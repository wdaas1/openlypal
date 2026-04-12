import { ExpoConfig, ConfigContext } from 'expo/config';

// app.json is locked. This file extends it at build time by merging additional
// plugin configuration. Expo resolves app.config.ts on top of app.json, so
// config here contains everything already defined in app.json.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  plugins: [
    ...(config.plugins ?? []),

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
