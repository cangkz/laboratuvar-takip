import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import stlRouter from "./stl.js";
import healthRouter from "./health.js";
import prosthesisRouter from "./prosthesis.js";
import { db, externalStlJobsTable } from "@workspace/db";
import { sql, eq, desc } from "drizzle-orm";
import { signLabToken } from "../middlewares/labAuth.js";
import { requireExternalLabAuth, type ExternalLabAuthedRequest } from "../middlewares/externalLabAuth.js";
import { getR2Client, getR2Bucket } from "../lib/r2Client.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use("/stl", stlRouter);
router.use(healthRouter);
router.use(prosthesisRouter);

// Super Admin: Kayıtlı laboratuvarları listele
router.get("/admin/labs", async (req, res) => {
  try {
    const result = await db.execute(sql`SELECT * FROM labs`);
    res.json(result.rows || result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Laboratuvarlar listelenirken hata oluştu." });
  }
});

// Super Admin: Yeni laboratuvar oluştur
router.post("/admin/labs", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    res.status(400).json({ error: "Tüm alanlar zorunludur." });
    return;
  }

  try {
    const existing = await db.execute(sql`SELECT * FROM labs WHERE email = ${email}`);
    const rows = existing.rows || existing;
    if (rows.length > 0) {
      res.status(400).json({ error: "Bu e-posta adresiyle zaten bir laboratuvar kayıtlı." });
      return;
    }

    const result = await db.execute(
      sql`INSERT INTO labs (name, email, password) VALUES (${name}, ${email}, ${password}) RETURNING *`
    );
    const newLab = (result.rows || result)[0];
    res.json({ success: true, lab: newLab });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Laboratuvar kaydedilirken veritabanı hatası oluştu." });
  }
});

// Laboratuvar Giriş
router.post("/auth/lab-login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await db.execute(sql`SELECT * FROM labs WHERE email = ${email}`);
    const lab = (result.rows || result)[0];

    if (!lab || lab.password !== password) {
      res.status(401).json({ error: "Geçersiz e-posta veya şifre." });
      return;
    }

    res.json({
      success: true,
      lab: { id: lab.id, name: lab.name, email: lab.email },
      // Önceden sahte bir string ("saas-lab-token-" + lab.id) dönüyordu ve
      // hiçbir middleware bunu doğrulamıyordu. Artık gerçek, imzalı bir JWT
      // dönüyoruz; requireLabAuth bunu doğrulayıp req.lab olarak set ediyor.
      token: signLabToken({ id: Number(lab.id), name: String(lab.name), email: String(lab.email) }),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Giriş yapılırken hata oluştu." });
  }
});

// Merkez Admin: Dış laboratuvarları listele
router.get("/admin/external-labs", async (req, res) => {
  try {
    const result = await db.execute(sql`SELECT * FROM external_labs`);
    res.json(result.rows || result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Dış laboratuvarlar listelenirken hata oluştu." });
  }
});

// Merkez Admin: Yeni dış laboratuvar hesabı oluştur
router.post("/admin/external-labs", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    res.status(400).json({ error: "Tüm alanlar zorunludur." });
    return;
  }

  try {
    const existing = await db.execute(sql`SELECT * FROM external_labs WHERE email = ${email}`);
    const rows = existing.rows || existing;
    if (rows.length > 0) {
      res.status(400).json({ error: "Bu e-posta adresiyle zaten bir dış laboratuvar kayıtlı." });
      return;
    }

    const result = await db.execute(
      sql`INSERT INTO external_labs (name, email, password) VALUES (${name}, ${email}, ${password}) RETURNING *`
    );
    res.json({ success: true, lab: (result.rows || result)[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Dış laboratuvar eklenirken hata oluştu." });
  }
});

// Merkez Lab: Gelen tüm dış STL dosyalarını listele
router.get("/admin/external-stls", async (req, res) => {
  try {
    const result = await db.execute(sql`SELECT * FROM external_stls`);
    res.json(result.rows || result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "STL dosyaları getirilemedi." });
  }
});

// Merkez Lab: Dışarıdan gelen STL dosyasını indir ve downloadedAt damgası vur
router.post("/admin/external-stls/:id/download", async (req, res) => {
  const stlId = Number(req.params.id);
  try {
    const result = await db.execute(
      sql`UPDATE external_stls SET downloaded_at = ${new Date()}, status = 'İndirildi' WHERE id = ${stlId} RETURNING *`
    );
    res.json({ success: true, stl: (result.rows || result)[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Dosya indirme durumu güncellenemedi." });
  }
});

// Dış Laboratuvar: Giriş Ucu
router.post("/auth/external-lab-login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await db.execute(sql`SELECT * FROM external_labs WHERE email = ${email}`);
    const lab = (result.rows || result)[0];

    if (!lab || lab.password !== password) {
      res.status(401).json({ error: "Geçersiz e-posta veya şifre." });
      return;
    }

    res.json({
      success: true,
      lab: { id: lab.id, name: lab.name, email: lab.email },
      token: "ext-lab-token-" + lab.id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Giriş yapılırken hata oluştu." });
  }
});

// Dış Laboratuvar: Yeni iş ve STL dosyası gönder
// NOT: Bu route önceden JSON body ({ externalLabId, fileUrl, ... }) bekliyordu ve
// hiç auth kontrolü yapmıyordu; ama frontend (external-lab-page.tsx) multipart
// form-data (gerçek dosya) ve Bearer token gönderiyordu — ikisi hiç uyuşmuyordu.
// Şimdi stl.ts'deki R2 upload deseniyle aynı şekilde çalışıyor: dosya doğrudan
// Cloudflare R2'ye yükleniyor, kayıt externalStlJobsTable'a ekleniyor.
router.post(
  "/external-lab/stls",
  requireExternalLabAuth,
  upload.single("file"),
  async (req: ExternalLabAuthedRequest, res) => {
    try {
      const { patientName, prosthesisType } = req.body;
      if (!patientName || !req.file) {
        res.status(400).json({ error: "Eksik alan bıraktınız." });
        return;
      }

      const s3 = getR2Client();
      const bucket = getR2Bucket();
      const originalName = req.file.originalname || "dosya";
      const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, "_");
      const fileKey = `external/${Date.now()}-${randomUUID().slice(0, 8)}-${safeName}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: fileKey,
          Body: req.file.buffer,
          ContentType: req.file.mimetype || "application/octet-stream",
        })
      );

      const [created] = await db
        .insert(externalStlJobsTable)
        .values({
          externalLabId: req.externalLab!.id,
          patientName,
          prosthesisType: prosthesisType || "",
          fileName: originalName,
          fileKey,
        })
        .returning();

      res.status(201).json({ success: true, job: created });
    } catch (err: any) {
      console.error("Dış laboratuvar STL yükleme hatası:", err);
      res.status(500).json({ error: "STL yüklenirken hata oluştu.", details: err.message });
    }
  },
);

// Dış Laboratuvar: Kendi gönderdiği STL'leri listele
router.get(
  "/external-lab/stls",
  requireExternalLabAuth,
  async (req: ExternalLabAuthedRequest, res) => {
    try {
      const jobs = await db
        .select()
        .from(externalStlJobsTable)
        .where(eq(externalStlJobsTable.externalLabId, req.externalLab!.id))
        .orderBy(desc(externalStlJobsTable.createdAt));
      res.json(jobs);
    } catch (err: any) {
      console.error("Dış laboratuvar STL listeleme hatası:", err);
      res.status(500).json({ error: "Dosyalar listelenemedi." });
    }
  },
);

export default router;