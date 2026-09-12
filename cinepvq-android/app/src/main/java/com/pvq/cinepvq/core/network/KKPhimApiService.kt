package com.pvq.cinepvq.core.network

import com.pvq.cinepvq.core.network.model.KKPhimDetailResponse
import com.pvq.cinepvq.core.network.model.KKPhimLatestResponse
import com.pvq.cinepvq.core.network.model.KKPhimV1ListResponse
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

interface KKPhimApiService {

    @GET("danh-sach/phim-moi-cap-nhat")
    suspend fun getLatestMovies(
        @Query("page") page: Int = 1
    ): Response<KKPhimLatestResponse>

    @GET("v1/api/danh-sach/{category}")
    suspend fun getMoviesByCategory(
        @Path("category") category: String,
        @Query("page") page: Int = 1
    ): Response<KKPhimV1ListResponse>

    @GET("v1/api/the-loai/{genre}")
    suspend fun getMoviesByGenre(
        @Path("genre") genre: String,
        @Query("page") page: Int = 1
    ): Response<KKPhimV1ListResponse>

    @GET("v1/api/quoc-gia/{country}")
    suspend fun getMoviesByCountry(
        @Path("country") country: String,
        @Query("page") page: Int = 1
    ): Response<KKPhimV1ListResponse>

    @GET("v1/api/tim-kiem")
    suspend fun searchMovies(
        @Query("keyword") keyword: String,
        @Query("page") page: Int = 1
    ): Response<KKPhimV1ListResponse>

    @GET("phim/{slug}")
    suspend fun getMovieDetail(
        @Path("slug") slug: String
    ): Response<KKPhimDetailResponse>
}
