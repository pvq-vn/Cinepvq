"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import MovieCard from "@/components/MovieCard";
import { MovieGridSkeleton } from "@/components/Skeleton";
import {
  Flame,
  Trophy,
  Award,
  Sparkles,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Star,
  Eye,
  Play,
  ExternalLink,
  CheckCircle2,
  Globe,
  Search,
  BarChart3,
  Film,
  Tv,
} from "lucide-react";
import {
  NETFLIX_COUNTRIES,
  DOUBAN_CATEGORIES,
  type PlatformId,
  type NetflixCountryCode,
  type NetflixMediaType,
  type DoubanCategory,
  type PlatformRankingSection,
  type TrendingRankingsPayload,
  type TrendingRankItem,
} from "@/types/trending";

type TabFilter = "all" | PlatformId;

const PLATFORM_TABS: {
  key: TabFilter;
  label: string;
  badge: string;
  activeClass: string;
  indicatorClass: string;
}[] = [
  {
    key: "all",
    label: "Tất Cả BXH",
    badge: "7 Nền tảng",
    activeClass: "from-amber-500 via-orange-500 to-rose-500 shadow-orange-500/25",
    indicatorClass: "border-b-amber-300",
  },
  {
    key: "netflix",
    label: "Netflix Top 10",
    badge: "Quốc gia",
    activeClass: "from-red-600 to-rose-700 shadow-red-600/25",
    indicatorClass: "border-b-white",
  },
  {
    key: "douban",
    label: "Douban (豆瓣)",
    badge: "Theo điểm",
    activeClass: "from-emerald-600 to-teal-700 shadow-emerald-600/25",
    indicatorClass: "border-b-emerald-200",
  },
  {
    key: "yunhe",
    label: "Vân Hợp (云合)",
    badge: "View TQ",
    activeClass: "from-sky-600 to-indigo-700 shadow-sky-600/25",
    indicatorClass: "border-b-sky-200",
  },
  {
    key: "kuyun",
    label: "Khốc Vân (酷云)",
    badge: "Thị phần",
    activeClass: "from-violet-600 to-fuchsia-700 shadow-purple-600/25",
    indicatorClass: "border-b-fuchsia-200",
  },
  {
    key: "vieon",
    label: "VieON",
    badge: "Xu hướng VN",
    activeClass: "from-lime-600 to-emerald-600 shadow-lime-600/25",
    indicatorClass: "border-b-lime-200",
  },
  {
    key: "fptplay",
    label: "FPT Play",
    badge: "Hot 24h",
    activeClass: "from-orange-500 to-red-500 shadow-orange-500/25",
    indicatorClass: "border-b-amber-200",
  },
  {
    key: "iqiyi",
    label: "iQIYI & WeTV",
    badge: "Độ nhiệt",
    activeClass: "from-teal-500 to-cyan-600 shadow-teal-500/25",
    indicatorClass: "border-b-cyan-200",
  },
];

function getItemHref(item: TrendingRankItem): string {
  if (item.playable === false) {
    return `/tim-kiem?q=${encodeURIComponent(item.searchQuery || item.name)}`;
  }
  return `/phim/${item.slug}`;
}

function RankedPosterCard({
  item,
  priority = false,
}: {
  item: TrendingRankItem;
  priority?: boolean;
}) {
  if (item.playable !== false) {
    return <MovieCard movie={item} variant="ranking" rank={item.rank} priority={priority} />;
  }

  const imageSrc = item.thumb_url || item.poster_url || "";
  return (
    <Link
      href={getItemHref(item)}
      className="group relative flex flex-col overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900/90 ring-1 ring-zinc-200/60 dark:ring-zinc-800/60 transition-transform duration-300 hover:ring-violet-500/50 hover:shadow-xl hover:shadow-violet-500/10 hover:-translate-y-1"
    >
      <div className="absolute top-2 left-2 z-20 flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-950/90 font-black text-lg text-amber-400 shadow-md ring-1 ring-amber-400/30">
        {item.rank}
      </div>

      <div className="relative aspect-[2/3] w-full overflow-hidden bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={item.name}
            referrerPolicy="no-referrer"
            decoding="async"
            loading={priority ? "eager" : "lazy"}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center p-4 text-center gap-2">
            <BarChart3 className="h-9 w-9 text-zinc-600" />
            <span className="text-xs font-bold text-zinc-400 line-clamp-3">
              {item.name}
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg">
            <Search className="h-5 w-5" />
          </div>
        </div>

        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1 text-[10px] pointer-events-none">
          <span className="rounded bg-zinc-950/85 px-2 py-0.5 font-bold text-amber-300 truncate">
            {item.broadcastPlatform || item.quality || item.platformName}
          </span>
          <span className="rounded bg-violet-600/90 px-2 py-0.5 font-bold text-white shrink-0">
            Tìm phim
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1 p-3.5">
        <h3 className="text-sm font-semibold leading-snug line-clamp-1 text-zinc-900 dark:text-zinc-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
          {item.name}
        </h3>
        {item.original_name && item.original_name !== item.name && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">
            {item.original_name}
          </p>
        )}
      </div>
    </Link>
  );
}

