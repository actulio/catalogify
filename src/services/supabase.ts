import { createClient } from '@supabase/supabase-js';
import { auth } from './firebase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Supabase's own Auth (sessions, refresh) is unused here — the Firebase ID
// token is forwarded as the access token on every request so Storage RLS
// policies can read the Firebase uid via auth.jwt()->>'sub'. See README for
// the Third-Party Auth (Firebase) integration this depends on.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  accessToken: async () => (await auth.currentUser?.getIdToken()) ?? null,
});

export const PHOTOS_BUCKET = 'photos';
