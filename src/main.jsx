import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowLeft, ArrowRight, Bell, Building2, CalendarDays, Check, CheckCircle2,
  ChevronDown, ChevronRight, CircleAlert, Clock3, Download, Eye, EyeOff,
  FileText, LayoutDashboard, LogOut, Menu, Search, Send, Settings, UploadCloud,
  User, UserPlus, Users, X, BarChart3, ClipboardCheck, BriefcaseBusiness
} from 'lucide-react';
import './styles.css';
import './responsive-fixes.css';

const attendance = [
  ['08.03 월','출근','09:02','18:01','콘텐츠 기획 회의, 레퍼런스 조사',''],
  ['08.04 화','출근','09:01','18:03','프로젝트 회의, 시장 조사',''],
  ['08.05 수','지각','09:28','18:07','자료 정리, 보고서 초안 작성','교통 체증'],
  ['08.06 목','출근','09:00','18:00','디자인 시안 검토, 피드백 정리',''],
  ['08.07 금','출근','09:03','18:05','영상 콘텐츠 촬영 보조',''],
  ['08.10 월','휴가','—','—','연차 사용','연차'],
  ['08.11 화','출근','09:00','18:02','브랜드 리서치, 레퍼런스 정리',''],
  ['08.12 수','출근','09:01','18:00','보고서 작성, 데이터 정리',''],
  ['08.13 목','출근','09:00','18:01','회의록 정리, 자료 취합',''],
  ['08.14 금','지각','09:25','18:02','프로젝트 미팅, 일정 조율','대중교통 지연']
];

const students = [
  ['2023001','김이안','4반','서울디자인대학교','파라고 프로젝트','제출','05.31 23:41'],
  ['2023002','박서준','4반','서울디자인대학교','파라고 프로젝트','제출','05.31 23:28'],
  ['2023003','이재민','4반','서울디자인대학교','파라고 프로젝트','미제출','—'],
  ['2023004','최유리','5반','서울디자인대학교','파라고 프로젝트','제출','05.31 22:59'],
  ['2023005','정민서','5반','서울디자인대학교','모노웍스','미제출','—'],
  ['2023006','한지호','5반','한국예술대학교','모노웍스','제출','05.31 22:31'],
  ['2023007','윤세아','4반','한국예술대학교','그로브 스튜디오','미제출','—'],
  ['2023008','오다은','6반','서울디자인대학교','파라고 프로젝트','제출','05.31 21:48']
];

function Logo({ compact=false }) {
  return <div className={`logo ${compact ? 'compact' : ''}`}><strong>회사와쏘</strong><span>FIELD PRACTICE ATTENDANCE SYSTEM</span></div>;
}

function Button({ children, variant='primary', icon: Icon, onClick, type='button', disabled=false }) {
  return <button type={type} disabled={disabled} onClick={onClick} className={`btn ${variant}`}>{Icon && <Icon size={17}/>}<span>{children}</span></button>;
}

function Status({ value }) {
  const cls = value === '제출' || value === '출근' ? 'success' : value === '지각' ? 'warn' : value === '휴가' ? 'info' : 'neutral';
  return <span className={`status ${cls}`}>{value === '출근' ? 'PRESENT' : value === '지각' ? 'LATE' : value === '휴가' ? 'VACATION' : value}</span>;
}

function Toast({ message }) { return message ? <div className="toast"><CheckCircle2 size={18}/>{message}</div> : null; }

function Footer() {
  return <footer><div><b>회사와쏘</b> FIELD PRACTICE ATTENDANCE SYSTEM<br/><span>© 2026 HOESAWASSO. ALL RIGHTS RESERVED.</span></div><div className="footer-links"><span>이용약관</span><span>개인정보처리방침</span><span>문의하기</span></div></footer>;
}

function AuthHeader() {
  return <header className="auth-header"><Logo/><span>FOR STUDENTS & ADMINISTRATORS</span><span className="support">고객센터&nbsp;&nbsp;02-1234-5678<br/>HELP@HOESAWASSO.KR</span></header>;
}

