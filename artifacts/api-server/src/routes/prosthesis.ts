import { Router, type IRouter } from "express";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  clinicsTable,
  clinicPricesTable,
  db,
  doctorsTable,
  jobTimelineTable,
  labJobsTable,
  labSettingsTable,
  processesTable,
  techniciansTable,
} from "@workspace/db";
import {
  CreateClinicBody,
  CreateClinicResponse,
  CreateDoctorBody,
  CreateDoctorResponse,
  CreateJobBody,
  CreateJobResponse,
  GetClinicParams,
  GetClinicResponse,
  GetDashboardSummaryResponse,
  GetJobByQrParams,
  GetJobByQrResponse,
  GetJobParams,
  GetJobResponse,
  CreateProcessBody,
  CreateProcessResponse,
  DeleteProcessParams,
  ListClinicJobsParams,
  ListClinicJobsResponse,
  ListClinicsResponse,
  ListDoctorsQueryParams,
  ListDoctorsResponse,
  ListJobTimelineParams,
  ListJobTimelineResponse,
  ListJobsQueryParams,
  ListJobsResponse,
  ListProcessesResponse,
  UpdateJobStatusBody,
  UpdateJobStatusParams,
  UpdateJobStatusResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const stageLabels: Record<string, string> = {
  waiting_pickup: "Klinikten teslim alınmayı bekliyor",
  picked_up: "Kuryede",
  received_lab: "Laboratuvara ulaştı",
  in_production: "Üretimde",
  quality_check: "Kalite kontrolde",
  ready_delivery: "Teslime hazır",
  out_for_delivery: "Kliniğe teslim ediliyor",
  delivered: "Kliniğe teslim edildi",
};

// Laboratuvar ID'sine göre filtreleme destekli ortak iş seçici
async function selectJobs(labId?: number, where?: ReturnType<typeof eq> | ReturnType<typeof and>) {
  const conditions = [];
  if (where) {
    conditions.push(where);
  }

  return db
    .select({
      id: labJobsTable.id,
      jobNumber: labJobsTable.jobNumber,
      qrCode: labJobsTable.qrCode,
      clinicId: labJobsTable.clinicId,
      clinicName: clinicsTable.name,
      doctorId: labJobsTable.doctorId,
      doctorName: doctorsTable.name,
      patientName: labJobsTable.patientName,
      patientReference: labJobsTable.patientReference,
      prosthesisType: labJobsTable.prosthesisType,
      shade: labJobsTable.shade,
      priority: labJobsTable.priority,
      status: labJobsTable.status,
      currentStage: labJobsTable.currentStage,
      toothCount: labJobsTable.toothCount,
      unitPrice: labJobsTable.unitPrice,
      totalPrice: labJobsTable.totalPrice,
      assignedTechnicians: labJobsTable.assignedTechnicians,
      createdAt: labJobsTable.createdAt,
      dueDate: labJobsTable.dueDate,
      updatedAt: labJobsTable.updatedAt,
      notes: labJobsTable.notes,
    })
    .from(labJobsTable)
    .innerJoin(clinicsTable, eq(labJobsTable.clinicId, clinicsTable.id))
    .innerJoin(doctorsTable, eq(labJobsTable.doctorId, doctorsTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(labJobsTable.updatedAt));
}

async function getJobById(id: number) {
  const [job] = await selectJobs(eq(labJobsTable.id, id));
  return job;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

// -------------------------------------------------------------
// 1. DOKTOR VE KLİNİK GİRİŞ SİSTEMİ (AUTH)
// -------------------------------------------------------------
router.post("/auth/doctor-login", async (req, res): Promise<void> => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "Kullanıcı adı ve şifre gereklidir." });
    return;
  }

  const [doctor] = await db
    .select({
      id: doctorsTable.id,
      clinicId: doctorsTable.clinicId,
      name: doctorsTable.name,
      specialty: doctorsTable.specialty,
      email: doctorsTable.email,
      username: doctorsTable.username,
      password: doctorsTable.password,
      clinicName: clinicsTable.name,
    })
    .from(doctorsTable)
    .innerJoin(clinicsTable, eq(doctorsTable.clinicId, clinicsTable.id))
    .where(eq(doctorsTable.username, String(username).trim()));

  if (!doctor || doctor.password !== String(password).trim()) {
    res.status(401).json({ error: "Geçersiz kullanıcı adı veya şifre." });
    return;
  }

  const { password: _, ...doctorData } = doctor;
  res.json({ success: true, doctor: doctorData });
});

