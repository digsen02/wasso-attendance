import { readEnvFile } from './env-file.mjs';
import { publicSupabaseConfig } from '../src/config/supabase.public.js';
const localEnv=process.env.SKIP_ENV_FILE==='true'?{}:readEnvFile();

const rawUrl=process.env.VITE_SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||localEnv.VITE_SUPABASE_URL||localEnv.NEXT_PUBLIC_SUPABASE_URL||publicSupabaseConfig.url;
const key=process.env.VITE_SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||localEnv.VITE_SUPABASE_ANON_KEY||localEnv.VITE_SUPABASE_PUBLISHABLE_KEY||localEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||publicSupabaseConfig.publishableKey;
if(!rawUrl||!key)throw new Error('VITE_SUPABASE_URL과 Supabase public key가 필요합니다.');

const baseUrl=rawUrl.replace(/\/rest\/v1\/?$/,'').replace(/\/$/,'');
const headers={apikey:key,Authorization:`Bearer ${key}`};
const auth=await fetch(`${baseUrl}/auth/v1/health`,{headers:{apikey:key}});
if(!auth.ok)throw new Error(`Supabase Auth 연결 실패 (${auth.status})`);

const rest=await fetch(`${baseUrl}/rest/v1/`,{headers});
const table=await fetch(`${baseUrl}/rest/v1/submission_periods?select=id&limit=1`,{headers});
let tableState='available';
if(!table.ok){
  const body=await table.json().catch(()=>({}));
  if(table.status===401&&body.code==='42501')tableState='protected-by-RLS';
  else throw new Error(`submission_periods 확인 실패 (${table.status}, ${body.code||'unknown'})`);
}
if(!rest.ok&&tableState!=='protected-by-RLS')throw new Error(`Supabase Data API 연결 실패 (${rest.status})`);

console.log(JSON.stringify({auth:'connected',dataApi:'connected',submissionPeriods:tableState,urlNormalized:baseUrl!==rawUrl},null,2));