function Login({ onLogin, onSignup }) {
  const [role,setRole]=useState('student'); const [show,setShow]=useState(false);
  const submit=e=>{e.preventDefault(); onLogin(role)};
  return <div className="page auth-page"><AuthHeader/><section className="auth-hero"><h1>회사와쏘</h1><p>FIELD PRACTICE ATTENDANCE SYSTEM</p></section><main className="login-grid">
    <aside className="auth-copy"><p className="eyebrow">MONTHLY ATTENDANCE</p><h2>이번 달 출근부를<br/>더 간단하게 관리합니다</h2><p>현장실습생과 담당 관리자가 출근부를 쉽고 정확하게 관리할 수 있도록 돕는 서비스입니다.</p><div className="feature-list"><div><CalendarDays/><span><b>간편한 출근 체크</b>PC·모바일에서 손쉽게 기록</span></div><div><BarChart3/><span><b>실시간 현황 확인</b>출근 현황을 한눈에 확인</span></div><div><FileText/><span><b>월별 출근부 관리</b>PDF 생성부터 제출까지</span></div></div></aside>
    <form className="login-form" onSubmit={submit}><div className="role-tabs"><button type="button" className={role==='student'?'active':''} onClick={()=>setRole('student')}>학생 로그인</button><button type="button" className={role==='admin'?'active':''} onClick={()=>setRole('admin')}>관리자 로그인</button></div><div className="form-head"><span className="eyebrow">WELCOME BACK</span><h3>{role==='student'?'학생 계정으로 로그인':'관리자 계정으로 로그인'}</h3><p>데모 화면은 아무 정보나 입력해도 시작할 수 있어요.</p></div><label>아이디<input required placeholder={role==='student'?'학번 또는 아이디':'관리자 아이디'} defaultValue={role==='student'?'2023408':'admin'}/></label><label>비밀번호<div className="input-icon"><input required type={show?'text':'password'} placeholder="비밀번호를 입력하세요" defaultValue="password"/><button type="button" aria-label="비밀번호 보기" onClick={()=>setShow(!show)}>{show?<EyeOff/>:<Eye/>}</button></div></label><div className="login-meta"><label className="check"><input type="checkbox"/> 로그인 유지</label><button type="button">비밀번호 찾기</button></div><Button type="submit">{role==='student'?'학생으로 시작하기':'관리자로 시작하기'} <ArrowRight size={17}/></Button><div className="signup-link">계정이 없으신가요? <button type="button" onClick={onSignup}>학생 회원가입</button></div></form>
    <aside className="schedule"><p className="eyebrow">THIS MONTH</p><h3>이번 달 주요 일정</h3><CalendarDays size={24}/><b>출근부 제출 마감일</b><strong>2026. 08. 31 (월)</strong><span>23:59까지 제출해주세요.</span><div className="note"><CircleAlert size={18}/><b>안내사항</b><p>마감일 이후 제출 시 인정되지 않을 수 있습니다.<br/>출근부는 매일 확인 및 기록해주세요.</p></div></aside>
  </main><Footer/></div>
}

function Signup({ onBack }) {
  const [done,setDone]=useState(false); const submit=e=>{e.preventDefault();setDone(true)};
  return <div className="page auth-page"><AuthHeader/><main className="signup-wrap"><aside><button className="back-link" onClick={onBack}><ArrowLeft/> 로그인으로</button><p className="eyebrow">STUDENT ONLY</p><h1>학생 회원가입</h1><p>정확한 학생 정보와 현장실습 정보를 입력해주세요. 입력한 내용은 출근부 관리에 사용됩니다.</p></aside><form onSubmit={submit} className="signup-form"><h2>회원 정보를 입력하세요.</h2><div className="two-col"><label>아이디<input required placeholder="아이디를 입력하세요"/></label><label>학번<input required placeholder="학번을 입력하세요"/></label><label>비밀번호<input required type="password" placeholder="8자 이상 입력하세요"/></label><label>비밀번호 확인<input required type="password" placeholder="비밀번호를 다시 입력하세요"/></label><label>이름<input required placeholder="이름을 입력하세요"/></label><label>학교<input required placeholder="학교명을 입력하세요"/></label><label>반<input required placeholder="예: 3학년 2반"/></label><label>실습 회사<input required placeholder="회사명을 입력하세요"/></label><label>현장실습 시작일<input required type="date"/></label><label>현장실습 종료일<input required type="date"/></label></div><label className="check agree"><input required type="checkbox"/> 이용약관과 개인정보 처리방침에 동의합니다.</label><Button type="submit">회원가입</Button>{done&&<div className="success-box"><CheckCircle2/><div><b>가입 신청이 완료되었습니다.</b><p>관리자 승인 후 서비스를 이용할 수 있어요.</p></div><button type="button" onClick={onBack}>로그인하기</button></div>}</form></main><Footer/></div>
}

