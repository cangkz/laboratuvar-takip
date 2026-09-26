ALTER TABLE "clinics" ALTER COLUMN "lab_id" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "doctors" ALTER COLUMN "lab_id" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "lab_jobs" ALTER COLUMN "lab_id" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "lab_settings" ALTER COLUMN "lab_id" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "technicians" ALTER COLUMN "lab_id" SET DEFAULT 1;