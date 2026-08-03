// The jest-expo preset backs expo-file-system with an in-memory mock
// (Paths.document.uri === 'file:///mock/document/'), scoped to this test
// file's module registry -- so state is shared across this file and nothing
// here touches a real disk. The beforeEach below clears it, so no case depends
// on running after (or before) any other.
import { File, Paths } from 'expo-file-system';

import { readFavorites, writeFavorites } from '../src/data/favorites';

describe('favorites', () => {
  beforeEach(() => {
    try {
      const file = new File(Paths.document, 'favorites.json');
      if (file.exists) file.delete();
    } catch {
      // Nothing written yet; that is the state we wanted anyway.
    }
  });

  it('is empty before anything has been saved', async () => {
    expect(await readFavorites()).toEqual([]);
  });

  it('round-trips a written list', async () => {
    await writeFavorites(['ATP', 'ZN']);
    expect(await readFavorites()).toEqual(['ATP', 'ZN']);
  });

  it('degrades to empty on corrupt (non-JSON) content, rather than throwing', async () => {
    new File(Paths.document, 'favorites.json').write('not json at all {{{');
    expect(await readFavorites()).toEqual([]);
  });

  it('degrades to empty when the file holds JSON that is not an array', async () => {
    new File(Paths.document, 'favorites.json').write(JSON.stringify({ oops: true }));
    expect(await readFavorites()).toEqual([]);
  });

  it('filters out non-string entries rather than failing the whole list', async () => {
    new File(Paths.document, 'favorites.json').write(JSON.stringify(['ATP', 123, null, 'ZN']));
    expect(await readFavorites()).toEqual(['ATP', 'ZN']);
  });
});
