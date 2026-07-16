# Catalogify

An Expo (React Native) app backed by Firebase (Auth, Firestore) and Supabase (Storage, for item photos).

Photos live in Supabase Storage rather than Firebase Storage because Firebase Storage requires the paid Blaze plan even for its free-tier quota, while Supabase's Storage is usable on its free tier with no payment method attached — so there's no risk of a surprise bill (e.g. from abusive traffic). Auth stays on Firebase; Supabase Storage trusts the same Firebase-issued sign-in via its Third-Party Auth integration (see below), so there's only one identity system, not two.

## Prerequisites

- Node.js and [pnpm](https://pnpm.io/) (`packageManager` in `package.json` pins `pnpm@11.1.1`)
- [Expo Go](https://expo.dev/go) app on your phone, or an iOS/Android simulator
- A [Firebase](https://console.firebase.google.com/) project
- A [Supabase](https://supabase.com/dashboard) project (free tier)
- The [Firebase CLI](https://firebase.google.com/docs/cli) for running the Firestore/Auth emulators and deploying Firestore rules: `pnpm dlx firebase-tools --version` (already available locally via the `firebase-tools` devDependency)

## Install

```bash
pnpm install
```

## Firebase project setup

1. Create a Firebase project (or reuse one) in the [Firebase console](https://console.firebase.google.com/).
2. Enable **Authentication → Sign-in method → Google**.
3. Enable **Firestore** (native mode).
4. Register a Web app in the project settings to get the `firebaseConfig` values used below.
5. Point the Firebase CLI at your project: `pnpm dlx firebase-tools use --add` and pick your project (this creates a local `.firebaserc`, which is gitignored per-project).

### Google Sign-In

Google Sign-In uses [`@react-native-google-signin/google-signin`](https://github.com/react-native-google-signin/google-signin) (native Google Sign-In SDKs), not a browser-redirect flow — Google's OAuth policy blocks the `exp://...` redirect URI that Expo Go's browser-based flow would otherwise produce for a "Web application" OAuth client. The tradeoff: this needs a [development build](#development-build) — it does not run in Expo Go at all.

> This uses the free/public version of the package, which is built on Android's **deprecated legacy Google Sign-In SDK** (per the [package's own docs](https://react-native-google-signin.github.io/docs/install)) — Google may remove it from Play Services at their discretion, with no fixed timeline. The maintainers' actively-developed offering is a paid "Universal Sign In" product. If this ever breaks, that's the likely reason and the migration path.

1. In the [Firebase console](https://console.firebase.google.com/), add an **Android app** to your project (separate from the Web app you registered earlier):
   - Package name: `com.catalogify.app` (matches `expo.android.package` in `app.json` — change both together if you want a different one).
   - Add a **SHA-1 signing certificate fingerprint** — see the box below on getting the *right* one, this is the step most likely to bite you.
   - Skip the "Add Firebase SDK" Gradle instructions the console shows next (adding the `com.google.gms.google-services` classpath/plugin) — the `@react-native-google-signin/google-signin` Expo config plugin already does this automatically during `expo prebuild`, into `android/build.gradle` and `android/app/build.gradle`. Doing it by hand isn't needed and there's nothing to add there in an Expo-managed project.
2. **Verify the matching Android OAuth client actually exists** in [Google Cloud console → Credentials](https://console.cloud.google.com/apis/credentials) for the same GCP project — an entry of type "Android" with that exact package name and SHA-1. Firebase is *supposed* to auto-create this from the fingerprint you just added, but in practice this doesn't always happen (or lags) — if it's missing, create it yourself: **Create Credentials → OAuth client ID → Android**, same package name + SHA-1.
3. Only after confirming that Android client exists, download **`google-services.json`** from the Firebase console and place it at the project root (already referenced by `app.json`'s `android.googleServicesFile`, and gitignored — each developer generates their own). If you create the Android OAuth client *after* an earlier download, re-download — an older copy won't include it.
4. Get the **Web client ID** — same Credentials page, copy the Client ID of the OAuth **Web client** (auto-created when you enabled Google as a Firebase Auth sign-in provider, named something like "Web client (auto created by Google Service)"). It's also visible inside `google-services.json` under an `oauth_client` entry with `"client_type": 3`. This becomes `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` below — it's what lets the app exchange the native Google Sign-In result for a Firebase credential, not what's used for the Android app's own identity (that's the package name + SHA-1 from step 1/2).

> **Getting the right SHA-1 (the #1 cause of `DEVELOPER_ERROR`)**: don't assume it comes from `~/.android/debug.keystore`. This project's generated `android/app/build.gradle` points its `debug` signing config at a *project-local* file — `android/app/debug.keystore` (a generic template file Expo/RN bundles into every fresh prebuild, unrelated to your global one) — via `storeFile file('debug.keystore')`. That's the certificate that actually signs local debug builds. Get its fingerprint with:
> ```bash
> KEYTOOL="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/keytool"   # or just `keytool` if it's on your PATH
> "$KEYTOOL" -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android
> ```
> (For an EAS build, the signing credential is managed by EAS instead — use `eas credentials` there, not this file.) If sign-in still fails with `DEVELOPER_ERROR` after registering that SHA-1 correctly everywhere, double-check you actually rebuilt (`npx expo prebuild --clean --platform android && npx expo run:android`) *after* replacing `google-services.json`, and that you're testing on a device/emulator with real Google Play Services (not a bare AOSP emulator image).

## Supabase project setup (photo storage)

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard) (free tier is fine).
2. Grab the **Project URL** and **anon/publishable key** from Project Settings → API — these become `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` below.
3. Create a **private** Storage bucket named `photos` (Storage → New bucket, toggle "Public" off), and set:
   - **Allowed MIME types**: `image/jpeg` — the only content type the app ever uploads.
   - **File size limit**: `1 MB` — item photos are identification thumbnails, not detailed images. The client already resizes/compresses to fit this (see `resizeUnderSizeLimit` in [src/services/image.ts](src/services/image.ts)), retrying with progressively stricter settings if the first attempt is too big, so this is a hard backstop rather than the normal path.
4. Wire up Firebase as a Third-Party Auth provider so Supabase trusts your existing Firebase sign-in, instead of needing a second login system:
   - In the Supabase dashboard: **Authentication → Third-Party Auth → Add integration → Firebase**, and enter your Firebase **Project ID** (Firebase console → Project settings → General).
   - No Firebase-side changes needed for this step — the app already forwards the signed-in user's Firebase ID token to Supabase via the `accessToken` callback in [src/services/supabase.ts](src/services/supabase.ts).
5. In the Supabase **SQL Editor**, run the following to scope each user to their own folder (`{uid}/lists/...`) inside the bucket:

   ```sql
   create policy "Users can upload their own photos"
   on storage.objects for insert
   to public
   with check (
     bucket_id = 'photos'
     and (storage.foldername(name))[1] = (auth.jwt()->>'sub')
   );

   create policy "Users can update their own photos"
   on storage.objects for update
   to public
   using (
     bucket_id = 'photos'
     and (storage.foldername(name))[1] = (auth.jwt()->>'sub')
   );

   create policy "Users can read their own photos"
   on storage.objects for select
   to public
   using (
     bucket_id = 'photos'
     and (storage.foldername(name))[1] = (auth.jwt()->>'sub')
   );

   create policy "Users can delete their own photos"
   on storage.objects for delete
   to public
   using (
     bucket_id = 'photos'
     and (storage.foldername(name))[1] = (auth.jwt()->>'sub')
   );
   ```

   These are written `to public` with an explicit `auth.jwt()->>'sub'` check rather than `to authenticated`, which is what Supabase's own Firebase-integration guide demonstrates. Their approach needs every Firebase user tagged with a `role: 'authenticated'` custom claim (via a Cloud Function), but Firebase Cloud Functions themselves require the Blaze plan — reintroducing the exact billing dependency this setup is meant to avoid. Checking the uid directly in the policy sidesteps that. **This hasn't been verified against a live Supabase project yet** — test an upload and a read once you've completed setup, and adjust if the policies don't behave as expected.

## Environment variables

Copy the example file and fill in the values from your Firebase Web app config, Google OAuth client IDs, and Supabase project:

```bash
cp .env.example .env
```

```
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

`EXPO_PUBLIC_*` variables are inlined at build time by Expo, so restart the dev server after changing `.env`.

## Firestore security rules

Rules live in [firestore.rules](firestore.rules), scoping access to `users/{userId}/**` for the signed-in user only. Deploy them with:

```bash
pnpm dlx firebase-tools deploy --only firestore:rules
```

(Photo storage access control is configured separately in Supabase — see the Supabase setup section above.)

## Development build

Because of Google Sign-In (see above), this app needs a **development build** instead of plain Expo Go — Expo Go can't load `@react-native-google-signin/google-signin` since it requires custom native code. A dev build behaves like Expo Go day-to-day (same dev menu, same fast refresh against `pnpm start`); you only need to rebuild it when a native dependency or `app.json` native config changes, not for regular JS/TS edits.

Build one with either:

```bash
eas build --profile development --platform android   # cloud build, needs a free EAS account
# or
npx expo run:android                                  # local build, needs Android Studio installed
```

Then install the resulting build on your device/emulator and run `pnpm start` as usual — it connects to the same Metro bundler.

## Running the app

```bash
pnpm start        # Expo dev server — open it in your development build (see above), not Expo Go
pnpm android      # build and open on Android emulator/device
pnpm ios          # build and open on iOS simulator/device
pnpm web          # open in the browser
```

> This project targets Expo SDK 57. See [AGENTS.md](AGENTS.md) — the SDK changed significantly, so check the [versioned docs](https://docs.expo.dev/versions/v57.0.0/) before making changes.

## Running tests

```bash
pnpm test            # unit tests (mocked, no network)
pnpm test:emulator   # tests against local Firestore + Auth emulators
```

`test:emulator` starts the Firestore and Auth emulators (ports `8080` and `9099`, configured in [firebase.json](firebase.json)) via the Firebase CLI and runs `src/services/FirebaseCatalogRepository.test.ts` against them — no real Firebase project or network access needed. If you want to run the emulators standalone (e.g. to poke around in the emulator UI):

```bash
pnpm dlx firebase-tools emulators:start --only firestore,auth
```