function AppShell({ role, page, setPage, onLogout, children }) {
  const studentNav=[['home','홈',LayoutDashboard],['attendance','출근부',CalendarDays],['profile','내 정보',User]];
  const adminNav=[['dashboard','대시보드',LayoutDashboard],['students','학생 관리',Users],['attendance-admin','출근부 관리',ClipboardCheck]];
  const nav=role==='student'?studentNav:adminNav;
  const [mobile,setMobile]=useState(false);
  return <div className="app-page"><header className="app-header"><Logo compact/><nav>{nav.map(([id,label])=><button key={id} className={page===id?'active':''} onClick={()=>setPage(id)}>{label}</button>)}</nav><div className="account"><Bell/><span><b>{role==='student'?'김회서 학생':'관리자 계정'}</b><small>{role.toUpperCase()}</small></span><ChevronDown/></div><button className="mobile-menu" aria-label="메뉴" onClick={()=>setMobile(!mobile)}>{mobile?<X/>:<Menu/>}</button></header>{mobile&&<div className="mobile-nav">{nav.map(([id,label,Icon])=><button key={id} onClick={()=>{setPage(id);setMobile(false)}}><Icon/>{label}</button>)}<button onClick={onLogout}><LogOut/>로그아웃</button></div>}<div className="app-body">{children}</div><Footer/></div>
}

function StudentHome({ setPage }) {
  return <div className="student-home"><section className="hero-dashboard"><div><p className="eyebrow">AUGUST 2026</p><h1>이번 달 출근부,<br/>제출하셨나요?</h1><p>매월 정해진 기간 내에 출근부를 제출해야 정상 근태로 인정됩니다.</p></div><div className="month-card"><div className="card-title"><div><h2>8월 출근부 <Status value="작성 중"/></h2><p><b>아직 제출하지 않았어요.</b><br/>마감일 전까지 출근부를 작성하고 제출해주세요.</p></div><span className="d-day">D-10</span></div><div className="metric-row"><div><CalendarDays/><span><small>마감일</small><b>2026. 08. 31</b></span></div><div><BarChart3/><span><small>근무 일수</small><b>18 / 22일</b></span></div><div><FileText/><span><small>PDF 상태</small><b>미생성</b></span></div><div><Clock3/><span><small>최근 작성</small><b>오늘 16:35</b></span></div></div><div className="action-row"><Button onClick={()=>setPage('attendance')}>작성 계속 <ArrowRight/></Button><Button variant="outline" onClick={()=>setPage('attendance')}>제출 현황 보기 <ChevronRight/></Button></div></div></section><section className="dashboard-grid"><div className="panel notifications"><div className="panel-head"><h3>최근 알림</h3><button>전체 보기 <ChevronRight/></button></div>{[[Bell,'출근부 제출 마감 안내','8월 출근부 제출 마감일은 08.31 23:59입니다.','08.21'],[FileText,'7월 출근부가 승인되었습니다.','관리자 승인이 완료되었습니다.','08.05'],[CircleAlert,'시스템 점검 안내','08.23 02:00–04:00 점검 예정입니다.','08.18']].map(([Icon,t,d,date])=><div className="notice" key={t}><span><Icon/></span><div><b>{t}</b><p>{d}</p></div><small>{date}</small></div>)}</div><div className="panel company-panel"><div className="panel-head"><h3>인턴십 정보</h3><button>상세 보기 <ChevronRight/></button></div><div className="company-content"><dl><dt>기업명</dt><dd>FARAGO PROJECTS</dd><dt>부서</dt><dd>PRODUCTION</dd><dt>담당자</dt><dd>김태우 팀장</dd><dt>인턴십 기간</dt><dd>2026. 06. 01 – 11. 30</dd></dl><div className="office-art"><Building2/><span>FARAGO<br/>STUDIO</span></div></div></div></section></div>
}

