import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env files
const projectRoot = path.resolve(__dirname, "..");
for (const envFile of [".env.local", ".env"]) {
  const fullPath = path.join(projectRoot, envFile);
  if (fs.existsSync(fullPath) && typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile(fullPath);
    } catch {
      // Ignore
    }
  }
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ ERROR: DATABASE_URL is not set.");
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

async function runSeed() {
  const client = await pool.connect();
  console.log("🌱 Running database seed...");

  try {
    const seedPath = path.join(__dirname, "seed.sql");
    const sql = fs.readFileSync(seedPath, "utf-8");

    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");

    console.log("✓ Seed data inserted successfully!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Failed to seed database:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runSeed().catch((err) => {
  console.error("Fatal seed error:", err.message);
  process.exit(1);
});
