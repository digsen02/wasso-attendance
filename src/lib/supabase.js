import { createClient } from '@supabase/supabase-js';
import { publicSupabaseConfig } from '../config/supabase.public';
const rawUrl=import.meta.env.VITE_SUPABASE_URL||publicSupabaseConfig.url;
const url=rawUrl?.replace(/\/rest\/v1\/?$/,'').replace(/\/$/,'');
const anonKey=import.meta.env.VITE_SUPABASE_ANON_KEY||import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||publicSupabaseConfig.publishableKey;
export const isSupabaseConfigured = Boolean(url && anonKey);
export const supabase = isSupabaseConfigured ? createClient(url, anonKey, { auth:{ persistSession:true, autoRefreshToken:true } }) : null;
