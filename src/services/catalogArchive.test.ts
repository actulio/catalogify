import { unzipSync, strFromU8, zipSync, strToU8 } from 'fflate';
import { buildArchive, ARCHIVE_FORMAT_VERSION, parseArchive, ArchiveErrorCode } from './catalogArchive';
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

function makeZip(data: unknown, extra: Record<string, Uint8Array> = {}): Uint8Array {
  return zipSync({ 'data.json': strToU8(JSON.stringify(data)), ...extra });
}

describe('parseArchive', () => {
  const valid = {
    formatVersion: 1,
    app: 'catalogify',
    exportedAt: 5,
    catalog: { name: 'Wines', fields: [], coverImage: 'images/cover.jpg' },
    items: [{ title: 'Barolo', values: { rating: 4 }, image: 'images/0.jpg', createdAt: 1, updatedAt: 2 }],
  };

  it('parses a valid archive and returns catalog, items and photo bytes', () => {
    const zip = makeZip(valid, {
      'images/cover.jpg': new Uint8Array([9]),
      'images/0.jpg': new Uint8Array([8]),
    });
    const res = parseArchive(zip);
    if (!res.ok) throw new Error('expected ok');
    expect(res.data.catalog.name).toBe('Wines');
    expect(res.data.items[0].title).toBe('Barolo');
    expect(Array.from(res.photos.get('images/cover.jpg')!)).toEqual([9]);
    expect(Array.from(res.photos.get('images/0.jpg')!)).toEqual([8]);
  });

  it('rejects a zip with no data.json', () => {
    const zip = zipSync({ 'other.txt': strToU8('hi') });
    const res = parseArchive(zip);
    expect(res).toMatchObject({ ok: false, code: ArchiveErrorCode.Invalid });
  });

  it('rejects malformed json', () => {
    const zip = zipSync({ 'data.json': strToU8('{ not json') });
    expect(parseArchive(zip)).toMatchObject({ ok: false, code: ArchiveErrorCode.Invalid });
  });

  it('rejects a newer formatVersion', () => {
    const res = parseArchive(makeZip({ ...valid, formatVersion: 2 }));
    expect(res).toMatchObject({ ok: false, code: ArchiveErrorCode.UnsupportedVersion });
  });

  it('rejects when required shape is missing (no catalog.name)', () => {
    const res = parseArchive(makeZip({ ...valid, catalog: { fields: [], coverImage: null } }));
    expect(res).toMatchObject({ ok: false, code: ArchiveErrorCode.Invalid });
  });

  it('rejects bytes that are not a valid zip', () => {
    expect(parseArchive(new Uint8Array([1, 2, 3, 4]))).toMatchObject({
      ok: false,
      code: ArchiveErrorCode.Invalid,
    });
  });

  it('rejects an archive with malformed field defs', () => {
    const res = parseArchive(makeZip({ ...valid, catalog: { name: 'W', fields: [123], coverImage: null } }));
    expect(res).toMatchObject({ ok: false, code: ArchiveErrorCode.Invalid });
  });

  it('rejects an item whose values is an array', () => {
    const res = parseArchive(
      makeZip({ ...valid, items: [{ title: 'X', values: [1, 2], image: null, createdAt: 1, updatedAt: 2 }] })
    );
    expect(res).toMatchObject({ ok: false, code: ArchiveErrorCode.Invalid });
  });

  it('rejects an archive with the wrong app marker', () => {
    const res = parseArchive(makeZip({ ...valid, app: 'other' }));
    expect(res).toMatchObject({ ok: false, code: ArchiveErrorCode.Invalid });
  });
});
