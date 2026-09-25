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

const DEFAULT_CHANGELOG = [
  "Trình phát video HLS chất lượng cao thích ứng",
  "Hỗ trợ chế độ PiP (Picture-in-Picture) và Mini Player trong ứng dụng",
  "Đồng bộ hai chiều danh sách Yêu thích và Lịch sử xem",
  "Tối ưu hóa hiệu năng và giao diện dark theme cao cấp",
];

export async function GET() {
  try {
    const rawVersionCode = process.env.APP_LATEST_VERSION_CODE;
    const versionCode = rawVersionCode ? parseInt(rawVersionCode, 10) : 1;

    const versionName = process.env.APP_LATEST_VERSION_NAME || "1.0.0";
    const downloadUrl =
      process.env.APP_LATEST_DOWNLOAD_URL ||
      "https://github.com/pvq-vn/Cinepvq/releases/latest/download/Cinepvq.apk";
    const sha256 = process.env.APP_LATEST_SHA256 || "";
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
      versionCode: Number.isFinite(versionCode) ? versionCode : 1,
      versionName: String(versionName).trim(),
      downloadUrl: String(downloadUrl).trim(),
      sha256: String(sha256).trim(),
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
        versionCode: 1,
        versionName: "1.0.0",
        downloadUrl: "https://github.com/pvq-vn/Cinepvq/releases/latest/download/Cinepvq.apk",
        sha256: "",
        changelog: DEFAULT_CHANGELOG,
        forceUpdate: false,
      },
      { status: 200 }
    );
  }
}
