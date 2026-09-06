import { useQuery } from "@tanstack/react-query";
import {
  getLatestMovies,
  getMovieDetail,
  searchMovies,
  getMoviesByCategory,
  getMoviesByGenre,
  getMoviesByCountry,
  getMoviesByYear,
} from "@/services/api";
import type { Movie, MovieDetail, Paginate } from "@/types/movie";

interface MoviesQueryResult {
  data: Movie[];
  paginate: Paginate | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

// ─── Phim mới cập nhật ─────────────────────────────────────────────────────

export function useFetchNewMovies(page = 1): MoviesQueryResult {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["newMovies", page],
    queryFn: async () => {
      const response = await getLatestMovies(page);
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    data: data?.items ?? [],
    paginate: data?.paginate ?? null,
    isLoading,
    isError,
    refetch,
  };
}

// ─── Phim theo danh mục (phim-bo, phim-le, tv-shows, hoat-hinh, dang-chieu) ─

export function useFetchMoviesByCategory(
  slug: string,
  page = 1
): MoviesQueryResult {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["moviesByCategory", slug, page],
    queryFn: async () => {
      const response = await getMoviesByCategory(slug, page);
      return response.data;
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });

  return {
    data: data?.items ?? [],
    paginate: data?.paginate ?? null,
    isLoading,
    isError,
    refetch,
  };
}

// ─── Phim theo thể loại ────────────────────────────────────────────────────

export function useFetchMoviesByGenre(
  slug: string,
  page = 1
): MoviesQueryResult {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["moviesByGenre", slug, page],
    queryFn: async () => {
      const response = await getMoviesByGenre(slug, page);
      return response.data;
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });

  return {
    data: data?.items ?? [],
    paginate: data?.paginate ?? null,
    isLoading,
    isError,
    refetch,
  };
}

// ─── Phim theo quốc gia ────────────────────────────────────────────────────

export function useFetchMoviesByCountry(
  slug: string,
  page = 1
): MoviesQueryResult {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["moviesByCountry", slug, page],
    queryFn: async () => {
      const response = await getMoviesByCountry(slug, page);
      return response.data;
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });

  return {
    data: data?.items ?? [],
    paginate: data?.paginate ?? null,
    isLoading,
    isError,
    refetch,
  };
}

// ─── Phim theo năm phát hành ───────────────────────────────────────────────

export function useFetchMoviesByYear(
  year: number,
  page = 1
): MoviesQueryResult {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["moviesByYear", year, page],
    queryFn: async () => {
      const response = await getMoviesByYear(year, page);
      return response.data;
    },
    enabled: !!year && !isNaN(year),
    staleTime: 5 * 60 * 1000,
  });

  return {
    data: data?.items ?? [],
    paginate: data?.paginate ?? null,
    isLoading,
    isError,
    refetch,
  };
}

// ─── Search movies ─────────────────────────────────────────────────────────

export function useSearchMovies(
  keyword: string,
  page = 1
): MoviesQueryResult {
  const trimmed = keyword.trim();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["searchMovies", trimmed, page],
    queryFn: async () => {
      const response = await searchMovies(trimmed, page);
      return response.data;
    },
    enabled: !!trimmed,
    staleTime: 2 * 60 * 1000,
  });

  return {
    data: data?.items ?? [],
    paginate: data?.paginate ?? null,
    isLoading: !!trimmed && isLoading,
    isError,
    refetch,
  };
}

// ─── Movie Discovery (Search & Multifaceted Filter) ────────────────────────

export interface MovieDiscoveryParams {
  keyword?: string;
  category?: string;
  genre?: string;
  country?: string;
  year?: number | string;
  page?: number;
}

export function useMovieDiscovery({
  keyword = "",
  category = "",
  genre = "",
  country = "",
  year,
  page = 1,
}: MovieDiscoveryParams): MoviesQueryResult {
  const trimmed = keyword.trim();
  const yearNum = year ? Number(year) : undefined;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [
      "movieDiscovery",
      {
        keyword: trimmed,
        category,
        genre,
        country,
        year: yearNum || null,
        page,
      },
    ],
    queryFn: async () => {
      if (trimmed) {
        const res = await searchMovies(trimmed, page);
        return res.data;
      }
      if (category) {
        const res = await getMoviesByCategory(category, page);
        return res.data;
      }
      if (genre) {
        const res = await getMoviesByGenre(genre, page);
        return res.data;
      }
      if (country) {
        const res = await getMoviesByCountry(country, page);
        return res.data;
      }
      if (yearNum && !isNaN(yearNum)) {
        const res = await getMoviesByYear(yearNum, page);
        return res.data;
      }
      // Default exploration: latest updated movies
      const res = await getLatestMovies(page);
      return res.data;
    },
    staleTime: 3 * 60 * 1000,
  });

  return {
    data: data?.items ?? [],
    paginate: data?.paginate ?? null,
    isLoading,
    isError,
    refetch,
  };
}

// ─── Movie detail ──────────────────────────────────────────────────────────

interface UseFetchMovieDetailResult {
  data: MovieDetail | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useFetchMovieDetail(slug: string): UseFetchMovieDetailResult {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["movieDetail", slug],
    queryFn: async () => {
      const response = await getMovieDetail(slug);
      return response.data;
    },
    enabled: !!slug,
    staleTime: 10 * 60 * 1000,
  });

  return {
    data: data?.movie ?? null,
    isLoading,
    isError,
    refetch,
  };
}
