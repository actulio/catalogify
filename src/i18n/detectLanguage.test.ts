import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { resolveInitialLanguage } from './detectLanguage';
import { LANGUAGE_STORAGE_KEY } from './config';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock('expo-localization', () => ({ getLocales: jest.fn() }));

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;
const mockGetLocales = Localization.getLocales as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetItem.mockResolvedValue(null);
  mockSetItem.mockResolvedValue(undefined);
  mockGetLocales.mockReturnValue([{ languageCode: 'en' }]);
});

describe('resolveInitialLanguage', () => {
  it('uses a stored supported language when present', async () => {
    mockGetItem.mockResolvedValue('en');
    mockGetLocales.mockReturnValue([{ languageCode: 'pt' }]);
    await expect(resolveInitialLanguage()).resolves.toBe('en');
    expect(mockGetLocales).not.toHaveBeenCalled();
  });

  it('maps a Portuguese device locale to pt and persists it', async () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'pt' }]);
    await expect(resolveInitialLanguage()).resolves.toBe('pt');
    expect(mockSetItem).toHaveBeenCalledWith(LANGUAGE_STORAGE_KEY, 'pt');
  });

  it('falls back to en for a non-Portuguese device locale', async () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'fr' }]);
    await expect(resolveInitialLanguage()).resolves.toBe('en');
    expect(mockSetItem).toHaveBeenCalledWith(LANGUAGE_STORAGE_KEY, 'en');
  });

  it('ignores an invalid stored value and re-resolves from locale', async () => {
    mockGetItem.mockResolvedValue('zz');
    mockGetLocales.mockReturnValue([{ languageCode: 'pt-BR' }]);
    await expect(resolveInitialLanguage()).resolves.toBe('pt');
  });
});
