import { useQuery } from "@tanstack/react-query";
import {
  getLatestMovies,
  getMovieDetail,
  searchMovies,
  getMoviesByCategory,
  getMoviesByGenre,
  getMoviesByCountry,
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
