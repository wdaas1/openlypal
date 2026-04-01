import * as ImagePicker from "expo-image-picker";

export type PickedFile = { uri: string; filename: string; mimeType: string };

export async function pickImage(): Promise<PickedFile | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
    allowsEditing: true,
  });
  if (result.canceled) return null;
  const a = result.assets[0];
  return {
    uri: a.uri,
    filename: a.fileName ?? `image-${Date.now()}.jpg`,
    mimeType: a.mimeType ?? "image/jpeg",
  };
}
