const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const statements = [
  `ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "lab_id" integer NOT NULL DEFAULT 1 REFERENCES "labs"("id")`,
  `ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "lab_id" integer NOT NULL DEFAULT 1 REFERENCES "labs"("id")`,
  `ALTER TABLE "technicians" ADD COLUMN IF NOT EXISTS "lab_id" integer NOT NULL DEFAULT 1 REFERENCES "labs"("id")`,
  `ALTER TABLE "lab_jobs" ADD COLUMN IF NOT EXISTS "lab_id" integer NOT NULL DEFAULT 1 REFERENCES "labs"("id")`,
  `ALTER TABLE "lab_settings" ADD COLUMN IF NOT EXISTS "lab_id" integer NOT NULL DEFAULT 1 REFERENCES "labs"("id")`,
  `ALTER TABLE "processes" ADD COLUMN IF NOT EXISTS "lab_id" integer REFERENCES "labs"("id")`,
];

async function run() {
  for (const stmt of statements) {
    console.log('Running:', stmt);
    await pool.query(stmt);
  }
  console.log('Done. lab_id columns added successfully.');
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
