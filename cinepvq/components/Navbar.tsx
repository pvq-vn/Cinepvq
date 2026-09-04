"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { Film, Sun, Moon, Menu, X, Search } from "lucide-react";

const navLinks = [
  { label: "Trang chủ", href: "/" },
  { label: "Phim", href: "/phim" },
  { label: "Thể loại", href: "/the-loai" },
  { label: "Liên hệ", href: "/contact" },
];

export default function Navbar() {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  // Avoid hydration mismatch for theme icon
  useEffect(() => setMounted(true), []);

  // Track scroll to add subtle shadow
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleTheme = () =>
    setTheme(resolvedTheme === "dark" ? "light" : "dark");

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    router.push(`/tim-kiem?keyword=${encodeURIComponent(trimmed)}`);
    setSearchQuery("");
    setSearchOpen(false);
    setMobileOpen(false);
  };

  return (
    <nav
      className={`
        fixed top-0 left-0 right-0 z-50
        bg-white/70 dark:bg-zinc-950/70
        backdrop-blur-xl
        border-b border-zinc-200/60 dark:border-zinc-800/60
        transition-shadow duration-300
        ${scrolled ? "shadow-lg shadow-zinc-900/5 dark:shadow-black/20" : ""}
      `}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* ── Logo ── */}
          <a href="/" className="group flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 shadow-md shadow-violet-500/25 transition-transform duration-200 group-hover:scale-105">
              <Film className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text text-transparent">
              Cinépvq
            </span>
          </a>

          {/* ── Desktop links ── */}
          <ul className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="relative px-3.5 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 rounded-lg transition-colors duration-200 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          {/* ── Right actions ── */}
          <div className="flex items-center gap-2">
            {/* Desktop search bar */}
            <form
              onSubmit={handleSearch}
              className="hidden md:flex items-center"
            >
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm phim..."
                  className="w-48 lg:w-56 rounded-lg border border-zinc-200/60 dark:border-zinc-700/60 bg-zinc-100/50 dark:bg-zinc-800/50 py-2 pl-9 pr-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none transition-all duration-200 focus:w-64 lg:focus:w-72 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 focus:bg-white dark:focus:bg-zinc-800"
                />
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
              </div>
            </form>

            {/* Mobile search toggle */}
            <button
              onClick={() => setSearchOpen((prev) => !prev)}
              aria-label="Tìm kiếm"
              className="flex md:hidden h-9 w-9 items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-400 transition-colors duration-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              <Search className="h-5 w-5" />
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              aria-label="Chuyển đổi chế độ sáng/tối"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-400 transition-colors duration-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              {mounted ? (
                resolvedTheme === "dark" ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )
              ) : (
                <span className="h-5 w-5" />
              )}
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label="Mở menu"
              className="flex md:hidden h-9 w-9 items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-400 transition-colors duration-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
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

      {/* ── Mobile search bar (slide down) ── */}
      <div
        className={`
          md:hidden overflow-hidden
          transition-[max-height,opacity] duration-300 ease-in-out
          ${searchOpen ? "max-h-20 opacity-100" : "max-h-0 opacity-0"}
          border-t border-zinc-200/60 dark:border-zinc-800/60
        `}
      >
        <form onSubmit={handleSearch} className="px-4 py-3">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm phim..."
              className="w-full rounded-lg border border-zinc-200/60 dark:border-zinc-700/60 bg-zinc-100/50 dark:bg-zinc-800/50 py-2.5 pl-10 pr-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none transition-colors duration-200 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
            />
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
          </div>
        </form>
      </div>

      {/* ── Mobile drawer ── */}
      <div
        className={`
          md:hidden overflow-hidden
          transition-[max-height,opacity] duration-300 ease-in-out
          ${mobileOpen ? "max-h-80 opacity-100" : "max-h-0 opacity-0"}
          border-t border-zinc-200/60 dark:border-zinc-800/60
        `}
      >
        <ul className="space-y-1 px-4 py-3">
          {navLinks.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 transition-colors duration-200 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
