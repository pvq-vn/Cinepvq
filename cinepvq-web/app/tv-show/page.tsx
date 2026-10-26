"use client";

import CategoryHubPage, { type CategoryRowConfig } from "@/components/CategoryHubPage";

const TVSHOW_SECTIONS: CategoryRowConfig[] = [
  {
    id: "tvshow-kr",
    title: "🇰🇷 Variety Show & Thực Tế Hàn Quốc",
    subtitle: "Running Man, show sống còn, âm nhạc và hẹn hò cực cuốn",
    country: "han-quoc",
  },
  {
    id: "tvshow-cn",
    title: "🇨🇳 Show Giải Trí & Âm Nhạc Hoa Ngữ",
    subtitle: "Keep Running, Đạp Gió, show thực tế quy tụ dàn sao đình đám",
    country: "trung-quoc",
  },
  {
    id: "tvshow-vn",
    title: "🇻🇳 Gameshow & Truyền Hình Thực Tế Việt Nam",
    subtitle: "Những chương trình giải trí ăn khách nhất màn ảnh Việt",
    country: "viet-nam",
  },
  {
    id: "tvshow-us",
    title: "🌍 Chương Trình Thực Tế Âu Mỹ",
    subtitle: "MasterChef, tài năng, khám phá và thực tế quốc tế",
    country: "au-my",
  },
  {
    id: "tvshow-comedy",
    title: "🎉 Show Hài Hước & Giải Trí Cuối Tuần",
    subtitle: "Cười thả ga với những thử thách bá đạo và dàn cast lầy lội",
    genre: "hai-huoc",
  },
];

export default function TVShowPage() {
  return (
    <CategoryHubPage
      categorySlug="tv-shows"
      title="Chương Trình TV Show"
      description="Tổng hợp các chương trình truyền hình thực tế, gameshow vận động, show âm nhạc và hẹn hò đình đám nhất."
      badge="TV Shows & Reality Hub"
      sections={TVSHOW_SECTIONS}
    />
  );
}
