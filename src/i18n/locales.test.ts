import pt from './locales/pt.json';
import en from './locales/en.json';

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return v !== null && typeof v === 'object' && !Array.isArray(v)
      ? flattenKeys(v as Record<string, unknown>, key)
      : [key];
  });
}

describe('locale key parity', () => {
  it('pt and en have identical key sets', () => {
    const ptKeys = flattenKeys(pt).sort();
    const enKeys = flattenKeys(en).sort();
    const onlyPt = ptKeys.filter((k) => !enKeys.includes(k));
    const onlyEn = enKeys.filter((k) => !ptKeys.includes(k));
    expect({ onlyPt, onlyEn }).toEqual({ onlyPt: [], onlyEn: [] });
  });
});
