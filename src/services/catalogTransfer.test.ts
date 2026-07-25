import { unzipSync, strFromU8 } from 'fflate';
import { exportCatalog, importCatalog, TransferIo } from './catalogTransfer';
import { CatalogList, CatalogItem } from '../domain/types';

const list: CatalogList = { id: 'L1', name: 'Wines', fields: [], coverUrl: 'https://x/cover.jpg', createdAt: 1 };
const items: CatalogItem[] = [
  { id: 'I1', listId: 'L1', title: 'Barolo', values: {}, photoUrl: 'https://x/1.jpg', createdAt: 1, updatedAt: 2 },
  { id: 'I2', listId: 'L1', title: 'Chianti', values: {}, createdAt: 3, updatedAt: 4 },
];

function fakeIo(overrides: Partial<TransferIo> = {}): TransferIo & { written: Map<string, Uint8Array> } {
  const written = new Map<string, Uint8Array>();
  return {
    written,
    downloadToBytes: async (url) => new Uint8Array([url.length]),
    writeTempFile: async (name, bytes) => {
      written.set(name, bytes);
      return `file:///tmp/${name}`;
    },
    share: async () => {},
    cleanup: () => {},
    ...overrides,
  };
}

describe('exportCatalog', () => {
  it('downloads cover + item photos, builds a zip, and shares it', async () => {
    const io = fakeIo();
    const repo = { getItems: jest.fn().mockResolvedValue(items) } as any;
    const shareSpy = jest.spyOn(io, 'share');
    const phases: string[] = [];

    await exportCatalog(repo, list, io, { onProgress: (p) => phases.push(p.phase) });

    expect(repo.getItems).toHaveBeenCalledWith('L1');
    // temp zip written + shared
    expect([...io.written.keys()][0]).toMatch(/\.zip$/);
    expect(shareSpy).toHaveBeenCalled();
    // zip has cover + one item image (I2 has no photo)
    const zip = [...io.written.values()][0];
    const files = unzipSync(zip);
    expect(Object.keys(files).sort()).toEqual(['data.json', 'images/0.jpg', 'images/cover.jpg'].sort());
    const data = JSON.parse(strFromU8(files['data.json']));
    expect(data.items[1].image).toBeNull();
    expect(phases).toContain('download');
    expect(phases).toContain('share');
  });

  it('continues (image null) when a photo download fails', async () => {
    const io = fakeIo({
      downloadToBytes: async (url) => {
        if (url === 'https://x/1.jpg') throw new Error('404');
        return new Uint8Array([1]);
      },
    });
    const repo = { getItems: jest.fn().mockResolvedValue(items) } as any;
    await exportCatalog(repo, list, io, {});
    const files = unzipSync([...io.written.values()][0]);
    expect(files['images/0.jpg']).toBeUndefined(); // failed item photo omitted
    expect(files['images/cover.jpg']).toBeDefined(); // cover succeeded
  });
});
