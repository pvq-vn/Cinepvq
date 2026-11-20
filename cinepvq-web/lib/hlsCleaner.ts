// ==============================================================================
// lib/hlsCleaner.ts
// HLS Playlist Ad-Stripper, URL Rewriter, and PNG-Disguised MPEG-TS Unwrapper
// Used by /api/hls-proxy for KKPhim1 ad removal, VSMOV native HLS, and PhimHDCSS
// ==============================================================================

export interface AdStripResult {
  cleaned: string;
  removedSegments: number;
  removedSeconds: number;
}

interface SegmentEntry {
  extinfLine: string;
  duration: number;
  uri: string;
  extraTags: string[];
}

interface ContinuitySection {
  leadingTags: string[];
  segments: SegmentEntry[];
  hasKeyNone: boolean;
}

const KNOWN_AD_PATH_RE =
  /(?:^|\/)(?:v\d+\/[a-f0-9]{16,}\/segment_\d+\.ts|ads?\/|quangcao|promo\/|preroll|midroll)/i;

const SEQUENTIAL_SEG_RE = /(?:^|\/)segment_\d+\.(?:ts|png|jpg|jpeg|webp)$/i;
const RANDOM_ALNUM_TS_RE = /^[A-Za-z0-9_-]{5,16}\.ts(?:\?.*)?$/;
const CONVERT_WATERMARK_RE = /^convertv\d+\/[A-Za-z0-9_-]{5,16}\.ts(?:\?.*)?$/i;

function resolveUrlSafe(uri: string, baseUrl: string): string {
  try {
    return new URL(uri, baseUrl).toString();
  } catch {
    return uri;
  }
}

function getHostSafe(url: string): string {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return "";
  }
}

function isMediaPlaylist(manifest: string): boolean {
  return manifest.includes("#EXTINF:");
}

/**
 * Strips injected commercial ad blocks from HLS media playlists (e.g. KKPhim1
 * `/v9/<hash>/segment_0001.ts` blocks inserted inside `#EXT-X-DISCONTINUITY`)
 * while strictly preserving real movie segments including `convertv9/` scenes.
 */