function AttendancePage() {
  const [uploaded,setUploaded]=useState(false), [submitted,setSubmitted]=useState(false), [month,setMonth]=useState(8), [toast,setToast]=useState('');
  const notify=m=>{setToast(m);setTimeout(()=>setToast(''),2400)};
  const upload=()=>{setUploaded(true);notify('파일명이 자동으로 변경되었습니다.')};
  return <div className="workspace"><div className="page-heading"><div><p className="eyebrow">MY ATTENDANCE</p><h1>월별 출근부</h1><p>매일의 근무 기록을 확인하고 PDF 출근부를 제출하세요.</p></div><div className="month-picker"><button onClick={()=>setMonth(m=>Math.max(1,m-1))}><ArrowLeft/></button><CalendarDays/><b>2026. {String(month).padStart(2,'0')}</b><button onClick={()=>setMonth(m=>Math.min(12,m+1))}><ArrowRight/></button></div></div><div className="table-wrap attendance-table"><table><thead><tr><th>날짜</th><th>상태</th><th>출근</th><th>퇴근</th><th>근무 내용</th><th>비고</th></tr></thead><tbody>{attendance.map(r=><tr key={r[0]}>{r.map((v,i)=><td key={i}>{i===1?<Status value={v}/>:v||'—'}</td>)}</tr>)}</tbody></table></div><div className="submission-grid"><section className="panel upload-panel"><div className="panel-head"><h3>PDF 업로드</h3><span>최대 10MB</span></div><input id="pdf-upload" type="file" accept="application/pdf" hidden onChange={upload}/><label htmlFor="pdf-upload" className="dropzone"><UploadCloud/><b>PDF 파일을 드래그하거나 클릭하여 업로드하세요.</b><span>제출 시 규칙에 맞는 파일명으로 자동 변경됩니다.</span></label>{uploaded&&<div className="uploaded-file"><FileText/><span><b>출근부_2026년8월_2023408_김회서.pdf</b><small>1.2 MB · 자동 생성 파일명</small></span><CheckCircle2/></div>}</section><section className="panel submit-panel"><div className="panel-head"><h3>제출 정보</h3><Status value={submitted?'제출':'작성 중'}/></div><dl><dt>제출 기간</dt><dd>08.01 – 08.31</dd><dt>최종 수정</dt><dd>2026.08.21 16:35</dd><dt>제출 횟수</dt><dd>{submitted?'1회':'0회'}</dd></dl><div className="action-row"><Button variant="outline" onClick={()=>notify('임시 저장되었습니다.')}>임시 저장</Button><Button disabled={!uploaded||submitted} onClick={()=>{setSubmitted(true);notify('출근부가 최종 제출되었습니다.')}}>{submitted?'제출 완료':'최종 제출'}</Button></div>{!uploaded&&<p className="helper">PDF 파일을 업로드하면 최종 제출할 수 있어요.</p>}</section></div><Toast message={toast}/></div>
}

