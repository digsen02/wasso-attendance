import { repository } from '../repositories';
import { ReportStatus } from '../data/seed';

export const authService = { login:(u,p)=>repository.login(u,p), logout:()=>repository.logout(), restore:()=>repository.restoreSession(), signup:input=>repository.signup(input) };
export const userService = { list:()=>repository.getUsers() };
export const attendanceService = { list:()=>repository.getLogs(), save:logs=>repository.upsertLogs(logs) };
export const submissionPeriodService = { list:()=>repository.getPeriods(), dDay(period,now=new Date()) { if(!period)return null; return Math.ceil((new Date(period.endDate)-now)/86400000); } };
export const notificationService = {
  list:()=>repository.getNotifications(), markRead:id=>repository.markNotificationRead(id),
  reminder:user=>repository.sendReminder(user.id,'2026-08'),
};
export const reportService = {
  list:()=>repository.getReports(),
  async saveDraft(report,logs){ await attendanceService.save(logs); return repository.updateReport({...report,status:ReportStatus.WRITING}); },
  validatePdf(file){ if(!file)throw new Error('PDF 파일을 선택해주세요.'); if(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf'))throw new Error('PDF 파일만 업로드할 수 있습니다.'); if(file.size>10*1024*1024)throw new Error('파일 크기는 10MB 이하여야 합니다.'); },
  async upload(report,file,user){ this.validatePdf(file); const month=Number(report.yearMonth.split('-')[1]); const fileName=`출근부 ${month}월 ${user.studentNumber} ${user.name}.pdf`; const result=await repository.uploadReport(file,`${report.yearMonth}/${user.id}/${fileName}`); return repository.updateReport({...report,status:ReportStatus.WRITING,fileName,filePath:result.path}); },
  downloadUrl:report=>repository.getReportUrl(report.filePath),
  async submit(report,logs){ if(!report.filePath)throw new Error('PDF 파일을 먼저 업로드해주세요.'); await attendanceService.save(logs); return repository.submitReport(report.id); },
  async review(report,student,status){ return repository.reviewReport(report.id,status); },
};
