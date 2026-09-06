// ==============================================================================
// lib/repositories/settingsRepository.ts
// User Settings Database Repository Layer
// ==============================================================================

import { query } from "@/lib/db/client";
import { type UserSettingsRow, mapSettingsRowToAppSettings } from "@/lib/db/types";
import { userRepository } from "@/lib/repositories/userRepository";
import type { AppSettings } from "@/types/movie";

const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  autoPlay: true,
  soundEnabled: true,
  preferredQuality: "auto",
};

export const settingsRepository = {
  async getSettingsByUserId(userId: string): Promise<AppSettings> {
    const realUserId = await userRepository.resolveUserId(userId);
    if (!realUserId) return DEFAULT_SETTINGS;

    const res = await query<UserSettingsRow>(
      "SELECT * FROM user_settings WHERE user_id = $1 LIMIT 1",
      [realUserId]
    );

    if (!res || res.rows.length === 0) {
      return DEFAULT_SETTINGS;
    }

    return mapSettingsRowToAppSettings(res.rows[0]);
  },

  async upsertSettings(
    userId: string,
    partial: Partial<AppSettings>
  ): Promise<AppSettings> {
    const realUserId = await userRepository.resolveUserId(userId);
    if (!realUserId) return { ...DEFAULT_SETTINGS, ...partial };

    const current = await this.getSettingsByUserId(realUserId);
    const merged = { ...current, ...partial };

    const cleanTheme =
      merged.theme === "dark" || merged.theme === "light"
        ? merged.theme
        : "system";
    const cleanQuality =
      merged.preferredQuality === "HD" || merged.preferredQuality === "FHD"
        ? merged.preferredQuality
        : "auto";

    const res = await query<UserSettingsRow>(
      `INSERT INTO user_settings (user_id, theme, autoplay, sound_enabled, preferred_quality, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         theme = EXCLUDED.theme,
         autoplay = EXCLUDED.autoplay,
         sound_enabled = EXCLUDED.sound_enabled,
         preferred_quality = EXCLUDED.preferred_quality,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *;`,
      [
        realUserId,
        cleanTheme,
        Boolean(merged.autoPlay),
        Boolean(merged.soundEnabled),
        cleanQuality,
      ]
    );

    if (!res || res.rows.length === 0) {
      return merged;
    }

    return mapSettingsRowToAppSettings(res.rows[0]);
  },
};
