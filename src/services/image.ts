import * as ImageManipulator from 'expo-image-manipulator';

const TARGET_LONG_EDGE = 1080;

export interface ResizeAction {
  resize: { width?: number; height?: number };
}

export function computeResizeAction(
  width: number,
  height: number,
  targetLongEdge = TARGET_LONG_EDGE
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

export async function resizeForUpload(
  uri: string,
  originalWidth: number,
  originalHeight: number
): Promise<ResizedImage> {
  const action = computeResizeAction(originalWidth, originalHeight);
  const result = await ImageManipulator.manipulateAsync(uri, [action], {
    compress: 0.7,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return { uri: result.uri, width: result.width, height: result.height };
}
