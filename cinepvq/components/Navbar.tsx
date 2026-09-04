"use client";

import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Film,
  Sun,
  Moon,
  Menu,
  X,
  Search,
  ChevronDown,
  Download,
  Settings as SettingsIcon,
  Flame,
} from "lucide-react";
import { GENRES, COUNTRIES } from "@/lib/taxonomy";
import SearchModal from "@/components/SearchModal";
import NotificationDropdown from "@/components/NotificationDropdown";
import UserMenu from "@/components/UserMenu";
import DownloadAppModal from "@/components/DownloadAppModal";

const emptySubscribe = () => () => {};

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);

  // Dropdown states
  const [genreOpen, setGenreOpen] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);

  // Close menus on route change without cascading effect
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setMobileOpen(false);
    setGenreOpen(false);
    setCountryOpen(false);
  }

  const genreRef = useRef<HTMLDivElement>(null);
  const countryRef = useRef<HTMLDivElement>(null);

  const { setTheme, resolvedTheme } = useTheme();

  // Safe client mount check
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Keyboard shortcut Ctrl+K for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchModalOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Track scroll for backdrop blur styling
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 15);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (genreRef.current && !genreRef.current.contains(e.target as Node)) {
        setGenreOpen(false);
      }
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
        setCountryOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleTheme = () =>
    setTheme(resolvedTheme === "dark" ? "light" : "dark");

  const navLinks = [
    { label: "Trang chủ", href: "/" },
    { label: "Phim bộ", href: "/phim-bo" },
    { label: "Phim lẻ", href: "/phim-le" },
    { label: "Hoạt hình", href: "/hoat-hinh" },
    { label: "TV Show", href: "/tv-show" },
  ];

  return (
    <>
      <header
        className={`
          fixed top-0 left-0 right-0 z-40
          transition-all duration-300
          ${
            scrolled
              ? "bg-white/85 dark:bg-zinc-950/85 backdrop-blur-xl border-b border-zinc-200/60 dark:border-zinc-800/60 shadow-lg shadow-zinc-900/5 dark:shadow-black/30"
              : "bg-gradient-to-b from-black/80 via-black/40 to-transparent text-white border-b border-transparent"
          }
        `}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-2">
            {/* ── Logo ── */}
            <Link
              href="/"
              className="group flex items-center gap-2.5 flex-shrink-0"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700 shadow-md shadow-violet-500/25 transition-transform duration-300 group-hover:scale-105">
                <Film className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-violet-500 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Cinépvq
              </span>
            </Link>

            {/* ── Desktop Navigation Links ── */}
            <nav className="hidden xl:flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`
                      px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200
                      ${
                        isActive
                          ? "bg-violet-600/15 text-violet-600 dark:text-violet-400 font-bold"
                          : scrolled
                            ? "text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70"
                            : "text-zinc-200 hover:text-white hover:bg-white/10"
                      }
                    `}
                  >
                    {link.label}
                  </Link>
                );
              })}

              {/* ── Thể loại Dropdown ── */}
              <div className="relative" ref={genreRef}>
                <button
                  onClick={() => {
                    setGenreOpen((prev) => !prev);
                    setCountryOpen(false);
                  }}
                  className={`
                    flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200
                    ${
                      pathname.startsWith("/the-loai")
                        ? "bg-violet-600/15 text-violet-600 dark:text-violet-400 font-bold"
                        : scrolled
                          ? "text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70"
                          : "text-zinc-200 hover:text-white hover:bg-white/10"
                    }
                  `}
                >
                  Thể loại
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${
                      genreOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {genreOpen && (
                  <div className="absolute left-0 mt-2 w-72 p-3 rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl ring-1 ring-zinc-200 dark:ring-zinc-800 grid grid-cols-2 gap-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    {GENRES.map((g) => (
                      <Link
                        key={g.slug}
                        href={`/the-loai/${g.slug}`}
                        onClick={() => setGenreOpen(false)}
                        className="px-2.5 py-1.5 text-xs rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-violet-50 dark:hover:bg-violet-900/30 hover:text-violet-600 dark:hover:text-violet-400 font-medium transition-colors"
                      >
                        {g.name}
                      </Link>
                    ))}
                    <div className="col-span-2 pt-2 mt-1 border-t border-zinc-100 dark:border-zinc-800 text-center">
                      <Link
                        href="/the-loai"
                        onClick={() => setGenreOpen(false)}
                        className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline"
                      >
                        Tất cả thể loại →
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Quốc gia Dropdown ── */}
              <div className="relative" ref={countryRef}>
                <button
                  onClick={() => {
                    setCountryOpen((prev) => !prev);
                    setGenreOpen(false);
                  }}
                  className={`
                    flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200
                    ${
                      pathname.startsWith("/quoc-gia")
                        ? "bg-violet-600/15 text-violet-600 dark:text-violet-400 font-bold"
                        : scrolled
                          ? "text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70"
                          : "text-zinc-200 hover:text-white hover:bg-white/10"
                    }
                  `}
                >
                  Quốc gia
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${
                      countryOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {countryOpen && (
                  <div className="absolute left-0 mt-2 w-64 p-3 rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl ring-1 ring-zinc-200 dark:ring-zinc-800 grid grid-cols-2 gap-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    {COUNTRIES.map((c) => (
                      <Link
                        key={c.slug}
                        href={`/quoc-gia/${c.slug}`}
                        onClick={() => setCountryOpen(false)}
                        className="px-2.5 py-1.5 text-xs rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-violet-50 dark:hover:bg-violet-900/30 hover:text-violet-600 dark:hover:text-violet-400 font-medium transition-colors"
                      >
                        {c.name}
                      </Link>
                    ))}
                    <div className="col-span-2 pt-2 mt-1 border-t border-zinc-100 dark:border-zinc-800 text-center">
                      <Link
                        href="/quoc-gia"
                        onClick={() => setCountryOpen(false)}
                        className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline"
                      >
                        Tất cả quốc gia →
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Thịnh hành Link ── */}
              <Link
                href="/thinh-hanh"
                className={`
                  flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200
                  ${
                    pathname === "/thinh-hanh"
                      ? "bg-amber-500/15 text-amber-500 dark:text-amber-400 font-extrabold"
                      : scrolled
                        ? "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                        : "text-amber-400 hover:bg-white/10"
                  }
                `}
              >
                <Flame className="h-3.5 w-3.5 fill-current" />
                Thịnh hành
              </Link>
            </nav>

            {/* ── Right action buttons ── */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Search button trigger */}
              <button
                onClick={() => setSearchModalOpen(true)}
                aria-label="Tìm kiếm phim"
                className={`
                  flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors
                  ${
                    scrolled
                      ? "bg-zinc-100/80 dark:bg-zinc-900/80 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 ring-1 ring-zinc-200/50 dark:ring-zinc-800/50"
                      : "bg-black/30 backdrop-blur-md text-zinc-300 hover:bg-black/50 ring-1 ring-white/10"
                  }
                `}
              >
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline">Tìm kiếm...</span>
                <kbd className="hidden md:inline rounded bg-black/20 dark:bg-white/10 px-1.5 py-0.5 text-[10px] text-zinc-400">
                  Ctrl K
                </kbd>
              </button>

              {/* Download App button */}
              <button
                onClick={() => setDownloadModalOpen(true)}
                aria-label="Tải ứng dụng"
                className={`
                  hidden sm:flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors
                  ${
                    scrolled
                      ? "bg-violet-600/10 text-violet-600 dark:text-violet-400 hover:bg-violet-600/20"
                      : "bg-white/15 backdrop-blur-md text-white hover:bg-white/25"
                  }
                `}
              >
                <Download className="h-3.5 w-3.5" />
                <span>Tải App</span>
              </button>

              {/* Notifications */}
              <NotificationDropdown />

              {/* Settings link */}
              <Link
                href="/cai-dat"
                aria-label="Cài đặt hệ thống"
                className={`
                  flex h-9 w-9 items-center justify-center rounded-lg transition-colors
                  ${
                    scrolled
                      ? "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white"
                      : "text-zinc-200 hover:bg-white/10 hover:text-white"
                  }
                `}
              >
                <SettingsIcon className="h-4 w-4" />
              </Link>

              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                aria-label="Chuyển đổi sáng/tối"
                className={`
                  flex h-9 w-9 items-center justify-center rounded-lg transition-colors
                  ${
                    scrolled
                      ? "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white"
                      : "text-zinc-200 hover:bg-white/10 hover:text-white"
                  }
                `}
              >
                {mounted ? (
                  resolvedTheme === "dark" ? (
                    <Sun className="h-4 w-4 text-amber-400" />
                  ) : (
                    <Moon className="h-4 w-4 text-zinc-700" />
                  )
                ) : (
                  <span className="h-4 w-4" />
                )}
              </button>

              {/* User Account */}
              <UserMenu />

              {/* Mobile Hamburger toggle */}
              <button
                onClick={() => setMobileOpen((prev) => !prev)}
                aria-label={mobileOpen ? "Đóng menu" : "Mở menu"}
                className={`
                  flex xl:hidden h-9 w-9 items-center justify-center rounded-lg transition-colors
                  ${
                    scrolled
                      ? "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white"
                      : "text-white hover:bg-white/10"
                  }
                `}
              >
                {mobileOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Mobile Drawer ── */}
        <div
          className={`
            xl:hidden overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out
            bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl border-b border-zinc-200/80 dark:border-zinc-800/80
            ${mobileOpen ? "max-h-[85vh] opacity-100 overflow-y-auto" : "max-h-0 opacity-0"}
          `}
        >
          <div className="p-4 space-y-4">
            {/* Primary Nav Links */}
            <div className="grid grid-cols-2 gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="px-3 py-2 text-xs font-semibold rounded-lg bg-zinc-100/70 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-violet-600/10 hover:text-violet-600 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/thinh-hanh"
                onClick={() => setMobileOpen(false)}
                className="col-span-2 px-3 py-2 text-xs font-bold rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center gap-1.5"
              >
                <Flame className="h-4 w-4 fill-current" />
                Bảng xếp hạng Thịnh hành
              </Link>
            </div>

            {/* Quick Genres */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Thể loại
                </span>
                <Link
                  href="/the-loai"
                  onClick={() => setMobileOpen(false)}
                  className="text-[11px] font-semibold text-violet-600 dark:text-violet-400"
                >
                  Xem tất cả →
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {GENRES.slice(0, 9).map((g) => (
                  <Link
                    key={g.slug}
                    href={`/the-loai/${g.slug}`}
                    onClick={() => setMobileOpen(false)}
                    className="p-1.5 text-[11px] text-center rounded bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-violet-600 truncate"
                  >
                    {g.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Quick Countries */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Quốc gia
                </span>
                <Link
                  href="/quoc-gia"
                  onClick={() => setMobileOpen(false)}
                  className="text-[11px] font-semibold text-violet-600 dark:text-violet-400"
                >
                  Xem tất cả →
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {COUNTRIES.slice(0, 6).map((c) => (
                  <Link
                    key={c.slug}
                    href={`/quoc-gia/${c.slug}`}
                    onClick={() => setMobileOpen(false)}
                    className="p-1.5 text-[11px] text-center rounded bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-violet-600 truncate"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Actions: Download App */}
            <button
              onClick={() => {
                setMobileOpen(false);
                setDownloadModalOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 text-white text-xs font-bold shadow-md shadow-violet-600/30"
            >
              <Download className="h-4 w-4" />
              Cài đặt Ứng dụng Cinépvq
            </button>
          </div>
        </div>
      </header>

      {/* Global Search Dialog Modal */}
      <SearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
      />

      {/* Download App Modal */}
      <DownloadAppModal
        isOpen={downloadModalOpen}
        onClose={() => setDownloadModalOpen(false)}
      />
    </>
  );
}
