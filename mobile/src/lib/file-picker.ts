import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

export type PickedFile = { uri: string; filename: string; mimeType: string };

// iOS export preset — compresses to 720p H.264 before returning the file
const VIDEO_EXPORT_PRESET = Platform.OS === "ios"
  ? ImagePicker.VideoExportPreset.H264_1280x720
  : undefined;

export async function pickImage(): Promise<PickedFile | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: "images",
    quality: 0.8,
    allowsEditing: false,
  });
  if (result.canceled) return null;
  const a = result.assets[0];
  return {
    uri: a.uri,
    filename: a.fileName ?? `image-${Date.now()}.jpg`,
    mimeType: a.mimeType ?? "image/jpeg",
  };
}

export async function pickVideo(): Promise<PickedFile | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: "videos",
    videoMaxDuration: 120,
    ...(VIDEO_EXPORT_PRESET !== undefined && { videoExportPreset: VIDEO_EXPORT_PRESET }),
  });
  if (result.canceled) return null;
  const a = result.assets[0];
  return {
    uri: a.uri,
    filename: a.fileName ?? `video-${Date.now()}.mp4`,
    mimeType: a.mimeType ?? "video/mp4",
  };
}

export async function takePhoto(): Promise<PickedFile | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: "images",
    quality: 0.85,
    allowsEditing: false,
  });
  if (result.canceled) return null;
  const a = result.assets[0];
  return {
    uri: a.uri,
    filename: a.fileName ?? `photo-${Date.now()}.jpg`,
    mimeType: a.mimeType ?? "image/jpeg",
  };
}

export async function recordVideo(): Promise<PickedFile | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: "videos",
    videoMaxDuration: 120,
    ...(VIDEO_EXPORT_PRESET !== undefined && { videoExportPreset: VIDEO_EXPORT_PRESET }),
  });
  if (result.canceled) return null;
  const a = result.assets[0];
  return {
    uri: a.uri,
    filename: a.fileName ?? `video-${Date.now()}.mp4`,
    mimeType: a.mimeType ?? "video/mp4",
  };
}
