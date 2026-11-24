module.exports = {
  expo: {
    name: "RoadCam Maps",
    slug: "roadcam-maps",
    version: "0.1.0",
    scheme: "roadcam",
    orientation: "landscape",
    userInterfaceStyle: "dark",
    platforms: ["ios", "android"],
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.roadcam.maps",
      deploymentTarget: "16.0",
      infoPlist: {
        NSCameraUsageDescription: "RoadCam uses the camera to record your drive.",
        NSMicrophoneUsageDescription: "RoadCam records audio with your drive video.",
        NSLocationWhenInUseUsageDescription: "RoadCam shares your current position with Organic Maps when you open it.",
        NSPhotoLibraryAddUsageDescription: "RoadCam saves your recorded drive videos to your photo library."
      }
    },
    android: {
      package: "com.roadcam.maps",
      minSdkVersion: 28,
      permissions: [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION"
      ]
    },
    plugins: [
      [
        "expo-camera",
        {
          cameraPermission: "Allow RoadCam to record video of your drive.",
          microphonePermission: "Allow RoadCam to record audio with your video.",
          recordAudioAndroid: true
        }
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission: "Allow RoadCam to share your position with Organic Maps when you open it."
        }
      ],
      [
        "expo-media-library",
        {
          photosPermission: "Allow RoadCam to access saved drive recordings.",
          savePhotosPermission: "Allow RoadCam to save drive recordings to your library.",
          granularPermissions: ["video"]
        }
      ]
    ]
  }
};
