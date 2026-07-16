import * as ImageManipulator from 'expo-image-manipulator';
import { MAX_PHOTO_BYTES, PHOTO_RESIZE_ATTEMPTS } from '../constants/photo';

const DEFAULT_ATTEMPT = PHOTO_RESIZE_ATTEMPTS[0];

export interface ResizeAction {
  resize: { width?: number; height?: number };
}

export function computeResizeAction(
  width: number,
  height: number,
  targetLongEdge = DEFAULT_ATTEMPT.targetLongEdge
): ResizeAction {
  if (width >= height) {
    return { resize: { width: Math.min(width, targetLongEdge) } };
  }
  return { resize: { height: Math.min(height, targetLongEdge) } };
}

export interface ResizedImage {
  uri: string;
  width: number;
  height: number;
}

export interface ResizeOptions {
  targetLongEdge?: number;
  compress?: number;
}

export async function resizeForUpload(
  uri: string,
  originalWidth: number,
  originalHeight: number,
  options: ResizeOptions = {}
): Promise<ResizedImage> {
  const { targetLongEdge = DEFAULT_ATTEMPT.targetLongEdge, compress = DEFAULT_ATTEMPT.compress } = options;
  const action = computeResizeAction(originalWidth, originalHeight, targetLongEdge);
  const result = await ImageManipulator.manipulateAsync(uri, [action], {
    compress,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return { uri: result.uri, width: result.width, height: result.height };
}

export interface ResizedData {
  uri: string;
  data: ArrayBuffer;
}

// Resizes with progressively stricter settings (see PHOTO_RESIZE_ATTEMPTS)
// until the result fits under MAX_PHOTO_BYTES. If even the strictest attempt
// is still too big (e.g. a very busy/detailed photo), returns that last,
// smallest attempt rather than failing the upload outright.
//
// Reads via arrayBuffer(), not blob() — React Native's Blob implementation
// can't be constructed from an ArrayBuffer/typed array, which is what
// fetch(...).blob() does internally, so it throws "Creating blobs from
// 'ArrayBuffer' and 'ArrayBufferView' are not supported". Supabase Storage's
// upload() accepts a plain ArrayBuffer directly, so there's no need for a
// Blob at all (see https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native).
export async function resizeUnderSizeLimit(
  uri: string,
  originalWidth: number,
  originalHeight: number
): Promise<ResizedData> {
  let lastResult: ResizedData | undefined;

  for (const attempt of PHOTO_RESIZE_ATTEMPTS) {
    const resized = await resizeForUpload(uri, originalWidth, originalHeight, attempt);
    const data = await (await fetch(resized.uri)).arrayBuffer();
    lastResult = { uri: resized.uri, data };
    if (data.byteLength <= MAX_PHOTO_BYTES) return lastResult;
  }

  return lastResult!;
}
