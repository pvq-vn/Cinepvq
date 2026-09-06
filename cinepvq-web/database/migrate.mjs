import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Automatically load local .env files if present (Node.js 20+)
const projectRoot = path.resolve(__dirname, "..");
for (const envFile of [".env.local", ".env"]) {
  const fullPath = path.join(projectRoot, envFile);
  if (fs.existsSync(fullPath) && typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile(fullPath);
    } catch {
      // Ignored if syntax is non-standard
    }
  }
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ ERROR: DATABASE_URL is not set.");
  console.error("Please configure DATABASE_URL in your .env or .env.local file.");
  console.error("Example: DATABASE_URL=postgresql://cinepvq_user:cinepvq_dev_password@localhost:5432/cinepvq");
  process.exit(1);
}

const isSsl =
  connectionString.includes("sslmode=") ||
  connectionString.includes("supabase.co") ||
  (!connectionString.includes("localhost") && !connectionString.includes("127.0.0.1"));

// Strip sslmode from query string to prevent pg-connection-string from overriding rejectUnauthorized
const cleanConnectionString = connectionString
  .replace(/([?&])sslmode=[^&]+(&|$)/, (_, p1, p2) => (p1 === "?" && p2 ? "?" : ""))
  .replace(/\?$/, "");

const pool = new pg.Pool({
  connectionString: cleanConnectionString,
  ssl: isSsl ? { rejectUnauthorized: false } : undefined,
});

async function runMigrations() {
  const client = await pool.connect();
  console.log("🚀 Starting database migrations...");

  try {
    // 1. Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Read existing migrations
    const { rows: appliedRows } = await client.query("SELECT name FROM _migrations");
    const appliedNames = new Set(appliedRows.map((r) => r.name));

    // 3. Read migration files
    const migrationsDir = path.join(__dirname, "migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let appliedCount = 0;

    for (const file of files) {
      if (appliedNames.has(file)) {
        console.log(`  - Skipping already applied: ${file}`);
        continue;
      }

      console.log(`  → Applying migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf-8");

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`  ✓ Applied: ${file}`);
        appliedCount++;
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`❌ Failed applying migration ${file}:`, err);
        throw err;
      }
    }

    console.log(`\n🎉 Migration completed! ${appliedCount} migration(s) applied.`);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error("Fatal migration error:", err.message);
  process.exit(1);
});
