import { CatalogList, CatalogItem, FieldDef, FieldValue } from './types';

export interface ItemQuery {
  searchText?: string;
  sortByRatingKey?: string;
  sortDirection?: 'asc' | 'desc';
  minRating?: number;
}

export interface CatalogRepository {
  getLists(): Promise<CatalogList[]>;
  createList(name: string, fields: FieldDef[]): Promise<CatalogList>;
  updateListFields(listId: string, fields: FieldDef[]): Promise<void>;
  deleteList(listId: string): Promise<void>;

  getItems(listId: string, query?: ItemQuery): Promise<CatalogItem[]>;
  addItem(
    listId: string,
    title: string,
    values: Record<string, FieldValue>,
    photoUri?: string
  ): Promise<CatalogItem>;
  updateItem(
    listId: string,
    itemId: string,
    title: string,
    values: Record<string, FieldValue>,
    photoUri?: string
  ): Promise<void>;
  deleteItem(listId: string, itemId: string): Promise<void>;
}
