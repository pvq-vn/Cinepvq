import type { QueryResultRow } from "pg";
import {
  query,
  withTransaction,
  getPool,
  isDbConfigured,
  getCleanConnectionString,
} from "./client";

export {
  query,
  withTransaction,
  getPool,
  isDbConfigured,
  getCleanConnectionString,
};

export async function queryPg<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<{ rows: T[]; rowCount: number }> {
  const res = await query<T>(text, params);
  return {
    rows: res?.rows ?? [],
    rowCount: res?.rowCount ?? 0,
  };
}
