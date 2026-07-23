import { supabase } from './supabase';
import { pingSupabase } from './keepAlive';

jest.mock('./supabase', () => {
  const limit = jest.fn();
  return {
    supabase: { from: jest.fn(() => ({ select: jest.fn(() => ({ limit })) })) },
    PHOTOS_BUCKET: 'photos',
    __limit: limit,
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { __limit } = require('./supabase') as { __limit: jest.Mock };

beforeEach(() => jest.clearAllMocks());

describe('pingSupabase', () => {
  it('queries the keepalive table and returns true on success', async () => {
    __limit.mockResolvedValue({ data: [{ id: 1 }], error: null });

    await expect(pingSupabase()).resolves.toBe(true);
    expect(supabase.from).toHaveBeenCalledWith('keepalive');
  });

  it('returns false when Supabase returns an error', async () => {
    __limit.mockResolvedValue({ data: null, error: { message: 'paused' } });
    await expect(pingSupabase()).resolves.toBe(false);
  });

  it('returns false (never throws) when the query rejects', async () => {
    __limit.mockRejectedValue(new Error('network down'));
    await expect(pingSupabase()).resolves.toBe(false);
  });
});
