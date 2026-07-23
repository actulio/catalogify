import { supabase } from './supabase';

// A real Postgres SELECT is the most defensible "activity" against Supabase's
// free-tier 7-day pause timer. The app otherwise only talks to Storage, so this
// dedicated ping guarantees database traffic. Best-effort: never throws.
export async function pingSupabase(): Promise<boolean> {
  try {
    const { error } = await supabase.from('keepalive').select('id').limit(1);
    if (error) {
      console.warn('Supabase keep-alive ping failed', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase keep-alive ping threw', err);
    return false;
  }
}