export function stripAdsFromM3u8(
  manifestText: string,
  mediaUrl: string
): AdStripResult {
  const rawLines = manifestText.replace(/\r\n/g, "\n").split("\n");
  if (!isMediaPlaylist(manifestText)) {
    return { cleaned: manifestText, removedSegments: 0, removedSeconds: 0 };
  }

  // Split header tags (before first #EXTINF or #EXT-X-DISCONTINUITY) and body sections
  const headerLines: string[] = [];
  const footerLines: string[] = [];
  const sections: ContinuitySection[] = [];

  let bodyStart = 0;
  for (let i = 0; i < rawLines.length; i++) {
    const trimmed = rawLines[i].trim();
    if (
      trimmed.startsWith("#EXTINF:") ||
      trimmed === "#EXT-X-DISCONTINUITY" ||
      trimmed.startsWith("#EXT-X-KEY:")
    ) {
      bodyStart = i;
      break;
    }
    if (trimmed) headerLines.push(trimmed);
    bodyStart = i + 1;
  }

  let current: ContinuitySection = {
    leadingTags: [],
    segments: [],
    hasKeyNone: false,
  };
  let pendingExtraTags: string[] = [];

  for (let i = bodyStart; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) continue;

    if (line === "#EXT-X-ENDLIST") {
      footerLines.push(line);
      continue;
    }

    if (line === "#EXT-X-DISCONTINUITY") {
      if (current.segments.length > 0 || current.leadingTags.length > 0) {
        sections.push(current);
        current = { leadingTags: [], segments: [], hasKeyNone: false };
      }
      pendingExtraTags = [];
      continue;
    }

    if (line.startsWith("#EXT-X-KEY:")) {
      if (/METHOD=NONE/i.test(line)) {
        current.hasKeyNone = true;
      }
      if (current.segments.length === 0) {
        current.leadingTags.push(line);
      } else {
        pendingExtraTags.push(line);
      }
      continue;
    }

    if (line.startsWith("#EXTINF:")) {
      const dur = parseFloat(line.slice(8).split(",")[0]) || 0;
      // Find next non-empty, non-comment URI line
      let uri = "";
      let j = i + 1;
      while (j < rawLines.length) {
        const candidate = rawLines[j].trim();
        if (!candidate) {
          j++;
          continue;
        }
        if (candidate.startsWith("#")) {
          // Skip vendor comment hints like #HDC-SHOP-ALT
          if (!candidate.startsWith("#HDC-")) {
            pendingExtraTags.push(candidate);
          }
          j++;
          continue;
        }
        uri = candidate;
        break;
      }
      if (uri) {
        current.segments.push({
          extinfLine: line,
          duration: dur,
          uri,
          extraTags: pendingExtraTags,
        });
        pendingExtraTags = [];
        i = j;
      }
      continue;
    }

    if (line.startsWith("#")) {
      if (!line.startsWith("#HDC-")) {
        if (current.segments.length === 0) {
          current.leadingTags.push(line);
        } else {
          pendingExtraTags.push(line);
        }
      }
    }
  }

  if (current.segments.length > 0 || current.leadingTags.length > 0) {
    sections.push(current);
  }

  // Analyze majority main movie pattern
  const baseHost = getHostSafe(mediaUrl);
  let totalSegments = 0;
  let randomAlnumCount = 0;
  for (const sec of sections) {
    for (const seg of sec.segments) {
      totalSegments++;
      if (RANDOM_ALNUM_TS_RE.test(seg.uri)) {
        randomAlnumCount++;
      }
    }
  }
  const mainUsesRandomAlnum = totalSegments >= 20 && randomAlnumCount / totalSegments > 0.65;

  let removedSegments = 0;
  let removedSeconds = 0;
  const keptSections: ContinuitySection[] = [];

  for (let idx = 0; idx < sections.length; idx++) {
    const sec = sections[idx];
    if (sec.segments.length === 0) continue;

    // Never strip real movie segments re-encoded with watermark in `convertv9/`
    const allConvertWatermark = sec.segments.every((s) =>
      CONVERT_WATERMARK_RE.test(s.uri)
    );
    if (allConvertWatermark) {
      keptSections.push(sec);
      continue;
    }

    const sectionDuration = sec.segments.reduce((acc, s) => acc + s.duration, 0);
    const isShortSection =
      sec.segments.length <= 25 &&
      sectionDuration <= 110 &&
      totalSegments > sec.segments.length * 3;

    let isAdSection = false;

    if (isShortSection) {
      const hasKnownAdPath = sec.segments.every((s) => KNOWN_AD_PATH_RE.test(s.uri));
      const allRootRelative = sec.segments.every((s) => s.uri.startsWith("/"));
      const allSequentialSeg = sec.segments.every((s) => SEQUENTIAL_SEG_RE.test(s.uri));
      const allDifferentHost = sec.segments.every((s) => {
        if (!/^https?:\/\//i.test(s.uri)) return false;
        const h = getHostSafe(s.uri);
        return h !== "" && baseHost !== "" && h !== baseHost;
      });

      if (hasKnownAdPath) {
        isAdSection = true;
      } else if (mainUsesRandomAlnum && allSequentialSeg) {
        isAdSection = true;
      } else if (mainUsesRandomAlnum && allRootRelative && sec.hasKeyNone) {
        isAdSection = true;
      } else if (mainUsesRandomAlnum && allDifferentHost && idx > 0) {
        isAdSection = true;
      }
    }

    if (isAdSection) {
      removedSegments += sec.segments.length;
      removedSeconds += sectionDuration;
    } else {
      keptSections.push(sec);
    }
  }

  // Reconstruct clean playlist
  const out: string[] = [...headerLines];
  for (let i = 0; i < keptSections.length; i++) {
    const sec = keptSections[i];
    if (i > 0) {
      out.push("#EXT-X-DISCONTINUITY");
    }
    for (const tag of sec.leadingTags) {
      out.push(tag);
    }
    for (const seg of sec.segments) {
      for (const extra of seg.extraTags) {
        out.push(extra);
      }
      out.push(seg.extinfLine);
      out.push(seg.uri);
    }
  }
  for (const f of footerLines) {
    out.push(f);
  }
  if (!footerLines.includes("#EXT-X-ENDLIST") && manifestText.includes("#EXT-X-ENDLIST")) {
    out.push("#EXT-X-ENDLIST");
  }

  return {
    cleaned: out.join("\n") + "\n",
    removedSegments,
    removedSeconds: Math.round(removedSeconds * 10) / 10,
  };
}

