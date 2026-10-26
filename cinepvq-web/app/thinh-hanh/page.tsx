"use client";

import { useState } from "react";
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
  RefreshCw,
  Star,
  Eye,
  Play,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import type {
  PlatformId,
  PlatformRankingSection,
  TrendingRankingsPayload,
  TrendingRankItem,
} from "@/services/trendingCrawler";

type TabFilter = "all" | PlatformId;

const PLATFORM_TABS: {
  key: TabFilter;
  label: string;
  badge: string;
  activeClass: string;
}[] = [
  {
    key: "all",
    label: "Tất Cả BXH",
    badge: "5 Nền tảng",
    activeClass: "from-amber-500 via-orange-500 to-rose-500 shadow-orange-500/25",
  },
  {
    key: "netflix",
    label: "Netflix Top 10",
    badge: "Global",
    activeClass: "from-red-600 to-rose-700 shadow-red-600/25",
  },
  {
    key: "douban",
    label: "Douban (豆瓣)",
    badge: "Điểm cao",
    activeClass: "from-emerald-600 to-teal-700 shadow-emerald-600/25",
  },
  {
    key: "vieon",
    label: "VieON",
    badge: "Xu hướng VN",
    activeClass: "from-lime-600 to-emerald-600 shadow-lime-600/25",
  },
  {
    key: "fptplay",
    label: "FPT Play",
    badge: "Hot 24h",
    activeClass: "from-orange-500 to-red-500 shadow-orange-500/25",
  },
  {
    key: "iqiyi",
    label: "iQIYI & WeTV",
    badge: "Độ nhiệt",
    activeClass: "from-teal-500 to-cyan-600 shadow-teal-500/25",
  },
];

