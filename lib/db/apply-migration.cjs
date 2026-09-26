const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = fs.readFileSync('./drizzle/0001_wonderful_caretaker.sql', 'utf8');
const statements = sql.split('--> statement-breakpoint');

async function run() {
  for (const stmt of statements) {
    const trimmed = stmt.trim();
    if (!trimmed) continue;
    console.log('Running:', trimmed);
    await pool.query(trimmed);
  }
  console.log('Done.');
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
