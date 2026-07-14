// Manual mock for the plain-Node "emulator" jest project. FirebaseCatalogRepository
// imports expo-image-manipulator statically (for uploadPhoto's resize step), but
// none of the emulator integration tests exercise the photo-upload path, and the
// real module requires Expo's native module registry, which is unavailable outside
// the jest-expo/React Native test environment. Stub it out so the import resolves.
module.exports = {
  manipulateAsync: async (uri) => ({ uri, width: 0, height: 0 }),
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
};
