import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

// 1. KLİNİKLER
export const clinicsTable = pgTable("clinics", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  address: text("address").notNull().default(""),
  phone: text("phone").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 2. DOKTORLAR (Kendi Giriş Bilgileriyle)
export const doctorsTable = pgTable("doctors", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").notNull().references(() => clinicsTable.id),
  name: text("name").notNull(),
  specialty: text("specialty").notNull().default("Diş Hekimi"),
  email: text("email").notNull().default(""),
  username: text("username").notNull().default(""),
  password: text("password").notNull().default("123456"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 3. KLİNİĞE ÖZEL FİYATLANDIRMA (Sadece Lab Görür)
export const clinicPricesTable = pgTable("clinic_prices", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").notNull().references(() => clinicsTable.id),
  procedureType: text("procedure_type").notNull(), // Örn: 'Zirkonyum', 'Porselen Kron', 'E-Max'
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0.00"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 4. BÖLÜM VE TEKNİSYENLER (İşi Yapan Kişiler)
export const techniciansTable = pgTable("technicians", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // Örn: 'Can', 'Yavuz'
  department: text("department").notNull(), // Örn: 'Porselen', 'CAD-CAM Tasarım'
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 5. İŞ EMRİ TABLOSU
export const labJobsTable = pgTable("lab_jobs", {
  id: serial("id").primaryKey(),
  jobNumber: text("job_number").notNull().unique(),
  qrCode: text("qr_code").notNull().unique(),
  clinicId: integer("clinic_id").notNull().references(() => clinicsTable.id),
  doctorId: integer("doctor_id").notNull().references(() => doctorsTable.id),
  patientName: text("patient_name").notNull(),
  patientReference: text("patient_reference").notNull().default(""),
  prosthesisType: text("prosthesis_type").notNull(),
  shade: text("shade").notNull().default("Belirtilmedi"),
  priority: text("priority").notNull().default("Normal"),
  status: text("status").notNull().default("waiting_pickup"),
  currentStage: text("current_stage").notNull().default("Klinikten teslim alınmayı bekliyor"),

  // Fiyatlandırma Alanları
  toothCount: integer("tooth_count").notNull().default(1),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull().default("0.00"),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull().default("0.00"),

  // Aşamalardaki Sorumlu Kişiler (JSON string: {"CAD-CAM": "Yavuz", "Porselen": "Can"})
  assignedTechnicians: text("assigned_technicians").default("{}"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  notes: text("notes"),
});

// 6. ZAMAN ÇİZELGESİ / GEÇMİŞ
export const jobTimelineTable = pgTable("job_timeline", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => labJobsTable.id),
  status: text("status").notNull(),
  label: text("label").notNull(),
  actor: text("actor").notNull(),
  actorRole: text("actor_role").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  note: text("note"),
});

// 7. AŞAMA / SÜREÇLER
export const processesTable = pgTable("processes", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 8. LABORATUVAR AYARLARI (İsim ve Logo)
export const labSettingsTable = pgTable("lab_settings", {
  id: serial("id").primaryKey(),
  labName: text("lab_name").notNull().default("Dental Protez Laboratuvarı"),
  logoUrl: text("logo_url").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// 9. SAAS LABORATUVAR HESAPLARI (Ana Panel Girişi)
export const labsTable = pgTable("labs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 10. DIŞ LABORATUVAR HESAPLARI (İş Gönderen Ortaklar)
export const externalLabsTable = pgTable("external_labs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 11. DIŞ LABORATUVARLARDAN GELEN STL GÖNDERİMLERİ
export const externalStlJobsTable = pgTable("external_stl_jobs", {
  id: serial("id").primaryKey(),
  externalLabId: integer("external_lab_id").notNull().references(() => externalLabsTable.id),
  patientName: text("patient_name").notNull(),
  prosthesisType: text("prosthesis_type").notNull().default(""),
  fileName: text("file_name").notNull(),
  fileKey: text("file_key").notNull(),
  status: text("status").notNull().default("Bekliyor"),
  downloadedAt: timestamp("downloaded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// INSERT ŞEMALARI
export const insertClinicSchema = createInsertSchema(clinicsTable).omit({ id: true, createdAt: true });
export const insertDoctorSchema = createInsertSchema(doctorsTable).omit({ id: true, createdAt: true });
export const insertClinicPriceSchema = createInsertSchema(clinicPricesTable).omit({ id: true, createdAt: true });
export const insertTechnicianSchema = createInsertSchema(techniciansTable).omit({ id: true, createdAt: true });
export const insertLabJobSchema = createInsertSchema(labJobsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProcessSchema = createInsertSchema(processesTable).omit({ id: true, createdAt: true });
export const insertLabSettingsSchema = createInsertSchema(labSettingsTable).omit({ id: true, updatedAt: true });
export const insertLabSchema = createInsertSchema(labsTable).omit({ id: true, createdAt: true });
export const insertExternalLabSchema = createInsertSchema(externalLabsTable).omit({ id: true, createdAt: true });
export const insertExternalStlJobSchema = createInsertSchema(externalStlJobsTable).omit({ id: true, createdAt: true, downloadedAt: true, status: true });

// TİPLER
export type Clinic = typeof clinicsTable.$inferSelect;
export type Doctor = typeof doctorsTable.$inferSelect;
export type ClinicPrice = typeof clinicPricesTable.$inferSelect;
export type Technician = typeof techniciansTable.$inferSelect;
export type LabJob = typeof labJobsTable.$inferSelect;
export type TimelineEntry = typeof jobTimelineTable.$inferSelect;
export type Process = typeof processesTable.$inferSelect;
export type LabSettings = typeof labSettingsTable.$inferSelect;
export type Lab = typeof labsTable.$inferSelect;
export type ExternalLab = typeof externalLabsTable.$inferSelect;
export type ExternalStlJob = typeof externalStlJobsTable.$inferSelect;

export type InsertClinic = z.infer<typeof insertClinicSchema>;
export type InsertDoctor = z.infer<typeof insertDoctorSchema>;
export type InsertClinicPrice = z.infer<typeof insertClinicPriceSchema>;
export type InsertTechnician = z.infer<typeof insertTechnicianSchema>;
export type InsertLabJob = z.infer<typeof insertLabJobSchema>;
export type InsertProcess = z.infer<typeof insertProcessSchema>;
export type InsertLabSettings = z.infer<typeof insertLabSettingsSchema>;
export type InsertLab = z.infer<typeof insertLabSchema>;
export type InsertExternalLab = z.infer<typeof insertExternalLabSchema>;
export type InsertExternalStlJob = z.infer<typeof insertExternalStlJobSchema>;