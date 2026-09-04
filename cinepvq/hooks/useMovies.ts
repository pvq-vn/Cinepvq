import { useQuery } from "@tanstack/react-query";
import { getLatestMovies, getMovieDetail, searchMovies, getMoviesByCategory } from "@/services/api";
import type { Movie, MovieDetail, Paginate } from "@/types/movie";

interface UseFetchNewMoviesResult {
  data: Movie[];
  paginate: Paginate | null;
  isLoading: boolean;
  isError: boolean;
}

export function useFetchNewMovies(page = 1): UseFetchNewMoviesResult {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["newMovies", page],
    queryFn: async () => {
      const response = await getLatestMovies(page);
      return response.data;
    },
  });

  return {
    data: data?.items ?? [],
    paginate: data?.paginate ?? null,
    isLoading,
    isError,
  };
}

// ─── Movie detail ──────────────────────────────────────────────────────────

interface UseFetchMovieDetailResult {
  data: MovieDetail | null;
  isLoading: boolean;
  isError: boolean;
}

export function useFetchMovieDetail(slug: string): UseFetchMovieDetailResult {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["movieDetail", slug],
    queryFn: async () => {
      const response = await getMovieDetail(slug);
      return response.data;
    },
    enabled: !!slug,
  });

  return {
    data: data?.movie ?? null,
    isLoading,
    isError,
  };
}

// ─── Search movies ─────────────────────────────────────────────────────────

interface UseSearchMoviesResult {
  data: Movie[];
  paginate: Paginate | null;
  isLoading: boolean;
  isError: boolean;
}

export function useSearchMovies(
  keyword: string,
  page = 1
): UseSearchMoviesResult {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["searchMovies", keyword, page],
    queryFn: async () => {
      const response = await searchMovies(keyword);
      return response.data;
    },
    enabled: !!keyword.trim(),
  });

  return {
    data: data?.items ?? [],
    paginate: data?.paginate ?? null,
    isLoading,
    isError,
  };
}

// ─── Movies by category ────────────────────────────────────────────────────

interface UseFetchMoviesByCategoryResult {
  data: Movie[];
  paginate: Paginate | null;
  isLoading: boolean;
  isError: boolean;
}

export function useFetchMoviesByCategory(
  slug: string,
  page = 1
): UseFetchMoviesByCategoryResult {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["moviesByCategory", slug, page],
    queryFn: async () => {
      const response = await getMoviesByCategory(slug, page);
      return response.data;
    },
    enabled: !!slug,
  });

  return {
    data: data?.items ?? [],
    paginate: data?.paginate ?? null,
    isLoading,
    isError,
  };
}
