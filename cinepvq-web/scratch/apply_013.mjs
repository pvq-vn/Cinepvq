import fs from "fs";
import { query } from "../lib/db/client.ts";

async function apply() {
  const sql = fs.readFileSync("database/migrations/013_sync_auth_users.sql", "utf-8");
  console.log("Applying 013_sync_auth_users.sql...");
  await query(sql);
  console.log("Successfully applied 013_sync_auth_users.sql!");
  process.exit(0);
}

apply().catch(err => {
  console.error("Failed to apply migration:", err);
  process.exit(1);
});
