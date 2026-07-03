package com.projectcerberus.screencapture

import android.content.Context
import org.json.JSONArray

/** Flat, capped JSON log of recent detections, readable by JS even after the app was killed. */
class DetectionHistoryStore(context: Context) {

    private val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val lock = Any()

    fun append(event: DetectionEvent) {
        synchronized(lock) {
            val current = readAll().toMutableList()
            current.add(0, event)
            while (current.size > MAX_ENTRIES) current.removeAt(current.lastIndex)
            val array = JSONArray()
            current.forEach { array.put(it.toJson()) }
            prefs.edit().putString(KEY_EVENTS, array.toString()).apply()
        }
    }

    fun readAll(): List<DetectionEvent> {
        val raw = prefs.getString(KEY_EVENTS, null) ?: return emptyList()
        return try {
            val arr = JSONArray(raw)
            (0 until arr.length()).mapNotNull { i -> DetectionEvent.fromJson(arr.getJSONObject(i)) }
        } catch (e: Exception) {
            emptyList()
        }
    }

    fun clear() {
        synchronized(lock) { prefs.edit().remove(KEY_EVENTS).apply() }
    }

    companion object {
        private const val PREFS_NAME = "cerberus_history"
        private const val KEY_EVENTS = "events"
        private const val MAX_ENTRIES = 200
    }
}
