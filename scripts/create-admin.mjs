import { createClient } from '@supabase/supabase-js';

const required=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','ADMIN_USERNAME','ADMIN_PASSWORD'];
const missing=required.filter(key=>!process.env[key]);
if(missing.length)throw new Error(`필수 환경 변수가 없습니다: ${missing.join(', ')}`);
if(process.env.ADMIN_PASSWORD.length<8)throw new Error('ADMIN_PASSWORD는 8자 이상이어야 합니다.');

const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const username=process.env.ADMIN_USERNAME.trim();
const email=`${username}@hoesawasso.local`;
const name=process.env.ADMIN_NAME||'관리자';

const list=await client.auth.admin.listUsers({page:1,perPage:1000});
if(list.error)throw list.error;
let user=list.data.users.find(item=>item.email?.toLowerCase()===email.toLowerCase());

if(user){
  const updated=await client.auth.admin.updateUserById(user.id,{
    password:process.env.ADMIN_PASSWORD,
    email_confirm:true,
    user_metadata:{...user.user_metadata,username,name},
  });
  if(updated.error)throw updated.error;
  user=updated.data.user;
}else{
  const temporaryStudentNumber=`ADMIN-${crypto.randomUUID()}`;
  const created=await client.auth.admin.createUser({
    email,password:process.env.ADMIN_PASSWORD,email_confirm:true,
    user_metadata:{username,name,student_number:temporaryStudentNumber,school:'SYSTEM',class_number:'ADMIN',company:'HOESAWASSO',start_date:'2000-01-01',end_date:'2099-12-31'},
  });
  if(created.error)throw created.error;
  user=created.data.user;
}

const {data:profile,error:profileLookupError}=await client.from('profiles').select('id').eq('id',user.id).maybeSingle();
if(profileLookupError)throw profileLookupError;
if(!profile){
  const {error:insertError}=await client.from('profiles').insert({id:user.id,username,role:'ADMIN',student_number:null,name,school:null,class_number:null,company:null,start_date:null,end_date:null});
  if(insertError)throw insertError;
}else{
  const {error:profileError}=await client.from('profiles').update({username,name,role:'ADMIN',student_number:null,school:null,class_number:null,company:null,start_date:null,end_date:null}).eq('id',user.id);
  if(profileError)throw profileError;
}

const {error:cleanupError}=await client.from('monthly_reports').delete().eq('student_id',user.id);
if(cleanupError)throw cleanupError;
console.log(`관리자 계정 준비 완료: ${username} (${email})`);
