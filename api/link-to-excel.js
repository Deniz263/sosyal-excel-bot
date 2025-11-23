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

async function fetchInstagramData(userOrUrl) {
  // RapidAPI endpoint'inin parametre adı dokümanda nasıl yazıyorsa onu kullan
  // Bu API'de genelde: user_id_or_username_or_url
  const options = {
    method: "GET",
    url: process.env.INSTAGRAM_API_URL, // Örn: https://instagram-scraper-stable-api.p.rapidapi.com/user_posts
    params: {
      user_id_or_username_or_url: userOrUrl,
    },
    headers: {
      "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
      "X-RapidAPI-Host": process.env.INSTAGRAM_API_HOST,
    },
  };

  const response = await axios.request(options);
  const data = response.data;

  const username = data.user_data?.username || "";

  // Senin gönderdiğin JSON'a göre:
  // data.user_posts = [ { node: { code, image_versions2: { candidates: [ { url }, ... ] } } }, ... ]
  const rows = (data.user_posts || []).map((item) => {
    const node = item.node || {};
    const img = node.image_versions2?.candidates?.[0]?.url || "";
    const postUrl = `https://www.instagram.com/p/${node.code}/`;

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
