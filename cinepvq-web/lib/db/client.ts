// ==============================================================================
// lib/db/client.ts
// PostgreSQL Connection Pool & Query Layer for Next.js
// Server-Only Execution with Graceful Offline Degradation
// ==============================================================================

import { Pool, type QueryResult, type PoolClient, type QueryResultRow } from "pg";

const globalForDb = globalThis as unknown as {
  pgPool?: Pool;
};

export function isDbConfigured(): boolean {
  const envUrl = process.env.DATABASE_URL;
  return Boolean(envUrl && envUrl.trim().length > 0);
}

/**
 * Normalizes and resolves the database connection string for serverless environments.
 * If the connection string points to a direct Supabase host (db.<ref>.supabase.co),
 * which only resolves over IPv6 and fails on Vercel Serverless (IPv4-only), it automatically
 * routes through the IPv4-compatible Supavisor Connection Pooler (aws-0-ap-southeast-1.pooler.supabase.com:6543).
 */
export function getCleanConnectionString(rawUrl?: string): string | null {
  if (!rawUrl || rawUrl.trim().length === 0) return null;

  let workingUrl = rawUrl.trim();

  try {
    const parsed = new URL(workingUrl);

    // Check if hostname is direct Supabase (db.<ref>.supabase.co) which is IPv6-only
    const directMatch = parsed.host.match(/^db\.([a-z0-9]+)\.supabase\.co(?::\d+)?$/i);
    if (directMatch) {
      const ref = directMatch[1];
      parsed.hostname = "aws-0-ap-southeast-1.pooler.supabase.com";
      parsed.port = "6543";
      if (!parsed.username.includes(".")) {
        parsed.username = `postgres.${ref}`;
      }
      workingUrl = parsed.toString();
    }
  } catch {
    // If URL parsing fails, retain raw string and attempt regex clean
  }

  // Strip sslmode from query string to prevent pg-connection-string from
  // overriding explicit ssl: { rejectUnauthorized: false } options.
  return workingUrl
    .replace(/([?&])sslmode=[^&]+(&|$)/, (_, p1, p2) => (p1 === "?" && p2 ? "?" : ""))
    .replace(/\?$/, "");
}

export function getPool(): Pool | null {
  if (!isDbConfigured()) {
    return null;
  }

  if (!globalForDb.pgPool) {
    const rawConnectionString = process.env.DATABASE_URL;
    const cleanConnectionString = getCleanConnectionString(rawConnectionString);

    if (!cleanConnectionString) {
      return null;
    }

    const isSsl = Boolean(
      cleanConnectionString.includes("sslmode=") ||
      cleanConnectionString.includes("supabase.co") ||
      cleanConnectionString.includes("supabase.com") ||
      cleanConnectionString.includes("pooler.supabase.com") ||
      (!cleanConnectionString.includes("localhost") && !cleanConnectionString.includes("127.0.0.1"))
    );

    globalForDb.pgPool = new Pool({
      connectionString: cleanConnectionString,
      max: process.env.NODE_ENV === "production" ? 3 : 5,
      idleTimeoutMillis: 15_000,
      connectionTimeoutMillis: 8_000,
      ssl: isSsl ? { rejectUnauthorized: false } : undefined,
      allowExitOnIdle: true,
    });

    globalForDb.pgPool.on("error", (err) => {
      console.error("[PostgreSQL Pool Error]", err.message);
    });
  }

  return globalForDb.pgPool;
}

/**
 * Execute a parameterized query safely against PostgreSQL.
 * If the database is not configured, returns null without throwing an unhandled exception.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T> | null> {
  const pool = getPool();
  if (!pool) {
    return null;
  }

  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    if (process.env.NODE_ENV === "development" && false) {
      const duration = Date.now() - start;
      console.log("[db:query]", { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error("[db:query error]", {
      message: error instanceof Error ? error.message : String(error),
      text,
    });
    throw error;
  }
}

/**
 * Run operations within a single database transaction.
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T | null> {
  const pool = getPool();
  if (!pool) {
    return null;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[db:transaction error]", err);
    throw err;
  } finally {
    client.release();
  }
}
