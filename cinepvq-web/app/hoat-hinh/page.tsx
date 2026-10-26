"use client";

import CategoryHubPage, { type CategoryRowConfig } from "@/components/CategoryHubPage";

const ANIME_SECTIONS: CategoryRowConfig[] = [
  {
    id: "anime-jp",
    title: "🇯🇵 Anime Nhật Bản Đang Hot",
    subtitle: "Shounen, Isekai, phép thuật và đời thường mới nhất mùa này",
    country: "nhat-ban",
  },
  {
    id: "anime-cn",
    title: "🐉 Hoạt Hình 3D Trung Quốc (Donghua)",
    subtitle: "Tu tiên, huyền huyễn, võ hiệp 3D đồ họa mãn nhãn",
    country: "trung-quoc",
  },
  {
    id: "anime-us",
    title: "🌟 Hoạt Hình Âu Mỹ & Disney / Pixar",
    subtitle: "Các tác phẩm hoạt hình điện ảnh quốc tế dành cho mọi lứa tuổi",
    country: "au-my",
  },
  {
    id: "anime-action",
    title: "⚡ Anime Hành Động & Siêu Năng Lực",
    subtitle: "Những trận chiến đỉnh cao không thể rời mắt",
    genre: "hanh-dong",
  },
  {
    id: "anime-adventure",
    title: "🗺️ Phiêu Lưu & Thế Giới Giả Tưởng",
    subtitle: "Hành trình khám phá những vùng đất kỳ bí và thần thoại",
    genre: "phieu-luu",
  },
];

export default function AnimePage() {
  return (
    <CategoryHubPage
      categorySlug="hoat-hinh"
      title="Hoạt Hình & Anime"
      description="Thế giới Anime Nhật Bản, Hoạt hình 3D Tu Tiên Trung Quốc (Donghua) và các tuyệt phẩm hoạt họa quốc tế."
      badge="Anime & Donghua Hub"
      quickCountries={[
        { name: "Nhật Bản", slug: "nhat-ban" },
        { name: "Trung Quốc", slug: "trung-quoc" },
        { name: "Âu Mỹ", slug: "au-my" },
        { name: "Hàn Quốc", slug: "han-quoc" },
      ]}
      sections={ANIME_SECTIONS}
    />
  );
}
