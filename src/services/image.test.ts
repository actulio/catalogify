// src/services/image.test.ts
import { computeResizeAction, resizeForUpload, resizeUnderSizeLimit } from './image';
import { MAX_PHOTO_BYTES } from '../constants/photo';

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn().mockResolvedValue({ uri: 'file://resized.jpg', width: 1080, height: 720 }),
  SaveFormat: { JPEG: 'jpeg' },
}));

describe('computeResizeAction', () => {
  it('constrains width for landscape images', () => {
    expect(computeResizeAction(3000, 2000)).toEqual({ resize: { width: 1800 } });
  });

  it('constrains height for portrait images', () => {
    expect(computeResizeAction(2000, 3000)).toEqual({ resize: { height: 1800 } });
  });

  it('does not upscale images already smaller than the target', () => {
    expect(computeResizeAction(600, 400)).toEqual({ resize: { width: 600 } });
  });
});

describe('resizeForUpload', () => {
  it('calls manipulateAsync with 0.9 JPEG compression', async () => {
    const ImageManipulator = require('expo-image-manipulator');
    const result = await resizeForUpload('file://original.jpg', 3000, 2000);

    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
      'file://original.jpg',
      [{ resize: { width: 1800 } }],
      { compress: 0.9, format: 'jpeg' }
    );
    expect(result).toEqual({ uri: 'file://resized.jpg', width: 1080, height: 720 });
  });
});

describe('resizeUnderSizeLimit', () => {
  const ImageManipulator = require('expo-image-manipulator');
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    ImageManipulator.manipulateAsync.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetchSizes(sizesByUri: Record<string, number>) {
    globalThis.fetch = jest.fn((uri: unknown) =>
      Promise.resolve({ arrayBuffer: async () => new ArrayBuffer(sizesByUri[uri as string]) })
    ) as unknown as typeof fetch;
  }

  it('accepts the first attempt if it is already under the size limit', async () => {
    ImageManipulator.manipulateAsync.mockResolvedValue({
      uri: 'file://attempt-1.jpg',
      width: 1080,
      height: 720,
    });
    mockFetchSizes({ 'file://attempt-1.jpg': MAX_PHOTO_BYTES - 1 });

    const result = await resizeUnderSizeLimit('file://original.jpg', 3000, 2000);

    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledTimes(1);
    expect(result.uri).toBe('file://attempt-1.jpg');
    expect(result.data.byteLength).toBe(MAX_PHOTO_BYTES - 1);
  });

  it('retries with stricter settings until the result fits under the limit', async () => {
    ImageManipulator.manipulateAsync
      .mockResolvedValueOnce({ uri: 'file://attempt-1.jpg', width: 1080, height: 720 })
      .mockResolvedValueOnce({ uri: 'file://attempt-2.jpg', width: 800, height: 533 })
      .mockResolvedValueOnce({ uri: 'file://attempt-3.jpg', width: 600, height: 400 });
    mockFetchSizes({
      'file://attempt-1.jpg': MAX_PHOTO_BYTES * 3,
      'file://attempt-2.jpg': MAX_PHOTO_BYTES * 2,
      'file://attempt-3.jpg': MAX_PHOTO_BYTES - 100,
    });

    const result = await resizeUnderSizeLimit('file://original.jpg', 3000, 2000);

    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledTimes(3);
    expect(result.uri).toBe('file://attempt-3.jpg');
    expect(result.data.byteLength).toBe(MAX_PHOTO_BYTES - 100);
  });

  it('falls back to the strictest attempt if none fit under the limit', async () => {
    ImageManipulator.manipulateAsync
      .mockResolvedValueOnce({ uri: 'file://attempt-1.jpg', width: 1080, height: 720 })
      .mockResolvedValueOnce({ uri: 'file://attempt-2.jpg', width: 800, height: 533 })
      .mockResolvedValueOnce({ uri: 'file://attempt-3.jpg', width: 600, height: 400 });
    mockFetchSizes({
      'file://attempt-1.jpg': MAX_PHOTO_BYTES * 3,
      'file://attempt-2.jpg': MAX_PHOTO_BYTES * 2,
      'file://attempt-3.jpg': MAX_PHOTO_BYTES * 1.5,
    });

    const result = await resizeUnderSizeLimit('file://original.jpg', 3000, 2000);

    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledTimes(3);
    expect(result.uri).toBe('file://attempt-3.jpg');
  });
});