function PodiumCard({ item }: { item: TrendingRankItem }) {
  const rank = item.rank;
  const badgeColor =
    rank === 1
      ? "from-amber-400 to-yellow-500 text-black"
      : rank === 2
        ? "from-slate-200 to-zinc-400 text-black"
        : rank === 3
          ? "from-amber-600 to-amber-800 text-white"
          : "from-emerald-500 to-teal-700 text-white";

  return (
    <div className="relative flex flex-col p-3.5 rounded-2xl bg-zinc-100/70 dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800/80 hover:border-amber-500/50 transition-all shadow-md hover:shadow-xl min-w-0">
      <div className="flex items-center justify-between gap-2 mb-2.5 min-w-0">
        <span
          className={`inline-flex items-center gap-1 font-black text-xs px-2.5 py-1 rounded-lg bg-gradient-to-r ${badgeColor} shadow-sm shrink-0`}
        >
          <Award className="h-3.5 w-3.5" />
          TOP {rank}
        </span>

        <div className="flex items-center gap-1.5 min-w-0">
          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 shrink-0">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {item.score.toFixed(1)} {item.scoreSource}
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 truncate">
            <Eye className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {item.formattedViews.replace(" lượt xem", "")}
            </span>
          </span>
        </div>
      </div>

      <RankedPosterCard item={item} priority={rank <= 3} />

      <div className="mt-2.5 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 min-w-0">
        <span className="font-semibold text-zinc-700 dark:text-zinc-300 truncate">
          {item.heatLabel}
        </span>
        {item.trendDelta > 0 ? (
          <span className="text-emerald-500 font-bold flex items-center gap-0.5 shrink-0">
            <TrendingUp className="h-3 w-3" />+{item.trendDelta} hạng
          </span>
        ) : item.trendDelta < 0 ? (
          <span className="text-rose-500 font-bold flex items-center gap-0.5 shrink-0">
            <TrendingDown className="h-3 w-3" />
            {item.trendDelta} hạng
          </span>
        ) : (
          <span className="text-amber-500 font-semibold shrink-0">Giữ vững</span>
        )}
      </div>
    </div>
  );
}

