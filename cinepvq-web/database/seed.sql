-- ==============================================================================
-- database/seed.sql
-- Initial seed data for Cinepvq: Taxonomy, Demo User, and Sample Movie
-- ==============================================================================

-- 1. Genres (Aligned with lib/taxonomy.ts)
INSERT INTO genres (name, slug, description) VALUES
('Hành Động', 'hanh-dong', 'Những pha rượt đuổi ngoạn mục và chiến đấu nghẹt thở'),
('Tình Cảm', 'tinh-cam', 'Những câu chuyện tình yêu ngọt ngào và lay động lòng người'),
('Hài Hước', 'phim-hai', 'Tiếng cười sảng khoái cùng những tình huống dí dỏm'),
('Cổ Trang', 'co-trang', 'Những trang sử hào hùng và thế giới kiếm hiệp kỳ ảo'),
('Tâm Lý', 'tam-ly', 'Đi sâu vào nội tâm con người và những góc khuất xã hội'),
('Kinh Dị', 'kinh-di', 'Trải nghiệm cảm giác rùng rợn và hồi hộp đến thót tim'),
('Hình Sự', 'hinh-su', 'Phá án căng thẳng, đấu trí giữa cảnh sát và tội phạm'),
('Khoa Học Viễn Tưởng', 'khoa-hoc-vien-tuong', 'Khám phá vũ trụ, tương lai và công nghệ đột phá'),
('Chính Kịch', 'chinh-kich', 'Các tác phẩm điện ảnh sâu lắng, giàu tính nhân văn'),
('Phiêu Lưu', 'phieu-luu', 'Những chuyến thám hiểm kỳ thú đến những vùng đất mới'),
('Hoạt Hình', 'hoat-hinh', 'Thế giới hoạt hoạ rực rỡ sắc màu cho mọi lứa tuổi'),
('Gây Cấn', 'gay-can', 'Nhịp phim dồn dập với những cú lật tẩy bất ngờ'),
('Bí Ẩn', 'bi-an', 'Những bí mật ẩn giấu chờ lời giải đáp'),
('Gia Đình', 'gia-dinh', 'Tình cảm gia đình thiêng liêng và ấm áp tình thân'),
('Chiến Tranh', 'chien-tranh', 'Tái hiện sự khốc liệt và tinh thần bất khuất của người lính'),
('Tài Liệu', 'tai-lieu', 'Những câu chuyện chân thực về cuộc sống và thiên nhiên')
ON CONFLICT (slug) DO NOTHING;

-- 2. Countries (Aligned with lib/taxonomy.ts)
INSERT INTO countries (name, slug, description) VALUES
('Trung Quốc', 'trung-quoc', 'Phim truyền hình và điện ảnh Hoa Ngữ'),
('Hàn Quốc', 'han-quoc', 'K-Drama lãng mạn và điện ảnh Hàn Quốc đỉnh cao'),
('Âu Mỹ', 'au-my', 'Bom tấn Hollywood và series đỉnh cao phương Tây'),
('Nhật Bản', 'nhat-ban', 'Anime, live-action và điện ảnh xứ sở hoa anh đào'),
('Thái Lan', 'thai-lan', 'Phim truyền hình T-Drama và phim kinh dị đặc sắc'),
('Việt Nam', 'viet-nam', 'Điện ảnh Việt Nam với các tác phẩm đậm chất quê hương'),
('Hồng Kông', 'hong-kong', 'Phim TVB kinh điển, võ thuật và hành động đỉnh cao'),
('Đài Loan', 'dai-loan', 'Phim thần tượng và tâm lý xã hội sâu sắc'),
('Anh Quốc', 'anh', 'Phim cổ điển và truyền hình Anh Quốc chuẩn mực'),
('Pháp', 'phap', 'Điện ảnh nghệ thuật Pháp lãng mạn và tinh tế'),
('Ấn Độ', 'an-do', 'Phim Bollywood hoành tráng, âm nhạc và cảm xúc')
ON CONFLICT (slug) DO NOTHING;

-- 3. Demo User (password: demo123456)
INSERT INTO users (id, email, username, password_hash, role) VALUES
('a0000000-0000-0000-0000-000000000001', 'demo@cinepvq.com', 'demo_user', '$2a$10$7EqJtq98hPqEX7fNZaFWoO.8H4uK8zW8FkZg/sM0LwSj7F2eX6qGy', 'user')
ON CONFLICT (email) DO NOTHING;

-- 4. Sample Movie Cache Demo
INSERT INTO movies (
    id, slug, name, original_name, description, thumb_url, poster_url,
    year, total_episodes, current_episode, duration, quality, language,
    director, casts, source, metadata_status
) VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'mai-2024',
    'Mai',
    'Mai (2024)',
    'Một câu chuyện tình cảm sâu sắc về cuộc sống, tình yêu và những lựa chọn của người phụ nữ.',
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba',
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba',
    2024,
    1,
    'Full HD',
    '131 phút',
    'FHD',
    'Vietsub',
    'Trấn Thành',
    'Phương Anh Đào, Tuấn Trần, Trấn Thành, Uyển Ân',
    'nguonc',
    'ready'
) ON CONFLICT (slug) DO NOTHING;

-- Relate sample movie with Vietnam country and Tâm Lý genre
INSERT INTO movie_countries (movie_id, country_id)
SELECT 'b0000000-0000-0000-0000-000000000001', id FROM countries WHERE slug = 'viet-nam'
ON CONFLICT DO NOTHING;

INSERT INTO movie_genres (movie_id, genre_id)
SELECT 'b0000000-0000-0000-0000-000000000001', id FROM genres WHERE slug IN ('tam-ly', 'tinh-cam')
ON CONFLICT DO NOTHING;

-- Server and Episode
INSERT INTO servers (id, movie_id, server_name) VALUES
('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Vietsub #1')
ON CONFLICT (movie_id, server_name) DO NOTHING;

INSERT INTO episodes (id, movie_id, server_id, name, slug, embed_url, episode_number) VALUES
('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Full', 'tap-full', 'https://player.phimapi.com/player/?url=https://example.com/mai-2024.m3u8', 1)
ON CONFLICT (server_id, slug) DO NOTHING;
