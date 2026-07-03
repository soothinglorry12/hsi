package com.projectcerberus.screencapture

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import org.json.JSONArray
import org.json.JSONObject

enum class DetectionCategory { PERSON, VEHICLE }

data class Detection(val label: String, val score: Float, val category: DetectionCategory)

/** Tunables for the capture/detection loop, sent from JS and applied live. */
data class MonitorSettings(
    val intervalMs: Long = 1000L,
    val confidenceThreshold: Float = 0.5f,
    val cooldownMs: Long = 30000L,
    val notifyPerson: Boolean = true,
    val notifyVehicle: Boolean = true,
)

/** A single "we saw something" event, persisted to history and surfaced as a notification. */
data class DetectionEvent(
    val id: String,
    val timestamp: Long,
    val labels: List<String>,
    val categories: List<String>,
    val topScore: Float,
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("id", id)
        put("timestamp", timestamp)
        put("labels", JSONArray(labels))
        put("categories", JSONArray(categories))
        put("topScore", topScore.toDouble())
    }

    fun toWritableMap(): WritableMap = Arguments.createMap().apply {
        putString("id", id)
        putDouble("timestamp", timestamp.toDouble())
        putArray("labels", Arguments.fromList(labels))
        putArray("categories", Arguments.fromList(categories))
        putDouble("topScore", topScore.toDouble())
    }

    companion object {
        fun fromJson(obj: JSONObject): DetectionEvent? = try {
            DetectionEvent(
                id = obj.getString("id"),
                timestamp = obj.getLong("timestamp"),
                labels = obj.getJSONArray("labels").toStringList(),
                categories = obj.getJSONArray("categories").toStringList(),
                topScore = obj.getDouble("topScore").toFloat(),
            )
        } catch (e: Exception) {
            null
        }

        private fun JSONArray.toStringList(): List<String> = (0 until length()).map { getString(it) }
    }
}
