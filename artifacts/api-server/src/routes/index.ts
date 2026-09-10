import { Router } from "express";
import stlRouter from "./stl.js";
import healthRouter from "./health.js";
import prosthesisRouter from "./prosthesis.js";
import { db, labs, externalLabs, externalStls } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// Diğer rotaların yanı sıra stl router'ı ekliyoruz
router.use("/stl", stlRouter);
router.use(healthRouter);
router.use(prosthesisRouter);

// Super Admin: Kayıtlı laboratuvarları veritabanından listele
router.get("/admin/labs", async (req, res) => {
  try {
    const allLabs = await db.select().from(labs);
    res.json(allLabs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Laboratuvarlar listelenirken hata oluştu." });
  }
});

// Super Admin: Yeni laboratuvar oluştur (Kalıcı Veritabanı Kaydı)
router.post("/admin/labs", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Tüm alanlar zorunludur." });
  }

  try {
    // Aynı e-posta ile kayıt var mı kontrolü (Veritabanından)
    const existing = await db.select().from(labs).where(eq(labs.email, email));
    if (existing.length > 0) {
      return res.status(400).json({ error: "Bu e-posta adresiyle zaten bir laboratuvar kayıtlı." });
    }

    // Veritabanına kalıcı olarak ekle
    const [newLab] = await db.insert(labs).values({
      name,
      email,
      password,
    }).returning();

    res.json({ success: true, lab: newLab });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Laboratuvar kaydedilirken veritabanı hatası oluştu." });
  }
});

// Laboratuvar Giriş (Login) Ucu (Veritabanı Kontrollü)
router.post("/auth/lab-login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const [lab] = await db.select().from(labs).where(eq(labs.email, email));

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


// --- B2B LAB-TO-LAB: Dış Laboratuvar Yönetimi ve STL Takibi ---

// Merkez Admin: Dış laboratuvarları listele
router.get("/admin/external-labs", async (req, res) => {
  try {
    const list = await db.select().from(externalLabs);
    res.json(list);
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
    const existing = await db.select().from(externalLabs).where(eq(externalLabs.email, email));
    if (existing.length > 0) {
      return res.status(400).json({ error: "Bu e-posta adresiyle zaten bir dış laboratuvar kayıtlı." });
    }

    const [newLab] = await db.insert(externalLabs).values({ name, email, password }).returning();
    res.json({ success: true, lab: newLab });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Dış laboratuvar eklenirken hata oluştu." });
  }
});

// Merkez Lab: Gelen tüm dış STL dosyalarını listele
router.get("/admin/external-stls", async (req, res) => {
  try {
    const list = await db.select().from(externalStls);
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "STL dosyaları getirilemedi." });
  }
});

// Merkez Lab: Dışarıdan gelen STL dosyasını indir ve downloadedAt damgası vur
router.post("/admin/external-stls/:id/download", async (req, res) => {
  const stlId = Number(req.params.id);
  try {
    const [updated] = await db.update(externalStls)
      .set({ 
        downloadedAt: new Date(),
        status: "İndirildi" 
      })
      .where(eq(externalStls.id, stlId))
      .returning();

    res.json({ success: true, stl: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Dosya indirme durumu güncellenemedi." });
  }
});

// Dış Laboratuvar: Giriş Ucu
router.post("/auth/external-lab-login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const [lab] = await db.select().from(externalLabs).where(eq(externalLabs.email, email));

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
    const [stlRecord] = await db.insert(externalStls).values({
      externalLabId,
      patientName,
      fileName,
      fileUrl,
      status: "Bekliyor"
    }).returning();

    res.json({ success: true, stl: stlRecord });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "STL yüklenirken hata oluştu." });
  }
});

// Dış Laboratuvar: Kendi gönderdiği STL'leri ve merkez labın indirme (downloadedAt) durumunu listele
router.get("/external-lab/stls/:labId", async (req, res) => {
  const labId = Number(req.params.labId);
  try {
    const stls = await db.select().from(externalStls).where(eq(externalStls.externalLabId, labId));
    res.json(stls);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Dosyalar listelenemedi." });
  }
});

export default router;