import { Router } from "express";
import stlRouter from "./stl.js";
import healthRouter from "./health.js";
import prosthesisRouter from "./prosthesis.js";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

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
    return res.status(400).json({ error: "Tüm alanlar zorunludur." });
  }

  try {
    const existing = await db.execute(sql`SELECT * FROM labs WHERE email = ${email}`);
    const rows = existing.rows || existing;
    if (rows.length > 0) {
      return res.status(400).json({ error: "Bu e-posta adresiyle zaten bir laboratuvar kayıtlı." });
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
      return res.status(401).json({ error: "Geçersiz e-posta veya şifre." });
    }

    res.json({
      success: true,
      lab: { id: lab.id, name: lab.name, email: lab.email },
      token: "saas-lab-token-" + lab.id
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
    return res.status(400).json({ error: "Tüm alanlar zorunludur." });
  }

  try {
    const existing = await db.execute(sql`SELECT * FROM external_labs WHERE email = ${email}`);
    const rows = existing.rows || existing;
    if (rows.length > 0) {
      return res.status(400).json({ error: "Bu e-posta adresiyle zaten bir dış laboratuvar kayıtlı." });
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
      return res.status(401).json({ error: "Geçersiz e-posta veya şifre." });
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

// Dış Laboratuvar: Yeni STL dosyası yükle/gönder
router.post("/external-lab/stls", async (req, res) => {
  const { externalLabId, patientName, fileName, fileUrl } = req.body;
  if (!externalLabId || !patientName || !fileName || !fileUrl) {
    return res.status(400).json({ error: "Eksik alan bıraktınız." });
  }

  try {
    const result = await db.execute(
      sql`INSERT INTO external_stls (external_lab_id, patient_name, file_name, file_url, status) VALUES (${externalLabId}, ${patientName}, ${fileName}, ${fileUrl}, 'Bekliyor') RETURNING *`
    );
    res.json({ success: true, stl: (result.rows || result)[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "STL yüklenirken hata oluştu." });
  }
});

// Dış Laboratuvar: Kendi gönderdiği STL'leri listele
router.get("/external-lab/stls/:labId", async (req, res) => {
  const labId = Number(req.params.labId);
  try {
    const result = await db.execute(sql`SELECT * FROM external_stls WHERE external_lab_id = ${labId}`);
    res.json(result.rows || result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Dosyalar listelenemedi." });
  }
});

export default router;