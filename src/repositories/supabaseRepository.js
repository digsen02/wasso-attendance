import { supabase } from '../lib/supabase';

const ensure = ({data,error}) => { if(error) throw error; return data; };
const profileToUser = p => ({ id:p.id,username:p.username,role:p.role,studentNumber:p.student_number,name:p.name,school:p.school,classNumber:p.class_number,company:p.company,startDate:p.start_date,endDate:p.end_date });
const logFromDb = r => ({id:r.id,studentId:r.student_id,date:r.date,checkIn:r.check_in,checkOut:r.check_out,workSummary:r.work_summary,status:r.status,note:r.note});
const reportFromDb = r => ({id:r.id,studentId:r.student_id,yearMonth:r.year_month,status:r.status,fileName:r.file_name,filePath:r.file_path,submittedAt:r.submitted_at});
const noticeFromDb = n => ({id:n.id,userId:n.user_id,type:n.type,message:n.message,isRead:n.is_read,createdAt:n.created_at});

export const supabaseRepository = {
  async login(username,password){ await supabase.auth.signInWithPassword({email:`${username}@hoesawasso.local`,password}).then(ensure); return this.restoreSession(); },
  async restoreSession(){ const {data:{user}}=await supabase.auth.getUser(); if(!user)return null; const row=ensure(await supabase.from('profiles').select('*').eq('id',user.id).single()); return profileToUser(row); },
  async logout(){ ensure(await supabase.auth.signOut()); },
  async signup(input){ const metadata={username:input.username,role:'STUDENT',student_number:input.studentNumber,name:input.name,school:input.school,class_number:input.classNumber,company:input.company,start_date:input.startDate,end_date:input.endDate}; const auth=ensure(await supabase.auth.signUp({email:`${input.username}@hoesawasso.local`,password:input.password,options:{data:metadata}})); return profileToUser({id:auth.user.id,...metadata}); },
  async getUsers(){ return ensure(await supabase.from('profiles').select('*')).map(profileToUser); },
  async getLogs(){ return ensure(await supabase.from('attendance_logs').select('*').order('date')).map(logFromDb); },
  async getReports(){ return ensure(await supabase.from('monthly_reports').select('*')).map(reportFromDb); },
  async getPeriods(){ const rows=ensure(await supabase.from('submission_periods').select('*')); return rows.map(r=>({id:r.id,yearMonth:r.year_month,startDate:r.start_date,endDate:r.end_date})); },
  async getNotifications(){ return ensure(await supabase.from('notifications').select('*').order('created_at',{ascending:false})).map(noticeFromDb); },
  async upsertLogs(logs){ const rows=logs.map(l=>({id:l.id,student_id:l.studentId,date:l.date,check_in:l.checkIn||null,check_out:l.checkOut||null,work_summary:l.workSummary,status:l.status,note:l.note})); return ensure(await supabase.from('attendance_logs').upsert(rows).select()).map(logFromDb); },
  async updateReport(r){ const row={id:r.id,student_id:r.studentId,year_month:r.yearMonth,status:r.status,file_name:r.fileName,file_path:r.filePath,submitted_at:r.submittedAt}; return reportFromDb(ensure(await supabase.from('monthly_reports').upsert(row).select().single())); },
  async uploadReport(file,path){ const result=ensure(await supabase.storage.from('attendance-reports').upload(path,file,{upsert:true,contentType:'application/pdf'})); return {path:result.path,size:file.size}; },
  async markNotificationRead(id){ return noticeFromDb(ensure(await supabase.from('notifications').update({is_read:true}).eq('id',id).select().single())); },
  async submitReport(reportId){ return reportFromDb(ensure(await supabase.rpc('submit_monthly_report',{p_report_id:reportId}))); },
  async reviewReport(reportId,status){ return reportFromDb(ensure(await supabase.rpc('review_monthly_report',{p_report_id:reportId,p_decision:status,p_reason:null}))); },
  async sendReminder(studentId,yearMonth){ return noticeFromDb(ensure(await supabase.rpc('resend_submission_reminder',{p_student_id:studentId,p_year_month:yearMonth}))); },
  async getDashboard(yearMonth){ return ensure(await supabase.rpc('get_admin_dashboard',{p_year_month:yearMonth})); },
  async getReportUrl(path){ return ensure(await supabase.storage.from('attendance-reports').createSignedUrl(path,60)).signedUrl; },
};
