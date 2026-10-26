package com.pvq.cinepvq.core.network.model

import kotlinx.serialization.Serializable

@Serializable
data class AppVersionDto(
    val versionCode: Int = 1,
    val versionName: String = "1.0.0",
    val downloadUrl: String = "",
    val sha256: String? = null,
    val changelog: List<String> = emptyList(),
    val forceUpdate: Boolean = false
)
