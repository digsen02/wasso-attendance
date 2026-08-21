import { isSupabaseConfigured } from '../lib/supabase';
import { supabaseRepository } from './supabaseRepository';
if(!isSupabaseConfigured)throw new Error('VITE_SUPABASE_URL과 Supabase public key가 필요합니다.');
export const repository=supabaseRepository;
