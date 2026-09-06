// ==============================================================================
// lib/repositories/notificationRepository.ts
// User Notifications Database Repository Layer
// ==============================================================================

import { query } from "@/lib/db/client";
import type { NotificationRow } from "@/lib/db/types";
import { userRepository } from "@/lib/repositories/userRepository";
import type { AppNotification } from "@/types/movie";

export const notificationRepository = {
  /**
   * Fetch personal + broadcast notifications.
   */
  async getNotificationsByUserId(userId?: string): Promise<AppNotification[]> {
    let sql: string;
    let params: unknown[];

    const realUserId = userId ? await userRepository.resolveUserId(userId) : null;

    if (realUserId) {
      sql = `SELECT * FROM notifications
             WHERE user_id = $1 OR user_id IS NULL
             ORDER BY created_at DESC
             LIMIT 50`;
      params = [realUserId];
    } else {
      sql = `SELECT * FROM notifications
             WHERE user_id IS NULL
             ORDER BY created_at DESC
             LIMIT 20`;
      params = [];
    }

    const res = await query<NotificationRow>(sql, params);
    if (!res) return [];

    return res.rows.map((row) => ({
      id: row.id,
      title: row.title,
      message: row.message,
      time: row.created_at.toLocaleDateString("vi-VN"),
      read: row.is_read,
      link: row.link ?? undefined,
    }));
  },

  async markAsRead(notificationId: string): Promise<boolean> {
    const res = await query(
      "UPDATE notifications SET is_read = TRUE WHERE id = $1",
      [notificationId]
    );
    return (res?.rowCount ?? 0) > 0;
  },

  async markAllAsRead(userId?: string): Promise<void> {
    if (userId) {
      const realUserId = await userRepository.resolveUserId(userId);
      if (realUserId) {
        await query(
          "UPDATE notifications SET is_read = TRUE WHERE user_id = $1 OR user_id IS NULL",
          [realUserId]
        );
      } else {
        await query("UPDATE notifications SET is_read = TRUE WHERE user_id IS NULL");
      }
    } else {
      await query("UPDATE notifications SET is_read = TRUE WHERE user_id IS NULL");
    }
  },

  async createNotification(data: {
    userId?: string;
    title: string;
    message: string;
    link?: string;
  }): Promise<AppNotification | null> {
    const realUserId = data.userId ? await userRepository.resolveUserId(data.userId) : null;
    const res = await query<NotificationRow>(
      `INSERT INTO notifications (user_id, title, message, link)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [realUserId, data.title, data.message, data.link ?? null]
    );

    if (!res || res.rows.length === 0) return null;
    const row = res.rows[0];

    return {
      id: row.id,
      title: row.title,
      message: row.message,
      time: row.created_at.toLocaleDateString("vi-VN"),
      read: row.is_read,
      link: row.link ?? undefined,
    };
  },
};
