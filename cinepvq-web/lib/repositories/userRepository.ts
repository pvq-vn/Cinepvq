// ==============================================================================
// lib/repositories/userRepository.ts
// User Account Data Access Layer
// ==============================================================================

import { query } from "@/lib/db/client";
import type { UserRow } from "@/lib/db/types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(id: string): boolean {
  return UUID_REGEX.test(id);
}

export const userRepository = {
  async findUserById(id: string): Promise<UserRow | null> {
    if (!isValidUuid(id)) return null;
    const res = await query<UserRow>("SELECT * FROM users WHERE id = $1 LIMIT 1", [
      id,
    ]);
    return res?.rows[0] ?? null;
  },

  async findUserByEmail(email: string): Promise<UserRow | null> {
    const res = await query<UserRow>(
      "SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [email]
    );
    return res?.rows[0] ?? null;
  },

  async findUserByUsername(username: string): Promise<UserRow | null> {
    const res = await query<UserRow>(
      "SELECT * FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1",
      [username]
    );
    return res?.rows[0] ?? null;
  },

  async createUser(data: {
    email: string;
    username: string;
    passwordHash: string;
    avatarUrl?: string;
    role?: "user" | "admin" | "moderator";
  }): Promise<UserRow | null> {
    const res = await query<UserRow>(
      `INSERT INTO users (email, username, password_hash, avatar_url, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        data.email.toLowerCase().trim(),
        data.username.trim(),
        data.passwordHash,
        data.avatarUrl ?? null,
        data.role ?? "user",
      ]
    );
    return res?.rows[0] ?? null;
  },

  /**
   * Ensure user exists in Supabase users table and return the user record.
   * Matches by UUID if valid, or by email. Creates user if neither exists.
   */
  async ensureUser(data: {
    id?: string;
    email: string;
    username?: string;
    avatarUrl?: string;
  }): Promise<UserRow | null> {
    const cleanEmail = data.email.toLowerCase().trim();
    const cleanUsername = (data.username || cleanEmail.split("@")[0]).trim();

    // 1. Try finding by ID if it's a valid UUID
    if (data.id && isValidUuid(data.id)) {
      const byId = await this.findUserById(data.id);
      if (byId) return byId;
    }

    // 2. Try finding by Email
    const byEmail = await this.findUserByEmail(cleanEmail);
    if (byEmail) return byEmail;

    // 3. Create user if not exists
    const res = await query<UserRow>(
      `INSERT INTO users (email, username, password_hash, avatar_url, role)
       VALUES ($1, $2, $3, $4, 'user')
       ON CONFLICT (email) DO UPDATE SET
         username = EXCLUDED.username
       RETURNING *`,
      [
        cleanEmail,
        cleanUsername,
        "$2a$10$local_auth_placeholder_hash_cinepvq_user",
        data.avatarUrl ?? null,
      ]
    );

    return res?.rows[0] ?? null;
  },

  /**
   * Update user profile details (username, avatarUrl).
   */
  async updateProfile(
    userId: string,
    data: { username?: string; avatarUrl?: string }
  ): Promise<UserRow | null> {
    if (!isValidUuid(userId)) return null;
    const updates: string[] = ["updated_at = CURRENT_TIMESTAMP"];
    const values: unknown[] = [userId];

    if (data.username !== undefined) {
      values.push(data.username.trim());
      updates.push(`username = $${values.length}`);
    }

    if (data.avatarUrl !== undefined) {
      values.push(data.avatarUrl ? data.avatarUrl.trim() : null);
      updates.push(`avatar_url = $${values.length}`);
    }

    const res = await query<UserRow>(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $1 RETURNING *`,
      values
    );
    return res?.rows[0] ?? null;
  },

  /**
   * Resolve a client-provided user identifier to a valid database UUID.
   */
  async resolveUserId(userIdentifier: string, email?: string): Promise<string | null> {
    if (!userIdentifier && !email) return null;

    if (userIdentifier && isValidUuid(userIdentifier)) {
      return userIdentifier;
    }

    if (email) {
      const user = await this.findUserByEmail(email);
      if (user) return user.id;
    }

    if (userIdentifier) {
      const user = await this.findUserByUsername(userIdentifier);
      if (user) return user.id;
    }

    return null;
  },
};
