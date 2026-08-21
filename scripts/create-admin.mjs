import { createClient } from '@supabase/supabase-js';

const required=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','ADMIN_USERNAME','ADMIN_PASSWORD'];
const missing=required.filter(key=>!process.env[key]);
if(missing.length)throw new Error(`필수 환경 변수가 없습니다: ${missing.join(', ')}`);
if(process.env.ADMIN_PASSWORD.length<8)throw new Error('ADMIN_PASSWORD는 8자 이상이어야 합니다.');

const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const username=process.env.ADMIN_USERNAME.trim();
const email=`${username}@hoesawasso.local`;
const temporaryStudentNumber=`ADMIN-${crypto.randomUUID()}`;
const {data,error}=await client.auth.admin.createUser({
  email,password:process.env.ADMIN_PASSWORD,email_confirm:true,
  user_metadata:{username,name:process.env.ADMIN_NAME||'관리자',student_number:temporaryStudentNumber,school:'SYSTEM',class_number:'ADMIN',company:'HOESAWASSO',start_date:'2000-01-01',end_date:'2099-12-31'},
});
if(error)throw error;
const {error:profileError}=await client.from('profiles').update({role:'ADMIN',student_number:null,school:null,class_number:null,company:null,start_date:null,end_date:null}).eq('id',data.user.id);
if(profileError){await client.auth.admin.deleteUser(data.user.id);throw profileError;}
const {error:cleanupError}=await client.from('monthly_reports').delete().eq('student_id',data.user.id);
if(cleanupError)throw cleanupError;
console.log(`관리자 계정 생성 완료: ${username}`);
