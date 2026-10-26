# Cinepvq Android Client Architecture Specification

Tài liệu này xác lập đặc tả kiến trúc, các hợp đồng API dùng chung (Shared Contracts), cơ chế đồng bộ dữ liệu (Data Synchronization) và mô hình bảo mật giữa **Cinepvq Web** (`cinepvq-web`) và ứng dụng native **Cinepvq Android** (`cinepvq-android`).

---

## A. Current Web Architecture (`cinepvq-web`)

### 1. Framework & Core
- **Framework**: Next.js 16.2.12 (Turbopack, App Router), React 19.2.4.
- **Language**: TypeScript 5.
- **Styling**: Tailwind CSS v4 + Vanilla CSS tokens (`globals.css`, dark theme mặc định với bảng màu Zinc/Violet).
- **Client State**:
  - `services/userStore.ts`: In-memory reactive stores (`authStore`, `favoritesStore`, `historyStore`, `episodeProgressStore`, `settingsStore`) được namespace hóa theo `userId` và đồng bộ qua Custom Events (`cinepvq_storage_update`).
  - `contexts/GlobalPlayerContext.tsx`: Quản lý playback session toàn cục, mini player, picture-in-picture, episode transition và debounced sync.

### 2. Backend & Database
- **Database Engine**: PostgreSQL 16 (chạy qua Docker Compose trên local, kiến trúc sẵn sàng chuyển lên Google Cloud SQL for PostgreSQL).
- **Database Access**: `pg` pool (`lib/db/client.ts`), quản lý qua 11 file SQL migration (`database/migrations/`).
- **Repositories**: `movieRepository`, `userRepository`, `favoriteRepository`, `historyRepository`, `settingsRepository`.
- **Identity Provider**: Supabase Auth (Quản lý JWT sessions, `auth.users`).

### 3. Upstream & Catalog Integration
- **Upstream Catalog**: KKPhim (`https://phimapi.com`) và NguonC (`https://phim.nguonc.com/api`).
- **Catalog Normalization**: `services/kkphimCatalogAdapter.ts` chuẩn hóa dữ liệu từ KKPhim về schema chung của Cinepvq.
- **Cache-Aside Pattern**: `GET /api/movies/[slug]` kiểm tra bảng `public.movies` trong PostgreSQL; nếu chưa có hoặc đang cập nhật thì fetch từ upstream và cache bất đồng bộ vào database.

### 4. Player & Video Sources Engine
- **Player Core**: `components/CustomHlsPlayer.tsx` sử dụng `hls.js` cho web.
- **Multi-Source Engine**: `services/videoSources/` tích hợp 4 adapter:
  1. `K20 Direct HLS` (Priority 1): Trích xuất link `.m3u8` CDN trực tiếp với chất lượng cao.
  2. `VSMOV Embed` (Priority 2): Hỗ trợ embed stream.
  3. `KKPhim1 Direct HLS` (Priority 3): Trích xuất link `.m3u8` từ KKPhim.
  4. `NguonC StreamC Iframe` (Priority 4): Server dự phòng phát qua iframe.

---

## B. Shared Contracts & API Mapping

Tất cả các API route này đã tồn tại trong `cinepvq-web/app/api/` và được tái sử dụng trực tiếp bởi Android client mà **KHÔNG ĐÒI HỎI BẤT KỲ SỬA ĐỔI NÀO TRÊN WEB**.

### 1. Phim & Streaming
- **Movie Detail (Cache-Aside)**:
  - `GET /api/movies/{slug}`
  - Auth: Public (không yêu cầu Bearer token).
  - Response:
    ```json
    {
      "status": "success",
      "movie": {
        "id": "uuid",
        "name": "Tên phim",
        "slug": "ten-phim",
        "original_name": "Original Name",
        "thumb_url": "https://...",
        "poster_url": "https://...",
        "description": "...",
        "total_episodes": 12,
        "current_episode": "Tập 12",
        "time": "45 phút/tập",
        "quality": "FHD",
        "language": "Vietsub",
        "director": "...",
        "casts": "...",
        "episodes": [
          {
            "server_name": "Vietsub",
            "items": [
              { "name": "1", "slug": "tap-1", "embed": "https://..." }
            ]
          }
        ]
      },
      "cached": true,
      "source": "database"
    }
    ```
