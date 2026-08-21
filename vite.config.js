import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import { readEnvFile } from './scripts/env-file.mjs';

export default defineConfig(()=>{
  const env=readEnvFile();
  const projectUrl=process.env.VITE_SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||env.VITE_SUPABASE_URL||env.NEXT_PUBLIC_SUPABASE_URL||'';
  const publicKey=process.env.VITE_SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||env.VITE_SUPABASE_ANON_KEY||env.VITE_SUPABASE_PUBLISHABLE_KEY||env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'';
  return {
    plugins:[react(),tailwindcss()],
    define:{
      'import.meta.env.VITE_SUPABASE_URL':JSON.stringify(projectUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY':JSON.stringify(publicKey),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':JSON.stringify(publicKey),
    },
  };
});
