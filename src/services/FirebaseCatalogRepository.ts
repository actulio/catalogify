import {
  collection,
  doc,
  getCountFromServer,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { supabase, PHOTOS_BUCKET } from './supabase';
import { CatalogRepository, ItemQuery } from '../domain/CatalogRepository';
import { CatalogList, CatalogItem, FieldDef, FieldValue } from '../domain/types';
import { resizeUnderSizeLimit } from './image';
import * as ImageManipulator from 'expo-image-manipulator';

function listsCol(uid: string) {
  return collection(db, 'users', uid, 'lists');
}

function itemsCol(uid: string, listId: string) {
  return collection(db, 'users', uid, 'lists', listId, 'items');
}

function toMillis(value: unknown): number {
  return value instanceof Timestamp ? value.toMillis() : Date.now();
}

// Signed URLs are re-generated on every upload (see uploadPhoto), so a long
// expiry just means existing photoUrl values keep working between edits
// rather than needing an active refresh mechanism.
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60 * 24 * 365;

export class FirebaseCatalogRepository implements CatalogRepository {
  constructor(private uid: string) {}

  async getLists(): Promise<CatalogList[]> {
    const snap = await getDocs(listsCol(this.uid));
    return snap.docs.map((d) => ({
      id: d.id,
      name: d.data().name,
      fields: d.data().fields ?? [],
      createdAt: toMillis(d.data().createdAt),
    }));
  }

  async createList(name: string, fields: FieldDef[]): Promise<CatalogList> {
    const ref = doc(listsCol(this.uid));
    await setDoc(ref, { name, fields, createdAt: serverTimestamp() });
    return { id: ref.id, name, fields, createdAt: Date.now() };
  }

  async updateListFields(listId: string, fields: FieldDef[]): Promise<void> {
    await updateDoc(doc(listsCol(this.uid), listId), { fields });
  }

  async deleteList(listId: string): Promise<void> {
    const items = await getDocs(itemsCol(this.uid, listId));
    const photoPaths = items.docs.map((d) => this.photoPath(listId, d.id));
    await Promise.all(items.docs.map((d) => deleteDoc(d.ref)));
    await deleteDoc(doc(listsCol(this.uid), listId));
    await this.removePhotos(photoPaths);
  }

  async getItemCounts(listIds: string[]): Promise<Record<string, number>> {
    const entries = await Promise.all(
      listIds.map(async (listId) => {
        const snap = await getCountFromServer(itemsCol(this.uid, listId));
        return [listId, snap.data().count] as const;
      })
    );
    return Object.fromEntries(entries);
  }

  async getItems(listId: string, query: ItemQuery = {}): Promise<CatalogItem[]> {
    const snap = await getDocs(itemsCol(this.uid, listId));
    let items: CatalogItem[] = snap.docs.map((d) => ({
      id: d.id,
      listId,
      title: d.data().title,
      values: d.data().values ?? {},
      photoUrl: d.data().photoUrl,
      createdAt: toMillis(d.data().createdAt),
      updatedAt: toMillis(d.data().updatedAt),
    }));

    if (query.searchText) {
      const needle = query.searchText.toLowerCase();
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(needle) ||
          Object.values(item.values).some(
            (v) => typeof v === 'string' && v.toLowerCase().includes(needle)
          )
      );
    }

    if (query.minRating !== undefined && query.sortByRatingKey) {
      const key = query.sortByRatingKey;
      items = items.filter((item) => Number(item.values[key] ?? 0) >= query.minRating!);
    }

    if (query.sortByRatingKey) {
      const key = query.sortByRatingKey;
      const ascending = query.sortDirection === 'asc';
      items = [...items].sort((a, b) => {
        const aVal = Number(a.values[key] ?? 0);
        const bVal = Number(b.values[key] ?? 0);
        return ascending ? aVal - bVal : bVal - aVal;
      });
    }

    return items;
  }

  async addItem(
    listId: string,
    title: string,
    values: Record<string, FieldValue>,
    photoUri?: string
  ): Promise<CatalogItem> {
    const ref = doc(itemsCol(this.uid, listId));
    const photoUrl = photoUri ? await this.uploadPhoto(listId, ref.id, photoUri) : undefined;
    await setDoc(ref, {
      title,
      values,
      photoUrl: photoUrl ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return {
      id: ref.id,
      listId,
      title,
      values,
      photoUrl,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  async updateItem(
    listId: string,
    itemId: string,
    title: string,
    values: Record<string, FieldValue>,
    photoUri?: string
  ): Promise<void> {
    const photoUrl = photoUri ? await this.uploadPhoto(listId, itemId, photoUri) : undefined;
    const update: Record<string, unknown> = { title, values, updatedAt: serverTimestamp() };
    if (photoUrl) update.photoUrl = photoUrl;
    await updateDoc(doc(itemsCol(this.uid, listId), itemId), update);
  }

  async deleteItem(listId: string, itemId: string): Promise<void> {
    await deleteDoc(doc(itemsCol(this.uid, listId), itemId));
    await this.removePhotos([this.photoPath(listId, itemId)]);
  }

  private photoPath(listId: string, itemId: string): string {
    return `${this.uid}/lists/${listId}/items/${itemId}/photo.jpg`;
  }

  // Best-effort storage cleanup: the Firestore delete is the source of truth, so a
  // storage failure is logged but never surfaced as a failed delete. Supabase's
  // remove() silently ignores paths that don't exist, so photo-less items are safe.
  private async removePhotos(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    const { error } = await supabase.storage.from(PHOTOS_BUCKET).remove(paths);
    if (error) console.warn('Failed to remove item photo(s) from storage', error);
  }

  private async uploadPhoto(listId: string, itemId: string, photoUri: string): Promise<string> {
    const info = await ImageManipulator.manipulateAsync(photoUri, []);
    const { data: photoData } = await resizeUnderSizeLimit(photoUri, info.width, info.height);
    const path = this.photoPath(listId, itemId);

    const { error: uploadError } = await supabase.storage
      .from(PHOTOS_BUCKET)
      .upload(path, photoData, { contentType: 'image/jpeg', upsert: true });
    if (uploadError) throw uploadError;

    const { data, error: signError } = await supabase.storage
      .from(PHOTOS_BUCKET)
      .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);
    if (signError) throw signError;

    return data.signedUrl;
  }
}
