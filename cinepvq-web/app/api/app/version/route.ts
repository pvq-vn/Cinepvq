// ==============================================================================
// app/api/app/version/route.ts
// Official Android App Version Metadata & Update Manifest
// ==============================================================================

import { NextResponse } from "next/server";

export interface AppVersionResponse {
  versionCode: number;
  versionName: string;
  downloadUrl: string;
  sha256: string;
  changelog: string[];
  forceUpdate: boolean;
}

const DEFAULT_VERSION_CODE = 4;
const DEFAULT_VERSION_NAME = "1.2.0";
const DEFAULT_TAG = `v${DEFAULT_VERSION_NAME}`;

const DEFAULT_CHANGELOG = [
  "Tối ưu toàn diện tốc độ khởi phát phim (0ms từ bộ nhớ đệm, gộp manifest 1 lượt tải, pre-warm sẵn nguồn ngay tại trang chi tiết) và phát mượt không giật lag (HTTP/2 pool, buffer 30s-75s, tự động chuyển nguồn nhanh hơn khi CDN tắc nghẽn)",
  "Hiển thị vòng xoay đang tải (buffering spinner) chuẩn xác thay vì nháy nút tạm dừng khi nạp video",
  "Hợp nhất toàn bộ 6 kho phim (KKPhim1, VSMOV, PhimHDCSS, ChoPhim, K20, NguonC) thành 1 kho phim duy nhất trên Tìm kiếm, Trang chủ, Chi tiết & BXH",
  "Bổ sung phụ đề tiếng Việt cho PhimHDCSS và hiển thị đầy đủ nguồn ChoPhim trong trình phát",
  "Nâng cấp BXH Douban cuộn vô hạn, chỉ hiển thị phim khả dụng có poster và giữ nguyên thứ hạng gốc",
  "Sửa triệt để lỗi phim đã xóa trong Lịch sử tự đồng bộ quay lại giữa Web và App",
  "Bổ sung Trang Quản Trị (Admin Portal) tích hợp trực tiếp trong Tài khoản và Cài đặt",
];

async function fetchReleaseSha256(downloadUrl: string): Promise<string> {
  const shaUrl = `${downloadUrl}.sha256`;
  try {
    const res = await fetch(shaUrl, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return "";
    const raw = (await res.text()).trim();
    const hexMatch = raw.match(/\b([a-f0-9]{64})\b/i);
    return hexMatch ? hexMatch[1].toLowerCase() : "";
  } catch {
    return "";
  }
}

export async function GET() {
  try {
    const rawVersionCode = process.env.APP_LATEST_VERSION_CODE;
    const parsedEnvCode = rawVersionCode ? parseInt(rawVersionCode, 10) : NaN;
    const versionCode = Number.isFinite(parsedEnvCode)
      ? Math.max(parsedEnvCode, DEFAULT_VERSION_CODE)
      : DEFAULT_VERSION_CODE;

    const isEnvForCurrentOrNewer = Number.isFinite(parsedEnvCode) && parsedEnvCode >= DEFAULT_VERSION_CODE;
    const versionName =
      isEnvForCurrentOrNewer && process.env.APP_LATEST_VERSION_NAME
        ? process.env.APP_LATEST_VERSION_NAME
        : DEFAULT_VERSION_NAME;

    const downloadUrl = (
      (isEnvForCurrentOrNewer && process.env.APP_LATEST_DOWNLOAD_URL) ||
      `https://github.com/pvq-vn/Cinepvq/releases/download/${DEFAULT_TAG}/Cinepvq.apk`
    ).trim();

    let sha256 = isEnvForCurrentOrNewer ? (process.env.APP_LATEST_SHA256 || "").trim() : "";
    if (!/^[a-f0-9]{64}$/i.test(sha256)) {
      sha256 = await fetchReleaseSha256(downloadUrl);
    }

    const forceUpdate = process.env.APP_FORCE_UPDATE === "true";

    let changelog = DEFAULT_CHANGELOG;
    if (process.env.APP_LATEST_CHANGELOG) {
      try {
        const parsed = JSON.parse(process.env.APP_LATEST_CHANGELOG);
        if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
          changelog = parsed;
        }
      } catch {
        // Fallback to default changelog if env var is malformed
      }
    }

    const payload: AppVersionResponse = {
      versionCode,
      versionName: String(versionName).trim(),
      downloadUrl,
      sha256,
      changelog,
      forceUpdate: Boolean(forceUpdate),
    };

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("[App Version API error]", error);
    return NextResponse.json(
      {
        versionCode: DEFAULT_VERSION_CODE,
        versionName: DEFAULT_VERSION_NAME,
        downloadUrl: `https://github.com/pvq-vn/Cinepvq/releases/download/${DEFAULT_TAG}/Cinepvq.apk`,
        sha256: "",
        changelog: DEFAULT_CHANGELOG,
        forceUpdate: false,
      },
      { status: 200 }
    );
  }
}
