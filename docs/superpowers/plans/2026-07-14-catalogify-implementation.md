# Catalogify Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Catalogify, a personal mobile app (React Native/Expo, Android-first) for creating custom catalogs (coffees, wines, fruits, …) with user-defined item fields, backed by Firebase (Firestore + Storage + Google Sign-In) behind a swappable repository interface.

**Architecture:** A pure `domain/` layer (types, validation) with no external dependencies, a `services/` layer implementing a `CatalogRepository` interface against Firebase, and a `screens/` layer that only talks to the repository interface — never to Firebase directly. This keeps business logic unit-testable without the emulator and keeps the backend swappable.

**Tech Stack:** Expo (managed, TypeScript), Firebase JS SDK v9 (Firestore, Storage, Auth), `expo-auth-session` for Google Sign-In, `expo-image-picker` + `expo-image-manipulator` for photos, React Navigation (native stack), Jest (`jest-expo` preset) + Firebase Local Emulator Suite for repository tests.

Reference spec: `docs/superpowers/specs/2026-07-14-catalogify-design.md`

---

## File Structure

```
catalogify/
  App.tsx
  app.json
  .env                              # gitignored; Firebase web config
  firebase.json                     # emulator config
  firestore.rules
  src/
    domain/
      types.ts                      # FieldDef, CatalogList, CatalogItem, etc.
      validation.ts                 # pure validation functions
      validation.test.ts
      CatalogRepository.ts          # interface + ItemQuery type
    services/
      firebase.ts                   # Firebase app/db/auth/storage init
      image.ts                      # resize/compress before upload
      image.test.ts
      FirebaseCatalogRepository.ts  # CatalogRepository impl
      FirebaseCatalogRepository.test.ts   # runs against emulator
      auth.ts                       # useAuth hook, Google sign-in
    theme/
      theme.ts                      # Warm Editorial color/type tokens
    navigation/
      RootNavigator.tsx
    components/
      ListTile.tsx
      ItemCard.tsx
    screens/
      SignInScreen.tsx
      HomeScreen.tsx
      EditListFieldsScreen.tsx
      ListDetailScreen.tsx
      ItemFormScreen.tsx
```

---

### Task 1: Project scaffold

**Files:**
- Create: whole Expo project at `/Users/work/personal/random/catalogify` (already git-initialized with the spec committed)

- [ ] **Step 1: Scaffold the Expo TypeScript app in the existing directory**

```bash
cd /Users/work/personal/random/catalogify
npx create-expo-app@latest . --template blank-typescript
```

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install firebase
npx expo install expo-image-picker expo-image-manipulator expo-auth-session expo-web-browser expo-crypto expo-linking expo-constants
npm install @react-navigation/native @react-navigation/native-stack
npx expo install react-native-screens react-native-safe-area-context
```

- [ ] **Step 3: Install dev/test dependencies**

```bash
npm install --save-dev jest-expo @types/jest firebase-tools
```

- [ ] **Step 4: Configure Jest**

Add to `package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:emulator": "firebase emulators:exec --only firestore,auth \"jest src/services/FirebaseCatalogRepository.test.ts\""
  },
  "jest": {
    "preset": "jest-expo"
  }
}
```

- [ ] **Step 5: Verify the scaffold builds**

Run: `npx tsc --noEmit`
Expected: exits 0 (no errors) on the fresh scaffold.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Expo TypeScript project"
```

---

### Task 2: Domain types

**Files:**
- Create: `src/domain/types.ts`

- [ ] **Step 1: Write the types file**

```typescript
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/domain/types.ts
git commit -m "feat: add domain types for lists and items"
```

---

### Task 3: Validation (pure, TDD)

**Files:**
- Create: `src/domain/validation.ts`
- Test: `src/domain/validation.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/domain/validation.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/domain/validation.test.ts`
Expected: FAIL — `Cannot find module './validation'`

- [ ] **Step 3: Write the implementation**

```typescript
// src/domain/validation.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/domain/validation.test.ts`
Expected: PASS — 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/domain/validation.ts src/domain/validation.test.ts
git commit -m "feat: add item field validation"
```

---

### Task 4: CatalogRepository interface

**Files:**
- Create: `src/domain/CatalogRepository.ts`

- [ ] **Step 1: Write the interface**

```typescript
// src/domain/CatalogRepository.ts
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/domain/CatalogRepository.ts
git commit -m "feat: define CatalogRepository interface"
```

---

### Task 5: Image resize utility (TDD)

**Files:**
- Create: `src/services/image.ts`
- Test: `src/services/image.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/services/image.test.ts
import { computeResizeAction, resizeForUpload } from './image';

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn().mockResolvedValue({ uri: 'file://resized.jpg', width: 1080, height: 720 }),
  SaveFormat: { JPEG: 'jpeg' },
}));

