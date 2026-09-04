"use client";

interface VideoPlayerProps {
  videoUrl: string;
}

export default function VideoPlayer({ videoUrl }: VideoPlayerProps) {
  if (!videoUrl) {
    return (
      <div className="relative w-full overflow-hidden rounded-xl bg-zinc-900 aspect-video flex items-center justify-center">
        <p className="text-zinc-500">Chọn một tập phim để xem</p>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-black shadow-2xl shadow-black/40 aspect-video">
      <iframe
        src={videoUrl}
        className="absolute inset-0 h-full w-full border-0"
        allowFullScreen
        allow="autoplay; encrypted-media; picture-in-picture"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
