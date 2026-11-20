// ==============================================================================
// services/videoSources/types.ts
// Common types & interfaces for Cinepvq Multi-Source Video Engine
// ==============================================================================

export type VideoSourceId =
  | "k20"
  | "vsmov"
  | "phimhdcss"
  | "chophim"
  | "kkphim"
  | "nguonc";

export type StreamType = "hls" | "iframe";

export interface SubtitleTrack {
  label: string;
  lang: string;
  url: string;
  rawUrl?: string;
}

export interface ResolvedSource {
  sourceId: VideoSourceId;
  name: string; // e.g. "K20 Direct HLS", "VSMOV Native HLS"
  displayName: string; // Short UI label, e.g. "K20", "VSMOV", "PhimHDCSS", "ChoPhim", "KKPhim1", "NguonC"
  type: StreamType;
  url: string; // Browser-playable .m3u8 (ad-cleaned/proxied) or embed iframe URL
  rawUrl?: string; // Direct upstream .m3u8/embed URL for Android on-device SmartHlsDataSource
  priority: number; // 1 = K20, 2 = VSMOV, 3 = PhimHDCSS, 4 = ChoPhim, 5 = KKPhim1, 6 = NguonC
  quality?: string;
  serverName?: string;
  isAvailable: boolean;
  headers?: Record<string, string>;
  subtitles?: SubtitleTrack[];
  stripPng?: boolean;
  adFree?: boolean;
}

export interface ResolveSourceOptions {
  slug?: string;
  imdbId?: string;
  tmdbId?: string;
  title?: string;
  season?: number;
  episode?: number;
  type?: "movie" | "series";
  nguoncEmbedUrl?: string;
  knownHlsUrl?: string;
  serverName?: string;
  episodeSlug?: string;
}

export interface VideoSourceAdapter {
  readonly sourceId: VideoSourceId;
  readonly name: string;
  readonly priority: number;
  resolveStream(options: ResolveSourceOptions): Promise<ResolvedSource | null>;
}
