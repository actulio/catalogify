// Item photos only need to identify the item, not show fine detail, so it's
// worth trading quality for a hard cap on upload size (matches the Supabase
// bucket's file size limit — see README).
export const MAX_PHOTO_BYTES = 1024 * 1024;

export interface PhotoResizeAttempt {
  targetLongEdge: number;
  compress: number;
}

// Tried in order until the result fits under MAX_PHOTO_BYTES (see
// resizeUnderSizeLimit in services/image.ts). The first entry is also the
// default used whenever resizeForUpload is called without explicit options.
export const PHOTO_RESIZE_ATTEMPTS: PhotoResizeAttempt[] = [
  { targetLongEdge: 1800, compress: 0.9 },
  { targetLongEdge: 1280, compress: 0.7 },
  { targetLongEdge: 1000, compress: 0.5 },
];