- **Video Source Resolver**:
  - `GET /api/video-sources/resolve?slug={slug}&episode={ep}&serverName={server}&nguoncEmbedUrl={embedUrl}`
  - Auth: Public.
  - Response:
    ```json
    {
      "status": "success",
      "sources": [
        {
          "sourceId": "k20",
          "name": "K20 Direct HLS (Siêu mượt)",
          "displayName": "K20 Direct",
          "type": "hls",
          "url": "https://.../master.m3u8",
          "priority": 1,
          "quality": "FHD",
          "isAvailable": true
        }
      ]
    }
    ```

### 2. Định Danh & Hồ Sơ (User & Profile)
- **User Identity Sync**:
  - `POST /api/user/sync`
  - Auth: Bắt buộc `Authorization: Bearer <access_token>`.
  - Body: `{}` (Server lấy `userId` từ verified Supabase JWT token).
  - Response:
    ```json
    {
      "status": "success",
      "user": {
        "id": "uuid",
        "email": "user@example.com",
        "username": "display_name",
        "avatarUrl": "https://...",
        "createdAt": "2026-09-12T..."
      },
      "fallback": false
    }
    ```
- **Profile Get & Update**:
  - `GET /api/user/profile` | `PATCH /api/user/profile`
  - Auth: `Authorization: Bearer <access_token>`.
  - Body (PATCH): `{ "username": "new_name", "avatarUrl": "https://..." }`

### 3. Yêu Thích (Favorites)
- `GET /api/favorites`
  - Auth: `Authorization: Bearer <access_token>`.
  - Response:
    ```json
    {
      "status": "success",
      "favorites": [
        {
          "slug": "phim-a",
          "name": "Phim A",
          "thumb_url": "https://...",
          "quality": "FHD",
          "current_episode": "Tập 10",
          "addedAt": "2026-09-12T..."
        }
      ]
    }
    ```
- `POST /api/favorites`
  - Toggle: `{ "movieSlug": "phim-a", "movie": { "slug": "phim-a", "name": "Phim A", "thumb_url": "https://..." } }`
  - Xóa: `{ "action": "remove", "movieSlug": "phim-a" }`
  - Xóa hết: `{ "action": "clear" }`
  - Đồng bộ hàng loạt: `{ "action": "sync", "favorites": [ ... ] }`

### 4. Lịch Sử & Tiến Độ Xem (Watch History & Playback Progress)
- `GET /api/history`
  - Auth: `Authorization: Bearer <access_token>`.
  - Response:
    ```json
    {
      "status": "success",
      "history": [
        {
          "slug": "phim-a",
          "name": "Phim A",
          "original_name": "Movie A",
          "thumb_url": "https://...",
          "episodeSlug": "tap-1",
          "episodeName": "Tập 1",
          "currentTime": 1240,
          "duration": 2500,
          "updatedAt": "2026-09-12T08:00:00.000Z"
        }
      ]
    }
    ```
- `POST /api/history`
  - Cập nhật tiến độ xem (Debounced Playback Progress):
    ```json
    {
      "action": "upsert",
      "movieSlug": "phim-a",
      "episodeSlug": "tap-1",
      "position": 1240,
      "duration": 2500,
      "updatedAt": "2026-09-12T08:00:00.000Z"
    }
    ```
  - Xóa một phim: `{ "action": "remove", "movieSlug": "phim-a" }`
  - Xóa tất cả: `{ "action": "clear" }`
  - Đồng bộ hàng loạt: `{ "action": "sync", "history": [ ... ] }`

### 5. Cài Đặt Người Dùng (Settings)
- `GET /api/settings` | `POST /api/settings`
  - Auth: `Authorization: Bearer <access_token>`.
  - Fields: `theme`, `autoPlay`, `soundEnabled`, `preferredQuality`.

---

## C. Source of Truth Matrix