describe('computeResizeAction', () => {
  it('constrains width for landscape images', () => {
    expect(computeResizeAction(3000, 2000)).toEqual({ resize: { width: 1080 } });
  });

  it('constrains height for portrait images', () => {
    expect(computeResizeAction(2000, 3000)).toEqual({ resize: { height: 1080 } });
  });

  it('does not upscale images already smaller than the target', () => {
    expect(computeResizeAction(600, 400)).toEqual({ resize: { width: 600 } });
  });
});

describe('resizeForUpload', () => {
  it('calls manipulateAsync with 0.7 JPEG compression', async () => {
    const ImageManipulator = require('expo-image-manipulator');
    const result = await resizeForUpload('file://original.jpg', 3000, 2000);

    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
      'file://original.jpg',
      [{ resize: { width: 1080 } }],
      { compress: 0.7, format: 'jpeg' }
    );
    expect(result).toEqual({ uri: 'file://resized.jpg', width: 1080, height: 720 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/services/image.test.ts`
Expected: FAIL — `Cannot find module './image'`

- [ ] **Step 3: Write the implementation**

```typescript
// src/services/image.ts
import * as ImageManipulator from 'expo-image-manipulator';

const TARGET_LONG_EDGE = 1080;

export interface ResizeAction {
  resize: { width?: number; height?: number };
}

export function computeResizeAction(
  width: number,
  height: number,
  targetLongEdge = TARGET_LONG_EDGE
): ResizeAction {
  if (width >= height) {
    return { resize: { width: Math.min(width, targetLongEdge) } };
  }
  return { resize: { height: Math.min(height, targetLongEdge) } };
}

export interface ResizedImage {
  uri: string;
  width: number;
  height: number;
}

export async function resizeForUpload(
  uri: string,
  originalWidth: number,
  originalHeight: number
): Promise<ResizedImage> {
  const action = computeResizeAction(originalWidth, originalHeight);
  const result = await ImageManipulator.manipulateAsync(uri, [action], {
    compress: 0.7,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return { uri: result.uri, width: result.width, height: result.height };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/services/image.test.ts`
Expected: PASS — 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/services/image.ts src/services/image.test.ts
git commit -m "feat: add client-side image resize before upload"
```

---

### Task 6: Firebase project setup and Firestore emulator config

**Files:**
- Create: `src/services/firebase.ts`
- Create: `firebase.json`
- Create: `firestore.rules`
- Create: `.env.example`
- Modify: `.gitignore` (add `.env`, `firebase-debug.log`, `firestore-debug.log`)

- [ ] **Step 1: Create the Firebase project manually (one-time, outside the repo)**

In the Firebase console (console.firebase.google.com): create a project named "catalogify", enable **Firestore** (production mode), **Storage**, and **Authentication → Google** sign-in provider. Register an Android app (and optionally a Web app for the emulator/Expo Go dev flow) to get a web config object.

- [ ] **Step 2: Write `.env.example` documenting the required config**

```
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
```

Copy this to `.env` and fill in real values from the Firebase console (Project Settings → your web app) and Google Cloud Console (OAuth client IDs) before running the app.

- [ ] **Step 3: Update `.gitignore`**

```
.env
firebase-debug.log
firestore-debug.log
```

- [ ] **Step 4: Write `src/services/firebase.ts`**

```typescript
// src/services/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export function connectToEmulators() {
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectAuthEmulator(auth, 'http://localhost:9099');
}
```

- [ ] **Step 5: Write `firestore.rules` scoping data to the signed-in user**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

- [ ] **Step 6: Write `firebase.json` for the local emulator suite**

```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "emulators": {
    "firestore": { "port": 8080 },
    "auth": { "port": 9099 }
  }
}
```

- [ ] **Step 7: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 8: Commit**

```bash
git add src/services/firebase.ts firebase.json firestore.rules .env.example .gitignore
git commit -m "feat: add Firebase config and emulator setup"
```

---

### Task 7: FirebaseCatalogRepository (TDD against emulator)

**Files:**
- Create: `src/services/FirebaseCatalogRepository.ts`
- Test: `src/services/FirebaseCatalogRepository.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/services/FirebaseCatalogRepository.test.ts
import { signInAnonymously } from 'firebase/auth';
import { auth, connectToEmulators } from './firebase';
import { FirebaseCatalogRepository } from './FirebaseCatalogRepository';

beforeAll(() => {
  connectToEmulators();
});

let repo: FirebaseCatalogRepository;

beforeEach(async () => {
  const { user } = await signInAnonymously(auth);
  repo = new FirebaseCatalogRepository(user.uid);
});

describe('FirebaseCatalogRepository', () => {
  it('creates and lists catalogs', async () => {
    const list = await repo.createList('Coffees', [
      { key: 'rating', label: 'Rating', type: 'rating', required: true, ratingScale: { max: 10 } },
    ]);

    const lists = await repo.getLists();
    expect(lists.map((l) => l.id)).toContain(list.id);
    expect(lists.find((l) => l.id === list.id)?.name).toBe('Coffees');
  });

  it('updates a list schema', async () => {
    const list = await repo.createList('Wines', []);
    await repo.updateListFields(list.id, [
      { key: 'region', label: 'Region', type: 'shortText', required: false },
    ]);

    const lists = await repo.getLists();
    expect(lists.find((l) => l.id === list.id)?.fields).toHaveLength(1);
  });

  it('adds, reads, and sorts items by rating', async () => {
    const list = await repo.createList('Coffees', [
      { key: 'rating', label: 'Rating', type: 'rating', required: true, ratingScale: { max: 10 } },
    ]);

    await repo.addItem(list.id, 'Low Rated', { rating: 3 });
    await repo.addItem(list.id, 'High Rated', { rating: 9 });

    const items = await repo.getItems(list.id, { sortByRatingKey: 'rating', sortDirection: 'desc' });
    expect(items.map((i) => i.title)).toEqual(['High Rated', 'Low Rated']);
  });

  it('filters items by search text on title', async () => {
    const list = await repo.createList('Coffees', []);
    await repo.addItem(list.id, 'Ethiopia Yirgacheffe', {});
    await repo.addItem(list.id, 'Colombia Supremo', {});

    const items = await repo.getItems(list.id, { searchText: 'ethiopia' });
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Ethiopia Yirgacheffe');
  });

  it('updates and deletes an item', async () => {
    const list = await repo.createList('Coffees', []);
    const item = await repo.addItem(list.id, 'Original Title', {});

    await repo.updateItem(list.id, item.id, 'Updated Title', {});
    let items = await repo.getItems(list.id);
    expect(items[0].title).toBe('Updated Title');

    await repo.deleteItem(list.id, item.id);
    items = await repo.getItems(list.id);
    expect(items).toHaveLength(0);
  });

  it('deletes a list', async () => {
    const list = await repo.createList('Temp', []);
    await repo.deleteList(list.id);

    const lists = await repo.getLists();
    expect(lists.map((l) => l.id)).not.toContain(list.id);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/services/FirebaseCatalogRepository.test.ts`
Expected: FAIL — `Cannot find module './FirebaseCatalogRepository'`

- [ ] **Step 3: Write the implementation**

```typescript
// src/services/FirebaseCatalogRepository.ts
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db, storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { CatalogRepository, ItemQuery } from '../domain/CatalogRepository';
import { CatalogList, CatalogItem, FieldDef, FieldValue } from '../domain/types';
import { resizeForUpload } from './image';
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
    await Promise.all(items.docs.map((d) => deleteDoc(d.ref)));
    await deleteDoc(doc(listsCol(this.uid), listId));
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
  }

  private async uploadPhoto(listId: string, itemId: string, photoUri: string): Promise<string> {
    const info = await ImageManipulator.manipulateAsync(photoUri, []);
    const resized = await resizeForUpload(photoUri, info.width, info.height);
    const response = await fetch(resized.uri);
    const blob = await response.blob();
    const storageRef = ref(storage, `users/${this.uid}/lists/${listId}/items/${itemId}/photo.jpg`);
    await uploadBytes(storageRef, blob);
    return getDownloadURL(storageRef);
  }
}
```

- [ ] **Step 4: Start the emulator and run tests**

Run: `npm run test:emulator`
Expected: PASS — 6 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/services/FirebaseCatalogRepository.ts src/services/FirebaseCatalogRepository.test.ts
git commit -m "feat: implement CatalogRepository against Firebase"
```

---

### Task 8: Google Sign-In auth hook

**Files:**
- Create: `src/services/auth.ts`

- [ ] **Step 1: Write the auth hook**

```typescript
// src/services/auth.ts
import { useEffect, useState } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signOut, User } from 'firebase/auth';
import { auth } from './firebase';

WebBrowser.maybeCompleteAuthSession();

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  });

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setInitializing(false);
    });
  }, []);

  useEffect(() => {
    if (response?.type === 'success' && response.authentication?.idToken) {
      const credential = GoogleAuthProvider.credential(response.authentication.idToken);
      signInWithCredential(auth, credential);
    }
  }, [response]);

  return {
    user,
    initializing,
    canSignIn: !!request,
    signIn: () => promptAsync(),
    signOut: () => signOut(auth),
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/services/auth.ts
git commit -m "feat: add Google Sign-In auth hook"
```

Manual verification only: OAuth flows can't run in Jest. Verify on-device in Task 14.

---

### Task 9: Warm Editorial theme tokens

**Files:**
- Create: `src/theme/theme.ts`

- [ ] **Step 1: Write the theme file**

```typescript
// src/theme/theme.ts
export const theme = {
  colors: {
    background: '#FAF6F0',
    cardBackground: '#FFFFFF',
    border: '#E8DDD0',
    textPrimary: '#3A2E22',
    textSecondary: '#8A7A68',
    accent: '#C9A27A',
    accentStrong: '#A8895F',
    danger: '#A83246',
  },
  radii: {
    small: 12,
    medium: 16,
    large: 18,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  fonts: {
    heading: 'Georgia',
    body: undefined, // system default sans-serif
  },
} as const;

export type Theme = typeof theme;
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/theme/theme.ts
git commit -m "feat: add Warm Editorial theme tokens"
```

---

### Task 10: Navigation shell and App entry point

**Files:**
- Create: `src/navigation/RootNavigator.tsx`
- Create: `src/screens/SignInScreen.tsx`
- Modify: `App.tsx`

- [ ] **Step 1: Write a placeholder SignInScreen**

```typescript
// src/screens/SignInScreen.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useAuth } from '../services/auth';
import { theme } from '../theme/theme';

export function SignInScreen() {
  const { signIn, canSignIn } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Catalogify</Text>
      <Pressable style={styles.button} disabled={!canSignIn} onPress={signIn}>
        <Text style={styles.buttonText}>Sign in with Google</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
  },
  title: {
    fontSize: 28,
    fontFamily: theme.fonts.heading,
    color: theme.colors.textPrimary,
  },
  button: {
    backgroundColor: theme.colors.accentStrong,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radii.medium,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});
```

- [ ] **Step 2: Write the RootNavigator**

```typescript
// src/navigation/RootNavigator.tsx
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../services/auth';
import { SignInScreen } from '../screens/SignInScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { EditListFieldsScreen } from '../screens/EditListFieldsScreen';
import { ListDetailScreen } from '../screens/ListDetailScreen';
import { ItemFormScreen } from '../screens/ItemFormScreen';
import { CatalogList, CatalogItem } from '../domain/types';

export type RootStackParamList = {
  Home: undefined;
  EditListFields: { list?: CatalogList };
  ListDetail: { list: CatalogList };
  ItemForm: { list: CatalogList; item?: CatalogItem };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { user, initializing } = useAuth();

  if (initializing) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!user ? (
          <Stack.Screen name="Home" component={SignInScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'My Catalogs' }} />
            <Stack.Screen name="EditListFields" component={EditListFieldsScreen} options={{ title: 'List Fields' }} />
            <Stack.Screen name="ListDetail" component={ListDetailScreen} options={{ title: '' }} />
            <Stack.Screen name="ItemForm" component={ItemFormScreen} options={{ title: 'Item' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

- [ ] **Step 3: Wire App.tsx**

```typescript
// App.tsx
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return <RootNavigator />;
}
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: fails until Tasks 11–13 create `HomeScreen`, `EditListFieldsScreen`, `ListDetailScreen`, `ItemFormScreen` — that's expected at this point. Re-run after Task 13 and confirm it then exits 0.

- [ ] **Step 5: Commit**

```bash
git add App.tsx src/navigation/RootNavigator.tsx src/screens/SignInScreen.tsx
git commit -m "feat: add navigation shell and sign-in screen"
```

---

### Task 11: Home screen and ListTile

**Files:**
- Create: `src/components/ListTile.tsx`
- Create: `src/screens/HomeScreen.tsx`

- [ ] **Step 1: Write ListTile**

```typescript
// src/components/ListTile.tsx
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { CatalogList } from '../domain/types';
import { theme } from '../theme/theme';

interface Props {
  list: CatalogList;
  itemCount: number;
  onPress: () => void;
}

export function ListTile({ list, itemCount, onPress }: Props) {
  return (
    <Pressable style={styles.tile} onPress={onPress}>
      <View style={styles.thumbnail} />
      <Text style={styles.name}>{list.name}</Text>
      <Text style={styles.count}>{itemCount} items</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.radii.medium,
    padding: theme.spacing.md,
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  thumbnail: {
    width: '100%',
    height: 60,
    borderRadius: theme.radii.small,
    backgroundColor: theme.colors.accent,
  },
  name: {
    fontFamily: theme.fonts.heading,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  count: {
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
});
```

- [ ] **Step 2: Write HomeScreen**

```typescript
// src/screens/HomeScreen.tsx
import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { CatalogList } from '../domain/types';
import { FirebaseCatalogRepository } from '../services/FirebaseCatalogRepository';
import { useAuth } from '../services/auth';
import { ListTile } from '../components/ListTile';
import { theme } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [lists, setLists] = useState<CatalogList[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      const repo = new FirebaseCatalogRepository(user.uid);
      repo.getLists().then(setLists);
    }, [user])
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={[...lists, null]}
        keyExtractor={(item, index) => item?.id ?? `add-${index}`}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.content}
        renderItem={({ item }) =>
          item ? (
            <ListTile
              list={item}
              itemCount={0}
              onPress={() => navigation.navigate('ListDetail', { list: item })}
            />
          ) : (
            <Pressable
              style={styles.addTile}
              onPress={() => navigation.navigate('EditListFields', {})}
            >
              <Text style={styles.addIcon}>+</Text>
            </Pressable>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.md },
  row: { gap: theme.spacing.md },
  addTile: {
    flex: 1,
    borderRadius: theme.radii.medium,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 90,
  },
  addIcon: { fontSize: 22, color: theme.colors.accent },
});
```

Note: `itemCount={0}` is a placeholder until item counts are wired up; acceptable for now since `CatalogList` doesn't carry a count and adding one would require a denormalized counter — out of scope for this plan. Revisit only if it becomes a real usability problem.

- [ ] **Step 3: Commit**

```bash
git add src/components/ListTile.tsx src/screens/HomeScreen.tsx
git commit -m "feat: add home screen with catalog grid"
```

---

### Task 12: EditListFields screen (field builder)

**Files:**
- Create: `src/screens/EditListFieldsScreen.tsx`

- [ ] **Step 1: Write the screen**

```typescript
// src/screens/EditListFieldsScreen.tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { FieldDef, FieldType } from '../domain/types';
import { FirebaseCatalogRepository } from '../services/FirebaseCatalogRepository';
import { useAuth } from '../services/auth';
import { theme } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'EditListFields'>;

const FIELD_TYPES: FieldType[] = ['shortText', 'longText', 'number', 'rating', 'photo', 'boolean', 'date'];

export function EditListFieldsScreen({ route, navigation }: Props) {
  const { user } = useAuth();
  const existing = route.params?.list;
  const [name, setName] = useState(existing?.name ?? '');
  const [fields, setFields] = useState<FieldDef[]>(existing?.fields ?? []);

  function addField() {
    setFields((prev) => [
      ...prev,
      { key: `field_${prev.length}_${Date.now()}`, label: '', type: 'shortText', required: false },
    ]);
  }

  function updateField(index: number, patch: Partial<FieldDef>) {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function removeField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    if (!user || !name.trim()) return;
    const repo = new FirebaseCatalogRepository(user.uid);
    if (existing) {
      await repo.updateListFields(existing.id, fields);
    } else {
      await repo.createList(name.trim(), fields);
    }
    navigation.goBack();
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.nameInput}
        placeholder="List name (e.g. Coffees)"
        value={name}
        onChangeText={setName}
        editable={!existing}
      />
      <FlatList
        data={fields}
        keyExtractor={(f) => f.key}
        contentContainerStyle={styles.fieldList}
        renderItem={({ item, index }) => (
          <View style={styles.fieldRow}>
            <TextInput
              style={styles.fieldLabelInput}
              placeholder="Field label"
              value={item.label}
              onChangeText={(label) => updateField(index, { label })}
            />
            <View style={styles.typeRow}>
              {FIELD_TYPES.map((type) => (
                <Pressable
                  key={type}
                  style={[styles.typeChip, item.type === type && styles.typeChipActive]}
                  onPress={() => updateField(index, { type })}
                >
                  <Text style={styles.typeChipText}>{type}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => removeField(index)}>
              <Text style={styles.removeText}>Remove field</Text>
            </Pressable>
          </View>
        )}
      />
      <Pressable style={styles.addFieldButton} onPress={addField}>
        <Text style={styles.addFieldText}>+ Add field</Text>
      </Pressable>
      <Pressable style={styles.saveButton} onPress={save}>
        <Text style={styles.saveButtonText}>Save</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing.lg },
  nameInput: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.radii.small,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  fieldList: { gap: theme.spacing.md },
  fieldRow: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.radii.small,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  fieldLabelInput: { fontSize: 15, color: theme.colors.textPrimary },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
  typeChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: theme.colors.background,
  },
  typeChipActive: { backgroundColor: theme.colors.accent },
  typeChipText: { fontSize: 11, color: theme.colors.textPrimary },
  removeText: { fontSize: 12, color: theme.colors.danger },
  addFieldButton: { paddingVertical: theme.spacing.md, alignItems: 'center' },
  addFieldText: { color: theme.colors.accentStrong },
  saveButton: {
    backgroundColor: theme.colors.accentStrong,
    borderRadius: theme.radii.medium,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 16 },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/EditListFieldsScreen.tsx
git commit -m "feat: add list field builder screen"
```

---

### Task 13: ListDetail and ItemForm screens

**Files:**
- Create: `src/components/ItemCard.tsx`
- Create: `src/screens/ListDetailScreen.tsx`
- Create: `src/screens/ItemFormScreen.tsx`

- [ ] **Step 1: Write ItemCard**

```typescript
// src/components/ItemCard.tsx
import { Pressable, Text, View, Image, StyleSheet } from 'react-native';
import { CatalogItem, CatalogList } from '../domain/types';
import { theme } from '../theme/theme';

interface Props {
  item: CatalogItem;
  list: CatalogList;
  onPress: () => void;
}

export function ItemCard({ item, list, onPress }: Props) {
  const ratingField = list.fields.find((f) => f.type === 'rating');
  const rating = ratingField ? item.values[ratingField.key] : undefined;
  const secondaryField = list.fields.find((f) => f.type === 'shortText' || f.type === 'longText');
  const secondary = secondaryField ? item.values[secondaryField.key] : undefined;

  return (
    <Pressable style={styles.card} onPress={onPress}>
      {item.photoUrl ? (
        <Image source={{ uri: item.photoUrl }} style={styles.thumbnail} />
      ) : (
        <View style={styles.thumbnailPlaceholder} />
      )}
      <View style={styles.body}>
        <Text style={styles.title}>{item.title}</Text>
        {rating !== undefined && rating !== null && (
          <Text style={styles.rating}>{'★'.repeat(Number(rating))}</Text>
        )}
        {secondary ? <Text style={styles.secondary}>{String(secondary)}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.radii.small,
    padding: theme.spacing.sm,
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  thumbnail: { width: 48, height: 48, borderRadius: theme.radii.small },
  thumbnailPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.small,
    backgroundColor: theme.colors.accent,
  },
  body: { flex: 1 },
  title: { fontFamily: theme.fonts.heading, fontSize: 15, color: theme.colors.textPrimary },
  rating: { color: theme.colors.accentStrong, fontSize: 12 },
  secondary: { color: theme.colors.textSecondary, fontSize: 12 },
});
```

- [ ] **Step 2: Write ListDetailScreen**

```typescript
// src/screens/ListDetailScreen.tsx
import { useCallback, useState } from 'react';
import { View, TextInput, FlatList, Pressable, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { CatalogItem } from '../domain/types';
import { FirebaseCatalogRepository } from '../services/FirebaseCatalogRepository';
import { useAuth } from '../services/auth';
import { ItemCard } from '../components/ItemCard';
import { theme } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ListDetail'>;

export function ListDetailScreen({ route, navigation }: Props) {
  const { list } = route.params;
  const { user } = useAuth();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [search, setSearch] = useState('');
  const ratingField = list.fields.find((f) => f.type === 'rating');

  const load = useCallback(() => {
    if (!user) return;
    const repo = new FirebaseCatalogRepository(user.uid);
    repo
      .getItems(list.id, {
        searchText: search || undefined,
        sortByRatingKey: ratingField?.key,
        sortDirection: 'desc',
      })
      .then(setItems);
  }, [user, search, list.id, ratingField]);

  useFocusEffect(load);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search"
        value={search}
        onChangeText={(text) => {
          setSearch(text);
          load();
        }}
      />
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <ItemCard
            item={item}
            list={list}
            onPress={() => navigation.navigate('ItemForm', { list, item })}
          />
        )}
      />
      <Pressable style={styles.fab} onPress={() => navigation.navigate('ItemForm', { list })}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  search: {
    margin: theme.spacing.lg,
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.radii.small,
    padding: theme.spacing.md,
  },
  list: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm },
  fab: {
    position: 'absolute',
    right: theme.spacing.lg,
    bottom: theme.spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.accentStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabText: { color: '#FFFFFF', fontSize: 28, lineHeight: 30 },
});
```

- [ ] **Step 3: Write ItemFormScreen**

```typescript
// src/screens/ItemFormScreen.tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, Switch, Image, ScrollView, Alert, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { FieldValue } from '../domain/types';
import { validateItem, hasErrors, ValidationErrors } from '../domain/validation';
import { FirebaseCatalogRepository } from '../services/FirebaseCatalogRepository';
import { useAuth } from '../services/auth';
import { theme } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ItemForm'>;

export function ItemFormScreen({ route, navigation }: Props) {
  const { list, item } = route.params;
  const { user } = useAuth();
  const [title, setTitle] = useState(item?.title ?? '');
  const [values, setValues] = useState<Record<string, FieldValue>>(item?.values ?? {});
  const [photoUri, setPhotoUri] = useState<string | undefined>(item?.photoUrl);
  const [errors, setErrors] = useState<ValidationErrors>({});

  function setValue(key: string, value: FieldValue) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 1 });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  async function save() {
    const fieldErrors = validateItem(list, title, values);
    setErrors(fieldErrors);
    if (hasErrors(fieldErrors) || !user) return;

    const repo = new FirebaseCatalogRepository(user.uid);
    if (item) {
      await repo.updateItem(list.id, item.id, title, values, photoUri);
    } else {
      await repo.addItem(list.id, title, values, photoUri);
    }
    navigation.goBack();
  }

  async function remove() {
    if (!item || !user) return;
    Alert.alert('Delete item?', `This removes "${item.title}" permanently.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const repo = new FirebaseCatalogRepository(user.uid);
          await repo.deleteItem(list.id, item.id);
          navigation.goBack();
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TextInput
        style={styles.titleInput}
        placeholder="Title"
        value={title}
        onChangeText={setTitle}
      />
      {errors.title ? <Text style={styles.error}>{errors.title}</Text> : null}

      {list.fields.some((f) => f.type === 'photo') && (
        <Pressable onPress={pickPhoto}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderText}>Add photo</Text>
            </View>
          )}
        </Pressable>
      )}

      {list.fields
        .filter((f) => f.type !== 'photo')
        .map((field) => (
          <View key={field.key} style={styles.fieldBlock}>
            <Text style={styles.label}>{field.label}</Text>

            {(field.type === 'shortText' || field.type === 'number' || field.type === 'date') && (
              <TextInput
                style={styles.input}
                value={values[field.key] != null ? String(values[field.key]) : ''}
                onChangeText={(text) =>
                  setValue(field.key, field.type === 'number' ? Number(text) || 0 : text)
                }
                keyboardType={field.type === 'number' ? 'numeric' : 'default'}
              />
            )}

            {field.type === 'longText' && (
              <TextInput
                style={[styles.input, styles.multiline]}
                multiline
                value={values[field.key] != null ? String(values[field.key]) : ''}
                onChangeText={(text) => setValue(field.key, text)}
              />
            )}

            {field.type === 'rating' && (
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder={`0-${field.ratingScale?.max ?? 10}`}
                value={values[field.key] != null ? String(values[field.key]) : ''}
                onChangeText={(text) => setValue(field.key, Number(text) || 0)}
              />
            )}

            {field.type === 'boolean' && (
              <Switch
                value={Boolean(values[field.key])}
                onValueChange={(v) => setValue(field.key, v)}
              />
            )}

            {errors[field.key] ? <Text style={styles.error}>{errors[field.key]}</Text> : null}
          </View>
        ))}

      <Pressable style={styles.saveButton} onPress={save}>
        <Text style={styles.saveButtonText}>Save</Text>
      </Pressable>

      {item && (
        <Pressable onPress={remove}>
          <Text style={styles.deleteText}>Delete item</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.md },
  titleInput: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.radii.small,
    padding: theme.spacing.md,
    fontSize: 16,
  },
  fieldBlock: { gap: theme.spacing.xs },
  label: { fontSize: 12, color: theme.colors.textSecondary },
  input: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.radii.small,
    padding: theme.spacing.md,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  photo: { width: '100%', height: 160, borderRadius: theme.radii.medium },
  photoPlaceholder: {
    width: '100%',
    height: 160,
    borderRadius: theme.radii.medium,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: { color: '#FFFFFF' },
  error: { color: theme.colors.danger, fontSize: 12 },
  saveButton: {
    backgroundColor: theme.colors.accentStrong,
    borderRadius: theme.radii.medium,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 16 },
  deleteText: { color: theme.colors.danger, textAlign: 'center' },
});
```

- [ ] **Step 4: Verify the whole app compiles now that all screens exist**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/ItemCard.tsx src/screens/ListDetailScreen.tsx src/screens/ItemFormScreen.tsx
git commit -m "feat: add list detail and item form screens"
```

---

### Task 14: Delete-list confirmation and on-device verification

**Files:**
- Modify: `src/screens/ListDetailScreen.tsx`

- [ ] **Step 1: Add a delete-list action with confirmation**

Add this import to `src/screens/ListDetailScreen.tsx`:

```typescript
import { Alert } from 'react-native';
```

Add this handler inside `ListDetailScreen`, above the `return`:

```typescript
  function confirmDeleteList() {
    if (!user) return;
    Alert.alert('Delete list?', `This removes "${list.name}" and all its items permanently.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const repo = new FirebaseCatalogRepository(user.uid);
          await repo.deleteList(list.id);
          navigation.navigate('Home');
        },
      },
    ]);
  }
```

Wire it into the header in `RootNavigator.tsx`'s `ListDetail` screen options by passing `headerRight` from the screen itself — replace the `ListDetailScreen` export's `return` wrapper's outer `<View style={styles.container}>` with the same view, and add above the `TextInput`:

```typescript
      <Pressable onPress={confirmDeleteList} style={styles.deleteListButton}>
        <Text style={styles.deleteListText}>Delete this list</Text>
      </Pressable>
```

Add matching styles to the `StyleSheet.create` call in the same file:

```typescript
  deleteListButton: { alignSelf: 'flex-end', marginHorizontal: theme.spacing.lg },
  deleteListText: { color: theme.colors.danger, fontSize: 12 },
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/screens/ListDetailScreen.tsx
git commit -m "feat: add delete-list confirmation"
```

- [ ] **Step 4: Manual on-device verification**

Fill in real values in `.env` (Task 6), then run:

```bash
npx expo start
```

On a device/emulator with Expo Go (or a dev client if Google Sign-In native modules require it), verify: sign in, create a "Coffees" list with a rating + photo field, add an item with a photo, confirm the photo appears resized/small in Firebase Storage, search and sort in the list, edit the list's fields, delete an item, delete the list.

---

## Self-Review Notes

- **Spec coverage:** auth (Task 8, 10), Firestore+Storage backend behind `CatalogRepository` (Tasks 4, 6, 7), dynamic per-list schema with add/edit-anytime (Tasks 2, 12), fixed field-type set (Task 2), image resize before upload (Task 5, used in Task 7's `uploadPhoto`), search + sort/filter by rating (Task 7, 13), Warm Editorial visuals (Task 9, applied throughout screens), delete confirmations (Tasks 13, 14), Firestore-emulator-based repository tests (Task 7) — all covered.
- **Type consistency checked:** `ItemQuery` (`searchText`, `sortByRatingKey`, `sortDirection`, `minRating`) is used identically in `CatalogRepository.ts`, `FirebaseCatalogRepository.ts`, and `ListDetailScreen.tsx`. `CatalogRepository` method signatures match between the interface (Task 4) and the implementation (Task 7) and all call sites (Tasks 11–14).
