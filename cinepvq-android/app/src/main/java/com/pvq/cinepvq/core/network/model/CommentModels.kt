package com.pvq.cinepvq.core.network.model

import kotlinx.serialization.Serializable

@Serializable
data class Comment(
    val id: String,
    val author: String,
    val avatar: String? = null,
    val content: String,
    val createdAt: String,
    val likes: Int = 0
)

@Serializable
data class CommentsResponse(
    val status: String,
    val message: String? = null,
    val comments: List<Comment>? = null,
    val comment: Comment? = null // Used for POST response
)

@Serializable
data class PostCommentRequest(
    val movieSlug: String,
    val content: String
)
