// src/domain/types.ts

export type FieldType =
  | 'shortText'
  | 'longText'
  | 'number'
  | 'rating'
  | 'photo'
  | 'boolean'
  | 'date';

export interface RatingScale {
  max: number;
  style?: 'stars';
}

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  ratingScale?: RatingScale;
}

export interface CatalogList {
  id: string;
  name: string;
  fields: FieldDef[];
  coverUrl?: string;
  createdAt: number;
}

export type FieldValue = string | number | boolean | null;

export interface CatalogItem {
  id: string;
  listId: string;
  title: string;
  values: Record<string, FieldValue>;
  photoUrl?: string;
  createdAt: number;
  updatedAt: number;
}
