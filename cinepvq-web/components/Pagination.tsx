"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPage: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  currentPage,
  totalPage,
  onPageChange,
}: PaginationProps) {
  if (totalPage <= 1) return null;

  const isFirst = currentPage <= 1;
  const isLast = currentPage >= totalPage;

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxButtons = 5;

    if (totalPage <= maxButtons + 2) {
      for (let i = 1; i <= totalPage; i++) pages.push(i);
    } else {
      pages.push(1);
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPage - 1, currentPage + 1);

      if (start > 2) pages.push("...");
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPage - 1) pages.push("...");

      pages.push(totalPage);
    }

    return pages;
  };

  return (
    <nav
      aria-label="Phân trang"
      className="mt-12 flex flex-wrap items-center justify-center gap-2 select-none"
    >
      {/* Prev */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={isFirst}
        className={`
          flex items-center gap-1 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all
          ${
            isFirst
              ? "cursor-not-allowed text-zinc-400 dark:text-zinc-600 bg-zinc-100/50 dark:bg-zinc-900/50"
              : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:bg-violet-600 hover:text-white dark:hover:bg-violet-600 dark:hover:text-white shadow-sm"
          }
        `}
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Trang trước</span>
      </button>

      {/* Pages */}
      <div className="flex items-center gap-1">
        {getPageNumbers().map((num, idx) => {
          if (num === "...") {
            return (
              <span
                key={`ellipsis-${idx}`}
                className="px-2 text-xs text-zinc-400"
              >
                ...
              </span>
            );
          }

          const pageNumber = Number(num);
          const isActive = pageNumber === currentPage;

          return (
            <button
              key={`page-${num}`}
              onClick={() => onPageChange(pageNumber)}
              className={`
                h-9 w-9 rounded-xl text-xs font-bold transition-all
                ${
                  isActive
                    ? "bg-violet-600 text-white shadow-md shadow-violet-600/30 scale-105"
                    : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:bg-violet-500/10 hover:text-violet-600"
                }
              `}
            >
              {num}
            </button>
          );
        })}
      </div>

      {/* Next */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={isLast}
        className={`
          flex items-center gap-1 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all
          ${
            isLast
              ? "cursor-not-allowed text-zinc-400 dark:text-zinc-600 bg-zinc-100/50 dark:bg-zinc-900/50"
              : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:bg-violet-600 hover:text-white dark:hover:bg-violet-600 dark:hover:text-white shadow-sm"
          }
        `}
      >
        <span className="hidden sm:inline">Trang sau</span>
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}