router.get("/doctor/:doctorId/jobs", async (req, res): Promise<void> => {
  const doctorId = Number(req.params.doctorId);
  const labId = req.query.labId ? Number(req.query.labId) : undefined;
  if (isNaN(doctorId)) {
    res.status(400).json({ error: "Geçersiz doktor ID." });
    return;
  }
  const jobs = await selectJobs(labId, eq(labJobsTable.doctorId, doctorId));
  const sanitized = jobs.map(({ unitPrice, totalPrice, ...rest }) => rest);
  res.json(sanitized);
});

// -------------------------------------------------------------
// 2. KLİNİĞE ÖZEL FİYATLANDIRMA VE FİNANS ENDPOINT'LERİ
// -------------------------------------------------------------
router.get("/clinics/:id/prices", async (req, res): Promise<void> => {
  const clinicId = Number(req.params.id);
  const prices = await db
    .select()
    .from(clinicPricesTable)
    .where(eq(clinicPricesTable.clinicId, clinicId))
    .orderBy(asc(clinicPricesTable.procedureType));
  res.json(prices);
});

router.post("/clinics/:id/prices", async (req, res): Promise<void> => {
  const clinicId = Number(req.params.id);
  const { procedureType, price } = req.body;
  if (!procedureType || price === undefined) {
    res.status(400).json({ error: "İşlem tipi ve fiyat zorunludur." });
    return;
  }

  const [existing] = await db
    .select()
    .from(clinicPricesTable)
    .where(
      and(
        eq(clinicPricesTable.clinicId, clinicId),
        eq(clinicPricesTable.procedureType, procedureType.trim()),
      ),
    );

  if (existing) {
    const [updated] = await db
      .update(clinicPricesTable)
      .set({ price: String(price) })
      .where(eq(clinicPricesTable.id, existing.id))
      .returning();
    res.json(updated);
    return;
  }

  const [created] = await db
    .insert(clinicPricesTable)
    .values({
      clinicId,
      procedureType: procedureType.trim(),
      price: String(price),
    })
    .returning();
  res.status(201).json(created);
});

router.delete("/clinics/prices/:priceId", async (req, res): Promise<void> => {
  const priceId = Number(req.params.priceId);
  await db.delete(clinicPricesTable).where(eq(clinicPricesTable.id, priceId));
  res.sendStatus(204);
});

router.get("/clinics/:id/finance-summary", async (req, res): Promise<void> => {
  const clinicId = Number(req.params.id);
  const labId = req.query.labId ? Number(req.query.labId) : undefined;
  
  const conditions = [eq(labJobsTable.clinicId, clinicId)];

  const jobs = await db
    .select({
      totalPrice: labJobsTable.totalPrice,
      createdAt: labJobsTable.createdAt,
    })
    .from(labJobsTable)
    .where(and(...conditions));

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let overallTotal = 0;
  let thisMonthTotal = 0;

  for (const job of jobs) {
    const amount = parseFloat(job.totalPrice || "0");
    overallTotal += amount;
    const d = new Date(job.createdAt);
    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
      thisMonthTotal += amount;
    }
  }

  res.json({
    clinicId,
    overallTotal: overallTotal.toFixed(2),
    thisMonthTotal: thisMonthTotal.toFixed(2),
    totalJobCount: jobs.length,
  });
});

// -------------------------------------------------------------
// 3. TEKNİSYEN VE BÖLÜM YÖNETİMİ
// -------------------------------------------------------------
router.get("/technicians", async (_req, res): Promise<void> => {
  const list = await db.select().from(techniciansTable).orderBy(asc(techniciansTable.name));
  res.json(list);
});

router.post("/technicians", async (req, res): Promise<void> => {
  const { name, department } = req.body;
  if (!name || !department) {
    res.status(400).json({ error: "Teknisyen adı ve departmanı zorunludur." });
    return;
  }
  const [created] = await db
    .insert(techniciansTable)
    .values({ name: name.trim(), department: department.trim() })
    .returning();
  res.status(201).json(created);
});

router.delete("/technicians/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  await db.delete(techniciansTable).where(eq(techniciansTable.id, id));
  res.sendStatus(204);
});

// -------------------------------------------------------------
// 4. LABORATUVAR AYARLARI
// -------------------------------------------------------------
router.get("/settings", async (_req, res): Promise<void> => {
  const [settings] = await db.select().from(labSettingsTable).limit(1);
  if (!settings) {
    res.json({ labName: "Dental Protez Laboratuvarı", logoUrl: "" });
    return;
  }
  res.json(settings);
});

