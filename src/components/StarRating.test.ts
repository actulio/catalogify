import { getStarStates } from './StarRating';

describe('getStarStates', () => {
  it('maps a full-scale rating to all full stars', () => {
    expect(getStarStates(5, 5)).toEqual(['full', 'full', 'full', 'full', 'full']);
    expect(getStarStates(10, 10)).toEqual(['full', 'full', 'full', 'full', 'full']);
  });

  it('maps a 0-10 value onto five stars with half precision', () => {
    // 7/10 -> 3.5 stars
    expect(getStarStates(7, 10)).toEqual(['full', 'full', 'full', 'half', 'empty']);
  });

  it('rounds to the nearest half star', () => {
    // 3/10 -> 1.5 stars
    expect(getStarStates(3, 10)).toEqual(['full', 'half', 'empty', 'empty', 'empty']);
    // 9/10 -> 4.5 stars
    expect(getStarStates(9, 10)).toEqual(['full', 'full', 'full', 'full', 'half']);
  });

  it('clamps a rating above max down to all full stars', () => {
    expect(getStarStates(8, 5)).toEqual(['full', 'full', 'full', 'full', 'full']);
  });

  it('clamps a negative rating up to all empty stars', () => {
    expect(getStarStates(-2, 5)).toEqual(['empty', 'empty', 'empty', 'empty', 'empty']);
  });

  it('returns all-empty stars when max is zero', () => {
    expect(getStarStates(3, 0)).toEqual(['empty', 'empty', 'empty', 'empty', 'empty']);
  });
});
