import * as ImagePicker from "expo-image-picker";
import { ActionSheetIOS, Alert, Platform } from "react-native";

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

export async function pickMultipleImages(): Promise<PickedFile[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return [];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: "images",
    quality: 0.8,
    allowsEditing: false,
    allowsMultipleSelection: true,
    selectionLimit: 10,
  });
  if (result.canceled) return [];
  return result.assets.map((a) => ({
    uri: a.uri,
    filename: a.fileName ?? `image-${Date.now()}.jpg`,
    mimeType: a.mimeType ?? "image/jpeg",
  }));
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

export type MediaPickerOptions = {
  mediaType: "image" | "video" | "both";
  onResult: (result: PickedFile | null) => void;
};

export async function showMediaPicker({ mediaType, onResult }: MediaPickerOptions): Promise<void> {
  const pickFromLibrary = async (): Promise<PickedFile | null> => {
    if (mediaType === "image") return pickImage();
    if (mediaType === "video") return pickVideo();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return null;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.85,
      videoMaxDuration: 120,
    });
    if (result.canceled || !result.assets?.[0]) return null;
    const asset = result.assets[0];
    return {
      uri: asset.uri,
      filename: asset.fileName ?? `media-${Date.now()}`,
      mimeType: asset.mimeType ?? "image/jpeg",
    };
  };

  const captureWithCamera = async (): Promise<PickedFile | null> => {
    if (mediaType === "video") return recordVideo();
    return takePhoto();
  };

  const pickerFn = await new Promise<(() => Promise<PickedFile | null>) | null>((resolve) => {
    const options = ["Camera", "Photo Library", "Cancel"];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 2 },
        (index) => {
          if (index === 0) resolve(captureWithCamera);
          else if (index === 1) resolve(pickFromLibrary);
          else resolve(null);
        }
      );
    } else {
      Alert.alert("Select Media", undefined, [
        { text: "Camera", onPress: () => resolve(captureWithCamera) },
        { text: "Photo Library", onPress: () => resolve(pickFromLibrary) },
        { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
      ]);
    }
  });

  if (!pickerFn) {
    onResult(null);
    return;
  }
  const result = await pickerFn();
  onResult(result);
}
