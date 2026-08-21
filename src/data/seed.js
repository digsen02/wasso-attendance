export const Role = { STUDENT: 'STUDENT', ADMIN: 'ADMIN' };
export const AttendanceStatus = { PRESENT: 'PRESENT', LATE: 'LATE', ABSENT: 'ABSENT', VACATION: 'VACATION' };
export const ReportStatus = { NOT_STARTED: 'NOT_STARTED', WRITING: 'WRITING', SUBMITTED: 'SUBMITTED', APPROVED: 'APPROVED', REJECTED: 'REJECTED' };
export const NotificationType = { REMINDER: 'REMINDER', SUBMITTED: 'SUBMITTED', APPROVED: 'APPROVED', REJECTED: 'REJECTED' };

export const seedUsers = [
  { id:'admin-1', username:'admin', role:Role.ADMIN, studentNumber:null, name:'관리자', school:null, classNumber:null, company:null, startDate:null, endDate:null },
  { id:'student-1', username:'student', role:Role.STUDENT, studentNumber:'2023408', name:'김회서', school:'서울디자인대학교', classNumber:'4반', company:'FARAGO PROJECTS', startDate:'2026-06-01', endDate:'2026-11-30' },
  { id:'student-2', username:'2023002', role:Role.STUDENT, studentNumber:'2023002', name:'박서준', school:'서울디자인대학교', classNumber:'4반', company:'FARAGO PROJECTS', startDate:'2026-06-01', endDate:'2026-11-30' },
  { id:'student-3', username:'2023003', role:Role.STUDENT, studentNumber:'2023003', name:'이재민', school:'서울디자인대학교', classNumber:'4반', company:'FARAGO PROJECTS', startDate:'2026-06-01', endDate:'2026-11-30' },
  { id:'student-4', username:'2023004', role:Role.STUDENT, studentNumber:'2023004', name:'최유리', school:'서울디자인대학교', classNumber:'5반', company:'MONO WORKS', startDate:'2026-06-01', endDate:'2026-11-30' },
  { id:'student-5', username:'2023005', role:Role.STUDENT, studentNumber:'2023005', name:'정민서', school:'한국예술대학교', classNumber:'5반', company:'MONO WORKS', startDate:'2026-07-01', endDate:'2026-12-31' },
  { id:'student-6', username:'2023006', role:Role.STUDENT, studentNumber:'2023006', name:'한지호', school:'한국예술대학교', classNumber:'5반', company:'GROVE STUDIO', startDate:'2026-07-01', endDate:'2026-12-31' },
  { id:'student-7', username:'2023007', role:Role.STUDENT, studentNumber:'2023007', name:'윤세아', school:'서울디자인대학교', classNumber:'6반', company:'GROVE STUDIO', startDate:'2026-07-01', endDate:'2026-12-31' },
];

const baseLogs = [
  ['03','PRESENT','09:02','18:01','콘텐츠 기획 회의, 레퍼런스 조사',''], ['04','PRESENT','09:01','18:03','프로젝트 회의, 시장 조사',''],
  ['05','LATE','09:28','18:07','자료 정리, 보고서 초안 작성','교통 체증'], ['06','PRESENT','09:00','18:00','디자인 시안 검토, 피드백 정리',''],
  ['07','PRESENT','09:03','18:05','영상 콘텐츠 촬영 보조',''], ['10','VACATION','','','연차 사용','연차'],
  ['11','PRESENT','09:00','18:02','브랜드 리서치, 레퍼런스 정리',''], ['12','PRESENT','09:01','18:00','보고서 작성, 데이터 정리',''],
];
export const seedLogs = seedUsers.filter(u=>u.role===Role.STUDENT).flatMap(u=>baseLogs.map((r,i)=>({ id:`log-${u.id}-${i}`,studentId:u.id,date:`2026-08-${r[0]}`,status:r[1],checkIn:r[2],checkOut:r[3],workSummary:r[4],note:r[5] })));
export const seedReports = [
  { id:'report-1',studentId:'student-1',yearMonth:'2026-08',status:ReportStatus.WRITING,fileName:null,filePath:null,submittedAt:null },
  { id:'report-2',studentId:'student-2',yearMonth:'2026-08',status:ReportStatus.SUBMITTED,fileName:'출근부 8월 2023002 박서준.pdf',filePath:'mock/report-2.pdf',submittedAt:'2026-08-21T14:21:00+09:00' },
  { id:'report-3',studentId:'student-3',yearMonth:'2026-08',status:ReportStatus.NOT_STARTED,fileName:null,filePath:null,submittedAt:null },
  { id:'report-4',studentId:'student-4',yearMonth:'2026-08',status:ReportStatus.APPROVED,fileName:'출근부 8월 2023004 최유리.pdf',filePath:'mock/report-4.pdf',submittedAt:'2026-08-20T22:59:00+09:00' },
  { id:'report-5',studentId:'student-5',yearMonth:'2026-08',status:ReportStatus.NOT_STARTED,fileName:null,filePath:null,submittedAt:null },
  { id:'report-6',studentId:'student-6',yearMonth:'2026-08',status:ReportStatus.REJECTED,fileName:'출근부 8월 2023006 한지호.pdf',filePath:'mock/report-6.pdf',submittedAt:'2026-08-19T22:31:00+09:00' },
  { id:'report-7',studentId:'student-7',yearMonth:'2026-08',status:ReportStatus.SUBMITTED,fileName:'출근부 8월 2023007 윤세아.pdf',filePath:'mock/report-7.pdf',submittedAt:'2026-08-21T13:47:00+09:00' },
];
export const seedPeriods = [{ id:'period-1',yearMonth:'2026-08',startDate:'2026-08-01T00:00:00+09:00',endDate:'2026-08-31T23:59:59+09:00' }];
export const seedNotifications = [
  { id:'notice-1',userId:'student-1',type:NotificationType.REMINDER,message:'8월 출근부 제출 기간이 시작되었습니다.',isRead:false,createdAt:'2026-08-01T09:00:00+09:00' },
  { id:'notice-2',userId:'student-1',type:NotificationType.APPROVED,message:'7월 출근부가 승인되었습니다.',isRead:true,createdAt:'2026-08-05T09:15:00+09:00' },
  { id:'notice-3',userId:'admin-1',type:NotificationType.SUBMITTED,message:'박서준 학생이 8월 출근부를 제출했습니다.',isRead:false,createdAt:'2026-08-21T14:21:00+09:00' },
];
