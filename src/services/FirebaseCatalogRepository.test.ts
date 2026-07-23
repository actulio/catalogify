import { signInAnonymously } from 'firebase/auth';
import { auth, connectToEmulators } from './firebase';
import { supabase, PHOTOS_BUCKET } from './supabase';
import { FirebaseCatalogRepository } from './FirebaseCatalogRepository';

beforeAll(() => {
  connectToEmulators();
});

let repo: FirebaseCatalogRepository;
let uid: string;

beforeEach(async () => {
  const { user } = await signInAnonymously(auth);
  uid = user.uid;
  repo = new FirebaseCatalogRepository(user.uid);
});

// Restore after the test body has run its assertions — restoring inside the test
// (e.g. a finally) would wipe the spy's recorded calls before we can assert on them.
afterEach(() => {
  jest.restoreAllMocks();
});

/** Spy that captures every `supabase.storage.from(...).remove(paths)` call. */
function spyOnStorageRemove() {
  const remove = jest.fn().mockResolvedValue({ data: [], error: null });
  const fromSpy = jest.spyOn(supabase.storage, 'from').mockReturnValue({ remove } as never);
  return { remove, fromSpy };
}

describe('FirebaseCatalogRepository', () => {
  it('creates and lists catalogs', async () => {
    const list = await repo.createList('Coffees', [
      { key: 'rating', label: 'Rating', type: 'rating', required: true, ratingScale: { max: 10 } },
    ]);

    const lists = await repo.getLists();
    expect(lists.map((l) => l.id)).toContain(list.id);
    expect(lists.find((l) => l.id === list.id)?.name).toBe('Coffees');
  });

  it('updates a list schema', async () => {
    const list = await repo.createList('Wines', []);
    await repo.updateListFields(list.id, [
      { key: 'region', label: 'Region', type: 'shortText', required: false },
    ]);

    const lists = await repo.getLists();
    expect(lists.find((l) => l.id === list.id)?.fields).toHaveLength(1);
  });

  it('adds, reads, and sorts items by rating', async () => {
    const list = await repo.createList('Coffees', [
      { key: 'rating', label: 'Rating', type: 'rating', required: true, ratingScale: { max: 10 } },
    ]);

    await repo.addItem(list.id, 'Low Rated', { rating: 3 });
    await repo.addItem(list.id, 'High Rated', { rating: 9 });

    const items = await repo.getItems(list.id, { sortByRatingKey: 'rating', sortDirection: 'desc' });
    expect(items.map((i) => i.title)).toEqual(['High Rated', 'Low Rated']);
  });

  it('filters items by search text on title', async () => {
    const list = await repo.createList('Coffees', []);
    await repo.addItem(list.id, 'Ethiopia Yirgacheffe', {});
    await repo.addItem(list.id, 'Colombia Supremo', {});

    const items = await repo.getItems(list.id, { searchText: 'ethiopia' });
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Ethiopia Yirgacheffe');
  });

  it('updates and deletes an item', async () => {
    const list = await repo.createList('Coffees', []);
    const item = await repo.addItem(list.id, 'Original Title', {});

    await repo.updateItem(list.id, item.id, 'Updated Title', {});
    let items = await repo.getItems(list.id);
    expect(items[0].title).toBe('Updated Title');

    await repo.deleteItem(list.id, item.id);
    items = await repo.getItems(list.id);
    expect(items).toHaveLength(0);
  });

  it('deletes a list', async () => {
    const list = await repo.createList('Temp', []);
    await repo.deleteList(list.id);

    const lists = await repo.getLists();
    expect(lists.map((l) => l.id)).not.toContain(list.id);
  });

  it('removes the item photo from storage when an item is deleted', async () => {
    const list = await repo.createList('Coffees', []);
    const item = await repo.addItem(list.id, 'With Photo', {});

    const { remove, fromSpy } = spyOnStorageRemove();
    await repo.deleteItem(list.id, item.id);

    expect(fromSpy).toHaveBeenCalledWith(PHOTOS_BUCKET);
    expect(remove).toHaveBeenCalledWith([`${uid}/lists/${list.id}/items/${item.id}/photo.jpg`]);
  });

  it('removes every item photo from storage when a list is deleted', async () => {
    const list = await repo.createList('Coffees', []);
    const a = await repo.addItem(list.id, 'A', {});
    const b = await repo.addItem(list.id, 'B', {});

    const { remove } = spyOnStorageRemove();
    await repo.deleteList(list.id);

    expect(remove).toHaveBeenCalledTimes(1);
    const paths = remove.mock.calls[0][0] as string[];
    expect(paths).toEqual(
      expect.arrayContaining([
        `${uid}/lists/${list.id}/items/${a.id}/photo.jpg`,
        `${uid}/lists/${list.id}/items/${b.id}/photo.jpg`,
      ])
    );
    expect(paths).toHaveLength(2);
  });
});
