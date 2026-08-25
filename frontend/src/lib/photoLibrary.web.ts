// Web has no photo library. The browser preview exists to look at the theme and
// the layout quickly; the gallery button is hidden there rather than offered and
// then failing. See photoLibrary.ts for why this file exists at all.
export const photoLibraryAvailable = false;

export async function requestPhotoPermission(): Promise<boolean> {
  return false;
}

export async function saveImageToPhotos(_uri: string): Promise<void> {
  throw new Error('Saving to a photo library is not supported on web.');
}
