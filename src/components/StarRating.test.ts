import { getStarStates } from './StarRating';

describe('getStarStates', () => {
  it('marks the first `rating` stars as filled and the rest empty', () => {
    expect(getStarStates(3, 5)).toEqual(['filled', 'filled', 'filled', 'empty', 'empty']);
  });

  it('clamps a rating above max down to max', () => {
    expect(getStarStates(8, 5)).toEqual(['filled', 'filled', 'filled', 'filled', 'filled']);
  });

  it('clamps a negative rating up to zero', () => {
    expect(getStarStates(-2, 5)).toEqual(['empty', 'empty', 'empty', 'empty', 'empty']);
  });

  it('returns an empty array when max is zero', () => {
    expect(getStarStates(3, 0)).toEqual([]);
  });
});
