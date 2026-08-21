import { seedLogs, seedNotifications, seedPeriods, seedReports, seedUsers, Role } from '../data/seed';

const clone = value => structuredClone(value);
let db = { users:clone(seedUsers), logs:clone(seedLogs), reports:clone(seedReports), periods:clone(seedPeriods), notifications:clone(seedNotifications) };
const wait = value => new Promise(resolve=>setTimeout(()=>resolve(clone(value)),120));
const id = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

export const mockRepository = {
  async login(username,password){
    if(!password) throw new Error('비밀번호를 입력해주세요.');
    const user=db.users.find(u=>u.username===username);
    if(!user) throw new Error('계정 정보를 확인해주세요. 데모 계정은 student / admin 입니다.');
    localStorage.setItem('hoesawasso_session',JSON.stringify({userId:user.id}));
    return wait(user);
  },
  async restoreSession(){ const raw=localStorage.getItem('hoesawasso_session'); if(!raw)return null; const {userId}=JSON.parse(raw); return wait(db.users.find(u=>u.id===userId)||null); },
  async logout(){ localStorage.removeItem('hoesawasso_session'); },
  async signup(input){
    if(db.users.some(u=>u.username===input.username)) throw new Error('이미 사용 중인 아이디입니다.');
    const {password:_,...profile}=input; const user={...profile,id:id('student'),role:Role.STUDENT}; db.users.push(user);
    db.reports.push({id:id('report'),studentId:user.id,yearMonth:'2026-08',status:'NOT_STARTED',fileName:null,filePath:null,submittedAt:null});
    return wait(user);
  },
  getUsers(){ return wait(db.users); }, getLogs(){ return wait(db.logs); }, getReports(){ return wait(db.reports); }, getPeriods(){ return wait(db.periods); }, getNotifications(){ return wait(db.notifications); },
  async upsertLogs(logs){ for(const log of logs){ const i=db.logs.findIndex(v=>v.id===log.id); i>=0?db.logs.splice(i,1,clone(log)):db.logs.push({...clone(log),id:id('log')}); } return wait(db.logs); },
  async updateReport(report){ const i=db.reports.findIndex(v=>v.id===report.id); i>=0?db.reports.splice(i,1,clone(report)):db.reports.push({...clone(report),id:id('report')}); return wait(i>=0?db.reports[i]:db.reports.at(-1)); },
  async uploadReport(file,path){ return wait({path:`mock/${path}`,size:file.size}); },
  async createNotification(notification){ const item={...notification,id:id('notice'),createdAt:new Date().toISOString()}; db.notifications.unshift(item); return wait(item); },
  async markNotificationRead(noticeId){ const item=db.notifications.find(n=>n.id===noticeId); if(item)item.isRead=true; return wait(item); },
  async submitReport(reportId){
    const report=db.reports.find(r=>r.id===reportId); if(!report?.filePath)throw new Error('PDF 파일을 먼저 업로드해주세요.');
    report.status='SUBMITTED'; report.submittedAt=new Date().toISOString();
    const student=db.users.find(u=>u.id===report.studentId);
    await this.createNotification({userId:student.id,type:'SUBMITTED',message:'8월 출근부 제출이 완료되었습니다.',isRead:false});
    for(const admin of db.users.filter(u=>u.role===Role.ADMIN)) await this.createNotification({userId:admin.id,type:'SUBMITTED',message:`${student.name} 학생이 8월 출근부를 제출했습니다.`,isRead:false});
    return wait(report);
  },
  async reviewReport(reportId,status){
    const report=db.reports.find(r=>r.id===reportId); if(report?.status!=='SUBMITTED')throw new Error('제출 완료 상태만 검토할 수 있습니다.');
    report.status=status; const student=db.users.find(u=>u.id===report.studentId);
    await this.createNotification({userId:student.id,type:status,message:`8월 출근부가 ${status==='APPROVED'?'승인':'반려'}되었습니다.`,isRead:false});
    return wait(report);
  },
  async sendReminder(studentId){ const student=db.users.find(u=>u.id===studentId); return this.createNotification({userId:student.id,type:'REMINDER',message:`${student.name}님, 8월 출근부를 제출해주세요.`,isRead:false}); },
  async getReportUrl(){ return 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrCg=='; },
};
