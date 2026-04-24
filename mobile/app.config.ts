import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  plugins: [
    ...(config.plugins ?? []),
    'expo-av',
    [
      'expo-camera',
      {
        cameraPermission: 'Allow Openly to use your camera for live streaming',
        microphonePermission: 'Allow Openly to use your microphone for live audio',
        recordAudioAndroid: true,
      },
    ],
    [
      'expo-audio',
      {
        microphonePermission: 'Openly uses the microphone to record audio for live streams and calls.',
      },
    ],
    'expo-image-picker',
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
