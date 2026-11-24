# RoadCam

RoadCam is a free, open-source starting point for using an older phone as a dash camera. It previews the rear camera in landscape, records video with microphone audio, and saves completed clips to the phone's media library. After the first-run recording notice is accepted and camera/microphone permissions are granted, recording starts when the camera is ready.

## Organic Maps handoff

Organic Maps is a separate application; it cannot be embedded as RoadCam's right-hand map pane. The Navigation pane opens Organic Maps at the phone's current position after foreground location permission is granted. Choose a destination and start voice-guided navigation inside Organic Maps. RoadCam cannot promise or control Organic Maps' voice prompts.

Because RoadCam must not record in the background, recording is stopped and the clip is saved before opening Organic Maps. The deep link includes a return URL for Organic Maps' return button; the operating system's Back/app switcher is also available. Recording remains stopped and must be started manually. Location permission is required for this handoff. If Organic Maps is not installed, install it from [organicmaps.app](https://organicmaps.app/).

## Requirements

- Node.js LTS and npm
- Expo-supported iOS and Android development environment
- iPhone X or newer running iOS 16+, or Samsung Galaxy S8 or newer running Android 9+ (test on target devices; performance and compatibility can vary)
- Organic Maps installed separately for navigation and voice guidance

## Run locally

1. Install dependencies: `npm install`
2. Start Expo: `npm start`.
3. Build and install a native development app with `npm run android` or `npm run ios`. Native permission changes require a native build; Expo Go does not include every required native configuration.
4. Type-check with `npm run typecheck`.

No map API key or RoadCam account is required. Wi-Fi or mobile data may be needed for Organic Maps to download maps; download the desired offline map in Organic Maps before driving if connectivity is unreliable.

## Permissions and device test

On first launch, review and accept the recording disclosure. Then allow camera and microphone access; recording does not begin unless both are granted. Location permission is requested only when opening Organic Maps. The app asks for media-library permission when saving its first video. If camera or microphone access is denied, use the on-screen retry control or enable access in system Settings.

Before driving, mount the phone securely, open the app while parked, confirm the visible **RECORDING** indicator, and verify a clip appears in the device's media library after stopping. Tap **Open Organic Maps** and confirm recording stops and the clip saves; use Organic Maps' return button or the system app switcher to return to RoadCam, then confirm recording stays stopped until **Start Recording** is pressed. Do not handle or interact with the phone while driving. This MVP does not provide collision detection, loop recording, emergency locking, cloud backup, or turn-by-turn navigation inside RoadCam.

## Costs and privacy

RoadCam's source and local recording workflow do not charge a RoadCam fee. RoadCam saves recordings locally and does not upload them. Organic Maps is a separate third-party app; its own app-store terms, map downloads, data use, and policies apply. Wi-Fi/mobile data, device storage, app distribution, and developer accounts can incur costs, so zero operating or distribution cost cannot be guaranteed.

## License and third-party notices

Original RoadCam project code and documentation are dedicated to the public domain under [CC0 1.0](LICENSE). CC0 does not apply to Organic Maps, Expo, React Native, or other third-party software and services. Their separate licenses, notices, service terms, and attribution requirements continue to apply.
