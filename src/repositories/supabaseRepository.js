import { supabase } from '../lib/supabase';

const ensure = ({data,error}) => { if(error) throw error; return data; };
const profileToUser = p => ({ id:p.id,username:p.username,role:p.role,studentNumber:p.student_number,name:p.name,school:p.school,classNumber:p.class_number,company:p.company,startDate:p.start_date,endDate:p.end_date,contactEmail:p.contact_email||'',phone:p.phone||'',department:p.department||'',managerName:p.manager_name||'',managerContact:p.manager_contact||'',internshipType:p.internship_type||'현장실습',workSchedule:p.work_schedule||'주 5일 · 09:00–18:00',notificationEnabled:p.notification_enabled!==false,createdAt:p.created_at,updatedAt:p.updated_at });
const logFromDb = r => ({id:r.id,studentId:r.student_id,date:r.date,checkIn:r.check_in,checkOut:r.check_out,workSummary:r.work_summary,status:r.status,note:r.note,createdAt:r.created_at,updatedAt:r.updated_at});
const reportFromDb = r => ({id:r.id,studentId:r.student_id,yearMonth:r.year_month,status:r.status,fileName:r.file_name,filePath:r.file_path,submittedAt:r.submitted_at,reviewedAt:r.reviewed_at,reviewedBy:r.reviewed_by,rejectionReason:r.rejection_reason,submissionCount:r.submission_count||0,createdAt:r.created_at,updatedAt:r.updated_at});
const noticeFromDb = n => ({id:n.id,userId:n.user_id,type:n.type,message:n.message,isRead:n.is_read,createdAt:n.created_at});
const historyFromDb = h => ({id:h.id,reportId:h.report_id,studentId:h.student_id,yearMonth:h.year_month,previousStatus:h.previous_status,status:h.status,reason:h.reason,actorId:h.actor_id,createdAt:h.created_at});

export const supabaseRepository = {
  async login(username,password,expectedRole){ await supabase.auth.signInWithPassword({email:`${username}@hoesawasso.local`,password}).then(ensure); const profile=await this.restoreSession(); if(expectedRole&&profile.role!==expectedRole){ await supabase.auth.signOut(); throw new Error(`선택한 ${expectedRole==='ADMIN'?'관리자':'학생'} 로그인 유형과 계정 권한이 일치하지 않습니다.`); } return profile; },
  async restoreSession(){ const {data:{user}}=await supabase.auth.getUser(); if(!user)return null; const row=ensure(await supabase.from('profiles').select('*').eq('id',user.id).single()); return profileToUser(row); },
  async logout(){ ensure(await supabase.auth.signOut()); },
  async signup(input){ const metadata={username:input.username,role:'STUDENT',student_number:input.studentNumber,name:input.name,school:input.school,class_number:input.classNumber,company:input.company,start_date:input.startDate,end_date:input.endDate}; const auth=ensure(await supabase.auth.signUp({email:`${input.username}@hoesawasso.local`,password:input.password,options:{data:metadata}})); return profileToUser({id:auth.user.id,...metadata}); },
  async createStudent(input){ const data=ensure(await supabase.functions.invoke('create-student',{body:input})); return profileToUser(data.profile); },
  async getUsers(){ return ensure(await supabase.from('profiles').select('*')).map(profileToUser); },
  async getLogs(){ return ensure(await supabase.from('attendance_logs').select('*').order('date')).map(logFromDb); },
  async getReports(){ return ensure(await supabase.from('monthly_reports').select('*')).map(reportFromDb); },
  async getPeriods(){ const rows=ensure(await supabase.from('submission_periods').select('*')); return rows.map(r=>({id:r.id,yearMonth:r.year_month,startDate:r.start_date,endDate:r.end_date})); },
  async getNotifications(){ return ensure(await supabase.from('notifications').select('*').order('created_at',{ascending:false})).map(noticeFromDb); },
  async getReportHistory(){ return ensure(await supabase.from('report_status_history').select('*').order('created_at',{ascending:false})).map(historyFromDb); },
  async upsertLogs(logs){ if(!logs.length)return []; const rows=logs.map(l=>({id:l.id,student_id:l.studentId,date:l.date,check_in:l.checkIn||null,check_out:l.checkOut||null,work_summary:l.workSummary,status:l.status,note:l.note})); return ensure(await supabase.from('attendance_logs').upsert(rows).select()).map(logFromDb); },
  async updateReport(r){ return reportFromDb(ensure(await supabase.rpc('save_monthly_report_draft',{p_report_id:r.id,p_file_name:r.fileName||null,p_file_path:r.filePath||null}))); },
  async uploadReport(file,path){ const result=ensure(await supabase.storage.from('attendance-reports').upload(path,file,{upsert:true,contentType:'application/pdf'})); return {path:result.path,size:file.size}; },
  async markNotificationRead(id){ return noticeFromDb(ensure(await supabase.from('notifications').update({is_read:true}).eq('id',id).select().single())); },
  async submitReport(reportId){ return reportFromDb(ensure(await supabase.rpc('submit_monthly_report',{p_report_id:reportId}))); },
  async reviewReport(reportId,status,reason){ return reportFromDb(ensure(await supabase.rpc('review_monthly_report',{p_report_id:reportId,p_decision:status,p_reason:reason||null}))); },
  async sendReminder(studentId,yearMonth){ return noticeFromDb(ensure(await supabase.rpc('resend_submission_reminder',{p_student_id:studentId,p_year_month:yearMonth}))); },
  async sendBulkReminders(yearMonth){ return ensure(await supabase.rpc('send_bulk_submission_reminders',{p_year_month:yearMonth})); },
  async updateMyProfile(input){ return profileToUser(ensure(await supabase.rpc('update_my_profile',{p_name:input.name,p_contact_email:input.contactEmail||null,p_phone:input.phone||null,p_notification_enabled:input.notificationEnabled}))); },
  async updateStudent(input){ return profileToUser(ensure(await supabase.rpc('update_student_profile',{p_student_id:input.id,p_name:input.name,p_student_number:input.studentNumber,p_school:input.school,p_class_number:input.classNumber,p_company:input.company,p_start_date:input.startDate,p_end_date:input.endDate,p_department:input.department||null,p_manager_name:input.managerName||null,p_manager_contact:input.managerContact||null,p_internship_type:input.internshipType||'현장실습',p_work_schedule:input.workSchedule||'주 5일 · 09:00–18:00',p_contact_email:input.contactEmail||null,p_phone:input.phone||null}))); },
  async changePassword(password){ return ensure(await supabase.auth.updateUser({password})).user; },
  async savePeriod(yearMonth,startDate,endDate){ const row=ensure(await supabase.rpc('manage_submission_period',{p_year_month:yearMonth,p_start_date:startDate,p_end_date:endDate})); return {id:row.id,yearMonth:row.year_month,startDate:row.start_date,endDate:row.end_date}; },
  async getDashboard(yearMonth){ return ensure(await supabase.rpc('get_admin_dashboard',{p_year_month:yearMonth})); },
  async getReportUrl(path){ return ensure(await supabase.storage.from('attendance-reports').createSignedUrl(path,60)).signedUrl; },
};
