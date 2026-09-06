# Tài Liệu Kiến Trúc Cơ Sở Dữ Liệu PostgreSQL (Cinepvq)

Tài liệu này mô tả chi tiết kiến trúc cơ sở dữ liệu PostgreSQL cho dự án **Cinepvq**, bao gồm sơ đồ thực thể quan hệ (ERD), cấu trúc bảng, quy trình migration, hướng dẫn chạy môi trường phát triển cục bộ và lộ trình chuyển đổi lên **Google Cloud SQL for PostgreSQL**.

---

## 1. Tổng Quan Kiến Trúc

Kiến trúc hiện tại của Cinepvq hoạt động theo mô hình **Cache-Aside kết hợp Persistent User Storage**:
- **Upstream Data Source**: NguonC API (`phim.nguonc.com`) vẫn là nguồn dữ liệu phim và streaming video gốc.
- **Database Role**: Đóng vai trò bộ nhớ đệm bền vững (Persistent Cache) cho metadata phim, danh sách tập, server, và là nơi lưu trữ dữ liệu người dùng (tài khoản, yêu thích, lịch sử xem, bình luận, thông báo, cài đặt).
- **Graceful Fallback**: Nếu `DATABASE_URL` không được cấu hình hoặc PostgreSQL tạm thời gián đoạn, ứng dụng tự động fallback về NguonC API và `localStorage`, đảm bảo 100% không gián đoạn dịch vụ.

```
┌─────────────────────────────────────────────────────────────┐
│               Trạng thái chuyển đổi hạ tầng                 │
├──────────────────────────────┬──────────────────────────────┤
│ Hiện tại (Current Phase)     │ Tương lai (Future Phase)     │
│ Local PostgreSQL (Docker)    │ Google Cloud SQL PostgreSQL  │
└──────────────────────────────┴──────────────────────────────┘
```

Chuyển đổi từ Local sang Cloud SQL chỉ yêu cầu thay đổi chuỗi kết nối `DATABASE_URL` và cấu hình deployment (Cloud SQL Auth Proxy hoặc Direct VPC Connection), không cần thay đổi bất kỳ dòng mã nguồn nào.

---

## 2. Sơ Đồ Thực Thể Quan Hệ (ERD)

```mermaid
erDiagram
    users ||--o{ favorites : "marks"
    users ||--o{ watch_history : "watches"
    users ||--o{ comments : "writes"
    users ||--o{ notifications : "receives"
    users ||--o| user_settings : "configures"

    movies ||--o{ movie_genres : "categorized"
    genres ||--o{ movie_genres : "classifies"

    movies ||--o{ movie_countries : "originates"
    countries ||--o{ movie_countries : "locates"

    movies ||--o{ servers : "hosts"
    servers ||--o{ episodes : "contains"
    movies ||--o{ episodes : "has"

    movies ||--o{ favorites : "favorited_by"
    movies ||--o{ watch_history : "viewed_in"
    movies ||--o{ comments : "reviewed_in"
    episodes ||--o{ watch_history : "resumes_at"

    users {
        uuid id PK
        varchar email UK
        varchar username UK
        varchar password_hash
        text avatar_url
        varchar role
        timestamptz created_at
        timestamptz updated_at
    }

    movies {
        uuid id PK
        varchar slug UK
        varchar name
        varchar original_name
        text description
        text thumb_url
        text poster_url
        int year
        int total_episodes
        varchar current_episode
        varchar duration
        varchar quality
        varchar language
        varchar director
        text casts
        varchar source
        varchar metadata_status
        boolean ai_enriched
        timestamptz ai_enriched_at
        timestamptz created_at
        timestamptz updated_at
    }

    genres {
        uuid id PK
        varchar name
        varchar slug UK
        text description
        timestamptz created_at
    }

    countries {
        uuid id PK
        varchar name
        varchar slug UK
        text description
        timestamptz created_at
    }

    movie_genres {
        uuid movie_id PK, FK
        uuid genre_id PK, FK
    }

    movie_countries {
        uuid movie_id PK, FK
        uuid country_id PK, FK
    }

    servers {
        uuid id PK
        uuid movie_id FK
        varchar server_name
        timestamptz created_at
        timestamptz updated_at
    }

    episodes {
        uuid id PK
        uuid movie_id FK
        uuid server_id FK
        varchar name
        varchar slug
        text embed_url
        int episode_number
        timestamptz created_at
        timestamptz updated_at
    }

    favorites {
        uuid user_id PK, FK
        uuid movie_id PK, FK
        timestamptz created_at
    }

    watch_history {
        uuid id PK
        uuid user_id FK
        uuid movie_id FK
        uuid episode_id FK
        int last_position_seconds
        timestamptz created_at
        timestamptz updated_at
    }

    comments {
        uuid id PK
        uuid user_id FK
        uuid movie_id FK
        text content
        timestamptz created_at
        timestamptz updated_at
    }

    notifications {
        uuid id PK
        uuid user_id FK
        varchar title
        text message
        text link
        boolean is_read
        timestamptz created_at
    }

    user_settings {
        uuid user_id PK, FK
        varchar theme
        boolean autoplay
        boolean sound_enabled
        varchar preferred_quality
        timestamptz updated_at
    }
```

