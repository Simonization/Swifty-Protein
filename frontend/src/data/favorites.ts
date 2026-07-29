// Favourite ligands — bonus VII.5.
//
// Stored in the document directory next to settings.json, for the same reason:
// the cache directory can be purged by the system, and a favourites list that
// silently empties itself is worse than none.
//
// The list is small (a handful of ids) and only read on the list screen, so it
// is a plain JSON array rather than anything indexed.
import { File, Paths } from 'expo-file-system';

const FILE_NAME = 'favorites.json';

const favoritesFile = (): File => new File(Paths.document, FILE_NAME);

export async function readFavorites(): Promise<string[]> {
  try {
    const file = favoritesFile();
    if (!file.exists) return [];
    const raw: unknown = JSON.parse(await file.text());
    // A hand-edited or half-written file degrades to "no favourites", never a crash.
    return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export async function writeFavorites(ids: string[]): Promise<void> {
  const file = favoritesFile();
  if (!file.exists) file.create({ intermediates: true });
  file.write(JSON.stringify(ids));
}
