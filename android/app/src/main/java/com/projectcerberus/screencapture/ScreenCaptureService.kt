package com.projectcerberus.screencapture

import android.app.Activity
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.SystemClock
import java.util.UUID
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Foreground service that mirrors the device screen into an off-screen [ImageReader],
 * throttles frames down to [MonitorSettings.intervalMs], and runs each sampled frame
 * through [DetectionEngine]. Deliberately processes at most one frame per interval
 * (not every frame the display produces) to keep CPU/battery use low.
 */
class ScreenCaptureService : Service() {

    private lateinit var notificationHelper: NotificationHelper
    private lateinit var historyStore: DetectionHistoryStore
    private lateinit var captureThread: HandlerThread
    private lateinit var captureHandler: Handler
    private lateinit var processingExecutor: ExecutorService

    private var mediaProjection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var imageReader: ImageReader? = null
    private var detectionEngine: DetectionEngine? = null

    @Volatile private var isCapturing = false
    @Volatile private var settings = MonitorSettings()
    private var lastProcessedAt = 0L
    private val lastNotifiedAt = mutableMapOf<DetectionCategory, Long>()

    override fun onCreate() {
        super.onCreate()
        notificationHelper = NotificationHelper(this)
        historyStore = DetectionHistoryStore(this)
        captureThread = HandlerThread("CerberusCapture").apply { start() }
        captureHandler = Handler(captureThread.looper)
        processingExecutor = Executors.newSingleThreadExecutor()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopCapture()
                return START_NOT_STICKY
            }
            ACTION_UPDATE_SETTINGS -> {
                settings = readSettings(intent.extras)
                return START_STICKY
            }
            else -> {
                val resultCode = intent?.getIntExtra(EXTRA_RESULT_CODE, Activity.RESULT_CANCELED) ?: Activity.RESULT_CANCELED
                @Suppress("DEPRECATION")
                val data = intent?.getParcelableExtra<Intent>(EXTRA_DATA)
                if (resultCode != Activity.RESULT_OK || data == null) {
                    stopSelf()
                    return START_NOT_STICKY
                }
                settings = readSettings(intent.extras)
                startForeground(
                    NOTIFICATION_ID_MONITORING,
                    notificationHelper.buildMonitoringNotification(),
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION,
                )
                startCapture(resultCode, data)
                // If the process is killed mid-capture, the permission token in this intent
                // is redelivered so we can try to resume rather than silently dying.
                return START_REDELIVER_INTENT
            }
        }
    }

    private fun readSettings(extras: Bundle?): MonitorSettings {
        if (extras == null) return settings
        return MonitorSettings(
            intervalMs = extras.getLong(EXTRA_INTERVAL_MS, settings.intervalMs),
            confidenceThreshold = extras.getFloat(EXTRA_CONFIDENCE, settings.confidenceThreshold),
            cooldownMs = extras.getLong(EXTRA_COOLDOWN_MS, settings.cooldownMs),
            notifyPerson = extras.getBoolean(EXTRA_NOTIFY_PERSON, settings.notifyPerson),
            notifyVehicle = extras.getBoolean(EXTRA_NOTIFY_VEHICLE, settings.notifyVehicle),
        )
    }

    private fun startCapture(resultCode: Int, data: Intent) {
        val projectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        val projection = projectionManager.getMediaProjection(resultCode, data)
        mediaProjection = projection
        projection.registerCallback(
            object : MediaProjection.Callback() {
                override fun onStop() {
                    captureHandler.post { stopCapture() }
                }
            },
            captureHandler,
        )

        val metrics = resources.displayMetrics
        val (width, height) = scaledDimensions(metrics.widthPixels, metrics.heightPixels, MAX_DIMENSION)

        try {
            detectionEngine = DetectionEngine(applicationContext)
        } catch (e: Exception) {
            ScreenGuardModule.emitError("model_load_failed", e.message ?: "Failed to load detection model")
            stopCapture()
            return
        }

        val reader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
        imageReader = reader
        virtualDisplay = projection.createVirtualDisplay(
            "CerberusCapture",
            width,
            height,
            metrics.densityDpi,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            reader.surface,
            null,
            captureHandler,
        )
        reader.setOnImageAvailableListener({ onFrameAvailable(it) }, captureHandler)
        isCapturing = true
        isRunning = true
    }

    private fun onFrameAvailable(reader: ImageReader) {
        val image = try {
            reader.acquireLatestImage()
        } catch (e: Exception) {
            null
        } ?: return
        try {
            if (!isCapturing) return
            val now = SystemClock.elapsedRealtime()
            if (now - lastProcessedAt < settings.intervalMs) return
            lastProcessedAt = now

            val bitmap = imageToBitmap(image) ?: return
            processingExecutor.execute {
                try {
                    runDetection(bitmap)
                } finally {
                    bitmap.recycle()
                }
            }
        } finally {
            image.close()
        }
    }

    private fun imageToBitmap(image: android.media.Image): Bitmap? = try {
        val plane = image.planes[0]
        val buffer = plane.buffer
        val pixelStride = plane.pixelStride
        val rowStride = plane.rowStride
        val rowPadding = rowStride - pixelStride * image.width
        val rawBitmap = Bitmap.createBitmap(
            image.width + rowPadding / pixelStride,
            image.height,
            Bitmap.Config.ARGB_8888,
        )
        rawBitmap.copyPixelsFromBuffer(buffer)
        if (rowPadding == 0) {
            rawBitmap
        } else {
            val cropped = Bitmap.createBitmap(rawBitmap, 0, 0, image.width, image.height)
            rawBitmap.recycle()
            cropped
        }
    } catch (e: Exception) {
        null
    }

    private fun runDetection(bitmap: Bitmap) {
        val engine = detectionEngine ?: return
        val detections = try {
            engine.detect(bitmap)
        } catch (e: Exception) {
            emptyList()
        }

        val relevant = detections.filter { d ->
            d.score >= settings.confidenceThreshold && when (d.category) {
                DetectionCategory.PERSON -> settings.notifyPerson
                DetectionCategory.VEHICLE -> settings.notifyVehicle
            }
        }
        if (relevant.isEmpty()) return

        val now = SystemClock.elapsedRealtime()
        val toNotify = relevant.filter { d ->
            now - (lastNotifiedAt[d.category] ?: 0L) >= settings.cooldownMs
        }
        if (toNotify.isEmpty()) return
        toNotify.forEach { lastNotifiedAt[it.category] = now }

        val event = DetectionEvent(
            id = UUID.randomUUID().toString(),
            timestamp = System.currentTimeMillis(),
            labels = toNotify.map { it.label }.distinct(),
            categories = toNotify.map { it.category.name }.distinct(),
            topScore = toNotify.maxOf { it.score },
        )
        historyStore.append(event)
        notificationHelper.showDetectionNotification(event)
        captureHandler.post { ScreenGuardModule.emitDetection(event) }
    }

    private fun scaledDimensions(width: Int, height: Int, maxDimension: Int): Pair<Int, Int> {
        if (width <= maxDimension && height <= maxDimension) return width to height
        val scale = maxDimension.toFloat() / maxOf(width, height)
        val newWidth = (width * scale).toInt().coerceAtLeast(1)
        val newHeight = (height * scale).toInt().coerceAtLeast(1)
        return newWidth to newHeight
    }

    private fun stopCapture() {
        if (!isCapturing) {
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return
        }
        isCapturing = false
        isRunning = false
        imageReader?.setOnImageAvailableListener(null, null)
        virtualDisplay?.release()
        virtualDisplay = null
        imageReader?.close()
        imageReader = null
        mediaProjection?.stop()
        mediaProjection = null
        detectionEngine?.close()
        detectionEngine = null
        lastNotifiedAt.clear()
        ScreenGuardModule.emitCaptureStopped()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        stopCapture()
        processingExecutor.shutdownNow()
        captureThread.quitSafely()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val ACTION_STOP = "com.projectcerberus.screencapture.action.STOP"
        const val ACTION_UPDATE_SETTINGS = "com.projectcerberus.screencapture.action.UPDATE_SETTINGS"

        const val EXTRA_RESULT_CODE = "resultCode"
        const val EXTRA_DATA = "data"
        const val EXTRA_INTERVAL_MS = "intervalMs"
        const val EXTRA_CONFIDENCE = "confidenceThreshold"
        const val EXTRA_COOLDOWN_MS = "cooldownMs"
        const val EXTRA_NOTIFY_PERSON = "notifyPerson"
        const val EXTRA_NOTIFY_VEHICLE = "notifyVehicle"

        private const val NOTIFICATION_ID_MONITORING = 5501
        private const val MAX_DIMENSION = 640

        @Volatile var isRunning: Boolean = false
            private set
    }
}