---

## 3. Danh Sách Các Bảng và Chi Tiết Trường

### 3.1. `users`
Phục vụ xác thực và quản lý tài khoản người dùng:
- `id`: Khóa chính UUID (`gen_random_uuid()`).
- `email`: Email người dùng, `UNIQUE`, `NOT NULL`.
- `username`: Tên định danh người dùng, `UNIQUE`, `NOT NULL`.
- `password_hash`: Chuỗi băm mật khẩu bảo mật (bcrypt).
- `avatar_url`: Đường dẫn ảnh đại diện.
- `role`: Phân quyền người dùng (`user`, `admin`, `moderator`), mặc định `user`.
- `created_at`, `updated_at`: Dấu thời gian chuẩn `TIMESTAMPTZ`.

### 3.2. `movies`
Bảng trung tâm lưu trữ thông tin phim và bộ nhớ đệm metadata:
- `id`: Khóa chính UUID.
- `slug`: Đường dẫn URL tĩnh của phim, `UNIQUE`, lập chỉ mục (`idx_movies_slug`).
- `name`, `original_name`: Tên tiếng Việt và tên gốc quốc tế.
- `description`, `thumb_url`, `poster_url`: Nội dung tóm tắt và hình ảnh.
- `year`: Năm phát hành (lập chỉ mục `idx_movies_year`).
- `total_episodes`, `current_episode`, `duration`, `quality`, `language`: Thuộc tính hiển thị.
- `director`, `casts`: Đạo diễn và danh sách diễn viên.
- `source`: Nguồn dữ liệu (mặc định `'nguonc'`, lập chỉ mục `idx_movies_source`).
- `metadata_status`: Trạng thái xử lý metadata (`pending`, `ready`, `enriching`, `failed`).
- `ai_enriched`, `ai_enriched_at`: Cờ và thời gian đánh dấu sẵn sàng cho tính năng Gemini/Vertex AI sau này.

### 3.3. `genres`, `countries`, `movie_genres`, `movie_countries`
Chuẩn hóa dữ liệu phân loại thay vì lưu text tự do:
- `genres`, `countries`: Bảng từ điển danh mục với `slug UNIQUE`.
- `movie_genres`: Bảng liên kết nhiều-nhiều với khóa chính kép `(movie_id, genre_id)` và `ON DELETE CASCADE`.
- `movie_countries`: Bảng liên kết nhiều-nhiều với khóa chính kép `(movie_id, country_id)` và `ON DELETE CASCADE`.

### 3.4. `servers` và `episodes`
Chuẩn hóa cấu trúc máy chủ phát và từng tập phim:
- `servers`: Lưu từng cụm máy chủ phát của phim (`server_name`), có ràng buộc duy nhất `(movie_id, server_name)`.
- `episodes`: Lưu danh sách tập phim thuộc về `server_id` và `movie_id`, có ràng buộc duy nhất `(server_id, slug)` và URL nhúng `embed_url`.

### 3.5. `favorites` và `watch_history`
Lưu trữ tương tác của người dùng:
- `favorites`: Khóa chính kép `(user_id, movie_id)`, hỗ trợ sắp xếp theo thời điểm yêu thích mới nhất.
- `watch_history`: Lưu vết phim, tập phim xem gần nhất (`episode_id`) và thời lượng phát dừng lại (`last_position_seconds`) để resume playback. Ràng buộc `UNIQUE(user_id, movie_id)`.

### 3.6. `comments`, `notifications`, `user_settings`
- `comments`: Bình luận trên phim kèm thông tin tác giả và thời gian tạo.
- `notifications`: Thông báo cá nhân hoặc thông báo toàn hệ thống (`user_id NULL`).
- `user_settings`: Khóa chính là `user_id`, lưu tùy chọn theme, tự động phát, âm thanh và chất lượng ưu tiên.

---

## 4. Hướng Dẫn Chạy Môi Trường Cục Bộ (Local Development)