export interface RewriteProxyOptions {
  proxyBasePath: string; // e.g. "/api/hls-proxy"
  stripAds?: boolean;
  proxySegments?: boolean;
  stripPng?: boolean;
  referer?: string;
}

/**
 * Rewrites master or media HLS manifests:
 * - Optionally strips KKPhim1 ad discontinuity blocks
 * - Resolves relative URLs to absolute URLs
 * - Routes sub-playlists through `/api/hls-proxy` so ad stripping & CORS apply recursively
 * - Optionally routes segments through `/api/hls-proxy?stripPng=1` (e.g. VSMOV PNG-TS segments)
 */
export function rewriteHlsManifest(
  manifestText: string,
  sourceUrl: string,
  options: RewriteProxyOptions
): { manifest: string; removedSegments: number; removedSeconds: number } {
  let workingText = manifestText.replace(/\r\n/g, "\n");
  let removedSegments = 0;
  let removedSeconds = 0;

  if (options.stripAds && isMediaPlaylist(workingText)) {
    const res = stripAdsFromM3u8(workingText, sourceUrl);
    workingText = res.cleaned;
    removedSegments = res.removedSegments;
    removedSeconds = res.removedSeconds;
  }

  const buildProxyUrl = (targetUrl: string, isPlaylist: boolean): string => {
    const params = new URLSearchParams();
    params.set("url", targetUrl);
    if (isPlaylist) {
      if (options.stripAds) params.set("stripAds", "1");
      if (options.proxySegments) params.set("proxySegments", "1");
      if (options.stripPng) params.set("stripPng", "1");
    } else if (options.stripPng) {
      params.set("stripPng", "1");
    }
    if (options.referer) {
      params.set("ref", options.referer);
    }
    return `${options.proxyBasePath}?${params.toString()}`;
  };

  const lines = workingText.split("\n");
  const isMaster =
    workingText.includes("#EXT-X-STREAM-INF") ||
    workingText.includes("#EXT-X-MEDIA:");

  const rewritten: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    // Strip custom non-standard comments that can trip strict parsers
    if (trimmed.startsWith("#HDC-")) {
      continue;
    }

    // Rewrite URI="..." inside tags such as #EXT-X-KEY or #EXT-X-MEDIA or #EXT-X-MAP
    if (trimmed.startsWith("#")) {
      if (trimmed.includes('URI="')) {
        const updatedTag = trimmed.replace(/URI="([^"]+)"/g, (_m, relUri: string) => {
          const abs = resolveUrlSafe(relUri, sourceUrl);
          const isKeyOrMap =
            trimmed.startsWith("#EXT-X-KEY") || trimmed.startsWith("#EXT-X-MAP");
          const isSubPlaylist =
            trimmed.startsWith("#EXT-X-MEDIA") || abs.includes(".m3u8");
          if (isSubPlaylist) {
            return `URI="${buildProxyUrl(abs, true)}"`;
          }
          if (isKeyOrMap && options.proxySegments) {
            return `URI="${buildProxyUrl(abs, false)}"`;
          }
          return `URI="${abs}"`;
        });
        rewritten.push(updatedTag);
      } else {
        rewritten.push(trimmed);
      }
      continue;
    }

    // URI line (either sub-playlist in master or media segment in media playlist)
    const absUrl = resolveUrlSafe(trimmed, sourceUrl);
    if (isMaster || absUrl.includes(".m3u8")) {
      rewritten.push(buildProxyUrl(absUrl, true));
    } else if (options.proxySegments || options.stripPng) {
      rewritten.push(buildProxyUrl(absUrl, false));
    } else {
      // Direct CDN URL for zero server bandwidth overhead!
      rewritten.push(absUrl);
    }
  }

  return {
    manifest: rewritten.join("\n") + "\n",
    removedSegments,
    removedSeconds,
  };
}

