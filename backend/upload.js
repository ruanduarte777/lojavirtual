const express = require("express");
const multer = require("multer");
const cloudinary = require("./cloudinary");

const router = express.Router();

// Multer em memória (não grava no disco)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

router.post("/", upload.single("imagem"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Envie um arquivo em 'imagem'." });

    const mimetype = req.file.mimetype || "";
    if (!mimetype.startsWith("image/")) {
      return res.status(400).json({ error: "Arquivo precisa ser uma imagem." });
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "lojavirtual",
          resource_type: "auto",
          transformation: [{ quality: "auto" }, { fetch_format: "auto" }],
        },
        (error, uploadResult) => {
          if (error) return reject(error);
          resolve(uploadResult);
        }
      );

      stream.end(req.file.buffer);
    });

    res.json({
      message: "Imagem enviada!",
      url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (error) {
    console.error("Erro upload:", error);
    res.status(500).json({ error: "Erro ao enviar imagem" });
  }
});

module.exports = router;