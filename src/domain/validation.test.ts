import { validateItem, hasErrors } from './validation';
import { CatalogList } from './types';

const coffeeList: CatalogList = {
  id: 'list1',
  name: 'Coffees',
  createdAt: 0,
  fields: [
    { key: 'origin', label: 'Origin', type: 'shortText', required: false },
    { key: 'rating', label: 'Rating', type: 'rating', required: true, ratingScale: { max: 10 } },
    { key: 'price', label: 'Price', type: 'number', required: false },
  ],
};

describe('validateItem', () => {
  it('requires a non-empty title', () => {
    const errors = validateItem(coffeeList, '', { rating: 8 });
    expect(errors.title).toBe('Title is required');
  });

  it('requires fields marked required', () => {
    const errors = validateItem(coffeeList, 'Ethiopia', {});
    expect(errors.rating).toBe('Rating is required');
  });

  it('rejects a rating above the scale max', () => {
    const errors = validateItem(coffeeList, 'Ethiopia', { rating: 11 });
    expect(errors.rating).toBe('Rating must be between 0 and 10');
  });

  it('rejects a non-numeric number field', () => {
    const errors = validateItem(coffeeList, 'Ethiopia', { rating: 8, price: 'free' });
    expect(errors.price).toBe('Price must be a number');
  });

  it('passes with valid data and no optional fields filled', () => {
    const errors = validateItem(coffeeList, 'Ethiopia', { rating: 8 });
    expect(hasErrors(errors)).toBe(false);
  });
});
