// ==============================================================================
// lib/db/client.ts
// PostgreSQL Connection Pool & Query Layer for Next.js
// Server-Only Execution with Graceful Offline Degradation
// ==============================================================================

import { Pool, type QueryResult, type PoolClient, type QueryResultRow } from "pg";

const connectionString = process.env.DATABASE_URL;

const globalForDb = globalThis as unknown as {
  pgPool?: Pool;
};

export function isDbConfigured(): boolean {
  return Boolean(connectionString && connectionString.trim().length > 0);
}

export function getPool(): Pool | null {
  if (!isDbConfigured()) {
    return null;
  }

  if (!globalForDb.pgPool) {
    const isSsl =
      Boolean(
        connectionString?.includes("sslmode=") ||
        connectionString?.includes("supabase.co") ||
        (connectionString && !connectionString.includes("localhost") && !connectionString.includes("127.0.0.1"))
      );

    const cleanConnectionString = connectionString
      ?.replace(/([?&])sslmode=[^&]+(&|$)/, (_, p1, p2) => (p1 === "?" && p2 ? "?" : ""))
      .replace(/\?$/, "");

    globalForDb.pgPool = new Pool({
      connectionString: cleanConnectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl: isSsl ? { rejectUnauthorized: false } : undefined,
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