function PodiumCard({ item }: { item: TrendingRankItem }) {
  const rank = item.rank;
  const badgeColor =
    rank === 1
      ? "from-amber-400 to-yellow-500 text-black"
      : rank === 2
        ? "from-slate-200 to-zinc-400 text-black"
        : "from-amber-600 to-amber-800 text-white";

  return (
    <div className="relative flex flex-col p-3.5 rounded-2xl bg-zinc-100/70 dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800/80 hover:border-amber-500/50 transition-all shadow-md hover:shadow-xl">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span
          className={`inline-flex items-center gap-1 font-black text-xs px-2.5 py-1 rounded-lg bg-gradient-to-r ${badgeColor} shadow-sm`}
        >
          <Award className="h-3.5 w-3.5" />
          TOP {rank}
        </span>

        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {item.score.toFixed(1)} {item.scoreSource}
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <Eye className="h-3 w-3" />
            {item.formattedViews.replace(" lượt xem", "")}
          </span>
        </div>
      </div>

      <MovieCard movie={item} variant="ranking" rank={rank} />

      <div className="mt-2.5 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
        <span className="font-semibold text-zinc-700 dark:text-zinc-300 truncate">
          {item.heatLabel}
        </span>
        {item.trendDelta > 0 ? (
          <span className="text-emerald-500 font-bold flex items-center gap-0.5 shrink-0">
            <TrendingUp className="h-3 w-3" />+{item.trendDelta} hạng
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
}: {
  platform: PlatformRankingSection;
  onSelectPlatform: (id: PlatformId) => void;
  expanded: boolean;
}) {
  const top3 = platform.items.slice(0, 3);
  const rest = expanded ? platform.items.slice(3, 12) : platform.items.slice(3, 9);

  return (
    <section className="rounded-3xl bg-white dark:bg-zinc-900/50 border border-zinc-200/80 dark:border-zinc-800/80 overflow-hidden shadow-lg">
      {/* Platform Branded Header */}
      <div
        className={`bg-gradient-to-r ${platform.brandColor} p-5 sm:p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-black/30 px-2.5 py-0.5 text-[10px] font-black tracking-wider uppercase">
              {platform.badgeText}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-white/85">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Đã đồng bộ trực tiếp
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-300 shrink-0" />
            <span>Bảng Xếp Hạng {platform.name}</span>
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
              className="inline-flex items-center gap-1.5 rounded-xl bg-white text-zinc-900 hover:bg-zinc-100 px-3.5 py-2 text-xs font-extrabold shadow transition-all"
            >
              <span>Xem trọn BXH {platform.name}</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Platform Body */}
      <div className="p-4 sm:p-6 space-y-8">
        {/* Top 3 Podium */}
        {top3.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {top3.map((item) => (
              <PodiumCard key={`${platform.id}-${item.slug}`} item={item} />
            ))}
          </div>
        )}

        {/* Remaining Ranked Items */}
        {rest.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm sm:text-base font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span>
                  Hạng #4 – #{3 + rest.length} trên {platform.name}
                </span>
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {rest.map((item) => (
                <div
                  key={`${platform.id}-${item.slug}`}
                  className="flex flex-col space-y-1.5"
                >
                  <MovieCard movie={item} variant="ranking" rank={item.rank} />
                  <div className="flex items-center justify-between px-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    <span className="font-bold text-amber-500 flex items-center gap-0.5">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {item.score.toFixed(1)}
                    </span>
                    <span className="truncate">{item.formattedViews}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default function TrendingPage() {
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [isRefreshingCrawl, setIsRefreshingCrawl] = useState(false);

  const {
    data: trendingPayload,
    isLoading,
    isError,
    refetch,
  } = useQuery<TrendingRankingsPayload>({
    queryKey: ["crawled-platform-rankings"],
    queryFn: async () => {
      const res = await fetch("/api/trending");
      if (!res.ok) throw new Error("Failed to load rankings");
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const handleForceCrawl = async () => {
    if (isRefreshingCrawl) return;
    setIsRefreshingCrawl(true);
    try {
      const res = await fetch("/api/trending?refresh=true");
      if (res.ok) {
        await refetch();
      }
    } finally {
      setIsRefreshingCrawl(false);
    }
  };

  const platforms = trendingPayload?.platforms ?? [];
  const visiblePlatforms =
    activeTab === "all"
      ? platforms
      : platforms.filter((p) => p.id === activeTab);

  // Number 1 overall movie across platforms for spotlight banner
  const spotlightItem = visiblePlatforms[0]?.items?.[0];

  return (
    <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-500 mb-3 border border-amber-500/20">
              <Flame className="h-4 w-4 fill-current" />
              Hệ thống Crawl BXH Đa Nền Tảng (Real-time)
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-transparent">
              Bảng Xếp Hạng Thịnh Hành
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl">
              Tự động tổng hợp và đồng bộ bảng xếp hạng phim ăn khách nhất từ{" "}
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                Netflix, Douban (豆瓣), VieON, FPT Play và iQIYI / WeTV
              </span>
              .
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
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 dark:bg-zinc-800 hover:bg-violet-600 dark:hover:bg-violet-600 text-white px-4 py-2.5 text-xs font-bold shadow transition-all disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isRefreshingCrawl ? "animate-spin" : ""}`}
              />
              <span>
                {isRefreshingCrawl ? "Đang cào BXH mới..." : "Làm mới BXH trực tiếp"}
              </span>
            </button>
          </div>
        </div>

        {/* Platform Switcher Tabs */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
          {PLATFORM_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all shrink-0 ${
                  isActive
                    ? `bg-gradient-to-r ${tab.activeClass} text-white shadow-lg scale-[1.02]`
                    : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-200/70 dark:border-zinc-800"
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

        {/* Spotlight Top #1 Banner */}
        {!isLoading && spotlightItem && (
          <div className="relative overflow-hidden rounded-3xl bg-zinc-900 text-white border border-white/10 shadow-2xl">
            <div className="absolute inset-0">
              <img
                src={spotlightItem.poster_url || spotlightItem.thumb_url}
                alt={spotlightItem.name}
                className="h-full w-full object-cover opacity-35 blur-xs scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/85 to-transparent" />
            </div>

            <div className="relative z-10 p-6 sm:p-8 md:p-10 flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <img
                src={spotlightItem.thumb_url || spotlightItem.poster_url}
                alt={spotlightItem.name}
                className="w-28 sm:w-36 aspect-[2/3] rounded-2xl object-cover shadow-2xl ring-2 ring-amber-400/60 shrink-0"
              />
              <div className="space-y-3 max-w-2xl">
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
                {spotlightItem.original_name && (
                  <p className="text-xs sm:text-sm text-zinc-300 font-medium">
                    {spotlightItem.original_name} • {spotlightItem.year || "2025"} •{" "}
                    {spotlightItem.current_episode || "Full HD"}
                  </p>
                )}

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/phim/${spotlightItem.slug}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-extrabold px-5 py-2.5 text-xs sm:text-sm shadow-lg shadow-orange-500/25 transition-all"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    <span>Xem Phim Ngay</span>
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
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow"
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
              <div key={platform.id} className={idx > 0 ? "cv-auto" : undefined}>
                <PlatformBxhSection
                  platform={platform}
                  onSelectPlatform={(id) => {
                    setActiveTab(id);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  expanded={activeTab !== "all"}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
