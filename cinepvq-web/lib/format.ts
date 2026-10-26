/**
 * Normalizes episode display label to prevent duplicate "Tập Tập" or raw slug "tap-01" prefixes.
 *
 * Examples:
 * - "Tập 01" -> "Tập 01"
 * - "Tập Tập 01" -> "Tập 01"
 * - "Tập tap-01" -> "Tập 01"
 * - "tap-01" -> "Tập 01"
 * - "tap-1" -> "Tập 01"
 * - "01" -> "Tập 01"
 * - "1" -> "Tập 01"
 * - "Full" / "tap-full" / "Tập Full" -> "Tập Full"
 * - "Hoàn Tất (16/16)" -> "Hoàn Tất (16/16)"
 */
export function normalizeEpisodeLabel(
  name?: string | null,
  fallbackSlug?: string | null
): string {
  const raw = (name || fallbackSlug || "").normalize("NFC").trim();
  if (!raw) return "";

  // Handle "full" variations
  if (/^(?:(?:tập|tap|ep|episode)[\s\-_:.]*)*full$/i.test(raw)) {
    return "Tập Full";
  }

  // Repeatedly strip leading "Tập", "tap", "ep", "episode" prefixes (with spaces, hyphens, underscores, colons)
  const prefixRegex = /^(?:(?:tập|tap|episode|ep)(?:[\s\-_:.]+|(?=\d)))+/i;
  if (prefixRegex.test(raw)) {
    const rest = raw.replace(prefixRegex, "").trim();
    if (!rest) return "Tập";

    if (/^full$/i.test(rest)) {
      return "Tập Full";
    }

    // If rest starts with a number (e.g. "1", "01", "1 (End)", "05 - Phần 2")
    const numMatch = rest.match(/^(\d+)(.*)$/);
    if (numMatch) {
      const paddedNum = numMatch[1].padStart(2, "0");
      const suffix = numMatch[2] ? numMatch[2] : "";
      return `Tập ${paddedNum}${suffix}`;
    }

    return `Tập ${rest}`;
  }

  // Purely numeric (e.g. "1", "01", "12")
  if (/^\d+$/.test(raw)) {
    return `Tập ${raw.padStart(2, "0")}`;
  }

  // Non-numeric custom label (e.g. "Hoàn tất (12/12)", "Trailer", "OVA") - preserve as-is
  return raw;
}