### 4.1. Khởi động PostgreSQL qua Docker Compose
Tại thư mục gốc dự án hoặc thư mục `cinepvq`, chạy:

```bash
docker compose up -d
```

Service sẽ khởi động container `cinepvq-postgres`:
- **Host**: `localhost`
- **Port**: `5432`
- **Database**: `cinepvq`
- **User**: `cinepvq_user`
- **Password**: `cinepvq_dev_password`
- **Volume**: Lưu trữ bền vững tại `postgres_data`.

### 4.2. Cấu hình biến môi trường
Tạo hoặc cập nhật file `.env` (hoặc `.env.local`) trong thư mục `cinepvq`:

```env
DATABASE_URL=postgresql://cinepvq_user:cinepvq_dev_password@localhost:5432/cinepvq
NGUONC_API_URL=https://phim.nguonc.com/api
NEXT_PUBLIC_NGUONC_API_URL=https://phim.nguonc.com/api/
```

### 4.3. Chạy Migration và Seed Dữ Liệu
Chạy migration để áp dụng toàn bộ 11 file SQL migration:

```bash
cd cinepvq
npm run db:migrate
```

Chạy seed để nạp thể loại, quốc gia chuẩn và tài khoản demo:

```bash
npm run db:seed
```

Tài khoản demo được tạo sẵn:
- **Email**: `demo@cinepvq.com`
- **Mật khẩu**: `demo123456`

---

## 5. Danh Sách Migration Files

Toàn bộ các file nằm trong thư mục `database/migrations/`:
1. `001_extensions.sql`: Kích hoạt extension `uuid-ossp` và `pgcrypto`.
2. `002_users.sql`: Tạo bảng người dùng `users`.
3. `003_movies.sql`: Tạo bảng phim trung tâm `movies`.
4. `004_taxonomy.sql`: Tạo bảng thể loại `genres`, quốc gia `countries` và bảng liên kết `movie_genres`, `movie_countries`.
5. `005_episodes.sql`: Tạo bảng máy chủ `servers` và tập phim `episodes`.
6. `006_favorites.sql`: Tạo bảng danh sách yêu thích `favorites`.
7. `007_watch_history.sql`: Tạo bảng lịch sử xem `watch_history`.
8. `008_comments.sql`: Tạo bảng bình luận `comments`.
9. `009_notifications.sql`: Tạo bảng thông báo `notifications`.
10. `010_user_settings.sql`: Tạo bảng cài đặt người dùng `user_settings`.
11. `011_indexes.sql`: Tạo các chỉ mục tối ưu truy vấn.

Trình chạy `database/migrate.mjs` tự động quản lý bảng `_migrations` và chỉ áp dụng các file chưa chạy trong một transaction an toàn.

---

## 6. Hướng Dẫn Chuyển Đổi Sang Google Cloud SQL (Phase Tiếp Theo)

Khi dự án sẵn sàng chuyển đổi lên Google Cloud Platform (GCP), không cần sửa mã nguồn ứng dụng. Các bước thực hiện:

### Bước 1: Tạo Cloud SQL for PostgreSQL Instance
- Engine: PostgreSQL 16
- Region: `asia-southeast1` (Singapore) hoặc vùng gần người dùng nhất
- Tạo Database: `cinepvq`
- Tạo Database User: ví dụ `cinepvq_app` với mật khẩu an toàn.

### Bước 2: Kết nối Cloud SQL
Tùy vào môi trường triển khai:
- **Cloud Run**: Sử dụng Cloud SQL built-in connection (`/cloudsql/PROJECT_ID:REGION:INSTANCE_ID`) và cấu hình `DATABASE_URL` trong Secrets Manager / Environment Variables:
  ```env
  DATABASE_URL=postgresql://cinepvq_app:SECURE_PASSWORD@127.0.0.1:5432/cinepvq?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_ID
  ```
- **Máy chủ bên ngoài / Local thông qua Cloud SQL Auth Proxy**:
  ```bash
  cloud-sql-proxy --port 5432 PROJECT_ID:REGION:INSTANCE_ID
  ```
  Và đặt `DATABASE_URL`:
  ```env
  DATABASE_URL=postgresql://cinepvq_app:SECURE_PASSWORD@127.0.0.1:5432/cinepvq?sslmode=require
  ```

### Bước 3: Chạy Migration lên Cloud SQL
Đặt biến `DATABASE_URL` trỏ tới Cloud SQL Proxy và chạy:
```bash
npm run db:migrate
npm run db:seed
```

Tất cả bảng, khóa ngoại, quan hệ và dữ liệu ban đầu sẽ được khởi tạo hoàn chỉnh ngay lập tức.
