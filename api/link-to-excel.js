// api/link-to-excel.js
const XLSX = require("xlsx");
const axios = require("axios");

module.exports = async (req, res) => {
  try {
    const { url } = req.query; // /api/link-to-excel?url=...

    if (!url) {
      res
        .status(400)
        .send(
          "Lütfen ?url= parametresi ile Instagram kullanıcı adı veya profil linki gönderin."
        );
      return;
    }

    // Şimdilik sadece Instagram destekliyoruz
    const rows = await fetchInstagramData(url);

    if (!rows || rows.length === 0) {
      res.status(404).send("Bu kullanıcıya ait post bulunamadı.");
      return;
    }

    // Excel oluştur
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Veriler");

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    // İndirme cevabı
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="instagram_postlari.xlsx"'
    );
    res.status(200).send(buffer);
  } catch (err) {
    console.error("link-to-excel hata:", err?.response?.data || err.message);
    res.status(500).send("Sunucu hatası.");
  }
};

// -------- Instagram RapidAPI entegrasyonu --------
// -------- Instagram RapidAPI entegrasyonu --------

async function fetchInstagramData(userOrUrl) {
  // 1) Girdiği metinden kullanıcı adını ayıkla
  let query = (userOrUrl || "").trim();

  // Eğer tam profil linki geldiyse (https://www.instagram.com/instagram/ gibi)
  if (query.includes("instagram.com")) {
    const match = query.match(/instagram\.com\/([^\/\?\s]+)/i);
    if (match && match[1]) {
      query = match[1]; // sadece "instagram" kısmı
    }
  }

  // 2) RapidAPI isteği
  const options = {
    method: "GET",
    url: process.env.INSTAGRAM_API_URL,
    params: {
      // API'nin hangi ismi kullandığından emin değilsek ikisini de gönderiyoruz
      user_id_or_username_or_url: query,
      username_or_id_or_url: query,
    },
    headers: {
      "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
      "X-RapidAPI-Host": process.env.INSTAGRAM_API_HOST,
    },
  };

  const response = await axios.request(options);
  const data = response.data || {};

  const username = data.user_data?.username || query;

  // Beklediğimiz yapı:
  // data.user_posts = [ { node: { code, image_versions2: { candidates: [ { url } ] } } }, ... ]
  const postsArray = data.user_posts || [];

  const rows = postsArray.map((item) => {
    const node = item.node || {};
    const img = node.image_versions2?.candidates?.[0]?.url || "";
    const postUrl = node.code
      ? `https://www.instagram.com/p/${node.code}/`
      : "";

    return {
      platform: "instagram",
      username,
      post_url: postUrl,
      image_url: img,
      likes: "", // Bu endpoint beğeni göndermiyor, şimdilik boş
      comments: "",
      caption: "",
      created_at: "",
    };
  });

  return rows;
}
