"use client";

import CategoryHubPage, { type CategoryRowConfig } from "@/components/CategoryHubPage";

const SINGLE_MOVIE_SECTIONS: CategoryRowConfig[] = [
  {
    id: "single-action",
    title: "💥 Bom Tấn Hành Động & Phiêu Lưu",
    subtitle: "Những pha hành động mãn nhãn, kỹ xảo đỉnh cao chiếu rạp",
    genre: "hanh-dong",
  },
  {
    id: "single-us",
    title: "🎬 Điện Ảnh Hollywood & Âu Mỹ",
    subtitle: "Tuyển tập phim lẻ bom tấn phòng vé Bắc Mỹ và Châu Âu",
    country: "au-my",
  },
  {
    id: "single-kr",
    title: "🇰🇷 Điện Ảnh Hàn Quốc Đặc Sắc",
    subtitle: "Phim chiếu rạp Hàn Quốc kịch tính, cảm xúc và doanh thu khủng",
    country: "han-quoc",
  },
  {
    id: "single-horror",
    title: "👻 Phim Lẻ Kinh Dị & Bí Ẩn Ám Ảnh",
    subtitle: "Thử thách lòng dũng cảm với những thước phim rùng rợn nhất",
    genre: "kinh-di",
  },
  {
    id: "single-scifi",
    title: "🚀 Khoa Học Viễn Tưởng & Đa Vũ Trụ",
    subtitle: "Du hành không gian, tương lai và những công nghệ vượt thời đại",
    genre: "vien-tuong",
  },
  {
    id: "single-comedy",
    title: "😂 Phim Lẻ Hài Hước & Gia Đình",
    subtitle: "Phút giây thư giãn sảng khoái bên gia đình và bạn bè",
    genre: "hai-huoc",
  },
];

export default function SingleMoviesPage() {
  return (
    <CategoryHubPage
      categorySlug="phim-le"
      title="Phim Lẻ Chiếu Rạp"
      description="Thưởng thức trọn vẹn hàng ngàn bộ phim điện ảnh bom tấn Hollywood, Hàn Quốc, Trung Quốc, Việt Nam chuẩn Full HD & 4K."
      badge="Cinema Hub • Phim Điện Ảnh"
      sections={SINGLE_MOVIE_SECTIONS}
    />
  );
}