/**
 * If a master HLS manifest contains exactly ONE `#EXT-X-STREAM-INF` variant
 * and no separate `#EXT-X-MEDIA:` audio/subtitle renditions, returns the
 * resolved absolute URL of that single media playlist so `/api/hls-proxy` can
 * flatten it in ONE round-trip (eliminating a full extra RTT on startup!).
 */
export function extractSingleVariantUrl(
  manifestText: string,
  sourceUrl: string
): string | null {
  const normalized = manifestText.replace(/\r\n/g, "\n");
  if (normalized.includes("#EXTINF:") || normalized.includes("#EXT-X-MEDIA:")) {
    return null;
  }
  const lines = normalized.split("\n").map((l) => l.trim()).filter(Boolean);
  const variantUrls: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("#EXT-X-STREAM-INF")) {
      for (let j = i + 1; j < lines.length; j++) {
        if (!lines[j].startsWith("#")) {
          variantUrls.push(resolveUrlSafe(lines[j], sourceUrl));
          i = j;
          break;
        }
      }
    }
  }
  return variantUrls.length === 1 ? variantUrls[0] : null;
}

/**
 * Finds the starting offset of a genuine 188-byte-aligned MPEG-TS sync triplet
 * (`0x47` at `i`, `i + 188`, `i + 376`) inside an initial header buffer.
 * Returns 0 if already MPEG-TS or not a disguised image header.
 */
export function findTsSyncOffsetInHeader(buf: Uint8Array): number {
  if (buf.length < 377) return 0;

  // Already pure MPEG-TS starting at byte 0
  if (buf[0] === 0x47 && buf[188] === 0x47 && buf[376] === 0x47) {
    return 0;
  }

  // Only scan if it looks like a disguised image/binary header (PNG, GIF, JPEG, WebP)
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const isGif = buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46;
  const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
  const isWebp = buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46;

  if (!isPng && !isGif && !isJpg && !isWebp) {
    return 0;
  }

  const maxScan = Math.min(buf.length - 377, 8192);
  for (let i = 1; i <= maxScan; i++) {
    if (buf[i] === 0x47 && buf[i + 188] === 0x47 && buf[i + 376] === 0x47) {
      return i;
    }
  }
  return 0;
}

/**
 * Unwraps PNG-disguised MPEG-TS segments (used by VSMOV & PhimHDCSS FHDC).
 * Scans the initial bytes for a genuine 188-byte-aligned MPEG-TS sync triplet
 * (`0x47` at `i`, `i + 188`, `i + 376`) and trims any fake PNG header/footer.
 */
export function stripPngPrefixFromTs(buf: Uint8Array): Uint8Array {
  const tsOffset = findTsSyncOffsetInHeader(buf);
  if (tsOffset <= 0) return buf;

  // Trim trailing non-188-byte-aligned footer (e.g. PNG IEND tail if appended)
  const remaining = buf.length - tsOffset;
  const alignedLen = remaining - (remaining % 188);
  return buf.subarray(tsOffset, tsOffset + alignedLen);
}
