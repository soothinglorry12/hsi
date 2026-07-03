package com.projectcerberus.screencapture

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class ScreenGuardModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext),
    ActivityEventListener {

    private var permissionPromise: Promise? = null
    private var grantedResultCode: Int? = null
    private var grantedData: Intent? = null

    init {
        reactContext.addActivityEventListener(this)
        activeInstance = this
    }

    override fun getName() = "ScreenGuard"

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        if (activeInstance === this) activeInstance = null
    }

    override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != CAPTURE_REQUEST_CODE) return
        val promise = permissionPromise
        permissionPromise = null
        if (resultCode == Activity.RESULT_OK && data != null) {
            grantedResultCode = resultCode
            grantedData = data
            promise?.resolve(true)
        } else {
            grantedResultCode = null
            grantedData = null
            promise?.resolve(false)
        }
    }

    override fun onNewIntent(intent: Intent?) = Unit

    @ReactMethod
    fun requestCapturePermission(promise: Promise) {
        val activity = currentActivity
        if (activity == null) {
            promise.reject("no_activity", "No current activity to request permission from")
            return
        }
        permissionPromise = promise
        val manager = activity.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        activity.startActivityForResult(manager.createScreenCaptureIntent(), CAPTURE_REQUEST_CODE)
    }

    @ReactMethod
    fun startMonitoring(options: ReadableMap, promise: Promise) {
        val resultCode = grantedResultCode
        val data = grantedData
        if (resultCode == null || data == null) {
            promise.reject("no_permission", "Screen capture permission has not been granted yet")
            return
        }
        val intent = Intent(reactContext, ScreenCaptureService::class.java).apply {
            putExtra(ScreenCaptureService.EXTRA_RESULT_CODE, resultCode)
            putExtra(ScreenCaptureService.EXTRA_DATA, data)
            putExtras(settingsBundle(options))
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("start_failed", e)
        }
    }

    @ReactMethod
    fun updateSettings(options: ReadableMap, promise: Promise) {
        val intent = Intent(reactContext, ScreenCaptureService::class.java).apply {
            action = ScreenCaptureService.ACTION_UPDATE_SETTINGS
            putExtras(settingsBundle(options))
        }
        reactContext.startService(intent)
        promise.resolve(true)
    }

    @ReactMethod
    fun stopMonitoring(promise: Promise) {
        val intent = Intent(reactContext, ScreenCaptureService::class.java).apply {
            action = ScreenCaptureService.ACTION_STOP
        }
        reactContext.startService(intent)
        grantedResultCode = null
        grantedData = null
        promise.resolve(true)
    }

    @ReactMethod
    fun isMonitoring(promise: Promise) {
        promise.resolve(ScreenCaptureService.isRunning)
    }

    @ReactMethod
    fun getDetectionHistory(promise: Promise) {
        val history = DetectionHistoryStore(reactContext).readAll()
        val array = Arguments.createArray()
        history.forEach { array.pushMap(it.toWritableMap()) }
        promise.resolve(array)
    }

    @ReactMethod
    fun clearDetectionHistory(promise: Promise) {
        DetectionHistoryStore(reactContext).clear()
        promise.resolve(true)
    }

    // RN's NativeEventEmitter requires these on the JS side even though we don't
    // use React Native's built-in subscription counting on the native side.
    @ReactMethod
    fun addListener(eventName: String) = Unit

    @ReactMethod
    fun removeListeners(count: Int) = Unit

    private fun settingsBundle(options: ReadableMap): Bundle = Bundle().apply {
        putLong(ScreenCaptureService.EXTRA_INTERVAL_MS, if (options.hasKey("intervalMs")) options.getInt("intervalMs").toLong() else 1000L)
        putFloat(ScreenCaptureService.EXTRA_CONFIDENCE, if (options.hasKey("confidenceThreshold")) options.getDouble("confidenceThreshold").toFloat() else 0.5f)
        putLong(ScreenCaptureService.EXTRA_COOLDOWN_MS, if (options.hasKey("cooldownMs")) options.getInt("cooldownMs").toLong() else 30000L)
        putBoolean(ScreenCaptureService.EXTRA_NOTIFY_PERSON, if (options.hasKey("notifyPerson")) options.getBoolean("notifyPerson") else true)
        putBoolean(ScreenCaptureService.EXTRA_NOTIFY_VEHICLE, if (options.hasKey("notifyVehicle")) options.getBoolean("notifyVehicle") else true)
    }

    private fun sendEvent(name: String, params: Any?) {
        if (!reactContext.hasActiveReactInstance()) return
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(name, params)
    }

    companion object {
        private const val CAPTURE_REQUEST_CODE = 6202

        @Volatile private var activeInstance: ScreenGuardModule? = null

        fun emitDetection(event: DetectionEvent) {
            activeInstance?.sendEvent("CerberusDetection", event.toWritableMap())
        }

        fun emitCaptureStopped() {
            activeInstance?.sendEvent("CerberusCaptureStopped", null)
        }

        fun emitError(code: String, message: String) {
            val map = Arguments.createMap().apply {
                putString("code", code)
                putString("message", message)
            }
            activeInstance?.sendEvent("CerberusServiceError", map)
        }
    }
}
