export function MovieCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900 ring-1 ring-zinc-200/50 dark:ring-zinc-800/50 animate-pulse">
      <div className="aspect-[2/3] w-full bg-zinc-200 dark:bg-zinc-800" />
      <div className="p-3 space-y-2">
        <div className="h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-3 w-1/2 rounded bg-zinc-200/70 dark:bg-zinc-800/70" />
      </div>
    </div>
  );
}

export function MovieGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <MovieCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function MovieRowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-4">
      <div className="h-7 w-48 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="w-[160px] sm:w-[200px] flex-shrink-0"
          >
            <MovieCardSkeleton />
          </div>
        ))}
      </div>
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="relative w-full h-[65vh] min-h-[460px] max-h-[700px] bg-zinc-200 dark:bg-zinc-900 animate-pulse overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-zinc-950 via-transparent to-transparent" />
      <div className="absolute bottom-12 left-4 sm:left-8 lg:left-12 max-w-2xl space-y-4">
        <div className="h-10 w-3/4 rounded-lg bg-zinc-300 dark:bg-zinc-800" />
        <div className="flex gap-2">
          <div className="h-6 w-16 rounded bg-zinc-300 dark:bg-zinc-800" />
          <div className="h-6 w-20 rounded bg-zinc-300 dark:bg-zinc-800" />
          <div className="h-6 w-16 rounded bg-zinc-300 dark:bg-zinc-800" />
        </div>
        <div className="h-16 w-full rounded bg-zinc-300/70 dark:bg-zinc-800/70" />
        <div className="flex gap-3">
          <div className="h-11 w-32 rounded-xl bg-zinc-300 dark:bg-zinc-800" />
          <div className="h-11 w-32 rounded-xl bg-zinc-300 dark:bg-zinc-800" />
        </div>
      </div>
    </div>
  );
}

export function MovieDetailSkeleton() {
  return (
    <div className="min-h-screen pt-20 pb-16 px-4 sm:px-6 lg:px-8 animate-pulse">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Backdrop / Hero skeleton */}
        <div className="relative aspect-video w-full rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
        
        {/* Info row */}
        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-48 aspect-[2/3] rounded-xl bg-zinc-200 dark:bg-zinc-800 flex-shrink-0" />
          <div className="flex-1 space-y-4">
            <div className="h-8 w-2/3 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-4 w-1/3 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="flex gap-2">
              <div className="h-6 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-6 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-6 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
            <div className="h-24 w-full rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>
      </div>
    </div>
  );
}