| Thực Thể | Source of Truth | Android Client Đọc | Android Client Ghi |
| :--- | :--- | :--- | :--- |
| **Auth Identity** | Supabase Auth (`auth.users`) | Supabase Auth API (`/auth/v1/token`) + Local Secure Store | Supabase Auth API (`/auth/v1/signup`, `/auth/v1/token`) |
| **User Profile** | PostgreSQL `public.users` | Cinepvq API `/api/user/profile` | Cinepvq API `PATCH /api/user/profile` |
| **Favorites** | PostgreSQL `public.favorites` | Cinepvq API `GET /api/favorites` | Cinepvq API `POST /api/favorites` |
| **Watch History** | PostgreSQL `public.watch_history` | Cinepvq API `GET /api/history` | Cinepvq API `POST /api/history` |
| **Watch Progress** | PostgreSQL `public.watch_history.last_position_seconds` | Cinepvq API `GET /api/history` | Cinepvq API `POST /api/history` (debounced) |
| **Catalog** | KKPhim API (`https://phimapi.com`) | Direct KKPhim API / Cinepvq Proxy | Read-only |
| **Movie Detail** | PostgreSQL `public.movies` (Cache) + Upstream | Cinepvq API `/api/movies/{slug}` | Read-only |
| **Stream URL** | Multi-Source Engine (K20 / KKPhim) | Cinepvq API `/api/video-sources/resolve` | Read-only |
| **Settings** | PostgreSQL `public.user_settings` | Cinepvq API `/api/settings` | Cinepvq API `POST /api/settings` |

---

## D. Android Architecture (`cinepvq-android`)

### 1. Kiến Trúc Phân Lớp (Clean Layered Architecture)
```text
┌─────────────────────────────────────────────────────────────┐
│                       UI Layer                              │
│  Compose Screens + Material 3 Components + ViewModels       │
│  (Home, Search, MovieDetail, VideoPlayer, Favorites, etc.)  │
└──────────────────────────────┬──────────────────────────────┘
                               │ StateFlow / Actions
┌──────────────────────────────▼──────────────────────────────┐
│                     Domain Layer                            │
│  Domain Models (Movie, Episode, StreamSource, HistoryItem)  │
│  Use Cases (SyncUserDataUseCase, ResolveStreamUseCase, etc) │
└──────────────────────────────┬──────────────────────────────┘
                               │ Repositories Interface
┌──────────────────────────────▼──────────────────────────────┐
│                      Data Layer                             │
│  Repository Implementations:                                │
│    - AuthRepository, MovieRepository, UserSyncRepository    │
│    - VideoSourceRepository                                  │
├──────────────────────────────┬──────────────────────────────┤
│       Remote Data            │          Local Data          │
│  Retrofit + OkHttp           │  Room SQLite Database        │
│  - CinepvqApiService         │  - FavoriteDao, HistoryDao   │
│  - KKPhimApiService          │  - MovieCacheDao             │
│  - SupabaseAuthApiService    │  DataStore / Secure Storage  │
└──────────────────────────────┴──────────────────────────────┘
```

### 2. Video Player Architecture
- Sử dụng **AndroidX Media3 (ExoPlayer)**.
- Hỗ trợ HLS (`media3-exoplayer-hls`) với định dạng `.m3u8`, tự động thích ứng băng thông (Adaptive Bitrate Streaming).
- Xử lý Lifecycle an toàn:
  - Tạm dừng (Pause) khi Activity `onStop` (trừ khi đang trong chế độ PiP).
  - Giải phóng player khi thoát màn hình phát phim.
- **Picture-in-Picture (PiP)**:
  - Đăng ký `android:supportsPictureInPicture="true"` trong `AndroidManifest.xml`.
  - Tự động kích hoạt khi người dùng nhấn Home trong khi phim đang phát (`enterPictureInPictureMode`).
- **Đồng Bộ Tiến Độ Xem (Playback Progress Sync)**:
  - Lắng nghe sự kiện phát của ExoPlayer mỗi 1 giây để cập nhật thanh hiển thị tại chỗ.
  - Sử dụng Coroutine Debounce 1.5 giây để ghi nhận tiến độ (`lastPositionSeconds`) lên Cinepvq API `/api/history`.
  - Khi mở một tập phim, tự động `player.seekTo(resumePositionSeconds * 1000L)` nếu có tiến độ lưu trước đó.

---

## E. Data Synchronization & Conflict Handling

