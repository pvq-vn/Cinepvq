# Cinepvq Android Client (Official Native App)

Ứng dụng Android native chính thức của hệ sinh thái Cinepvq, xây dựng bằng **Kotlin** và **Jetpack Compose**, tích hợp đồng bộ 2 chiều hoàn chỉnh với hệ thống `cinepvq-web`.

---

## 🌟 Tính Năng Chính (Features)

1. **Khám phá & Danh mục phim (Home & Catalog)**:
   - Hero Banner hiển thị phim nổi bật với backdrop nghệ thuật & tag thể loại.
   - Các hàng phim (Movie Rows) ngang mượt mà: Phim mới cập nhật, Phim bộ, Phim lẻ, Hoạt hình / Anime, Phim chiếu rạp.
   - Thẻ phim (Movie Card) chuẩn tỷ lệ 2:3 với poster, rating, năm phát hành, số tập (e.g. "Tập 12/24").
   - Kéo để làm mới (Pull-to-refresh) & xử lý phân trang vô tận (Infinite scrolling).

2. **Tìm kiếm phim (Instant Search)**:
   - Tìm kiếm thời gian thực với debounce 400ms.
   - Gợi ý từ khóa tìm kiếm & lịch sử tìm kiếm.
   - Lưới kết quả tìm kiếm thích ứng (Adaptive Grid).

3. **Chi tiết phim & Danh sách tập (Detail & Episodes)**:
   - Hiển thị đầy đủ thông tin: diễn viên, đạo diễn, quốc gia, thời lượng, danh mục, tóm tắt nội dung.
   - Chọn server nguồn phát (K20 Direct HLS, KKPhim HLS, NguonC embed).
   - Chọn tập phim dạng lưới dễ thao tác, tự động đánh dấu tập đang xem và tiến độ đã lưu.
   - Nút Yêu thích (Favorite) đồng bộ tức thời với tài khoản Cinepvq.

4. **Trình phát Video nâng cao (ExoPlayer / Media3 Engine)**:
   - Phát trực tiếp HLS (`.m3u8`) với chất lượng thích ứng (Adaptive Bitrate).
   - Tự động khôi phục vị trí xem (Resume playback) chính xác đến từng giây từ backend / Room cache.
   - Điều khiển playback: Play/Pause, tua nhanh/lùi 10s, chọn tốc độ phát (0.5x đến 2.0x).
   - Chế độ toàn màn hình (Fullscreen) & Hỗ trợ Picture-in-Picture (PiP).
   - Tự động chuyển tập tiếp theo khi phát xong.
   - Ghi nhận tiến độ xem (debounced 1.5s) đồng bộ ngược lên Cinepvq `/api/history`.

5. **Xác thực & Tài khoản (Authentication & Identity)**:
   - Đăng nhập & Đăng ký sử dụng chung hệ thống Supabase Auth với web.
   - Khôi phục phiên làm việc (Session restoration) tự động và an toàn qua `EncryptedSharedPreferences`.
   - Cập nhật thông tin profile (Họ tên, Avatar URL).

6. **Đồng bộ Dữ liệu 2 Chiều (Full 2-Way Sync)**:
   - **Favorites**: Lưu danh sách yêu thích cả offline (Room DB) và online (`/api/favorites`).
   - **Watch History & Progress**: Đồng bộ lịch sử xem và vị trí playback giữa Web và Android với cơ chế giải quyết xung đột dựa trên mốc thời gian (`updatedAt`).

7. **Thiết kế Chuẩn Cinepvq (Design System)**:
   - Dark theme cao cấp (Zinc `#09090B`, Deep Charcoal `#18181B`, Violet Accent `#8B5CF6`).
   - Material 3 Navigation Bar, Typography Google Inter/Roboto hiện đại.
   - Xử lý mượt mà trạng thái Loading Skeleton, Trống (Empty State) và Lỗi (Network Error Retry).

---

## 🛠️ Công Nghệ & Kiến Trúc (Tech Stack & Architecture)

- **Language:** Kotlin 2.2.10 (Target SDK 35, Min SDK 24)
- **UI Toolkit:** Jetpack Compose + Material 3 + Compose Navigation
- **Architecture:** Clean Architecture + Feature-Oriented MVVM + Repository Pattern
- **Media Engine:** AndroidX Media3 (ExoPlayer 1.5.1 + HLS module)
- **Local Persistence:** Room SQLite 2.7.0-alpha13 + Flow reactive streams
- **Secure Storage:** AndroidX Security Crypto (EncryptedSharedPreferences / AES-256 GCM)
- **Networking:** Retrofit 2.11.0 + OkHttp 4.12.0 + Kotlinx Serialization JSON
- **Image Loading:** Coil 3.1.0 (Disk & Memory caching)
- **Asynchronous:** Kotlin Coroutines & StateFlow

```
com.pvq.cinepvq/
├── CinepvqApp.kt                 # Application Entrypoint & ImageLoader setup
├── MainActivity.kt               # Single Activity hosting NavHost & BottomBar
├── core/
│   ├── database/                 # Room Database, DAOs, and Entities
│   ├── designsystem/             # Reusable UI Components (Cards, Rows, Banners)
│   ├── network/                  # Retrofit Services, AuthInterceptor, DTOs
│   └── security/                 # EncryptedSharedPreferences wrapper
├── data/
│   ├── auth/                     # AuthRepository (Supabase Auth & Session)
│   ├── movie/                    # MovieRepository (KKPhim + Local Cache)
│   ├── player/                   # VideoSourceRepository (Cinepvq Multi-source resolver)
│   └── user/                     # UserSyncRepository (Favorites & History 2-Way Sync)
├── domain/
│   └── model/                    # Clean Domain Models
├── features/
│   ├── auth/                     # Login & Register Screen
│   ├── detail/                   # Movie Detail & Episode Selection Screen
│   ├── favorites/                # Synchronized Favorite List Screen
│   ├── history/                  # Watch History & Progress Screen
│   ├── home/                     # Home Catalog Screen
│   ├── navigation/               # Compose Navigation Graph & Bottom Navigation
│   ├── player/                   # Media3 ExoPlayer Screen & Controls
│   ├── profile/                  # User Profile Screen
│   └── search/                   # Instant Search Screen
└── ui/theme/                     # Cinepvq Design Tokens (Colors, Typography, Theme)
```

---

## 🚀 Hướng Dẫn Build & Chạy Ứng Dụng

### Yêu cầu môi trường
- Android SDK Platform 35
- JDK 21 (hoặc JDK 17+)
- Gradle 9.6.0+ (có sẵn wrapper `gradlew`)

### Build APK Debug
```bash
cd cinepvq-android
./gradlew assembleDebug
```
File APK kết quả tại: `cinepvq-android/app/build/outputs/apk/debug/app-debug.apk`

### Chạy Unit Tests
```bash
cd cinepvq-android
./gradlew testDebugUnitTest
```

---

## 🔒 Bảo Mật & Source of Truth

- **Không chứa Service Role Key**: APK chỉ sử dụng Supabase Anon Key công khai giống như frontend của Web client.
- **Server Identity Guard**: Mọi request đồng bộ người dùng đều gửi header `Authorization: Bearer <Supabase Access Token>`. Backend Cinepvq xác thực JWT từ Supabase và tự trích xuất `user.id`, hoàn toàn loại bỏ nguy cơ mạo danh ID.
- **Không thay đổi Web**: Toàn bộ hệ sinh thái `cinepvq-web` được giữ nguyên vẹn 100%.
