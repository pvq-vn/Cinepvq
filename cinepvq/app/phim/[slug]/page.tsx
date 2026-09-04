"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useFetchMovieDetail } from "@/hooks/useMovies";
import VideoPlayer from "@/components/VideoPlayer";

export default function MovieDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: movie, isLoading, isError } = useFetchMovieDetail(slug);

  // ─── Episode state ─────────────────────────────────────────────────────────
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string>("");
  const [activeEpisodeSlug, setActiveEpisodeSlug] = useState<string>("");

  // Auto-select first episode when data loads
  useEffect(() => {
    if (movie?.episodes?.length) {
      const firstServer = movie.episodes[0];
      if (firstServer?.items?.length) {
        const firstEp = firstServer.items[0];
        setCurrentVideoUrl(firstEp.embed);
        setActiveEpisodeSlug(firstEp.slug);
      }
    }
  }, [movie]);

  // ─── Error state ───────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
          <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-red-600 dark:text-red-400">
          Không tải được thông tin phim
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Vui lòng kiểm tra kết nối mạng và thử lại.
        </p>
      </div>
    );
  }

  // ─── Loading state ─────────────────────────────────────────────────────────
  if (isLoading || !movie) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 rounded-full border-4 border-zinc-200 dark:border-zinc-800" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-violet-600 animate-spin" />
        </div>
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 animate-pulse">
          Đang tải phim...
        </p>
      </div>
    );
  }

  // ─── Handle episode click ─────────────────────────────────────────────────
  const handleEpisodeClick = (episodeSlug: string, embedUrl: string) => {
    setCurrentVideoUrl(embedUrl);
    setActiveEpisodeSlug(episodeSlug);
    // Scroll to top to see the player
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main className="flex-1 pt-20 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-8">

        {/* ── Video Player ───────────────────────────────────────────────── */}
        {currentVideoUrl ? (
          <VideoPlayer videoUrl={currentVideoUrl} />
        ) : (
          <div className="relative w-full overflow-hidden rounded-xl bg-zinc-900 aspect-video flex items-center justify-center">
            <p className="text-zinc-500">Chọn một tập phim để xem</p>
          </div>
        )}

        {/* ── Movie Info ─────────────────────────────────────────────────── */}
        <section className="space-y-4">
          {/* Title */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl text-zinc-900 dark:text-zinc-50">
              {movie.name}
            </h1>
            {movie.original_name && (
              <p className="mt-1 text-base text-zinc-500 dark:text-zinc-400 italic">
                {movie.original_name}
              </p>
            )}
          </div>

          {/* Meta badges */}
          <div className="flex flex-wrap items-center gap-2">
            {movie.quality && (
              <span className="inline-flex items-center rounded-md bg-violet-600/15 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:text-violet-300 ring-1 ring-inset ring-violet-600/20">
                {movie.quality}
              </span>
            )}
            {movie.language && (
              <span className="inline-flex items-center rounded-md bg-sky-600/15 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:text-sky-300 ring-1 ring-inset ring-sky-600/20">
                {movie.language}
              </span>
            )}
            {movie.time && (
              <span className="inline-flex items-center rounded-md bg-zinc-600/10 px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300 ring-1 ring-inset ring-zinc-500/20">
                ⏱ {movie.time}
              </span>
            )}
            {movie.current_episode && (
              <span className="inline-flex items-center rounded-md bg-amber-600/15 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300 ring-1 ring-inset ring-amber-600/20">
                {movie.current_episode}
              </span>
            )}
          </div>

          {/* Categories & Country */}
          <div className="flex flex-wrap gap-2">
            {Array.isArray(movie.category)
              ? movie.category.map((cat) => (
                  <span
                    key={cat.slug}
                    className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-700 dark:hover:text-violet-300"
                  >
                    {cat.name}
                  </span>
                ))
              : null}
            {Array.isArray(movie.country)
              ? movie.country.map((c) => (
                  <span
                    key={c.slug}
                    className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    🌍 {c.name}
                  </span>
                ))
              : null}
          </div>

          {/* Director & Cast */}
          {(movie.director || movie.casts) && (
            <div className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              {movie.director && (
                <p>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">Đạo diễn:</span>{" "}
                  {movie.director}
                </p>
              )}
              {movie.casts && (
                <p>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">Diễn viên:</span>{" "}
                  {movie.casts}
                </p>
              )}
            </div>
          )}

          {/* Description */}
          {movie.description && (
            <div
              className="prose prose-sm prose-zinc dark:prose-invert max-w-none leading-relaxed"
              dangerouslySetInnerHTML={{ __html: movie.description }}
            />
          )}
        </section>

        {/* ── Episode List ───────────────────────────────────────────────── */}
        {Array.isArray(movie.episodes) && movie.episodes.length > 0 && (
          <section className="space-y-6">
            {movie.episodes.map((server) => (
              <div key={server.server_name} className="space-y-3">
                {/* Server name */}
                <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-500" />
                  {server.server_name}
                </h3>

                {/* Episode buttons */}
                <div className="flex flex-wrap gap-2">
                  {server.items.map((ep) => {
                    const isActive = ep.slug === activeEpisodeSlug;
                    return (
                      <button
                        key={ep.slug}
                        onClick={() => handleEpisodeClick(ep.slug, ep.embed)}
                        className={`
                          relative rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200
                          focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950
                          ${
                            isActive
                              ? "bg-violet-600 text-white shadow-lg shadow-violet-500/30"
                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-violet-100 dark:hover:bg-violet-900/40 hover:text-violet-700 dark:hover:text-violet-300"
                          }
                        `}
                      >
                        {ep.name}
                        {isActive && (
                          <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-violet-500" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