### 1. Thuật Toán Hòa Trộn Lịch Sử Xem (Watch History Merge)
Khi người dùng đăng nhập hoặc mở app có kết nối mạng:
1. Client gửi `GET /api/history` kèm Bearer token.
2. Với mỗi mục `remoteItem`:
   - Lấy `localItem` tương ứng theo `slug` từ Room DB.
   - So sánh mốc thời gian: `remoteItem.updatedAt` vs `localItem.updatedAt`.
   - Nếu `remoteTimestamp >= localTimestamp`: Ghi đè dữ liệu local bằng `remoteItem`.
   - Nếu `localTimestamp > remoteTimestamp` (do xem offline trước đó): Giữ dữ liệu local và thêm vào danh sách `itemsToPush`.
3. Với các mục chỉ có ở local mà server chưa có: Thêm vào `itemsToPush`.
4. Nếu `itemsToPush` có phần tử: Gửi `POST /api/history` với `{ "action": "sync", "history": itemsToPush }` lên server.

### 2. Thuật Toán Hòa Trộn Danh Sách Yêu Thích (Favorites Merge)
- Khi ở chế độ khách (Guest): Lưu trong Room DB local.
- Khi người dùng đăng nhập:
  - Nếu local có phim yêu thích chưa sync: Gửi `POST /api/favorites` với `{ "action": "sync", "favorites": localList }`.
  - Sau đó tải toàn bộ danh sách mới nhất từ server về lưu vào Room DB.

---

## F. Security Model

1. **Zero Secret Leakage**:
   - Tuyệt đối không nhúng `SUPABASE_SERVICE_ROLE_KEY` hoặc chuỗi kết nối trực tiếp `DATABASE_URL` vào mã nguồn Android.
   - Chỉ sử dụng `NEXT_PUBLIC_SUPABASE_ANON_KEY` (khóa công khai tương tự như trên web) để giao tiếp với Supabase Auth.
2. **Server-Enforced User Identity**:
   - Tất cả các endpoint `/api/favorites`, `/api/history`, `/api/user/sync`, `/api/user/profile` đều yêu cầu `Authorization: Bearer <jwt>`.
   - Backend Next.js xác thực chữ ký mật mã của token thông qua `supabase.auth.getUser(token)` và lấy `user.id` từ phiên đã xác thực, không bao giờ tin cậy `userId` do client gửi lên.
3. **Secure Credential Storage on Android**:
   - Sử dụng `EncryptedSharedPreferences` (thuộc thư viện `androidx.security:security-crypto`) hoặc Android Keystore để mã hóa token `access_token` và `refresh_token` lưu trên thiết bị.
   - Xóa toàn bộ token và cache người dùng khi người dùng nhấn Đăng xuất (Sign Out).
4. **Network Security**:
   - Sử dụng HTTPS cho tất cả các kết nối upstream.
   - Cấu hình `network_security_config.xml` cho phép cleartext traffic cục bộ (`10.0.2.2` hoặc IP local LAN) phục vụ quá trình test dev.

---

## G. Dependencies

```toml
[versions]
agp = "9.4.0"
kotlin = "2.2.10"
coreKtx = "1.15.0"
lifecycleRuntime = "2.8.7"
activityCompose = "1.9.3"
composeBom = "2024.11.00"
navigationCompose = "2.8.5"
media3 = "1.5.1"
coil = "3.0.4"
retrofit = "2.11.0"
okhttp = "4.12.0"
kotlinxSerialization = "1.7.3"
room = "2.6.1"
securityCrypto = "1.1.0-alpha06"
coroutines = "1.9.0"
```

---

## H. Known Limitations & Future Extensions

### Known Limitations
- Một số luồng video từ nguồn thứ cấp (VSMOV hoặc iframe NguonC) cần webview embed nếu không trích xuất được direct HLS; tuy nhiên nguồn chính K20 và KKPhim hỗ trợ 100% direct `.m3u8` phát mượt trên ExoPlayer.
- Thiết bị chạy Android dưới API 26 (Android 8.0) sẽ không kích hoạt chế độ Picture-in-Picture.

### Future Extension Points
- Hỗ trợ tải tập phim về máy để xem offline (Media3 DownloadService + Encrypted local storage).
- Hỗ trợ Google Cast / Chromecast để truyền phim lên Smart TV.
- Thông báo đẩy (Firebase Cloud Messaging) khi có tập phim mới của các bộ phim đang theo dõi.
