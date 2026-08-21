import { createClient } from '@supabase/supabase-js';
const rawUrl=import.meta.env.VITE_SUPABASE_URL;
const url=rawUrl?.replace(/\/rest\/v1\/?$/,'').replace(/\/$/,'');
const anonKey=import.meta.env.VITE_SUPABASE_ANON_KEY||import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const isSupabaseConfigured = Boolean(url && anonKey);
export const supabase = isSupabaseConfigured ? createClient(url, anonKey, { auth:{ persistSession:true, autoRefreshToken:true } }) : null;
