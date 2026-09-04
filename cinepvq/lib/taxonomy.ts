export interface TaxonomyItem {
  name: string;
  slug: string;
  description?: string;
  gradient?: string;
  icon?: string;
}

export const GENRES: TaxonomyItem[] = [
  {
    name: "Hành Động",
    slug: "hanh-dong",
    description: "Những pha rượt đuổi ngoạn mục và chiến đấu nghẹt thở",
    gradient: "from-red-600 to-amber-600",
  },
  {
    name: "Tình Cảm",
    slug: "tinh-cam",
    description: "Những câu chuyện tình yêu ngọt ngào và lay động lòng người",
    gradient: "from-pink-500 to-rose-600",
  },
  {
    name: "Hài Hước",
    slug: "phim-hai",
    description: "Tiếng cười sảng khoái cùng những tình huống dí dỏm",
    gradient: "from-amber-400 to-orange-500",
  },
  {
    name: "Cổ Trang",
    slug: "co-trang",
    description: "Những trang sử hào hùng và thế giới kiếm hiệp kỳ ảo",
    gradient: "from-yellow-600 to-amber-700",
  },
  {
    name: "Tâm Lý",
    slug: "tam-ly",
    description: "Đi sâu vào nội tâm con người và những góc khuất xã hội",
    gradient: "from-indigo-600 to-blue-700",
  },
  {
    name: "Kinh Dị",
    slug: "kinh-di",
    description: "Trải nghiệm cảm giác rùng rợn và hồi hộp đến thót tim",
    gradient: "from-stone-900 to-red-950",
  },
  {
    name: "Hình Sự",
    slug: "hinh-su",
    description: "Phá án căng thẳng, đấu trí giữa cảnh sát và tội phạm",
    gradient: "from-slate-700 to-zinc-900",
  },
  {
    name: "Khoa Học Viễn Tưởng",
    slug: "khoa-hoc-vien-tuong",
    description: "Khám phá vũ trụ, tương lai và công nghệ đột phá",
    gradient: "from-violet-600 to-purple-800",
  },
  {
    name: "Chính Kịch",
    slug: "chinh-kich",
    description: "Các tác phẩm điện ảnh sâu lắng, giàu tính nhân văn",
    gradient: "from-blue-600 to-cyan-700",
  },
  {
    name: "Phiêu Lưu",
    slug: "phieu-luu",
    description: "Những chuyến thám hiểm kỳ thú đến những vùng đất mới",
    gradient: "from-emerald-600 to-teal-700",
  },
  {
    name: "Hoạt Hình",
    slug: "hoat-hinh",
    description: "Thế giới hoạt hoạ rực rỡ sắc màu cho mọi lứa tuổi",
    gradient: "from-sky-500 to-indigo-600",
  },
  {
    name: "Gây Cấn",
    slug: "gay-can",
    description: "Nhịp phim dồn dập với những cú lật tẩy bất ngờ",
    gradient: "from-orange-600 to-red-700",
  },
  {
    name: "Bí Ẩn",
    slug: "bi-an",
    description: "Những bí mật ẩn giấu chờ lời giải đáp",
    gradient: "from-purple-900 to-slate-900",
  },
  {
    name: "Gia Đình",
    slug: "gia-dinh",
    description: "Tình cảm gia đình thiêng liêng và ấm áp tình thân",
    gradient: "from-teal-500 to-emerald-600",
  },
  {
    name: "Chiến Tranh",
    slug: "chien-tranh",
    description: "Tái hiện sự khốc liệt và tinh thần bất khuất của người lính",
    gradient: "from-stone-700 to-neutral-800",
  },
  {
    name: "Tài Liệu",
    slug: "tai-lieu",
    description: "Những câu chuyện chân thực về cuộc sống và thiên nhiên",
    gradient: "from-cyan-600 to-blue-800",
  },
];

export const COUNTRIES: TaxonomyItem[] = [
  {
    name: "Trung Quốc",
    slug: "trung-quoc",
    description: "Phim truyền hình và điện ảnh Hoa Ngữ",
    gradient: "from-red-600 to-yellow-600",
  },
  {
    name: "Hàn Quốc",
    slug: "han-quoc",
    description: "K-Drama lãng mạn và điện ảnh Hàn Quốc đỉnh cao",
    gradient: "from-blue-600 to-red-600",
  },
  {
    name: "Âu Mỹ",
    slug: "au-my",
    description: "Bom tấn Hollywood và series đỉnh cao phương Tây",
    gradient: "from-indigo-600 to-sky-600",
  },
  {
    name: "Nhật Bản",
    slug: "nhat-ban",
    description: "Anime, live-action và điện ảnh xứ sở hoa anh đào",
    gradient: "from-rose-500 to-red-600",
  },
  {
    name: "Thái Lan",
    slug: "thai-lan",
    description: "Phim truyền hình T-Drama và phim kinh dị đặc sắc",
    gradient: "from-amber-500 to-purple-600",
  },
  {
    name: "Việt Nam",
    slug: "viet-nam",
    description: "Điện ảnh Việt Nam với các tác phẩm đậm chất quê hương",
    gradient: "from-red-600 to-yellow-500",
  },
  {
    name: "Hồng Kông",
    slug: "hong-kong",
    description: "Phim TVB kinh điển, võ thuật và hành động đỉnh cao",
    gradient: "from-rose-600 to-orange-600",
  },
  {
    name: "Đài Loan",
    slug: "dai-loan",
    description: "Phim thần tượng và tâm lý xã hội sâu sắc",
    gradient: "from-teal-600 to-blue-600",
  },
  {
    name: "Anh Quốc",
    slug: "anh",
    description: "Phim cổ điển và truyền hình Anh Quốc chuẩn mực",
    gradient: "from-blue-800 to-red-700",
  },
  {
    name: "Pháp",
    slug: "phap",
    description: "Điện ảnh nghệ thuật Pháp lãng mạn và tinh tế",
    gradient: "from-blue-600 to-rose-600",
  },
  {
    name: "Ấn Độ",
    slug: "an-do",
    description: "Phim Bollywood hoành tráng, âm nhạc và cảm xúc",
    gradient: "from-orange-500 to-emerald-600",
  },
];

export const GENRE_MAP: Record<string, string> = GENRES.reduce(
  (acc, item) => ({ ...acc, [item.slug]: item.name }),
  {}
);

export const COUNTRY_MAP: Record<string, string> = COUNTRIES.reduce(
  (acc, item) => ({ ...acc, [item.slug]: item.name }),
  {}
);
