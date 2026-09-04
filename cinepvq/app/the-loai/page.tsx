"use client";

import Link from "next/link";

const genres = [
  { name: "Hành Động",   slug: "hanh-dong",   gradient: "from-red-500 to-orange-500" },
  { name: "Tình Cảm",    slug: "tinh-cam",    gradient: "from-pink-500 to-rose-500" },
  { name: "Hài Hước",    slug: "hai-huoc",    gradient: "from-amber-400 to-yellow-500" },
  { name: "Kinh Dị",     slug: "kinh-di",     gradient: "from-emerald-600 to-teal-700" },
  { name: "Tâm Lý",      slug: "tam-ly",      gradient: "from-indigo-500 to-blue-600" },
  { name: "Võ Thuật",    slug: "vo-thuat",    gradient: "from-orange-500 to-red-600" },
  { name: "Cổ Trang",    slug: "co-trang",    gradient: "from-yellow-600 to-amber-700" },
  { name: "Hình Sự",     slug: "hinh-su",     gradient: "from-slate-500 to-zinc-700" },
  { name: "Khoa Học Viễn Tưởng", slug: "khoa-hoc-vien-tuong", gradient: "from-violet-500 to-purple-600" },
];

export default function GenresPage() {
  return (
    <main className="flex-1 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Heading */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text text-transparent">
            Thể Loại Phim
          </h1>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400">
            Chọn thể loại yêu thích để khám phá kho phim phong phú
          </p>
        </div>

        {/* Genre grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
          {genres.map((genre) => (
            <Link
              key={genre.slug}
              href={`/the-loai/${genre.slug}`}
              className="group relative flex items-center justify-center overflow-hidden rounded-2xl p-8 sm:p-10 transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl active:scale-[0.98]"
            >
              {/* Gradient background */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${genre.gradient} opacity-85 group-hover:opacity-100 transition-opacity duration-300`}
              />

              {/* Subtle pattern overlay */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_50%)]" />

              {/* Shine effect on hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-tr from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />

              {/* Genre name */}
              <span className="relative z-10 text-lg sm:text-xl font-bold text-white drop-shadow-md tracking-wide">
                {genre.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
