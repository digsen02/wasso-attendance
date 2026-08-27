import { repository } from '../repositories';
import { ReportStatus } from '../domain/enums';

export const authService = { login:(u,p)=>repository.login(u,p), logout:()=>repository.logout(), restore:()=>repository.restoreSession(), signup:input=>repository.signup(input) };
export const userService = { list:()=>repository.getUsers(), create:input=>repository.createStudent(input) };
export const attendanceService = { list:()=>repository.getLogs(), save:logs=>repository.upsertLogs(logs) };
export const submissionPeriodService = {
  list:()=>repository.getPeriods(),
  save:(yearMonth,startDate,endDate)=>repository.savePeriod(yearMonth,startDate,endDate),
  dDay(period,now=new Date()) { if(!period)return null; return Math.ceil((new Date(period.endDate)-now)/86400000); },
};
export const notificationService = {
  list:()=>repository.getNotifications(),
  markRead:id=>repository.markNotificationRead(id),
  reminder:(user,yearMonth)=>repository.sendReminder(user.id,yearMonth),
};
export const reportService = {
  list:()=>repository.getReports(),
  async saveDraft(report,logs){ await attendanceService.save(logs); return repository.updateReport({...report,status:ReportStatus.WRITING}); },
  async validatePdf(file){
    if(!file)throw new Error('PDF 파일을 선택해주세요.');
    if(file.type!=='application/pdf'||!file.name.toLowerCase().endsWith('.pdf'))throw new Error('PDF 파일만 업로드할 수 있습니다.');
    if(file.size<=0||file.size>10*1024*1024)throw new Error('파일 크기는 0MB 초과 10MB 이하여야 합니다.');
    const signature=new TextDecoder().decode(await file.slice(0,5).arrayBuffer());
    if(signature!=='%PDF-')throw new Error('유효한 PDF 파일이 아닙니다.');
  },
  async upload(report,file,user){
    await this.validatePdf(file);
    const month=Number(report.yearMonth.split('-')[1]);
    const safe=value=>String(value).replace(/[\\/:*?"<>|]/g,'_').trim();
    const fileName=`출근부 ${month}월 ${safe(user.studentNumber)} ${safe(user.name)}.pdf`;
    const result=await repository.uploadReport(file,`${report.yearMonth}/${user.id}/${fileName}`);
    return repository.updateReport({...report,status:ReportStatus.WRITING,fileName,filePath:result.path});
  },
  downloadUrl:report=>repository.getReportUrl(report.filePath),
  async submit(report,logs){ if(!report.filePath)throw new Error('PDF 파일을 먼저 업로드해주세요.'); await attendanceService.save(logs); return repository.submitReport(report.id); },
  async review(report,student,status,reason){ return repository.reviewReport(report.id,status,reason); },
};
