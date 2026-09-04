"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, X, Film, Loader2, ArrowRight } from "lucide-react";
import { searchMovies } from "@/services/api";
import type { Movie } from "@/types/movie";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClose = useCallback(() => {
    setQuery("");
    setResults([]);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  // Debounced search
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    const timer = setTimeout(() => {
      setLoading(true);
      searchMovies(trimmed, 1)
        .then((res) => {
          setResults(res.data.items?.slice(0, 6) ?? []);
        })
        .catch(() => {
          setResults([]);
        })
        .finally(() => {
          setLoading(false);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/tim-kiem?keyword=${encodeURIComponent(trimmed)}`);
    handleClose();
  };

  if (!isOpen) return null;

  const hasQuery = Boolean(query.trim());
  const displayResults = hasQuery ? results : [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity"
        onClick={handleClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl ring-1 ring-zinc-200 dark:ring-zinc-800 transition-all z-10">
        {/* Search input form */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center border-b border-zinc-200 dark:border-zinc-800 px-4 py-3"
        >
          <Search className="h-5 w-5 text-zinc-400 dark:text-zinc-500 mr-3 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm kiếm phim, diễn viên, đạo diễn..."
            className="flex-1 bg-transparent text-base text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none"
          />
          {loading && (
            <Loader2 className="h-5 w-5 animate-spin text-violet-500 mr-2" />
          )}
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
              }}
              className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>

        {/* Results / Suggestions / Empty */}
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {hasQuery && displayResults.length > 0 ? (
            <div className="space-y-1">
              {displayResults.map((movie) => (
                <Link
                  key={movie.slug}
                  href={`/phim/${movie.slug}`}
                  onClick={handleClose}
                  className="flex items-center gap-3.5 rounded-xl p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors"
                >
                  <img
                    src={movie.thumb_url || movie.poster_url}
                    alt={movie.name}
                    className="h-14 w-10 object-cover rounded-md bg-zinc-800 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {movie.name}
                    </h4>
                    {movie.original_name && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                        {movie.original_name}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-400">
                      {movie.year && <span>{movie.year}</span>}
                      {movie.quality && <span>• {movie.quality}</span>}
                      {movie.current_episode && (
                        <span>• {movie.current_episode}</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}

              {/* View all button */}
              <button
                type="button"
                onClick={handleSubmit}
                className="w-full flex items-center justify-center gap-2 py-3 mt-2 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline border-t border-zinc-100 dark:border-zinc-800"
              >
                Xem tất cả kết quả cho &ldquo;{query}&rdquo;
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : hasQuery && !loading ? (
            <div className="py-12 text-center text-zinc-500">
              <Film className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Không tìm thấy bộ phim nào phù hợp</p>
            </div>
          ) : (
            <div className="p-4 text-xs text-zinc-500 dark:text-zinc-400 space-y-2">
              <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                Gợi ý tìm kiếm phổ biến:
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {["Đấu La Đại Lục", "Thám Tử Lừng Danh Conan", "Naruto", "One Piece", "Harry Potter", "Spider-Man"].map(
                  (term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => setQuery(term)}
                      className="rounded-lg bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-600 transition-colors"
                    >
                      {term}
                    </button>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