router.post("/settings", async (req, res): Promise<void> => {
  const { labName, logoUrl } = req.body;
  const [existing] = await db.select().from(labSettingsTable).limit(1);

  if (existing) {
    const [updated] = await db
      .update(labSettingsTable)
      .set({
        labName: labName ?? existing.labName,
        logoUrl: logoUrl ?? existing.logoUrl,
        updatedAt: new Date(),
      })
      .where(eq(labSettingsTable.id, existing.id))
      .returning();
    res.json(updated);
    return;
  }

  const [created] = await db
    .insert(labSettingsTable)
    .values({
      labName: labName || "Dental Protez Laboratuvarı",
      logoUrl: logoUrl || "",
    })
    .returning();
  res.status(201).json(created);
});

// -------------------------------------------------------------
// SÜREÇLER, İŞLER VE KLİNİK METODLARI (LAB-ID FİLTRELİ)
// -------------------------------------------------------------
router.get("/processes", async (_req, res): Promise<void> => {
  const processes = await db
    .select()
    .from(processesTable)
    .orderBy(asc(processesTable.sortOrder), asc(processesTable.name));
  res.json(ListProcessesResponse.parse(processes));
});

router.post("/processes", async (req, res): Promise<void> => {
  const parsed = CreateProcessBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const name = parsed.data.name.trim();
  if (!name) {
    res.status(400).json({ error: "İşlem adı boş bırakılamaz." });
    return;
  }
  const [existing] = await db
    .select({ id: processesTable.id })
    .from(processesTable)
    .where(eq(processesTable.name, name));
  if (existing) {
    res.status(400).json({ error: "Bu işlem zaten kayıtlı." });
    return;
  }
  const current = await db.select({ id: processesTable.id }).from(processesTable);
  const [created] = await db
    .insert(processesTable)
    .values({
      key: `custom_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
      name,
      sortOrder: current.length + 1,
      isDefault: false,
    })
    .returning();
  res.status(201).json(CreateProcessResponse.parse(created));
});

router.delete("/processes/:id", async (req, res): Promise<void> => {
  const parsed = DeleteProcessParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [process] = await db
    .select()
    .from(processesTable)
    .where(eq(processesTable.id, parsed.data.id));
  if (!process) {
    res.status(404).json({ error: "İşlem bulunamadı." });
    return;
  }
  if (process.isDefault) {
    res.status(400).json({ error: "Varsayılan işlemler silinemez." });
    return;
  }
  await db.delete(processesTable).where(eq(processesTable.id, process.id));
  res.sendStatus(204);
});

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const labId = req.query.labId ? Number(req.query.labId) : undefined;
  const [jobs, processes] = await Promise.all([
    selectJobs(labId),
    db.select().from(processesTable).orderBy(asc(processesTable.sortOrder)),
  ]);
  const today = startOfToday();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const deliveredKey = processes.find((process) => process.key === "delivered")?.key ?? "delivered";
  const statusCounts = processes
    .map((process) => ({
      status: process.key,
      label: process.name,
      count: jobs.filter((job) => job.status === process.key).length,
    }))
    .filter((entry) => entry.count > 0);

  res.json(
    GetDashboardSummaryResponse.parse({
      activeJobs: jobs.filter((job) => job.status !== deliveredKey).length,
      dueToday: jobs.filter(
        (job) =>
          job.status !== deliveredKey &&
          job.dueDate >= today &&
          job.dueDate < tomorrow,
      ).length,
      waitingPickup: jobs.filter((job) => job.status === "waiting_pickup").length,
      readyForDelivery: jobs.filter((job) => job.status === "ready_delivery").length,
      statusCounts,
      recentJobs: jobs.slice(0, 5),
    }),
  );
});

router.get("/jobs", async (req, res): Promise<void> => {
  const labId = req.query.labId ? Number(req.query.labId) : undefined;
  const parsed = ListJobsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const conditions = [];
  if (parsed.data.status) conditions.push(eq(labJobsTable.status, parsed.data.status));
  if (parsed.data.clinicId) conditions.push(eq(labJobsTable.clinicId, parsed.data.clinicId));
  if (parsed.data.q) {
    conditions.push(
      or(
        ilike(labJobsTable.jobNumber, `%${parsed.data.q}%`),
        ilike(labJobsTable.patientName, `%${parsed.data.q}%`),
        ilike(labJobsTable.patientReference, `%${parsed.data.q}%`),
      ),
    );
  }

  const jobs = await selectJobs(labId, conditions.length ? and(...conditions) : undefined);
  res.json(ListJobsResponse.parse(jobs));
});

router.post("/jobs", async (req, res): Promise<void> => {
  const labId = req.body.labId ? Number(req.body.labId) : (req.query.labId ? Number(req.query.labId) : undefined);
  const parsed = CreateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const now = new Date();
  const [initialProcess] = await db
    .select()
    .from(processesTable)
    .where(eq(processesTable.key, "waiting_pickup"));
  const initialStatus = initialProcess?.key ?? "waiting_pickup";
  const initialLabel = initialProcess?.name ?? stageLabels.waiting_pickup;
  const jobNumber = `PT-${now.getFullYear()}-${String(Date.now()).slice(-6)}`;
  const qrCode = `PTK-${randomUUID().slice(0, 8).toUpperCase()}`;

  const toothCount = Number(req.body.toothCount) || 1;
  let unitPrice = "0.00";
  let totalPrice = "0.00";

  const [priceEntry] = await db
    .select()
    .from(clinicPricesTable)
    .where(
      and(
        eq(clinicPricesTable.clinicId, parsed.data.clinicId),
        eq(clinicPricesTable.procedureType, parsed.data.prosthesisType),
      ),
    );

  if (priceEntry) {
    unitPrice = priceEntry.price;
    totalPrice = (parseFloat(unitPrice) * toothCount).toFixed(2);
  }

  const assignedTechnicians = req.body.assignedTechnicians
    ? JSON.stringify(req.body.assignedTechnicians)
    : "{}";

  const [created] = await db
    .insert(labJobsTable)
    .values({
      ...parsed.data,
      jobNumber,
      qrCode,
      toothCount,
      unitPrice,
      totalPrice,
      assignedTechnicians,
      patientReference: parsed.data.patientReference ?? "",
      shade: parsed.data.shade ?? "Belirtilmedi",
      priority: parsed.data.priority ?? "Normal",
      status: initialStatus,
      currentStage: initialLabel,
      notes: parsed.data.notes ?? null,
    })
    .returning();

  await db.insert(jobTimelineTable).values({
    jobId: created.id,
    status: initialStatus,
    label: initialLabel,
    actor: "Sistem",
    actorRole: "system",
    note: "İş kaydı oluşturuldu.",
  });

  const job = await getJobById(created.id);
  res.status(201).json(CreateJobResponse.parse(job));
});

router.get("/jobs/qr/:qrCode", async (req, res): Promise<void> => {
  const labId = req.query.labId ? Number(req.query.labId) : undefined;
  const parsed = GetJobByQrParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [job] = await selectJobs(labId, eq(labJobsTable.qrCode, parsed.data.qrCode));
  if (!job) {
    res.status(404).json({ error: "İş bulunamadı." });
    return;
  }
  res.json(GetJobByQrResponse.parse(job));
});

router.get("/jobs/:id", async (req, res): Promise<void> => {
  const labId = req.query.labId ? Number(req.query.labId) : undefined;
  const parsed = GetJobParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const job = await getJobById(parsed.data.id);
  if (!job) {
    res.status(404).json({ error: "İş bulunamadı." });
    return;
  }
  res.json(GetJobResponse.parse(job));
});

router.patch("/jobs/:id/status", async (req, res): Promise<void> => {
  const labId = req.body.labId ? Number(req.body.labId) : (req.query.labId ? Number(req.query.labId) : undefined);
  const params = UpdateJobStatusParams.safeParse(req.params);
  const body = UpdateJobStatusBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [process] = await db
    .select()
    .from(processesTable)
    .where(eq(processesTable.key, body.data.status));
  const nextLabel = process?.name ?? stageLabels[body.data.status];
  if (!nextLabel) {
    res.status(400).json({ error: "Geçersiz iş durumu." });
    return;
  }

  const [updated] = await db
    .update(labJobsTable)
    .set({
      status: body.data.status,
      currentStage: nextLabel,
      updatedAt: new Date(),
    })
    .where(eq(labJobsTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "İş bulunamadı." });
    return;
  }

  await db.insert(jobTimelineTable).values({
    jobId: updated.id,
    status: body.data.status,
    label: nextLabel,
    actor: "Operasyon ekibi",
    actorRole: "lab",
    note: body.data.note ?? null,
  });

  const job = await getJobById(updated.id);
  res.json(UpdateJobStatusResponse.parse(job));
});

router.patch("/jobs/:id/technicians", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { assignedTechnicians } = req.body;
  const [updated] = await db
    .update(labJobsTable)
    .set({
      assignedTechnicians: JSON.stringify(assignedTechnicians || {}),
      updatedAt: new Date(),
    })
    .where(eq(labJobsTable.id, id))
    .returning();
  res.json(updated);
});

router.get("/jobs/:id/timeline", async (req, res): Promise<void> => {
  const parsed = ListJobTimelineParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const timeline = await db
    .select()
    .from(jobTimelineTable)
    .where(eq(jobTimelineTable.jobId, parsed.data.id))
    .orderBy(asc(jobTimelineTable.timestamp));
  res.json(ListJobTimelineResponse.parse(timeline));
});

router.get("/clinics", async (req, res): Promise<void> => {
  const labId = req.query.labId ? Number(req.query.labId) : undefined;
  
  // Sadece o laboratuvara ait işleri ve ilişkili verileri baz alalım
  const jobs = await selectJobs(labId);
  const clinics = await db.select().from(clinicsTable).orderBy(asc(clinicsTable.name));
  const doctors = await db.select().from(doctorsTable);

  const result = clinics.map((clinic) => ({
    ...clinic,
    doctorsCount: doctors.filter((doctor) => doctor.clinicId === clinic.id).length,
    activeJobs: jobs.filter(
      (job) => job.clinicId === clinic.id && job.status !== "delivered",
    ).length,
  }));
  res.json(ListClinicsResponse.parse(result));
});

router.post("/clinics", async (req, res): Promise<void> => {
  const parsed = CreateClinicBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [clinic] = await db
    .insert(clinicsTable)
    .values({
      name: parsed.data.name,
      code: parsed.data.code,
      address: parsed.data.address ?? "",
      phone: parsed.data.phone ?? "",
    })
    .returning();
  res.status(201).json(
    CreateClinicResponse.parse({
      ...clinic,
      doctorsCount: 0,
      activeJobs: 0,
    }),
  );
});

router.get("/clinics/:id", async (req, res): Promise<void> => {
  const labId = req.query.labId ? Number(req.query.labId) : undefined;
  const parsed = GetClinicParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [clinic] = await db.select().from(clinicsTable).where(eq(clinicsTable.id, parsed.data.id));
  if (!clinic) {
    res.status(404).json({ error: "Klinik bulunamadı." });
    return;
  }
  const [doctors, jobs] = await Promise.all([
    db.select().from(doctorsTable).where(eq(doctorsTable.clinicId, clinic.id)),
    selectJobs(labId, eq(labJobsTable.clinicId, clinic.id)),
  ]);
  res.json(
    GetClinicResponse.parse({
      ...clinic,
      doctorsCount: doctors.length,
      activeJobs: jobs.filter((job) => job.status !== "delivered").length,
      doctors,
    }),
  );
});

router.get("/clinics/:id/jobs", async (req, res): Promise<void> => {
  const labId = req.query.labId ? Number(req.query.labId) : undefined;
  const parsed = ListClinicJobsParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const jobs = await selectJobs(labId, eq(labJobsTable.clinicId, parsed.data.id));
  res.json(ListClinicJobsResponse.parse(jobs));
});

router.get("/doctors", async (req, res): Promise<void> => {
  const parsed = ListDoctorsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const doctors = await db
    .select()
    .from(doctorsTable)
    .where(parsed.data.clinicId ? eq(doctorsTable.clinicId, parsed.data.clinicId) : undefined)
    .orderBy(asc(doctorsTable.name));
  res.json(ListDoctorsResponse.parse(doctors));
});

router.post("/doctors", async (req, res): Promise<void> => {
  const parsed = CreateDoctorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const username = req.body.username || `dr_${randomUUID().slice(0, 6)}`;
  const password = req.body.password || "123456";

  const [doctor] = await db
    .insert(doctorsTable)
    .values({
      clinicId: parsed.data.clinicId,
      name: parsed.data.name,
      specialty: parsed.data.specialty ?? "Diş Hekimi",
      email: parsed.data.email ?? "",
      username,
      password,
    })
    .returning();
  res.status(201).json(CreateDoctorResponse.parse(doctor));
});

export default router;