function PlatformBxhSection({
  platform,
  onSelectPlatform,
  expanded,
  netflixCountry,
  netflixType,
  onChangeNetflixCountry,
  onChangeNetflixType,
  doubanCategory,
  onChangeDoubanCategory,
  isUpdating,
  hasMoreDouban = false,
  isLoadingMoreDouban = false,
  onLoadMoreDouban,
}: {
  platform: PlatformRankingSection;
  onSelectPlatform: (id: PlatformId) => void;
  expanded: boolean;
  netflixCountry: NetflixCountryCode;
  netflixType: NetflixMediaType;
  onChangeNetflixCountry: (c: NetflixCountryCode) => void;
  onChangeNetflixType: (t: NetflixMediaType) => void;
  doubanCategory: DoubanCategory;
  onChangeDoubanCategory: (c: DoubanCategory) => void;
  isUpdating: boolean;
  hasMoreDouban?: boolean;
  isLoadingMoreDouban?: boolean;
  onLoadMoreDouban?: () => void;
}) {
  const top3 = platform.items.slice(0, 3);
  const rest = expanded
    ? platform.items.slice(3)
    : platform.items.slice(3, 10);

  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (
      platform.id !== "douban" ||
      !expanded ||
      !hasMoreDouban ||
      isLoadingMoreDouban ||
      !onLoadMoreDouban
    ) {
      return;
    }
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          onLoadMoreDouban();
        }
      },
      { rootMargin: "320px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [platform.id, expanded, hasMoreDouban, isLoadingMoreDouban, onLoadMoreDouban]);

  return (
    <section className="rounded-3xl bg-white dark:bg-zinc-900/50 border border-zinc-200/80 dark:border-zinc-800/80 overflow-hidden shadow-lg">
      {/* Platform Branded Header */}
      <div
        className={`bg-gradient-to-r ${platform.brandColor} p-5 sm:p-6 text-white space-y-4`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-black/30 px-2.5 py-0.5 text-[10px] font-black tracking-wider uppercase">
                {platform.badgeText}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-white/85">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Dữ liệu thực tế
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-300 shrink-0" />
              <span className="truncate">Bảng Xếp Hạng {platform.name}</span>
            </h2>
            <p className="text-xs sm:text-sm text-white/85 max-w-2xl">
              {platform.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            {!expanded && (
              <button
                type="button"
                onClick={() => onSelectPlatform(platform.id)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white text-zinc-900 hover:bg-zinc-100 px-3.5 py-2 text-xs font-extrabold shadow transition-all cursor-pointer"
              >
                <span>Xem trọn BXH</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Netflix Country & TV/Films Interactive Filter Bar */}
        {platform.id === "netflix" && (
          <div className="pt-3 border-t border-white/15 flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/90">
                <Globe className="h-3.5 w-3.5" />
                Chọn quốc gia Netflix Top 10:
              </span>

              <div className="inline-flex rounded-xl bg-black/30 p-0.5 border border-white/15">
                <button
                  type="button"
                  onClick={() => onChangeNetflixType("tv")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                    netflixType === "tv"
                      ? "bg-white text-zinc-950 shadow"
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  <Tv className="h-3 w-3" />
                  Phim Bộ (TV)
                </button>
                <button
                  type="button"
                  onClick={() => onChangeNetflixType("films")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                    netflixType === "films"
                      ? "bg-white text-zinc-950 shadow"
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  <Film className="h-3 w-3" />
                  Phim Lẻ (Films)
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {NETFLIX_COUNTRIES.map((c) => {
                const selected = c.code === netflixCountry;
                return (
                  <button
                    key={c.code}
                    type="button"
                    disabled={isUpdating && selected}
                    onClick={() => onChangeNetflixCountry(c.code)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all shrink-0 cursor-pointer border ${
                      selected
                        ? "bg-white text-red-700 border-white shadow-md"
                        : "bg-black/25 text-white/90 border-white/15 hover:bg-black/40"
                    }`}
                  >
                    <span>{c.flag}</span>
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Douban Category Sub-Filter Bar */}
        {platform.id === "douban" && (
          <div className="pt-3 border-t border-white/15 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {DOUBAN_CATEGORIES.map((cat) => {
              const selected = cat.key === doubanCategory;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => onChangeDoubanCategory(cat.key)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all shrink-0 cursor-pointer border ${
                    selected
                      ? "bg-white text-emerald-800 border-white shadow-md"
                      : "bg-black/25 text-white/90 border-white/15 hover:bg-black/40"
                  }`}
                >
                  <Star
                    className={`h-3 w-3 ${
                      selected ? "fill-amber-500 text-amber-500" : "text-amber-300"
                    }`}
                  />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Platform Body */}
      <div className="p-4 sm:p-6 space-y-8">
        {top3.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {top3.map((item) => (
              <PodiumCard key={`${platform.id}-${item.rank}-${item.slug}`} item={item} />
            ))}
          </div>
        )}

        {rest.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm sm:text-base font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" aria-hidden="true" />
                <span>
                  Hạng #{rest[0].rank} – #{rest[rest.length - 1].rank} trên {platform.name}
                </span>
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {rest.map((item) => (
                <div
                  key={`${platform.id}-${item.rank}-${item.slug}`}
                  className="flex flex-col space-y-1.5 min-w-0"
                >
                  <RankedPosterCard item={item} />
                  <div className="flex items-center justify-between gap-1 px-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    <span className="font-bold text-amber-500 flex items-center gap-0.5 shrink-0">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                      {item.score.toFixed(1)}
                    </span>
                    <span className="truncate">{item.formattedViews}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Douban Infinite Scroll Sentinel & Accessible Load More Control */}
        {platform.id === "douban" && (
          <div className="pt-2 flex flex-col items-center gap-3">
            {expanded && hasMoreDouban && (
              <div ref={loadMoreSentinelRef} className="h-1 w-full" aria-hidden="true" />
            )}

            {isLoadingMoreDouban && (
              <div className="flex flex-col items-center gap-2 py-2">
                <progress
                  aria-label="Đang cào thêm phim bảng xếp hạng Douban"
                  className="w-40 h-1.5 rounded-full accent-emerald-500"
                />
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Đang cào và đối chiếu thêm phim từ Douban...
                </span>
              </div>
            )}

            {expanded && hasMoreDouban && !isLoadingMoreDouban && onLoadMoreDouban && (
              <button
                type="button"
                onClick={onLoadMoreDouban}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 text-xs font-bold shadow-md transition-colors cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Tải thêm phim Douban</span>
              </button>
            )}

            {expanded && !hasMoreDouban && platform.items.length > 0 && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Đã hiển thị toàn bộ {platform.items.length} phim khả dụng trong danh mục này.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default function TrendingPage() {
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [netflixCountry, setNetflixCountry] = useState<NetflixCountryCode>("vn");
  const [netflixType, setNetflixType] = useState<NetflixMediaType>("tv");
  const [doubanCategory, setDoubanCategory] = useState<DoubanCategory>("all");
  const [isRefreshingCrawl, setIsRefreshingCrawl] = useState(false);

  // Douban infinite scroll appended pages state
  const [doubanExtraItems, setDoubanExtraItems] = useState<TrendingRankItem[]>([]);
  const [doubanNextCursor, setDoubanNextCursor] = useState<number | null>(null);
  const [doubanHasMoreOverride, setDoubanHasMoreOverride] = useState<boolean | null>(null);
  const [isLoadingMoreDouban, setIsLoadingMoreDouban] = useState(false);
  const loadingMoreRef = useRef(false);

  // Reset Douban appended items directly in the category switch handler
  const handleChangeDoubanCategory = useCallback((nextCategory: DoubanCategory) => {
    setDoubanCategory(nextCategory);
    setDoubanExtraItems([]);
    setDoubanNextCursor(null);
    setDoubanHasMoreOverride(null);
  }, []);

  const tabButtonRefs = useRef<Partial<Record<TabFilter, HTMLButtonElement | null>>>({});

  const selectTabWithScroll = (tabKey: TabFilter) => {
    setActiveTab(tabKey);
    const btn = tabButtonRefs.current[tabKey];
    btn?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  };

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIdx = -1;
    if (e.key === "ArrowRight") nextIdx = (index + 1) % PLATFORM_TABS.length;
    else if (e.key === "ArrowLeft")
      nextIdx = (index - 1 + PLATFORM_TABS.length) % PLATFORM_TABS.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = PLATFORM_TABS.length - 1;

    if (nextIdx >= 0) {
      e.preventDefault();
      const targetKey = PLATFORM_TABS[nextIdx].key;
      selectTabWithScroll(targetKey);
      tabButtonRefs.current[targetKey]?.focus();
    }
  };

  const {
    data: trendingPayload,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery<TrendingRankingsPayload>({
    queryKey: [
      "crawled-platform-rankings",
      netflixCountry,
      netflixType,
      doubanCategory,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        country: netflixCountry,
        netflixType,
        doubanCategory,
      });
      const res = await fetch(`/api/trending?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load rankings");
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const handleForceCrawl = async () => {
    if (isRefreshingCrawl) return;
    setIsRefreshingCrawl(true);
    try {
      const params = new URLSearchParams({
        country: netflixCountry,
        netflixType,
        doubanCategory,
        refresh: "true",
      });
      const res = await fetch(`/api/trending?${params.toString()}`);
      if (res.ok) {
        setDoubanExtraItems([]);
        setDoubanNextCursor(null);
        setDoubanHasMoreOverride(null);
        await refetch();
      }
    } finally {
      setIsRefreshingCrawl(false);
    }
  };

  const rawPlatforms = trendingPayload?.platforms ?? [];
  const baseDoubanSection = rawPlatforms.find((p) => p.id === "douban");
  const effectiveDoubanCursor = doubanNextCursor ?? baseDoubanSection?.nextCursor ?? 0;
  const effectiveDoubanHasMore =
    doubanHasMoreOverride !== null
      ? doubanHasMoreOverride
      : Boolean(baseDoubanSection?.hasMore);

  const handleLoadMoreDouban = useCallback(async () => {
    if (loadingMoreRef.current || !effectiveDoubanHasMore || effectiveDoubanCursor <= 0) {
      return;
    }
    loadingMoreRef.current = true;
    setIsLoadingMoreDouban(true);
    try {
      const params = new URLSearchParams({
        platform: "douban",
        doubanCategory,
        doubanOffset: String(effectiveDoubanCursor),
      });
      const res = await fetch(`/api/trending?${params.toString()}`);
      if (!res.ok) return;
      const data = (await res.json()) as TrendingRankingsPayload;
      const nextSec = data.platforms?.find((p) => p.id === "douban");
      if (!nextSec) {
        setDoubanHasMoreOverride(false);
        return;
      }
      setDoubanExtraItems((prev) => {
        const seen = new Set([
          ...(baseDoubanSection?.items || []).map((i) => i.slug),
          ...prev.map((i) => i.slug),
        ]);
        const fresh = (nextSec.items || []).filter((i) => i.slug && !seen.has(i.slug));
        return [...prev, ...fresh];
      });
      setDoubanNextCursor(nextSec.nextCursor ?? effectiveDoubanCursor);
      setDoubanHasMoreOverride(Boolean(nextSec.hasMore));
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMoreDouban(false);
    }
  }, [doubanCategory, effectiveDoubanCursor, effectiveDoubanHasMore, baseDoubanSection?.items]);

  const platforms = rawPlatforms.map((p) => {
    if (p.id !== "douban" || doubanExtraItems.length === 0) return p;
    const seen = new Set(p.items.map((i) => i.slug));
    const merged = [
      ...p.items,
      ...doubanExtraItems.filter((i) => !seen.has(i.slug)),
    ];
    return {
      ...p,
      items: merged,
      hasMore: effectiveDoubanHasMore,
      nextCursor: effectiveDoubanCursor,
    };
  });

  const visiblePlatforms =
    activeTab === "all"
      ? platforms
      : platforms.filter((p) => p.id === activeTab);

  const spotlightItem = visiblePlatforms[0]?.items?.[0];

  return (
    <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-500 mb-3 border border-amber-500/20">
              <Flame className="h-4 w-4 fill-current" />
              Hệ thống BXH Đa Nền Tảng (Real-time)
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-transparent">
              Bảng Xếp Hạng Thịnh Hành
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl">
              Tổng hợp trực tiếp{" "}
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                Netflix Top 10 theo quốc gia (VN, HQ, Mỹ, Nhật...), Douban theo điểm thực, View Vân Hợp (云合), Khốc Vân (酷云)
              </span>
              , VieON, FPT Play và iQIYI / WeTV.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            {trendingPayload?.updatedAt && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Cập nhật:{" "}
                {new Date(trendingPayload.updatedAt).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
            <button
              type="button"
              onClick={handleForceCrawl}
              disabled={isRefreshingCrawl || isLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 dark:bg-zinc-800 hover:bg-violet-600 dark:hover:bg-violet-600 text-white px-4 py-2.5 text-xs font-bold shadow transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  isRefreshingCrawl || isFetching ? "animate-spin" : ""
                }`}
              />
              <span>
                {isRefreshingCrawl ? "Đang cào BXH mới..." : "Làm mới BXH trực tiếp"}
              </span>
            </button>
          </div>
        </div>

        {/* Accessible Single-Row Scrollable Platform Switcher Tabs */}
        <div
          role="tablist"
          aria-label="Chọn bảng xếp hạng theo nền tảng"
          className="flex flex-nowrap items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none border-b border-zinc-200/70 dark:border-zinc-800/80"
        >
          {PLATFORM_TABS.map((tab, idx) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                ref={(el) => {
                  tabButtonRefs.current[tab.key] = el;
                }}
                id={`tab-${tab.key}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => selectTabWithScroll(tab.key)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                className={`flex items-center gap-2 rounded-t-2xl rounded-b-lg px-4 py-2.5 text-xs font-bold transition-all shrink-0 cursor-pointer border-b-2 ${
                  isActive
                    ? `bg-gradient-to-r ${tab.activeClass} ${tab.indicatorClass} text-white shadow-lg`
                    : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border-transparent border border-zinc-200/70 dark:border-zinc-800"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                    isActive
                      ? "bg-black/25 text-white"
                      : "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab Panel */}
        <div
          id="bxh-tabpanel"
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
          className="space-y-8"
        >
          {/* Spotlight Top #1 Banner */}
          {!isLoading && spotlightItem && (
            <div className="relative overflow-hidden rounded-3xl bg-zinc-900 text-white border border-white/10 shadow-2xl">
              <div className="absolute inset-0">
                {(spotlightItem.poster_url || spotlightItem.thumb_url) && (
                  <img
                    src={spotlightItem.poster_url || spotlightItem.thumb_url}
                    alt={spotlightItem.name}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover opacity-35 blur-xs scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/85 to-transparent" />
              </div>

              <div className="relative z-10 p-6 sm:p-8 md:p-10 flex flex-col sm:flex-row items-start sm:items-center gap-6">
                {spotlightItem.thumb_url || spotlightItem.poster_url ? (
                  <img
                    src={spotlightItem.thumb_url || spotlightItem.poster_url}
                    alt={spotlightItem.name}
                    referrerPolicy="no-referrer"
                    className="w-28 sm:w-36 aspect-[2/3] rounded-2xl object-cover shadow-2xl ring-2 ring-amber-400/60 shrink-0"
                  />
                ) : (
                  <div className="w-28 sm:w-36 aspect-[2/3] rounded-2xl bg-zinc-800 flex items-center justify-center ring-2 ring-amber-400/60 shrink-0">
                    <Trophy className="h-10 w-10 text-amber-400" />
                  </div>
                )}
                <div className="space-y-3 max-w-2xl min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-1 text-xs font-black text-black shadow">
                      QUÁN QUÂN #{spotlightItem.rank} {spotlightItem.platformName.toUpperCase()}
                    </span>
                    <span className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold text-amber-300 flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {spotlightItem.score.toFixed(1)} ({spotlightItem.scoreSource})
                    </span>
                    <span className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-300 flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" />
                      {spotlightItem.formattedViews}
                    </span>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                    {spotlightItem.name}
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-300 font-medium">
                    {[
                      spotlightItem.original_name !== spotlightItem.name
                        ? spotlightItem.original_name
                        : "",
                      spotlightItem.year || "",
                      spotlightItem.heatLabel,
                    ]
                      .filter(Boolean)
                      .join(" • ")}
                  </p>

                  <div className="pt-2 flex flex-wrap items-center gap-3">
                    <Link
                      href={getItemHref(spotlightItem)}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-extrabold px-5 py-2.5 text-xs sm:text-sm shadow-lg shadow-orange-500/25 transition-all"
                    >
                      {spotlightItem.playable === false ? (
                        <>
                          <Search className="h-4 w-4" />
                          <span>Tìm Phim Trên Cinepvq</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 fill-current" />
                          <span>Xem Phim Ngay</span>
                        </>
                      )}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {isError && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
              <p className="text-sm font-semibold text-red-500">
                Không thể tải bảng xếp hạng lúc này.
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Thử lại
              </button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && <MovieGridSkeleton count={12} />}

          {/* Platform Ranking Sections */}
          {!isLoading && !isError && (
            <div className="space-y-12">
              {visiblePlatforms.map((platform, idx) => (
                <div key={`${platform.id}-${platform.countryCode || ""}-${platform.categoryKey || ""}`} className={idx > 0 ? "cv-auto" : undefined}>
                  <PlatformBxhSection
                    platform={platform}
                    onSelectPlatform={(id) => {
                      selectTabWithScroll(id);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    expanded={activeTab !== "all"}
                    netflixCountry={netflixCountry}
                    netflixType={netflixType}
                    onChangeNetflixCountry={setNetflixCountry}
                    onChangeNetflixType={setNetflixType}
                    doubanCategory={doubanCategory}
                    onChangeDoubanCategory={handleChangeDoubanCategory}
                    isUpdating={isFetching}
                    hasMoreDouban={platform.id === "douban" ? effectiveDoubanHasMore : false}
                    isLoadingMoreDouban={platform.id === "douban" ? isLoadingMoreDouban : false}
                    onLoadMoreDouban={platform.id === "douban" ? handleLoadMoreDouban : undefined}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
