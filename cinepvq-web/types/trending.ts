import type { Movie } from "@/types/movie";

export type PlatformId =
  | "netflix"
  | "douban"
  | "yunhe"
  | "kuyun"
  | "vieon"
  | "fptplay"
  | "iqiyi";

export type NetflixCountryCode =
  | "vn"
  | "kr"
  | "us"
  | "global"
  | "jp"
  | "th"
  | "tw"
  | "gb";

export type NetflixMediaType = "tv" | "films";

export type DoubanCategory = "all" | "tv_cn" | "tv_global" | "movie" | "top250";

export interface NetflixCountryOption {
  code: NetflixCountryCode;
  label: string;
  shortLabel: string;
  tudumSlug: string;
  flag: string;
  kkphimCountrySlug: string;
}

export interface DoubanCategoryOption {
  key: DoubanCategory;
  label: string;
}

export const NETFLIX_COUNTRIES: NetflixCountryOption[] = [
  { code: "vn", label: "Việt Nam", shortLabel: "VN", tudumSlug: "vietnam", flag: "🇻🇳", kkphimCountrySlug: "viet-nam" },
  { code: "kr", label: "Hàn Quốc", shortLabel: "HQ", tudumSlug: "south-korea", flag: "🇰🇷", kkphimCountrySlug: "han-quoc" },
  { code: "us", label: "Mỹ", shortLabel: "Mỹ", tudumSlug: "united-states", flag: "🇺🇸", kkphimCountrySlug: "au-my" },
  { code: "global", label: "Toàn Cầu", shortLabel: "Global", tudumSlug: "", flag: "🌍", kkphimCountrySlug: "au-my" },
  { code: "jp", label: "Nhật Bản", shortLabel: "Nhật", tudumSlug: "japan", flag: "🇯🇵", kkphimCountrySlug: "nhat-ban" },
  { code: "th", label: "Thái Lan", shortLabel: "Thái", tudumSlug: "thailand", flag: "🇹🇭", kkphimCountrySlug: "thai-lan" },
  { code: "tw", label: "Đài Loan", shortLabel: "Đài Loan", tudumSlug: "taiwan", flag: "🇹🇼", kkphimCountrySlug: "dai-loan" },
  { code: "gb", label: "Anh", shortLabel: "UK", tudumSlug: "united-kingdom", flag: "🇬🇧", kkphimCountrySlug: "anh" },
];

export const DOUBAN_CATEGORIES: DoubanCategoryOption[] = [
  { key: "all", label: "Tổng hợp điểm cao" },
  { key: "tv_cn", label: "Phim bộ Hoa ngữ" },
  { key: "tv_global", label: "Phim bộ Quốc tế" },
  { key: "movie", label: "Điện ảnh tuần" },
  { key: "top250", label: "Kinh điển Top 250" },
];

export interface TrendingRankItem extends Movie {
  rank: number;
  platformId: PlatformId;
  platformName: string;
  score: number;
  scoreSource: string;
  views: number;
  formattedViews: string;
  heatLabel: string;
  trendDelta: number;
  playable?: boolean;
  searchQuery?: string;
  countryCode?: string;
  weeksInTop10?: number;
  marketShare?: number;
  broadcastPlatform?: string;
  mediaType?: "tv" | "movie";
}

export interface PlatformRankingSection {
  id: PlatformId;
  name: string;
  subtitle: string;
  brandColor: string;
  accentBg: string;
  badgeText: string;
  sourceUrl: string;
  updatedAt: string;
  countryCode?: string;
  countryLabel?: string;
  categoryKey?: string;
  metricLabel?: string;
  items: TrendingRankItem[];
}

export interface TrendingRankingsPayload {
  status: boolean;
  updatedAt: string;
  activeNetflixCountry: NetflixCountryCode;
  activeNetflixType: NetflixMediaType;
  activeDoubanCategory: DoubanCategory;
  netflixCountries: NetflixCountryOption[];
  doubanCategories: DoubanCategoryOption[];
  platforms: PlatformRankingSection[];
}
