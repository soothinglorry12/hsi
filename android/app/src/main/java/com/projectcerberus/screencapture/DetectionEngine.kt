package com.projectcerberus.screencapture

import android.content.Context
import android.graphics.Bitmap
import org.tensorflow.lite.support.image.TensorImage
import org.tensorflow.lite.task.core.BaseOptions
import org.tensorflow.lite.task.vision.detector.ObjectDetector

/**
 * Thin wrapper around a TFLite Task Library object detector, filtered down to the
 * two categories this app cares about. COCO's "bicycle" is counted as a vehicle too.
 */
class DetectionEngine(context: Context, modelFileName: String = "model.tflite") {

    private val personLabels = setOf("person")
    private val vehicleLabels = setOf("car", "motorcycle", "bus", "truck", "train", "bicycle")

    // Kept low and fixed: the user-facing confidence threshold is applied by the
    // caller so it can change at runtime without rebuilding the interpreter.
    private val detector: ObjectDetector = ObjectDetector.createFromFileAndOptions(
        context,
        modelFileName,
        ObjectDetector.ObjectDetectorOptions.builder()
            .setBaseOptions(BaseOptions.builder().setNumThreads(2).build())
            .setMaxResults(10)
            .setScoreThreshold(0.2f)
            .build(),
    )

    // Frames come from an off-screen ImageReader mirroring the display, so they're
    // always upright — no orientation correction needed before detection.
    fun detect(bitmap: Bitmap): List<Detection> {
        val tensorImage = TensorImage.fromBitmap(bitmap)
        val results = detector.detect(tensorImage)
        val detections = mutableListOf<Detection>()
        for (result in results) {
            val best = result.categories.maxByOrNull { it.score } ?: continue
            val label = best.label.lowercase()
            val category = when {
                personLabels.contains(label) -> DetectionCategory.PERSON
                vehicleLabels.contains(label) -> DetectionCategory.VEHICLE
                else -> null
            } ?: continue
            detections.add(Detection(label, best.score, category))
        }
        return detections
    }

    fun close() {
        detector.close()
    }
}
