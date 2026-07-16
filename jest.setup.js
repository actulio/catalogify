// Provide dummy Firebase config values for tests that run against the local
// Firebase emulator suite. The emulator does not validate these against a
// real project, but the Firebase SDK requires non-empty, well-formed-looking
// values to initialize without throwing (e.g. auth/invalid-api-key).
process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||= 'test-api-key';
process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ||= 'localhost';
process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ||= 'demo-catalogify';
process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||= '000000000000';
process.env.EXPO_PUBLIC_FIREBASE_APP_ID ||= '1:000000000000:web:0000000000000000000000';

// Dummy Supabase config so createClient() doesn't throw on a missing/malformed
// URL during tests. Nothing here makes real network calls in the test suites.
process.env.EXPO_PUBLIC_SUPABASE_URL ||= 'https://demo-catalogify.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
