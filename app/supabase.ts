import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const databaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
let client: SupabaseClient | undefined;
export function getSupabase(): SupabaseClient {
  if (!databaseConfigured) throw new Error('Konfigurasi Supabase belum diisi. Ikuti PANDUAN_DATABASE.md.');
  client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  return client;
}
