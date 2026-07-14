// src/services/image.test.ts
import { computeResizeAction, resizeForUpload } from './image';

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn().mockResolvedValue({ uri: 'file://resized.jpg', width: 1080, height: 720 }),
  SaveFormat: { JPEG: 'jpeg' },
}));

describe('computeResizeAction', () => {
  it('constrains width for landscape images', () => {
    expect(computeResizeAction(3000, 2000)).toEqual({ resize: { width: 1080 } });
  });

  it('constrains height for portrait images', () => {
    expect(computeResizeAction(2000, 3000)).toEqual({ resize: { height: 1080 } });
  });

  it('does not upscale images already smaller than the target', () => {
    expect(computeResizeAction(600, 400)).toEqual({ resize: { width: 600 } });
  });
});

describe('resizeForUpload', () => {
  it('calls manipulateAsync with 0.7 JPEG compression', async () => {
    const ImageManipulator = require('expo-image-manipulator');
    const result = await resizeForUpload('file://original.jpg', 3000, 2000);

    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
      'file://original.jpg',
      [{ resize: { width: 1080 } }],
      { compress: 0.7, format: 'jpeg' }
    );
    expect(result).toEqual({ uri: 'file://resized.jpg', width: 1080, height: 720 });
  });
});
