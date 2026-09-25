import { createClient } from '@supabase/supabase-js';

/**
 * Sanitizes Supabase URL to ensure it is strictly the origin (e.g. https://xxx.supabase.co).
 * Strips accidental subpaths like '/rest/v1' or trailing slashes that cause
 * the PostgREST error: "Invalid path specified in request URL".
 */
function sanitizeSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();
  try {
    const parsed = new URL(trimmed);
    return parsed.origin;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseUrl = sanitizeSupabaseUrl(rawSupabaseUrl);

const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey).trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl && (supabaseAnonKey || supabaseServiceKey)
);

// Public client for client-side or anon operations
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Admin/Server client for secure server-side transactions & stored procedures
export const supabaseAdmin = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;
