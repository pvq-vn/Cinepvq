// ==============================================================================
// services/videoSources/types.ts
// Common types & interfaces for Cinepvq Multi-Source Video Engine
// ==============================================================================

export type VideoSourceId = "k20" | "vsmov" | "kkphim" | "nguonc";

export type StreamType = "hls" | "iframe";

export interface ResolvedSource {
  sourceId: VideoSourceId;
  name: string; // e.g. "K20 Direct HLS", "VSMOV Embed"
  displayName: string; // Short UI label, e.g. "K20", "VSMOV", "KKPhim1", "NguonC"
  type: StreamType;
  url: string; // Direct .m3u8 CDN or embed iframe URL
  priority: number; // 1 = K20, 2 = VSMOV, 3 = KKPhim1, 4 = NguonC
  quality?: string;
  serverName?: string;
  isAvailable: boolean;
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
  serverName?: string;
  episodeSlug?: string;
}

export interface VideoSourceAdapter {
  readonly sourceId: VideoSourceId;
  readonly name: string;
  readonly priority: number;
  resolveStream(options: ResolveSourceOptions): Promise<ResolvedSource | null>;
}
