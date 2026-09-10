import { Router } from "express";
import multer from "multer";
import { ListObjectsV2Command, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, getR2Bucket } from "../lib/r2Client.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// STL dosyalarını listele
router.get("/", async (req, res) => {
  try {
    const s3 = getR2Client();
    const bucket = getR2Bucket();

    const command = new ListObjectsV2Command({ Bucket: bucket });
    const response = await s3.send(command);

    const files = (response.Contents || []).map((item) => ({
      key: item.Key,
      size: item.Size,
      lastModified: item.LastModified,
    }));

    res.json(files);
  } catch (error: any) {
    console.error("STL listeleme hatası:", error);
    res.status(500).json({ error: "Dosyalar listelenemedi.", details: error.message });
  }
});

// Yeni STL dosyası yükle
router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Dosya yüklenmedi." });
    }

    const s3 = getR2Client();
    const bucket = getR2Bucket();

    // Türkçe karakter veya bozuk karakterleri temizleyip güvenli dosya adı oluşturalım
    const originalName = req.file.originalname || "dosya";
    const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${Date.now()}-${safeName}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype || "application/octet-stream",
    });

    await s3.send(command);
    res.status(201).json({ message: "Dosya başarıyla yüklendi.", key: fileName });
  } catch (error: any) {
    console.error("STL yükleme hatası:", error);
    res.status(500).json({ error: "Dosya yüklenemedi.", details: error.message || String(error) });
  }
});

// STL dosyası indir
router.get("/:key/download", async (req, res) => {
  try {
    const { key } = req.params;
    const s3 = getR2Client();
    const bucket = getR2Bucket();

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: decodeURIComponent(key),
    });

    const response = await s3.send(command);
    if (!response.Body) {
      return res.status(404).json({ error: "Dosya bulunamadı." });
    }

    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(key)}"` );
    if (response.ContentType) {
      res.setHeader("Content-Type", response.ContentType);
    }

    // Node stream'i Express response'a aktar
    const bodyStream = response.Body as any;
    bodyStream.pipe(res);
  } catch (error: any) {
    console.error("STL indirme hatası:", error);
    res.status(500).json({ error: "Dosya indirilemedi.", details: error.message });
  }
});

// STL dosyası sil
router.delete("/:key", async (req, res) => {
  try {
    const { key } = req.params;
    const s3 = getR2Client();
    const bucket = getR2Bucket();

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: decodeURIComponent(key),
    });

    await s3.send(command);
    res.json({ message: "Dosya başarıyla silindi." });
  } catch (error: any) {
    console.error("STL silme hatası:", error);
    res.status(500).json({ error: "Dosya silinemedi.", details: error.message });
  }
});

export default router;