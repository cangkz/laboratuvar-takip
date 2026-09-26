CREATE TABLE IF NOT EXISTS "clinic_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"clinic_id" integer NOT NULL,
	"procedure_type" text NOT NULL,
	"price" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clinics" (
	"id" serial PRIMARY KEY NOT NULL,
	"lab_id" integer NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clinics_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "doctors" (
	"id" serial PRIMARY KEY NOT NULL,
	"lab_id" integer NOT NULL,
	"clinic_id" integer NOT NULL,
	"name" text NOT NULL,
	"specialty" text DEFAULT 'Diş Hekimi' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"username" text DEFAULT '' NOT NULL,
	"password" text DEFAULT '123456' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "external_labs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_labs_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "external_stl_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_lab_id" integer NOT NULL,
	"patient_name" text NOT NULL,
	"prosthesis_type" text DEFAULT '' NOT NULL,
	"file_name" text NOT NULL,
	"file_key" text NOT NULL,
	"status" text DEFAULT 'Bekliyor' NOT NULL,
	"downloaded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_timeline" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"status" text NOT NULL,
	"label" text NOT NULL,
	"actor" text NOT NULL,
	"actor_role" text NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lab_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"lab_id" integer NOT NULL,
	"job_number" text NOT NULL,
	"qr_code" text NOT NULL,
	"clinic_id" integer NOT NULL,
	"doctor_id" integer NOT NULL,
	"patient_name" text NOT NULL,
	"patient_reference" text DEFAULT '' NOT NULL,
	"prosthesis_type" text NOT NULL,
	"shade" text DEFAULT 'Belirtilmedi' NOT NULL,
	"priority" text DEFAULT 'Normal' NOT NULL,
	"status" text DEFAULT 'waiting_pickup' NOT NULL,
	"current_stage" text DEFAULT 'Klinikten teslim alınmayı bekliyor' NOT NULL,
	"tooth_count" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"total_price" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"assigned_technicians" text DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	CONSTRAINT "lab_jobs_job_number_unique" UNIQUE("job_number"),
	CONSTRAINT "lab_jobs_qr_code_unique" UNIQUE("qr_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lab_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"lab_id" integer NOT NULL,
	"lab_name" text DEFAULT 'Dental Protez Laboratuvarı' NOT NULL,
	"logo_url" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "labs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "labs_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "processes" (
	"id" serial PRIMARY KEY NOT NULL,
	"lab_id" integer,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "processes_key_unique" UNIQUE("key"),
	CONSTRAINT "processes_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "technicians" (
	"id" serial PRIMARY KEY NOT NULL,
	"lab_id" integer NOT NULL,
	"name" text NOT NULL,
	"department" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clinic_prices" ADD CONSTRAINT "clinic_prices_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clinics" ADD CONSTRAINT "clinics_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "doctors" ADD CONSTRAINT "doctors_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "doctors" ADD CONSTRAINT "doctors_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "external_stl_jobs" ADD CONSTRAINT "external_stl_jobs_external_lab_id_external_labs_id_fk" FOREIGN KEY ("external_lab_id") REFERENCES "public"."external_labs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_timeline" ADD CONSTRAINT "job_timeline_job_id_lab_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."lab_jobs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lab_jobs" ADD CONSTRAINT "lab_jobs_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lab_jobs" ADD CONSTRAINT "lab_jobs_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lab_jobs" ADD CONSTRAINT "lab_jobs_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lab_settings" ADD CONSTRAINT "lab_settings_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "processes" ADD CONSTRAINT "processes_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "technicians" ADD CONSTRAINT "technicians_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
