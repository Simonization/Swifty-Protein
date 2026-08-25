// Saving a snapshot to the device gallery.
//
// Split by platform (see photoLibrary.web.ts) because `expo-media-library` has
// no web implementation: importing it in a web bundle throws "Cannot find
// native module 'ExpoMediaLibraryNext'" the moment the module initialises. Since
// LigandViewScreen is imported by the navigator at startup, that took down the
// whole page — `npm run web` rendered white with the failure only in the
// console. Metro picks the .web.ts variant for web, so the native module now
// never reaches that bundle.
import * as MediaLibrary from 'expo-media-library';

export const photoLibraryAvailable = true;

export async function requestPhotoPermission(): Promise<boolean> {
  const permission = await MediaLibrary.requestPermissionsAsync();
  return permission.granted;
}

export async function saveImageToPhotos(uri: string): Promise<void> {
  await MediaLibrary.saveToLibraryAsync(uri);
}
