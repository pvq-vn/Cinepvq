"use client";

import Link from "next/link";
import { COUNTRIES } from "@/lib/taxonomy";
import { Globe } from "lucide-react";

export default function CountriesPage() {
  return (
    <main className="flex-1 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Heading */}
        <div className="mb-10 text-center sm:text-left">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600/10 px-3 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-3">
            <Globe className="h-3.5 w-3.5" />
            Điện ảnh năm châu
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Quốc Gia & Khu Vực
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl">
            Thưởng thức điện ảnh theo nền văn hóa và phong cách sản xuất từ các quốc gia hàng đầu thế giới.
          </p>
        </div>

        {/* Countries cards grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
          {COUNTRIES.map((country) => (
            <Link
              key={country.slug}
              href={`/quoc-gia/${country.slug}`}
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl p-6 sm:p-7 min-h-[140px] sm:min-h-[160px] transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl active:scale-[0.98] ring-1 ring-white/10"
            >
              {/* Dynamic Gradient Background */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${country.gradient || "from-indigo-600 to-blue-700"} opacity-90 group-hover:opacity-100 transition-opacity duration-300`}
              />

              {/* Radial overlay */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.2),transparent_60%)]" />

              {/* Top indicator */}
              <div className="relative z-10 flex items-center justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/20 text-white backdrop-blur-sm">
                  <Globe className="h-4 w-4" />
                </span>
              </div>

              {/* Bottom text */}
              <div className="relative z-10 space-y-1 mt-4">
                <h3 className="text-lg sm:text-xl font-bold text-white tracking-wide drop-shadow-md">
                  {country.name}
                </h3>
                {country.description && (
                  <p className="text-[11px] text-white/80 line-clamp-2 leading-relaxed">
                    {country.description}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
