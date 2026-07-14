import { CatalogList, FieldValue } from './types';

export interface ValidationErrors {
  [fieldKey: string]: string;
}

export function validateItem(
  list: CatalogList,
  title: string,
  values: Record<string, FieldValue>
): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!title || title.trim().length === 0) {
    errors.title = 'Title is required';
  }

  for (const field of list.fields) {
    const value = values[field.key];
    const isEmpty = value === null || value === undefined || value === '';

    if (field.required && isEmpty) {
      errors[field.key] = `${field.label} is required`;
      continue;
    }

    if (isEmpty) continue;

    if (field.type === 'rating') {
      const max = field.ratingScale?.max ?? 10;
      const num = Number(value);
      if (Number.isNaN(num) || num < 0 || num > max) {
        errors[field.key] = `${field.label} must be between 0 and ${max}`;
      }
    }

    if (field.type === 'number' && Number.isNaN(Number(value))) {
      errors[field.key] = `${field.label} must be a number`;
    }
  }

  return errors;
}

export function hasErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}