function ProfilePage({ onLogout }) {
  return <div className="workspace profile"><div className="page-heading"><div><p className="eyebrow">MY PROFILE</p><h1>학생 프로필</h1><p>내 정보와 현장실습 정보를 확인하고 관리합니다.</p></div><Button variant="outline">정보 수정</Button></div><section className="profile-card"><div className="avatar">김회서</div><div><h2>김회서 <Status value="정상"/></h2><p>서울디자인대학교 · 시각디자인과 3-2</p></div></section><div className="profile-grid"><section className="panel"><h3>기본 정보</h3><dl className="info-list"><dt>학번</dt><dd>2023408</dd><dt>아이디</dt><dd>kimhoesa</dd><dt>이메일</dt><dd>kimhoesa@design.ac.kr</dd><dt>전화번호</dt><dd>010-1234-5678</dd></dl></section><section className="panel"><h3>현장실습 정보</h3><dl className="info-list"><dt>회사</dt><dd>FARAGO PROJECTS</dd><dt>부서</dt><dd>PRODUCTION</dd><dt>담당자</dt><dd>김태우 팀장</dd><dt>실습 기간</dt><dd>2026.06.01 – 11.30</dd></dl></section></div><Button variant="danger" icon={LogOut} onClick={onLogout}>로그아웃</Button></div>
}

function Metric({ label,value,suffix,Icon,tone }) { return <div className={`metric ${tone||''}`}><div><span>{label}</span><strong>{value}<small>{suffix}</small></strong></div><Icon/></div> }

function AdminDashboard({ openStudent, setPage }) {
  return <div className="workspace admin-dashboard"><div className="page-heading"><div><p className="eyebrow">ADMINISTRATION</p><h1>제출 현황 대시보드</h1><p>전체 학생의 출근부 제출 현황을 한눈에 확인하고 관리하세요.</p></div><div className="date-box"><CalendarDays/>2026. 08. 31</div></div><div className="metrics"><Metric label="전체 학생" value="128" suffix="명" Icon={Users}/><Metric label="제출 완료" value="96" suffix="명" Icon={CheckCircle2} tone="green"/><Metric label="미제출" value="32" suffix="명" Icon={CircleAlert} tone="orange"/><Metric label="제출률" value="75.0" suffix="%" Icon={BarChart3}/></div><div className="admin-grid"><section className="panel"><div className="panel-head"><h3>최근 학생 제출 현황</h3><button onClick={()=>setPage('students')}>전체 보기 <ChevronRight/></button></div><StudentTable rows={students.slice(0,6)} onRow={openStudent}/></section><aside className="admin-side"><section className="panel"><h3>반별 제출률</h3>{[['4반',68,34,50],['5반',82.5,33,40],['6반',76,29,38]].map(([c,p,n,t])=><div className="progress-item" key={c}><div><b>{c}</b><span>{p}% ({n}/{t})</span></div><div className="progress"><i style={{width:`${p}%`}}/></div></div>)}</section><section className="panel no-submit"><div className="panel-head"><h3>미제출자 (32명)</h3><Button variant="outline" icon={Send}>알림 보내기</Button></div>{students.filter(s=>s[5]==='미제출').map(s=><div key={s[0]}><span>{s[1]} <small>{s[0]} · {s[2]}</small></span><CircleAlert/></div>)}</section></aside></div></div>
}

function StudentTable({ rows, onRow }) { return <div className="table-wrap"><table><thead><tr><th>학번</th><th>이름</th><th>반</th><th>학교</th><th>회사</th><th>상태</th><th>제출 일시</th></tr></thead><tbody>{rows.map(r=><tr key={r[0]} onClick={()=>onRow(r)}>{r.map((v,i)=><td key={i}>{i===5?<Status value={v}/>:v}</td>)}</tr>)}</tbody></table></div> }

function StudentManagement({ openStudent }) {
  const [filter,setFilter]=useState('전체'),[query,setQuery]=useState('');
  const shown=useMemo(()=>students.filter(s=>(filter==='전체'||s[5]===filter)&&(`${s[0]} ${s[1]}`.includes(query))),[filter,query]);
  return <div className="workspace"><div className="page-heading"><div><p className="eyebrow">STUDENT DIRECTORY</p><h1>학생 관리</h1><p>학생의 제출 상태와 실습 정보를 검색하고 확인합니다.</p></div><Button icon={UserPlus}>학생 추가</Button></div><section className="filter-bar"><div className="segmented">{['전체','제출','미제출'].map(v=><button key={v} className={filter===v?'active':''} onClick={()=>setFilter(v)}>{v}</button>)}</div><label className="search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="이름 또는 학번 검색"/></label><select aria-label="반 필터"><option>전체 반</option><option>4반</option><option>5반</option><option>6반</option></select><Button variant="outline" icon={Download}>엑셀 다운로드</Button></section><section className="panel student-list"><div className="panel-head"><h3>전체 학생 <span>{shown.length}명</span></h3><span>학생 행을 누르면 상세 정보를 확인할 수 있어요.</span></div><StudentTable rows={shown} onRow={openStudent}/></section></div>
}

