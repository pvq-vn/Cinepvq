"use client";

import CategoryHubPage, { type CategoryRowConfig } from "@/components/CategoryHubPage";

const SERIES_SECTIONS: CategoryRowConfig[] = [
  {
    id: "series-kr",
    title: "🇰🇷 Phim Bộ Hàn Quốc Đang Gây Sốt",
    subtitle: "K-Drama tình cảm, tâm lý, báo thù và hài lãng mạn mới nhất",
    country: "han-quoc",
  },
  {
    id: "series-cn",
    title: "🇨🇳 Phim Bộ Hoa Ngữ & Cổ Trang Tiên Hiệp",
    subtitle: "Siêu phẩm cổ trang, ngôn tình hiện đại và kiếm hiệp Trung Quốc",
    country: "trung-quoc",
  },
  {
    id: "series-us",
    title: "🇺🇸 Series Âu Mỹ &Bom Tấn Truyền Hình",
    subtitle: "Series hành động, viễn tưởng, hình sự kịch tính chuẩn Hollywood",
    country: "au-my",
  },
  {
    id: "series-cotrang",
    title: "⚔️ Tuyệt Đỉnh Cổ Trang & Thần Thoại",
    subtitle: "Những bộ phim cổ trang cung đấu, kiếm hiệp được yêu thích nhất",
    genre: "co-trang",
  },
  {
    id: "series-romance",
    title: "💖 Phim Bộ Tình Cảm Lãng Mạn",
    subtitle: "Chuyện tình ngọt ngào, sâu lắng chạm đến trái tim khán giả",
    genre: "tinh-cam",
  },
  {
    id: "series-crime",
    title: "🕵️ Hình Sự, Trinh Thám & Tâm Lý",
    subtitle: "Những vụ án hóc búa và đấu trí căng thẳng từng tập",
    genre: "hinh-su",
  },
];

export default function SeriesMoviesPage() {
  return (
    <CategoryHubPage
      categorySlug="phim-bo"
      title="Phim Bộ Đặc Sắc"
      description="Khám phá kho phim bộ truyền hình dài tập Hàn Quốc, Trung Quốc, Âu Mỹ, Thái Lan, Việt Nam cập nhật tập mới siêu tốc mỗi ngày."
      badge="Series Hub • Đa Quốc Gia & Thể Loại"
      sections={SERIES_SECTIONS}
    />
  );
}
