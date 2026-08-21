import { isSupabaseConfigured } from '../lib/supabase';
import { mockRepository } from './mockRepository';
import { supabaseRepository } from './supabaseRepository';
const forceMock=import.meta.env.VITE_USE_MOCK==='true';
export const repository = isSupabaseConfigured&&!forceMock ? supabaseRepository : mockRepository;
export const dataSource = isSupabaseConfigured&&!forceMock ? 'SUPABASE' : 'MOCK';
