import { ExpoConfig, ConfigContext } from 'expo/config';

// app.json is locked. This file extends it at build time by merging additional
// plugin configuration. Expo resolves app.config.ts on top of app.json, so
// config here contains everything already defined in app.json.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  plugins: [
    ...(config.plugins ?? []),

    // Wires up camera and microphone entitlements on iOS/Android.
    // Required for CameraView, video recording, and live moments to work in
    // production builds.
    [
      'expo-camera',
      {
        cameraPermission: 'Openly uses the camera to capture photos and videos inside the app before you publish them.',
        microphonePermission: 'Openly uses the microphone to record audio with your videos and live moments.',
        recordAudioAndroid: true,
      },
    ],

    // Wires up camera and media-library entitlements on iOS/Android.
    // Required for launchCameraAsync and launchImageLibraryAsync to work in
    // production builds.
    'expo-image-picker',

    // Configures APNs in production mode and sets the Android notification
    // icon/colour. Required for remote push notifications to work in App Store
    // and Play Store builds.
    [
      'expo-notifications',
      {
        icon: './icon.png',
        color: '#00CF35',
        mode: 'production',
      },
    ],
  ],
});