function AttendanceAdmin({ openStudent }) { return <div className="workspace"><div className="page-heading"><div><p className="eyebrow">REVIEW ATTENDANCE</p><h1>출근부 관리</h1><p>제출된 출근부를 검토하고 승인 또는 반려 처리합니다.</p></div></div><section className="filter-bar"><select><option>전체 학교</option></select><select><option>전체 상태</option><option>제출</option><option>미제출</option></select><div className="date-box"><CalendarDays/>2026. 08</div><span className="filter-result">총 128건의 제출 내역</span></section><section className="panel"><StudentTable rows={[...students].reverse()} onRow={openStudent}/></section></div> }

function StudentModal({ student, onClose }) {
  const [decision,setDecision]=useState('');
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal"><div className="modal-head"><div><p className="eyebrow">SUBMISSION DETAIL</p><h2>출근부 제출 상세</h2></div><button aria-label="닫기" onClick={onClose}><X/></button></div><div className="detail-top"><section><h3>학생 정보</h3><dl><dt>이름</dt><dd>{student[1]}</dd><dt>학번</dt><dd>{student[0]}</dd><dt>학교</dt><dd>{student[3]}</dd><dt>반</dt><dd>{student[2]}</dd></dl></section><section><h3>인턴십 정보</h3><dl><dt>회사</dt><dd>{student[4]}</dd><dt>시작일</dt><dd>2026. 06. 01</dd><dt>종료일</dt><dd>2026. 11. 30</dd><dt>상태</dt><dd><Status value={student[5]}/></dd></dl></section></div><section className="detail-att"><div className="panel-head"><h3>출근 기록</h3><span>총 출근일 18일 · 총 근무시간 144시간</span></div><div className="mini-attendance">{attendance.slice(0,5).map(r=><div key={r[0]}><b>{r[0]}</b><span>{r[2]} – {r[3]}</span><span>{r[4]}</span></div>)}</div></section><div className="file-card"><FileText/><span><b>출근부_2026년8월_{student[0]}_{student[1]}.pdf</b><small>PDF · 1.2 MB</small></span><Download/></div>{decision?<div className={`decision ${decision==='승인'?'approved':'rejected'}`}><CheckCircle2/> {decision} 처리가 완료되었습니다.</div>:<div className="modal-actions"><Button variant="outline" onClick={()=>setDecision('반려')}>반려</Button><Button onClick={()=>setDecision('승인')}>승인</Button></div>}</div></div>
}

function App() {
  const [role,setRole]=useState(null), [auth,setAuth]=useState('login'), [page,setPage]=useState('home'), [selected,setSelected]=useState(null);
  const login=r=>{setRole(r);setPage(r==='student'?'home':'dashboard')};
  if(!role) return auth==='signup'?<Signup onBack={()=>setAuth('login')}/>:<Login onLogin={login} onSignup={()=>setAuth('signup')}/>;
  const logout=()=>{setRole(null);setAuth('login')};
  let content;
  if(role==='student') content=page==='attendance'?<AttendancePage/>:page==='profile'?<ProfilePage onLogout={logout}/>:<StudentHome setPage={setPage}/>;
  else content=page==='students'?<StudentManagement openStudent={setSelected}/>:page==='attendance-admin'?<AttendanceAdmin openStudent={setSelected}/>:<AdminDashboard openStudent={setSelected} setPage={setPage}/>;
  return <AppShell role={role} page={page} setPage={setPage} onLogout={logout}>{content}{selected&&<StudentModal student={selected} onClose={()=>setSelected(null)}/>}</AppShell>;
}

createRoot(document.getElementById('root')).render(<App/>);
