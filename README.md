# Project Cerberus

A lightweight, cross-platform mobile app that watches whatever is on your
screen and raises a notification when it spots a **person** or a
**vehicle** — entirely on-device, no cloud calls, no frames ever leave the
phone.

It works by capturing the screen (not the camera) via each platform's screen
recording API, sampling a frame every second or so, and running a small
on-device object detector (TFLite Task Vision, EfficientDet-Lite0) filtered
down to COCO's `person` / `car` / `motorcycle` / `bus` / `truck` / `train` /
`bicycle` classes.

## How it works, per platform

| | Android | iOS |
|---|---|---|
| Capture | `MediaProjection` + `ImageReader`, inside a foreground service | `ReplayKit` Broadcast Upload Extension |
| Starts from background? | Yes, once permission is granted once | No — user must tap the system broadcast picker themselves each time (Apple platform limitation) |
| Can the app stop it? | Yes | No — only the user, via the picker or the red status-bar pill |
| Where detection runs | Foreground service process | The extension's own sandboxed process (~50MB memory ceiling) |
| Alert path | Local notification, posted directly | Local notification, posted directly from the extension |

Android is the fully-featured, "it just works" target. iOS is scaffolded and
functional but requires a few manual Xcode steps (Apple doesn't allow
programmatic creation of extension targets) — see below.

## Repo layout

```
App.tsx, src/                        React Native UI (TypeScript)
src/native/screenGuard.ts            Typed bridge to the native module
android/.../screencapture/           Kotlin: capture service, TFLite wrapper, RN bridge
ios/ProjectCerberus/ScreenGuardModule.swift   Main-app-side bridge (shows the broadcast picker)
ios/BroadcastExtension/SampleHandler.swift    Runs in the extension process; does the actual detection
ios/Shared/                          Code shared by both iOS targets (App Group models)
```

## Setup

```bash
npm install
```

### Android

```bash
npm run android
```

The `.tflite` model (~4.3MB) isn't committed to the repo — `android/app/build.gradle`
downloads it automatically during `preBuild` (same EfficientDet-Lite0 model Google
ships in its own TFLite sample apps). First build needs network access; after that
it's cached in `android/app/src/main/assets/model.tflite`.

Minimum SDK is 29 (Android 10) — `MediaProjection` capture from a background-friendly
foreground service isn't practical below that.

### iOS

The RN app, the Swift bridge module, and the extension source are all written, but
Xcode extension targets can't be created by editing text files — you need to do this
once, in Xcode, on a Mac:

1. `cd ios && pod install`
2. Open `ProjectCerberus.xcworkspace` in Xcode.
3. **File → New → Target → Broadcast Upload Extension**, name it `BroadcastExtension`,
   uncheck "Include UI Extension".
4. Delete the placeholder `SampleHandler.swift` Xcode generated and add the real one
   from `ios/BroadcastExtension/SampleHandler.swift` (and its `Info.plist`) to that target.
5. Add every file under `ios/Shared/` to **both** targets' Target Membership.
6. Register an App Group in your Apple Developer account, then set it in both
   `ios/ProjectCerberus/ProjectCerberus.entitlements` and
   `ios/BroadcastExtension/BroadcastExtension.entitlements` (replace the placeholder
   `group.com.projectcerberus.shared`), and attach each entitlements file to its target
   in Xcode's Signing & Capabilities tab.
7. Update `CerberusBroadcastExtensionBundleId` in `ios/ProjectCerberus/Info.plist` to
   match the extension target's actual bundle ID.
8. Download the same model used on Android and add it to the extension target:
   ```bash
   curl -o ios/BroadcastExtension/model.tflite \
     https://storage.googleapis.com/download.tensorflow.org/models/tflite/task_library/object_detection/android/lite-model_efficientdet_lite0_detection_metadata_1.tflite
   ```
   then drag it into Xcode with "BroadcastExtension" target membership checked.
9. Uncomment the `target 'BroadcastExtension'` block at the bottom of `ios/Podfile`
   and run `pod install` again.
10. Build and run `ProjectCerberus` from Xcode (not `npm run ios`, until you've done
    the above — the extension target has to exist for the workspace to build with it).

## Settings

Interval, confidence threshold, notification cooldown, and which categories
(person/vehicle) trigger alerts are all adjustable in the Settings tab and persisted
locally. On Android these apply live to an already-running session; on iOS a change
only takes effect the next time you start a broadcast (there's no channel for the
main app to talk to an extension that's already running).

## Known limitations

- **Screen off ⇒ nothing to see.** Both platforms mirror the compositor output;
  if the display is off there's no frame to analyze. This isn't a bug to work around
  — it's what "watching the screen" means.
- **iOS can't be started or stopped by the app.** This is an Apple platform
  restriction on `ReplayKit`, not a shortcut we took.
- **Extension memory is tight.** iOS Broadcast Upload Extensions get roughly 50MB;
  EfficientDet-Lite0 was picked specifically because it fits.
- This was built and typechecked/linted/unit-tested in a sandboxed Linux container
  without the Android SDK or Xcode available, so the native Kotlin/Swift code has been
  carefully hand-reviewed against the real APIs but not compiled end-to-end here.
  Run a real `./gradlew assembleDebug` / Xcode build as your first step.

## Scripts

```bash
npm run android      # build + install + launch on a connected device/emulator
npm run ios           # (after completing the iOS setup above)
npm start              # Metro bundler
npm test                # jest
npm run lint            # eslint
npx tsc --noEmit        # typecheck
```
