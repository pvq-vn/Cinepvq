"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  User as UserIcon,
  Bookmark,
  Heart,
  History,
  Settings,
  LogOut,
  LogIn,
} from "lucide-react";
import { useUserStore } from "@/hooks/useUserStore";

export default function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, mounted, logout } = useUserStore();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!mounted) {
    return (
      <div className="h-9 w-9 rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
    );
  }

  // Guest (Not logged in) state -> Show "Đăng nhập"
  if (!user) {
    return (
      <div className="flex items-center">
        <Link
          href="/dang-nhap"
          aria-label="Đăng nhập tài khoản"
          title="Đăng nhập"
          className="flex h-9 w-9 sm:h-auto sm:w-auto items-center justify-center sm:justify-start gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 sm:px-3.5 sm:py-1.5 text-xs font-bold text-white shadow-md shadow-violet-600/25 active:scale-95 transition-all"
        >
          <LogIn className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
          <span className="hidden sm:inline">Đăng nhập</span>
        </Link>
      </div>
    );
  }

  // Authenticated state -> Show Avatar with Dropdown Menu
  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Tài khoản người dùng"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 text-white shadow-md shadow-violet-500/20 hover:scale-105 active:scale-95 transition-transform text-xs font-bold uppercase ring-2 ring-violet-500/20"
      >
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.username}
            className="h-full w-full object-cover rounded-full"
          />
        ) : (
          user.username?.charAt(0) || <UserIcon className="h-4 w-4" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl ring-1 ring-zinc-200 dark:ring-zinc-800 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Profile Header */}
          <div className="border-b border-zinc-100 dark:border-zinc-800/80 px-4 py-3">
            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
              {user.username}
            </p>
            <p className="text-[11px] text-zinc-500 truncate">{user.email}</p>
          </div>

          {/* Menu items */}
          <div className="p-1.5 space-y-0.5">
            <Link
              href="/tai-khoan"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <UserIcon className="h-4 w-4 text-violet-500" />
              <span>Tài khoản</span>
            </Link>
            <Link
              href="/xem-sau"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Bookmark className="h-4 w-4 text-amber-500" />
              <span>Xem sau</span>
            </Link>
            <Link
              href="/yeu-thich"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Heart className="h-4 w-4 text-rose-500" />
              <span>Yêu thích</span>
            </Link>
            <Link
              href="/lich-su"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <History className="h-4 w-4 text-amber-500" />
              <span>Lịch sử</span>
            </Link>
            <Link
              href="/cai-dat"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Settings className="h-4 w-4 text-zinc-400" />
              <span>Cài đặt</span>
            </Link>
          </div>

          {/* Logout */}
          <div className="border-t border-zinc-100 dark:border-zinc-800/80 p-1.5">
            <button
              onClick={() => {
                logout();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left"
            >
              <LogOut className="h-4 w-4" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
