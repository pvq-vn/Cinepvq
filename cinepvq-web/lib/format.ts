/**
 * Normalizes episode display label to prevent duplicate "Tập Tập" prefixes.
 *
 * Examples:
 * - "Tập 01" -> "Tập 01"
 * - "Tập Tập 01" -> "Tập 01"
 * - "01" -> "Tập 01"
 * - "1" -> "Tập 1"
 * - "Full" -> "Full"
 * - "Tập Đặc Biệt" -> "Tập Đặc Biệt"
 */
export function normalizeEpisodeLabel(name?: string | null): string {
  if (!name) return "";
  const trimmed = name.trim();
  if (!trimmed) return "";

  // Check if it already starts with one or more "Tập" (case-insensitive)
  const tapMatch = trimmed.match(/^(?:tập\s*)+/i);
  if (tapMatch) {
    const rest = trimmed.slice(tapMatch[0].length).trim();
    return rest ? `Tập ${rest}` : "Tập";
  }

  // If purely numeric (e.g. "01", "1", "12"), prefix with "Tập "
  if (/^\d+$/.test(trimmed)) {
    return `Tập ${trimmed}`;
  }

  // Non-numeric custom label (e.g. "Full", "Trailer", "OVA") - preserve as-is
  return trimmed;
}
