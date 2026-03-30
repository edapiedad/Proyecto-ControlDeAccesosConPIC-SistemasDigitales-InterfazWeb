import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Server-side Supabase client using Service Role Key
// This bypasses RLS — only use in server-side code (API routes, server components)

let _client: SupabaseClient<Database> | null = null;

function getServiceClient(): SupabaseClient<Database> {
  if (_client) return _client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables'
    );
  }

  _client = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _client;
}

// Lazy getter — only creates the client when first accessed at runtime
export const supabaseAdmin = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    const client = getServiceClient();
    const value = client[prop as keyof SupabaseClient<Database>];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});
