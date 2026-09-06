"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Film,
  Lock,
  Mail,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { useUserStore } from "@/hooks/useUserStore";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get("redirect") || "/tai-khoan";
  const safeRedirect = redirectTarget.startsWith("/") ? redirectTarget : "/tai-khoan";

  const { login, register } = useUserStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState(false);
  const [loading, setLoading] = useState(false);

  // Legacy pre-Phase-4 account activation state
  const [isLegacyAccount, setIsLegacyAccount] = useState(false);
  const [legacyUsername, setLegacyUsername] = useState("");
  const [activating, setActivating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setErrorMsg("");
    setIsLegacyAccount(false);
    setLoading(true);

    try {
      await login(email.trim(), password.trim());
      setSuccessMsg(true);
      setTimeout(() => {
        router.push(safeRedirect);
      }, 600);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Đăng nhập thất bại. Vui lòng thử lại.";

      // If credentials failed, check if this is an unactivated legacy account
      try {
        const checkRes = await fetch("/api/auth/legacy-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
        });
        const checkData = await checkRes.json();
        if (checkData.status === "success" && checkData.isLegacy) {
          setIsLegacyAccount(true);
          setLegacyUsername(checkData.username || email.split("@")[0]);
          return;
        }

        // If failed due to unconfirmed email, legacy-check confirmed it. Retry login seamlessly.
        if (msg.includes("Email not confirmed")) {
          await login(email.trim(), password.trim());
          setSuccessMsg(true);
          setTimeout(() => {
            router.push(safeRedirect);
          }, 600);
          return;
        }
      } catch {}

      setErrorMsg(
        msg.includes("Invalid login credentials")
          ? "Email hoặc mật khẩu không chính xác."
          : msg.includes("Email not confirmed")
          ? "Tài khoản vừa được kích hoạt xác nhận. Vui lòng bấm Đăng nhập lại."
          : msg
      );
    } finally {
      setLoading(false);
    }
  };

  const handleActivateLegacy = async () => {
    if (!email.trim() || !password.trim()) return;
    setActivating(true);
    setErrorMsg("");

    try {
      await register(email.trim(), password.trim(), legacyUsername);
      setIsLegacyAccount(false);
      setSuccessMsg(true);
      setTimeout(() => {
        router.push(safeRedirect);
      }, 600);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Kích hoạt thất bại. Vui lòng thử lại.";
      setErrorMsg(msg);
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xl p-8 sm:p-10 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <Link href="/" className="inline-flex items-center gap-2 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/30">
            <Film className="h-5 w-5" />
          </div>
          <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text text-transparent">
            Cinépvq
          </span>
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Đăng nhập tài khoản
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Đồng bộ phim yêu thích và lịch sử xem trên mọi thiết bị
        </p>
      </div>

      {/* Legacy Account Migration Card */}
      {isLegacyAccount && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-zinc-800 dark:text-zinc-200 text-xs space-y-2.5">
          <div className="flex items-center gap-2 font-bold text-amber-600 dark:text-amber-400">
            <ShieldCheck className="h-4 w-4 flex-shrink-0" />
            <span>Kích hoạt tài khoản từ hệ thống cũ</span>
          </div>
          <p className="leading-relaxed text-zinc-600 dark:text-zinc-400">
            Tài khoản <strong>{email}</strong> ({legacyUsername}) được tạo trước khi nâng cấp bảo mật Supabase Auth. Nhấn nút bên dưới để thiết lập mật khẩu này cho tài khoản của bạn. Mọi phim yêu thích và lịch sử xem trước đây sẽ được giữ nguyên 100%!
          </p>
          <button
            type="button"
            onClick={handleActivateLegacy}
            disabled={activating}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 py-2.5 text-xs font-bold text-white shadow-md transition-all disabled:opacity-50"
          >
            {activating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowRight className="h-3.5 w-3.5" />
            )}
            <span>{activating ? "Đang kích hoạt..." : "Kích hoạt tài khoản ngay"}</span>
          </button>
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-semibold">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Success Alert */}
      {successMsg && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          <span>Đăng nhập thành công! Đang chuyển hướng...</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Email hoặc Tên người dùng
          </label>
          <div className="relative">
            <input
              type="text"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vidu@cinepvq.com"
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 py-3 pl-10 pr-3 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all"
            />
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Mật khẩu
            </label>
            <Link
              href="/quen-mat-khau"
              className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:underline"
            >
              Quên mật khẩu?
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 py-3 pl-10 pr-10 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all"
            />
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Remember me */}
        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="remember"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
          />
          <label
            htmlFor="remember"
            className="text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer"
          >
            Ghi nhớ đăng nhập trên thiết bị này
          </label>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-bold text-white shadow-lg shadow-violet-600/30 hover:bg-violet-500 active:scale-98 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          <span>{loading ? "Đang xử lý..." : "Đăng nhập"}</span>
        </button>
      </form>

      {/* Footer */}
      <div className="text-center pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Chưa có tài khoản?{" "}
          <Link
            href={
              safeRedirect !== "/tai-khoan"
                ? `/dang-ky?redirect=${encodeURIComponent(safeRedirect)}`
                : "/dang-ky"
            }
            className="font-bold text-violet-600 dark:text-violet-400 hover:underline"
          >
            Đăng ký ngay
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex-1 flex items-center justify-center pt-24 pb-16 px-4 sm:px-6">
      <Suspense
        fallback={
          <div className="w-full max-w-md h-96 rounded-3xl bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
