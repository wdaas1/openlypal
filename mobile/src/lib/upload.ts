export type UploadResult = { id: string; url: string; filename: string; contentType: string; sizeBytes: number };

export async function uploadFile(uri: string, filename: string, mimeType: string): Promise<UploadResult> {
  return uploadFileWithProgress(uri, filename, mimeType, () => {});
}

export function uploadFileWithProgress(
  uri: string,
  filename: string,
  mimeType: string,
  onProgress: (pct: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL!;
    const formData = new FormData();
    formData.append("file", { uri, type: mimeType, name: filename } as any);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BACKEND_URL}/api/upload`);
    xhr.timeout = 5 * 60 * 1000; // 5 minutes

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded / event.total);
      }
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText) as { data?: UploadResult; error?: string };
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data.data!);
        } else {
          reject(new Error(data.error ?? `Upload failed (${xhr.status})`));
        }
      } catch {
        reject(new Error("Invalid server response"));
      }
    };

    xhr.onerror = () => reject(new Error("Upload failed — check your connection"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));

    xhr.send(formData);
  });
}
