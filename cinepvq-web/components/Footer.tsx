import Link from "next/link";
import { Film, Heart, Shield, Sparkles } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-950/60 text-zinc-600 dark:text-zinc-400 text-xs mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Col 1: Brand */}
          <div className="space-y-3 md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white">
                <Film className="h-4 w-4" />
              </div>
              <span className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
                Cinépvq
              </span>
            </Link>
            <p className="text-zinc-500 leading-relaxed text-[11px]">
              Nền tảng xem phim trực tuyến hiện đại, chất lượng cao với hàng ngàn bộ phim điện ảnh, phim bộ, anime và TV show hấp dẫn.
            </p>
          </div>

          {/* Col 2: Navigation */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-200">
              Khám Phá
            </h4>
            <ul className="space-y-1.5">
              <li>
                <Link href="/phim-bo" className="hover:text-violet-600 transition-colors">
                  Phim bộ mới nhất
                </Link>
              </li>
              <li>
                <Link href="/phim-le" className="hover:text-violet-600 transition-colors">
                  Phim lẻ đặc sắc
                </Link>
              </li>
              <li>
                <Link href="/hoat-hinh" className="hover:text-violet-600 transition-colors">
                  Thế giới hoạt hình
                </Link>
              </li>
              <li>
                <Link href="/tv-show" className="hover:text-violet-600 transition-colors">
                  Chương trình TV Show
                </Link>
              </li>
              <li>
                <Link href="/thinh-hanh" className="hover:text-violet-600 transition-colors">
                  Bảng xếp hạng Thịnh hành
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Thể loại & Quốc gia */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-200">
              Danh Mục
            </h4>
            <ul className="space-y-1.5">
              <li>
                <Link href="/the-loai" className="hover:text-violet-600 transition-colors">
                  Tất cả thể loại
                </Link>
              </li>
              <li>
                <Link href="/quoc-gia" className="hover:text-violet-600 transition-colors">
                  Tất cả quốc gia
                </Link>
              </li>
              <li>
                <Link href="/the-loai/hanh-dong" className="hover:text-violet-600 transition-colors">
                  Phim hành động
                </Link>
              </li>
              <li>
                <Link href="/quoc-gia/han-quoc" className="hover:text-violet-600 transition-colors">
                  Điện ảnh Hàn Quốc
                </Link>
              </li>
              <li>
                <Link href="/quoc-gia/au-my" className="hover:text-violet-600 transition-colors">
                  Phim chiếu rạp Âu Mỹ
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Tài khoản & Tiện ích */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-200">
              Cá Nhân Hóa
            </h4>
            <ul className="space-y-1.5">
              <li>
                <Link href="/tai-khoan" className="hover:text-violet-600 transition-colors">
                  Tài khoản của tôi
                </Link>
              </li>
              <li>
                <Link href="/tai-khoan/yeu-thich" className="hover:text-violet-600 transition-colors">
                  Danh sách yêu thích
                </Link>
              </li>
              <li>
                <Link href="/tai-khoan/lich-su" className="hover:text-violet-600 transition-colors">
                  Lịch sử xem phim
                </Link>
              </li>
              <li>
                <Link href="/cai-dat" className="hover:text-violet-600 transition-colors">
                  Cài đặt giao diện & hệ thống
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Disclaimer & Copyright */}
        <div className="pt-8 border-t border-zinc-200/60 dark:border-zinc-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-500">
          <p className="flex items-center gap-1">
            © {new Date().getFullYear()} Cinépvq Platform. Xây dựng với
            <Heart className="h-3 w-3 text-rose-500 fill-current inline mx-0.5" />
            cho người yêu điện ảnh.
          </p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Shield className="h-3.5 w-3.5 text-emerald-500" />
              Nguồn dữ liệu phim tự động
            </span>
            <span className="flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
              Trải nghiệm Streaming cao cấp
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
