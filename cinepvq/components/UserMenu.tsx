"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  User as UserIcon,
  Heart,
  History,
  Settings,
  LogOut,
  LogIn,
  UserPlus,
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

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Tài khoản người dùng"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 text-white shadow-md shadow-violet-500/20 hover:scale-105 active:scale-95 transition-transform"
      >
        <UserIcon className="h-4 w-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl ring-1 ring-zinc-200 dark:ring-zinc-800 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {mounted && user ? (
            <>
              {/* Profile Header */}
              <div className="border-b border-zinc-100 dark:border-zinc-800/80 px-4 py-3">
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                  {user.username}
                </p>
                <p className="text-[11px] text-zinc-500 truncate">{user.email}</p>
              </div>

              {/* Logged in links */}
              <div className="p-1.5 space-y-0.5">
                <Link
                  href="/tai-khoan"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <UserIcon className="h-4 w-4 text-violet-500" />
                  Hồ sơ cá nhân
                </Link>
                <Link
                  href="/tai-khoan/yeu-thich"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <Heart className="h-4 w-4 text-rose-500" />
                  Phim yêu thích
                </Link>
                <Link
                  href="/tai-khoan/lich-su"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <History className="h-4 w-4 text-amber-500" />
                  Lịch sử xem phim
                </Link>
                <Link
                  href="/cai-dat"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <Settings className="h-4 w-4 text-zinc-400" />
                  Cài đặt
                </Link>
              </div>

              {/* Logout */}
              <div className="border-t border-zinc-100 dark:border-zinc-800/80 p-1.5">
                <button
                  onClick={() => {
                    logout();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left"
                >
                  <LogOut className="h-4 w-4" />
                  Đăng xuất
                </button>
              </div>
            </>
          ) : (
            /* Not logged in */
            <div className="p-2 space-y-1">
              <Link
                href="/dang-nhap"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <LogIn className="h-4 w-4 text-violet-500" />
                Đăng nhập
              </Link>
              <Link
                href="/dang-ky"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors"
              >
                <UserPlus className="h-4 w-4" />
                Đăng ký tài khoản
              </Link>
              <Link
                href="/cai-dat"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border-t border-zinc-100 dark:border-zinc-800/80"
              >
                <Settings className="h-4 w-4 text-zinc-400" />
                Cài đặt hệ thống
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
