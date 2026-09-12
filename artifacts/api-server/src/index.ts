import { Router } from "express";
import multer from "multer";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { eq, desc } from "drizzle-orm";
import { db, labsTable, externalLabsTable, externalStlJobsTable } from "@workspace/db";
import stlRouter from "./routes/stl.js";
import healthRouter from "./routes/health.js";
import prosthesisRouter from "./routes/prosthesis.js";
import { getR2Client, getR2Bucket } from "./lib/r2Client.js";
import { signExternalLabToken, requireExternalLabAuth, type ExternalLabAuthedRequest } from "./middlewares/externalLabAuth.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use("/stl", stlRouter);
router.use(healthRouter);
router.use(prosthesisRouter);

// -------------------------------------------------------------
// SÜPER ADMIN: ANA LABORATUVAR HESAPLARI (labs)
// -------------------------------------------------------------
router.get("/admin/labs", async (_req, res) => {
  try {
    const rows = await db.select().from(labsTable);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Laboratuvarlar listelenirken hata oluştu." });
  }
});

router.post("/admin/labs", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Tüm alanlar zorunludur." });
  }

  try {
    const [existing] = await db.select().from(labsTable).where(eq(labsTable.email, email));
    if (existing) {
      return res.status(400).json({ error: "Bu e-posta adresiyle zaten bir laboratuvar kayıtlı." });
    }

    const [newLab] = await db.insert(labsTable).values({ name, email, password }).returning();
    res.json({ success: true, lab: newLab });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Laboratuvar kaydedilirken veritabanı hatası oluştu." });
  }
});

router.post("/auth/lab-login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const [lab] = await db.select().from(labsTable).where(eq(labsTable.email, email));

    if (!lab || lab.password !== password) {
      return res.status(401).json({ error: "Geçersiz e-posta veya şifre." });
    }

    res.json({
      success: true,
      lab: { id: lab.id, name: lab.name, email: lab.email },
      token: "saas-lab-token-" + lab.id,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Giriş yapılırken hata oluştu." });
  }
});

// -------------------------------------------------------------
// MERKEZ ADMIN: DIŞ LABORATUVAR YÖNETİMİ
// -------------------------------------------------------------
router.get("/admin/external-labs", async (_req, res) => {
  try {
    const rows = await db.select().from(externalLabsTable);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Dış laboratuvarlar listelenirken hata oluştu." });
  }
});

router.post("/admin/external-labs", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Tüm alanlar zorunludur." });
  }

  try {
    const [existing] = await db
      .select()
      .from(externalLabsTable)
      .where(eq(externalLabsTable.email, email));
    if (existing) {
      return res.status(400).json({ error: "Bu e-posta adresiyle zaten bir dış laboratuvar kayıtlı." });
    }

    const [newLab] = await db
      .insert(externalLabsTable)
      .values({ name, email, password })
      .returning();
    res.json({ success: true, lab: newLab });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Dış laboratuvar eklenirken hata oluştu." });
  }
});

// Merkez lab: gelen tüm dış STL gönderimlerini görür (kim gönderdi etiketiyle)
router.get("/admin/external-stls", async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: externalStlJobsTable.id,
        externalLabId: externalStlJobsTable.externalLabId,
        externalLabName: externalLabsTable.name,
        patientName: externalStlJobsTable.patientName,
        prosthesisType: externalStlJobsTable.prosthesisType,
        fileName: externalStlJobsTable.fileName,
        fileKey: externalStlJobsTable.fileKey,
        status: externalStlJobsTable.status,
        downloadedAt: externalStlJobsTable.downloadedAt,
        createdAt: externalStlJobsTable.createdAt,
      })
      .from(externalStlJobsTable)
      .innerJoin(externalLabsTable, eq(externalStlJobsTable.externalLabId, externalLabsTable.id))
      .orderBy(desc(externalStlJobsTable.createdAt));
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "STL dosyaları getirilemedi." });
  }
});

// Merkez lab: gelen bir STL'i indirir, indirilme zaman damgasını işaretler
router.get("/admin/external-stls/:id/download", async (req, res) => {
  const stlId = Number(req.params.id);
  try {
    const [job] = await db
      .select()
      .from(externalStlJobsTable)
      .where(eq(externalStlJobsTable.id, stlId));
    if (!job) {
      return res.status(404).json({ error: "Kayıt bulunamadı." });
    }

    await db
      .update(externalStlJobsTable)
      .set({ downloadedAt: new Date(), status: "İndirildi" })
      .where(eq(externalStlJobsTable.id, stlId));

    const s3 = getR2Client();
    const bucket = getR2Bucket();
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const command = new GetObjectCommand({ Bucket: bucket, Key: job.fileKey });
    const response = await s3.send(command);

    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(job.fileName)}"`);
    if (response.ContentType) res.setHeader("Content-Type", response.ContentType);
    (response.Body as any).pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Dosya indirilemedi." });
  }
});

// -------------------------------------------------------------
// DIŞ LABORATUVAR: GİRİŞ (JWT üretir)
// -------------------------------------------------------------
router.post("/auth/external-lab-login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const [lab] = await db
      .select()
      .from(externalLabsTable)
      .where(eq(externalLabsTable.email, email));

    if (!lab || lab.password !== password) {
      return res.status(401).json({ error: "Geçersiz e-posta veya şifre." });
    }

    const token = signExternalLabToken({ id: lab.id, name: lab.name, email: lab.email });
    res.json({
      success: true,
      lab: { id: lab.id, name: lab.name, email: lab.email },
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Giriş yapılırken hata oluştu." });
  }
});

export default router;