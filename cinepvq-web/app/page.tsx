"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  getLatestMovies,
  getMoviesByCategory,
  getMoviesByGenre,
  getMoviesByCountry,
} from "@/services/api";
import HeroCarousel from "@/components/HeroCarousel";
import MovieRow from "@/components/MovieRow";
import ContinueWatchingRow from "@/components/ContinueWatchingRow";
import { HeroSkeleton, MovieRowSkeleton } from "@/components/Skeleton";
import { AlertCircle, RefreshCw, Sparkles } from "lucide-react";

export default function Home() {
  // ─── Viewport-based Batching State (Home Performance 2.0) ──────────────────
  // Batch 1: Loaded immediately on mount (Hero, ContinueWatching, Top Phim, Phim Mới, Phim Bộ)
  // Batch 2: Loaded when scrolling near bottom of Batch 1 (Phim Lẻ, Hoạt Hình, TV Show)
  // Batch 3: Loaded when scrolling near bottom of Batch 2 (Hành Động, Âu Mỹ, Hàn Quốc)
  const [isBatch2Active, setIsBatch2Active] = useState<boolean>(false);
  const [isBatch3Active, setIsBatch3Active] = useState<boolean>(false);

  const batch2SentinelRef = useRef<HTMLDivElement>(null);
  const batch3SentinelRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver for Batch 2
  useEffect(() => {
    if (isBatch2Active) return;
    if (typeof window !== "undefined" && !("IntersectionObserver" in window)) {
      const timer = setTimeout(() => setIsBatch2Active(true), 0);
      return () => clearTimeout(timer);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsBatch2Active(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px 0px" }
    );

    const el = batch2SentinelRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [isBatch2Active]);

  // IntersectionObserver for Batch 3
  useEffect(() => {
    if (!isBatch2Active || isBatch3Active) return;
    if (typeof window !== "undefined" && !("IntersectionObserver" in window)) {
      const timer = setTimeout(() => setIsBatch3Active(true), 0);
      return () => clearTimeout(timer);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsBatch3Active(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px 0px" }
    );

    const el = batch3SentinelRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [isBatch2Active, isBatch3Active]);

  // ─── BATCH 1 QUERIES (Mount immediately) ───────────────────────────────────

  // Query 1: Latest movies (Used for Hero Carousel + Top Phim + Phim mới cập nhật)
  const {
    data: latestData,
    isLoading: latestLoading,
    isError: latestError,
    refetch: refetchLatest,
  } = useQuery({
    queryKey: ["home-latest"],
    queryFn: async () => (await getLatestMovies(1)).data,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Query 2: Phim bộ
  const { data: seriesData, isLoading: seriesLoading } = useQuery({
    queryKey: ["home-phim-bo"],
    queryFn: async () => (await getMoviesByCategory("phim-bo", 1)).data,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // ─── BATCH 2 QUERIES (Enabled when isBatch2Active = true) ───────────────────

  // Query 3: Phim lẻ
  const { data: singleData, isLoading: singleLoading } = useQuery({
    queryKey: ["home-phim-le"],
    queryFn: async () => (await getMoviesByCategory("phim-le", 1)).data,
    enabled: isBatch2Active,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Query 4: Hoạt hình
  const { data: animeData, isLoading: animeLoading } = useQuery({
    queryKey: ["home-hoat-hinh"],
    queryFn: async () => (await getMoviesByCategory("hoat-hinh", 1)).data,
    enabled: isBatch2Active,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Query 5: TV Show
  const { data: tvShowData, isLoading: tvShowLoading } = useQuery({
    queryKey: ["home-tv-shows"],
    queryFn: async () => (await getMoviesByCategory("tv-shows", 1)).data,
    enabled: isBatch2Active,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // ─── BATCH 3 QUERIES (Enabled when isBatch3Active = true) ───────────────────

  // Query 6: Thể loại Hành động
  const { data: actionData, isLoading: actionLoading } = useQuery({
    queryKey: ["home-genre-hanh-dong"],
    queryFn: async () => (await getMoviesByGenre("hanh-dong", 1)).data,
    enabled: isBatch3Active,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Query 7: Quốc gia Âu Mỹ
  const { data: westernData, isLoading: westernLoading } = useQuery({
    queryKey: ["home-country-au-my"],
    queryFn: async () => (await getMoviesByCountry("au-my", 1)).data,
    enabled: isBatch3Active,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Query 8: Quốc gia Hàn Quốc
  const { data: koreanData, isLoading: koreanLoading } = useQuery({
    queryKey: ["home-country-han-quoc"],
    queryFn: async () => (await getMoviesByCountry("han-quoc", 1)).data,
    enabled: isBatch3Active,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Handle Full Page Error if first query fails
  if (latestError) {
    return (
      <main className="flex-1 min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500 mb-4">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
          Không thể kết nối đến máy chủ phim
        </h2>
        <p className="mt-2 text-xs text-zinc-500 max-w-sm">
          Dịch vụ phim tạm thời không phản hồi. Vui lòng kiểm tra lại kết nối mạng của bạn.
        </p>
        <button
          onClick={() => refetchLatest()}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-600/30 hover:bg-violet-500 transition-all"
        >
          <RefreshCw className="h-4 w-4" />
          Thử lại
        </button>
      </main>
    );
  }

  const latestMovies = latestData?.items ?? [];

  return (
    <main className="flex-1 pb-16">
      {/* ── BATCH 1: Top Priority Sections (Instant Mount) ── */}

      {/* 1. Hero Cinematic Carousel */}
      {latestLoading ? (
        <HeroSkeleton />
      ) : (
        <HeroCarousel movies={latestMovies} />
      )}

      {/* Continue Watching Shelf (Auto-hides if empty, uses local store/auth) */}
      <ContinueWatchingRow />

      {/* 2. Trending / Top Phim Hôm Nay (Ranking shelf) */}
      <div className="mt-6">
        {latestLoading ? (
          <div className="px-4 sm:px-6 lg:px-8">
            <MovieRowSkeleton />
          </div>
        ) : (
          <MovieRow
            title="🔥 Top Phim Hôm Nay"
            subtitle="Các bộ phim nổi bật được khán giả theo dõi nhiều nhất"
            seeAllHref="/thinh-hanh"
            movies={latestMovies.slice(0, 10)}
            variant="ranking"
          />
        )}
      </div>

      {/* Quick Genre Tags Banner */}
      <section className="px-4 sm:px-6 lg:px-8 my-6">
        <div className="mx-auto max-w-7xl flex items-center gap-2 overflow-x-auto scrollbar-none py-2">
          <span className="text-xs font-bold text-zinc-400 flex items-center gap-1 flex-shrink-0 mr-2">
            <Sparkles className="h-3.5 w-3.5 text-violet-500" />
            Thể loại:
          </span>
          {[
            { label: "Hành Động", href: "/the-loai/hanh-dong" },
            { label: "Tình Cảm", href: "/the-loai/tinh-cam" },
            { label: "Hài Hước", href: "/the-loai/phim-hai" },
            { label: "Cổ Trang", href: "/the-loai/co-trang" },
            { label: "Kinh Dị", href: "/the-loai/kinh-di" },
            { label: "Khoa Học Viễn Tưởng", href: "/the-loai/khoa-hoc-vien-tuong" },
            { label: "Tâm Lý", href: "/the-loai/tam-ly" },
            { label: "Hình Sự", href: "/the-loai/hinh-su" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex-shrink-0 rounded-full px-3.5 py-1 text-xs font-medium bg-zinc-100 dark:bg-zinc-900 hover:bg-violet-600 hover:text-white dark:hover:bg-violet-600 dark:hover:text-white text-zinc-700 dark:text-zinc-300 transition-colors shadow-sm"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/the-loai"
            className="flex-shrink-0 text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline ml-2"
          >
            Tất cả →
          </Link>
        </div>
      </section>

      {/* 3. Phim Mới Cập Nhật */}
      <div>
        {latestLoading ? (
          <div className="px-4 sm:px-6 lg:px-8">
            <MovieRowSkeleton />
          </div>
        ) : (
          <MovieRow
            title="Phim Mới Cập Nhật"
            subtitle="Những tác phẩm vừa được cập nhật tập mới"
            seeAllHref="/phim"
            movies={latestMovies}
          />
        )}
      </div>

      {/* 4. Phim Bộ Mới */}
      <div>
        {seriesLoading ? (
          <div className="px-4 sm:px-6 lg:px-8">
            <MovieRowSkeleton />
          </div>
        ) : (
          <MovieRow
            title="Phim Bộ Đặc Sắc"
            subtitle="Series dài tập lôi cuốn, trọn bộ vietsub chất lượng cao"
            seeAllHref="/phim-bo"
            movies={seriesData?.items ?? []}
          />
        )}
      </div>

      {/* ── SENTINEL 1: Triggers Batch 2 when near viewport ── */}
      <div ref={batch2SentinelRef} className="h-1 w-full pointer-events-none" />

      {/* ── BATCH 2: Phim Lẻ, Hoạt Hình, TV Show ── */}
      {isBatch2Active ? (
        <>
          {/* 5. Phim Lẻ Mới */}
          <div>
            {singleLoading ? (
              <div className="px-4 sm:px-6 lg:px-8 my-8">
                <MovieRowSkeleton />
              </div>
            ) : (
              <MovieRow
                title="Phim Lẻ Chiếu Rạp"
                subtitle="Bom tấn điện ảnh màn ảnh rộng không thể bỏ lỡ"
                seeAllHref="/phim-le"
                movies={singleData?.items ?? []}
              />
            )}
          </div>

          {/* 6. Hoạt Hình Mới */}
          <div>
            {animeLoading ? (
              <div className="px-4 sm:px-6 lg:px-8 my-8">
                <MovieRowSkeleton />
              </div>
            ) : (
              <MovieRow
                title="Thế Giới Hoạt Hình & Anime"
                subtitle="Các bộ phim hoạt hình kinh điển và anime hot nhất"
                seeAllHref="/hoat-hinh"
                movies={animeData?.items ?? []}
              />
            )}
          </div>

          {/* 7. TV Show Mới */}
          <div>
            {tvShowLoading ? (
              <div className="px-4 sm:px-6 lg:px-8 my-8">
                <MovieRowSkeleton />
              </div>
            ) : (
              <MovieRow
                title="Chương Trình TV Show"
                subtitle="Gameshow truyền hình và các chương trình thực tế thú vị"
                seeAllHref="/tv-show"
                movies={tvShowData?.items ?? []}
              />
            )}
          </div>
        </>
      ) : null}

      {/* ── SENTINEL 2: Triggers Batch 3 when near viewport ── */}
      <div ref={batch3SentinelRef} className="h-1 w-full pointer-events-none" />

      {/* ── BATCH 3: Thể Loại Hành Động, Bom Tấn Âu Mỹ, K-Drama Hàn Quốc ── */}
      {isBatch3Active ? (
        <>
          {/* 8. Phim Hành Động Kịch Tính */}
          <div>
            {actionLoading ? (
              <div className="px-4 sm:px-6 lg:px-8 my-8">
                <MovieRowSkeleton />
              </div>
            ) : (
              <MovieRow
                title="Hành Động Kịch Tính"
                subtitle="Nghẹt thở với những pha rượt đuổi và cận chiến mãn nhãn"
                seeAllHref="/the-loai/hanh-dong"
                movies={actionData?.items ?? []}
              />
            )}
          </div>

          {/* 9. Bom Tấn Âu Mỹ */}
          <div>
            {westernLoading ? (
              <div className="px-4 sm:px-6 lg:px-8 my-8">
                <MovieRowSkeleton />
              </div>
            ) : (
              <MovieRow
                title="Điện Ảnh Âu Mỹ"
                subtitle="Hollywood đỉnh cao với kỹ xảo và âm thanh sống động"
                seeAllHref="/quoc-gia/au-my"
                movies={westernData?.items ?? []}
              />
            )}
          </div>

          {/* 10. K-Drama Hàn Quốc */}
          <div>
            {koreanLoading ? (
              <div className="px-4 sm:px-6 lg:px-8 my-8">
                <MovieRowSkeleton />
              </div>
            ) : (
              <MovieRow
                title="K-Drama Hàn Quốc Tuyển Chọn"
                subtitle="Những câu chuyện tình cảm lãng mạn và kịch tính xứ sở kim chi"
                seeAllHref="/quoc-gia/han-quoc"
                movies={koreanData?.items ?? []}
              />
            )}
          </div>
        </>
      ) : null}
    </main>
  );
}
