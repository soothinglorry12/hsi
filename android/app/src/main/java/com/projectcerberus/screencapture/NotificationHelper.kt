package com.projectcerberus.screencapture

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.projectcerberus.R

class NotificationHelper(private val context: Context) {

    private val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    init {
        createChannels()
    }

    private fun createChannels() {
        val monitoring = NotificationChannel(
            MONITORING_CHANNEL_ID,
            "Monitoring active",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "Shown while Cerberus is watching the screen"
            setShowBadge(false)
        }
        val detections = NotificationChannel(
            DETECTIONS_CHANNEL_ID,
            "Detections",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Alerts when a person or vehicle is detected on screen"
        }
        manager.createNotificationChannel(monitoring)
        manager.createNotificationChannel(detections)
    }

    fun buildMonitoringNotification(): android.app.Notification {
        val stopIntent = Intent(context, ScreenCaptureService::class.java).setAction(ScreenCaptureService.ACTION_STOP)
        val stopPendingIntent = PendingIntent.getService(
            context,
            0,
            stopIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        val contentPendingIntent = launchIntent?.let {
            PendingIntent.getActivity(context, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        }
        return NotificationCompat.Builder(context, MONITORING_CHANNEL_ID)
            .setContentTitle("Cerberus is watching")
            .setContentText("Analyzing your screen for people and vehicles")
            .setSmallIcon(R.drawable.ic_notification)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(contentPendingIntent)
            .addAction(0, "Stop", stopPendingIntent)
            .build()
    }

    fun showDetectionNotification(event: DetectionEvent) {
        val hasPerson = event.categories.contains(DetectionCategory.PERSON.name)
        val hasVehicle = event.categories.contains(DetectionCategory.VEHICLE.name)
        val title = when {
            hasPerson && hasVehicle -> "Person & vehicle detected"
            hasPerson -> "Person detected"
            else -> "Vehicle detected"
        }
        val text = event.labels.joinToString(", ") { it.replaceFirstChar(Char::uppercase) }
        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        val contentPendingIntent = launchIntent?.let {
            PendingIntent.getActivity(context, 1, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        }
        val notification = NotificationCompat.Builder(context, DETECTIONS_CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_notification)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .setContentIntent(contentPendingIntent)
            .build()
        manager.notify(event.id.hashCode(), notification)
    }

    companion object {
        const val MONITORING_CHANNEL_ID = "cerberus_monitoring"
        const val DETECTIONS_CHANNEL_ID = "cerberus_detections"
    }
}
