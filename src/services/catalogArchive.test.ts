import { unzipSync, strFromU8 } from 'fflate';
import { buildArchive, ARCHIVE_FORMAT_VERSION } from './catalogArchive';
import { CatalogList, CatalogItem } from '../domain/types';

const list: CatalogList = {
  id: 'L1',
  name: 'Wines',
  fields: [{ key: 'rating', label: 'Rating', type: 'rating', required: false, ratingScale: { max: 5 } }],
  coverUrl: 'https://x/cover.jpg',
  createdAt: 111,
};
const items: CatalogItem[] = [
  { id: 'I1', listId: 'L1', title: 'Barolo', values: { rating: 4 }, photoUrl: 'https://x/1.jpg', createdAt: 1, updatedAt: 2 },
  { id: 'I2', listId: 'L1', title: 'Chianti', values: { rating: 3 }, createdAt: 3, updatedAt: 4 },
];

describe('buildArchive', () => {
  it('emits data.json with version, catalog (no id) and items (no id), plus referenced images', () => {
    const photos = new Map<string, Uint8Array>([
      ['images/cover.jpg', new Uint8Array([1, 2, 3])],
      ['images/0.jpg', new Uint8Array([4, 5])],
    ]);
    const zip = buildArchive(list, items, photos);
    const files = unzipSync(zip);

    expect(Object.keys(files).sort()).toEqual(
      ['data.json', 'images/0.jpg', 'images/cover.jpg'].sort()
    );
    const data = JSON.parse(strFromU8(files['data.json']));
    expect(data.formatVersion).toBe(ARCHIVE_FORMAT_VERSION);
    expect(data.catalog).toEqual({ name: 'Wines', fields: list.fields, coverImage: 'images/cover.jpg' });
    expect(data.items).toEqual([
      { title: 'Barolo', values: { rating: 4 }, image: 'images/0.jpg', createdAt: 1, updatedAt: 2 },
      { title: 'Chianti', values: { rating: 3 }, image: null, createdAt: 3, updatedAt: 4 },
    ]);
    expect(Array.from(files['images/0.jpg'])).toEqual([4, 5]);
  });

  it('sets coverImage null when no cover bytes are provided', () => {
    const zip = buildArchive({ ...list, coverUrl: undefined }, [], new Map());
    const data = JSON.parse(strFromU8(unzipSync(zip)['data.json']));
    expect(data.catalog.coverImage).toBeNull();
  });
});
