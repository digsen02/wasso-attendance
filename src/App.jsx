import { useEffect, useMemo, useRef, useState } from "react";
import {
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Send,
  Settings,
  UploadCloud,
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useApp } from "./context/AppContext";
import { AttendanceStatus, ReportStatus, Role } from "./domain/enums";
import { formatDateTime, getDday, statusMeta } from "./utils/format";
import { PASSWORD_MIN_LENGTH, validateInternshipDates, validatePassword } from "./utils/validation";

const today = new Date();
const systemMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
const shiftMonth = (yearMonth, amount) => {
  const [year, month] = yearMonth.split("-").map(Number);
  const value = new Date(year, month - 1 + amount, 1);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
};
const monthLabel = (yearMonth) => yearMonth.replace("-", ". ");
const monthEndLabel = (yearMonth) => {
  const [year, month] = yearMonth.split("-").map(Number);
  return `${year}. ${String(month).padStart(2, "0")}. ${new Date(year, month, 0).getDate()}`;
};
const periodLabel = (period) => period
  ? `${formatDateTime(period.startDate)} ~ ${formatDateTime(period.endDate)}`
  : "제출 기간 미설정";
const weekday = (date) => `${["일", "월", "화", "수", "목", "금", "토"][new Date(`${date}T00:00:00`).getDay()]}요일`;
const workMinutes = (log) => {
  if (!log.checkIn || !log.checkOut) return 0;
  const [ih, im] = log.checkIn.split(":").map(Number);
  const [oh, om] = log.checkOut.split(":").map(Number);
  return Math.max(0, oh * 60 + om - ih * 60);
};
const durationLabel = (minutes) => minutes ? `${Math.floor(minutes / 60)}시간 ${minutes % 60 ? `${minutes % 60}분` : ""}`.trim() : "—";
const latestAt = (items) => items.map((v) => v?.updatedAt || v?.createdAt).filter(Boolean).sort().at(-1);
const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

function Pagination({ page, total, pageSize, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return <div className="pagination"><button disabled={page <= 1} onClick={() => onChange(page - 1)}>이전</button><span>{page} / {pages}</span><button disabled={page >= pages} onClick={() => onChange(page + 1)}>다음</button></div>;
}
function Logo() {
  return (
    <div className="logo">
      <strong>회사와쏘</strong>
      <span>FIELD PRACTICE ATTENDANCE SYSTEM</span>
    </div>
  );
}
function Button({ children, variant = "primary", icon: Icon, ...props }) {
  return (
    <button className={`btn ${variant}`} {...props}>
      {Icon && <Icon size={17} />}
      <span>{children}</span>
    </button>
  );
}
function MonthPicker() {
  const { state, actions } = useApp();
  return (
    <div className="month-picker">
      <button aria-label="이전 달" onClick={() => actions.selectMonth(shiftMonth(state.selectedMonth, -1))}><ArrowLeft /></button>
      <CalendarDays />
      <b>{monthLabel(state.selectedMonth)}</b>
      <button aria-label="다음 달" onClick={() => actions.selectMonth(shiftMonth(state.selectedMonth, 1))}><ArrowRight /></button>
    </div>
  );
}
function Status({ value }) {
  const meta = statusMeta[value] || { label: value, tone: "neutral" };
  return (
    <span className={`status ${meta.tone}`}>
      <CheckCircle2 size={11} />
      {meta.label}
    </span>
  );
}
function Footer() {
  return (
    <footer>
      <div>
        <b>회사와쏘</b> FIELD PRACTICE ATTENDANCE SYSTEM
        <br />
        <span>© 2026 HOESAWASSO. ALL RIGHTS RESERVED.</span>
      </div>
      <div className="footer-links">
        <span>이용약관</span>
        <span>개인정보처리방침</span>
        <span>문의하기</span>
      </div>
    </footer>
  );
}
function Toast() {
  const { state } = useApp();
  return state.toast ? (
    <div className={`toast ${state.toast.kind}`}>
      <CheckCircle2 size={18} />
      {state.toast.message}
    </div>
  ) : null;
}
function Loading() {
  return (
    <div className="loading-screen">
      <span className="spinner" />
      <b>데이터를 불러오고 있습니다.</b>
    </div>
  );
}
function Empty({ title = "표시할 데이터가 없습니다.", description }) {
  return (
    <div className="empty-state">
      <FileText />
      <b>{title}</b>
      {description && <p>{description}</p>}
    </div>
  );
}

function Protected({ role, children }) {
  const { state } = useApp();
  const location = useLocation();
  if (!state.ready) return <Loading />;
  if (!state.currentUser)
    return <Navigate to="/login" replace state={{ from: location }} />;
  if (role && state.currentUser.role !== role)
    return (
      <Navigate
        to={
          state.currentUser.role === Role.ADMIN
            ? "/admin/dashboard"
            : "/student"
        }
        replace
      />
    );
  return children;
}

function NotificationPanel({ onClose }) {
  const { state, actions } = useApp();
  const items = state.notifications.filter(
    (n) => n.userId === state.currentUser.id,
  );
  return (
    <div className="notification-panel">
      <div className="panel-head">
        <h3>알림</h3>
        <button aria-label="알림 닫기" onClick={onClose}>
          <X />
        </button>
      </div>
      {items.length ? (
        items.map((n) => (
          <button
            key={n.id}
            className={`notification-item ${n.isRead ? "" : "unread"}`}
            onClick={() => actions.markRead(n.id)}
          >
            <span>
              <Bell />
            </span>
            <div>
              <b>{statusMeta[n.type]?.label || n.type}</b>
              <p>{n.message}</p>
              <small>{formatDateTime(n.createdAt)}</small>
            </div>
            {!n.isRead && <i />}
          </button>
        ))
      ) : (
        <Empty title="새로운 알림이 없습니다." />
      )}
    </div>
  );
}

function Shell({ role, children }) {
  const { state, actions } = useApp();
  const [menu, setMenu] = useState(false),
    [notices, setNotices] = useState(false);
  const navigate = useNavigate();
  const nav =
    role === Role.STUDENT
      ? [
          ["/student", "홈", LayoutDashboard],
          ["/student/attendance", "출근부", CalendarDays],
          ["/student/profile", "내 정보", User],
        ]
      : [
          ["/admin/dashboard", "대시보드", LayoutDashboard],
          ["/admin/students", "학생 관리", Users],
          ["/admin/attendance", "출근부 관리", CalendarDays],
          ["/admin/reports", "보고서", BarChart3],
          ["/admin/settings", "설정", Settings],
        ];
  const unread = state.notifications.filter(
    (n) => n.userId === state.currentUser.id && !n.isRead,
  ).length;
  const logout = async () => {
    await actions.logout();
    navigate("/login");
  };
  return (
    <div className="app-page">
      <header className="app-header">
        <Logo />
        <nav>
          {nav.map(([to, label]) => (
            <NavLink key={to} end={to === "/student"} to={to}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="account">
          <button
            className="bell-button"
            aria-label="알림"
            onClick={() => setNotices(!notices)}
          >
            <Bell />
            {unread > 0 && <i>{unread}</i>}
          </button>
          <span>
            <b>{state.currentUser.name}</b>
            <small>{role}</small>
          </span>
          <button aria-label="로그아웃" onClick={logout}>
            <LogOut />
          </button>
        </div>
        <button
          className="mobile-menu"
          aria-label="메뉴"
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X /> : <Menu />}
        </button>
      </header>
      {menu && (
        <div className="mobile-nav">
          {nav.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} onClick={() => setMenu(false)}>
              <Icon />
              {label}
            </NavLink>
          ))}
          <button onClick={logout}>
            <LogOut />
            로그아웃
          </button>
        </div>
      )}
      {notices && <NotificationPanel onClose={() => setNotices(false)} />}
      <main className="app-body">{children}</main>
      <Footer />
      <Toast />
    </div>
  );
}

function AuthLayout({ children }) {
  return (
    <div className="page auth-page">
      <header className="auth-header">
        <Logo />
        <span>FOR STUDENTS & ADMINISTRATORS</span>
        <span className="support">
          고객센터 02-1234-5678
          <br />
          HELP@HOESAWASSO.KR
        </span>
      </header>
      <section className="auth-hero">
        <h1>회사와쏘</h1>
        <p>FIELD PRACTICE ATTENDANCE SYSTEM</p>
      </section>
      {children}
      <Footer />
      <Toast />
    </div>
  );
}
function Login() {
  const { state, actions } = useApp();
  const [role, setRole] = useState(Role.STUDENT),
    [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [show, setShow] = useState(false);
  const navigate = useNavigate();
  if (state.ready && state.currentUser)
    return (
      <Navigate
        to={
          state.currentUser.role === Role.ADMIN
            ? "/admin/dashboard"
            : "/student"
        }
        replace
      />
    );
  const choose = (r) => setRole(r);
  const submit = async (e) => {
    e.preventDefault();
    try {
      const user = await actions.login(username, password, role);
      navigate(user.role === Role.ADMIN ? "/admin/dashboard" : "/student", {
        replace: true,
      });
    } catch {}
  };
  return (
    <AuthLayout>
      <main className="login-grid">
        <aside className="auth-copy">
          <p className="eyebrow">MONTHLY ATTENDANCE</p>
          <h2>
            이번 달 출근부를
            <br />더 간단하게 관리합니다
          </h2>
          <p>
            현장실습생과 담당 관리자가 출근부를 쉽고 정확하게 관리할 수 있도록
            돕는 서비스입니다.
          </p>
          <div className="feature-list">
            <div>
              <CalendarDays />
              <span>
                <b>간편한 출근 체크</b>매일의 근무 기록 관리
              </span>
            </div>
            <div>
              <BarChart3 />
              <span>
                <b>실시간 제출 현황</b>계산된 통계를 한눈에 확인
              </span>
            </div>
            <div>
              <FileText />
              <span>
                <b>안전한 PDF 제출</b>검증부터 알림까지
              </span>
            </div>
          </div>
        </aside>
        <form className="login-form" onSubmit={submit}>
          <div className="role-tabs">
            <button
              type="button"
              className={role === Role.STUDENT ? "active" : ""}
              onClick={() => choose(Role.STUDENT)}
            >
              학생 로그인
            </button>
            <button
              type="button"
              className={role === Role.ADMIN ? "active" : ""}
              onClick={() => choose(Role.ADMIN)}
            >
              관리자 로그인
            </button>
          </div>
          <div className="form-head">
            <span className="eyebrow">SUPABASE DATA SOURCE</span>
            <h3>
              {role === Role.STUDENT
                ? "학생 계정으로 로그인"
                : "관리자 계정으로 로그인"}
            </h3>
            <p>Supabase Auth에 등록된 계정으로 로그인해주세요.</p>
          </div>
          <label>
            아이디
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
          <label>
            비밀번호
            <div className="input-icon">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                type={show ? "text" : "password"}
              />
              <button
                type="button"
                aria-label="비밀번호 보기"
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </label>
          {state.error && (
            <div className="form-error">
              <CircleAlert />
              {state.error}
            </div>
          )}
          <Button type="submit" disabled={state.loading}>
            {state.loading
              ? "로그인 중..."
              : role === Role.STUDENT
                ? "학생으로 시작하기"
                : "관리자로 시작하기"}
            <ArrowRight />
          </Button>
          <div className="signup-link">
            계정이 없으신가요? <NavLink to="/signup">학생 회원가입</NavLink>
          </div>
        </form>
        <aside className="schedule">
          <p className="eyebrow">THIS MONTH</p>
          <h3>이번 달 주요 일정</h3>
          <CalendarDays />
          <b>출근부 제출 마감일</b>
          <strong>{monthEndLabel(systemMonth)}</strong>
          <span>23:59까지 제출해주세요.</span>
          <div className="note">
            <CircleAlert />
            <b>안내사항</b>
            <p>마감 후 제출은 인정되지 않을 수 있습니다.</p>
          </div>
        </aside>
      </main>
    </AuthLayout>
  );
}
function Signup() {
  const { actions } = useApp();
  const navigate = useNavigate();
  const submit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      validatePassword(data.password);
      validateInternshipDates(data.startDate, data.endDate);
      await actions.signup(data);
      navigate("/login");
    } catch {}
  };
  return (
    <AuthLayout>
      <main className="signup-wrap">
        <aside>
          <NavLink className="back-link" to="/login">
            <ArrowLeft />
            로그인으로
          </NavLink>
          <p className="eyebrow">STUDENT ONLY</p>
          <h1>학생 회원가입</h1>
          <p>학생 정보와 실제 현장실습 정보를 정확히 입력해주세요.</p>
        </aside>
        <form className="signup-form" onSubmit={submit}>
          <h2>회원 정보를 입력하세요.</h2>
          <div className="two-col">
            {[
              ["username", "아이디", "student2"],
              ["password", "비밀번호", "8자 이상"],
              ["studentNumber", "학번", "2023999"],
              ["name", "이름", "홍길동"],
              ["school", "학교", "학교명"],
              ["classNumber", "반", "4반"],
              ["company", "실습 회사", "회사명"],
            ].map(([name, label, placeholder]) => (
              <label key={name}>
                {label}
                <input
                  name={name}
                  type={name === "password" ? "password" : "text"}
                  minLength={name === "password" ? PASSWORD_MIN_LENGTH : undefined}
                  placeholder={placeholder}
                  required
                />
              </label>
            ))}
            <label>
              실습 시작일
              <input name="startDate" type="date" required />
            </label>
            <label>
              실습 종료일
              <input name="endDate" type="date" required />
            </label>
          </div>
          <label className="check agree">
            <input type="checkbox" required />
            이용약관과 개인정보처리방침에 동의합니다.
          </label>
          <Button type="submit">회원가입</Button>
        </form>
      </main>
    </AuthLayout>
  );
}

function PageHead({ eyebrow, title, description, children }) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
function StudentHome() {
  const { state } = useApp();
  const navigate = useNavigate();
  const report = state.reports.find(
    (r) => r.studentId === state.currentUser.id && r.yearMonth === state.selectedMonth,
  );
  const logs = state.logs.filter(
    (l) =>
      l.studentId === state.currentUser.id && l.date.startsWith(state.selectedMonth),
  );
  const period = state.periods.find((p) => p.yearMonth === state.selectedMonth);
  const completedDays = logs.filter((l) => [AttendanceStatus.PRESENT, AttendanceStatus.LATE].includes(l.status) && l.checkIn && l.checkOut).length;
  const lastEdit = latestAt([...logs, report]);
  const actionLabel = [ReportStatus.SUBMITTED, ReportStatus.APPROVED].includes(report?.status) ? "제출 내역 보기" : report?.status === ReportStatus.REJECTED ? "반려 내용 수정" : "출근부 작성";
  return (
    <Shell role={Role.STUDENT}>
      <div className="student-home">
        <MonthPicker />
        <section className="hero-dashboard">
          <div>
            <p className="eyebrow">{monthLabel(state.selectedMonth)}</p>
            <h1>
              이번 달 출근부,
              <br />
              제출하셨나요?
            </h1>
            <p>
              매월 정해진 기간 내에 출근부를 제출해야 정상 근태로 인정됩니다.
            </p>
          </div>
          <div className="month-card">
            <div className="card-title">
              <div>
                <h2>
                  {Number(state.selectedMonth.slice(5))}월 출근부{" "}
                  <Status value={report?.status || ReportStatus.NOT_STARTED} />
                </h2>
                <p>
                  {report?.status === ReportStatus.SUBMITTED
                    ? "제출이 완료되었습니다."
                    : "마감일 전까지 출근부를 작성하고 제출해주세요."}
                </p>
              </div>
              <span className="d-day">D-{getDday(period) ?? "-"}</span>
            </div>
            <div className="metric-row">
              <div>
                <CalendarDays />
                <span>
                  <small>마감일</small>
                  <b>{period ? formatDateTime(period.endDate) : "미설정"}</b>
                </span>
              </div>
              <div>
                <BarChart3 />
                <span>
                  <small>완료 근무일</small>
                  <b>{completedDays} / {logs.length}일</b>
                </span>
              </div>
              <div>
                <FileText />
                <span>
                  <small>PDF 상태</small>
                  <b>{report?.fileName ? "업로드" : "미업로드"}</b>
                </span>
              </div>
              <div>
                <Clock3 />
                <span>
                  <small>최근 수정</small>
                  <b>{formatDateTime(lastEdit)}</b>
                </span>
              </div>
            </div>
            <div className="action-row">
              <Button onClick={() => navigate("/student/attendance")}>
                {actionLabel} <ArrowRight />
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/student/profile")}
              >
                내 정보 <ChevronRight />
              </Button>
            </div>
          </div>
        </section>
        <section className="dashboard-grid">
          <div className="panel notifications">
            <div className="panel-head">
              <h3>최근 알림</h3>
              <button onClick={() => navigate("/student/profile#activity")}>전체 보기 <ChevronRight /></button>
            </div>
            {state.notifications
              .filter((n) => n.userId === state.currentUser.id)
              .slice(0, 3)
              .map((n) => (
                <div className="notice" key={n.id}>
                  <span>
                    <Bell />
                  </span>
                  <div>
                    <b>{n.message}</b>
                    <p>{formatDateTime(n.createdAt)}</p>
                  </div>
                  {!n.isRead && <i className="unread-dot" />}
                </div>
              ))}
          </div>
          <div className="panel company-panel">
            <div className="panel-head">
              <h3>인턴십 정보</h3>
            </div>
            <div className="company-content">
              <dl>
                <dt>기업명</dt>
                <dd>{state.currentUser.company}</dd>
                <dt>실습 부서</dt>
                <dd>{state.currentUser.department || "미등록"}</dd>
                <dt>담당자</dt>
                <dd>{state.currentUser.managerName || "미등록"}{state.currentUser.managerContact ? ` · ${state.currentUser.managerContact}` : ""}</dd>
                <dt>근무 일정</dt>
                <dd>{state.currentUser.workSchedule}</dd>
                <dt>실습 기간</dt>
                <dd>
                  {state.currentUser.startDate} – {state.currentUser.endDate}
                </dd>
              </dl>
              <div className="office-art">
                <Building2 />
                <span>
                  FIELD
                  <br />
                  STUDIO
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Shell>
  );
}

function Attendance() {
  const { state, actions } = useApp();
  const user = state.currentUser;
  const internshipStartMonth = user.startDate?.slice(0, 7);
  const internshipEndMonth = user.endDate?.slice(0, 7);
  const isInternshipMonth = Boolean(
    internshipStartMonth && internshipEndMonth
      && state.selectedMonth >= internshipStartMonth
      && state.selectedMonth <= internshipEndMonth,
  );
  const report = state.reports.find(
    (r) => r.studentId === user.id && r.yearMonth === state.selectedMonth,
  );
  const source = state.logs.filter(
    (l) => l.studentId === user.id && l.date.startsWith(state.selectedMonth),
  );
  const [logs, setLogs] = useState(source);
  const [healingMonth, setHealingMonth] = useState(null);
  const [healingError, setHealingError] = useState(false);
  useEffect(() => setLogs(source), [state.logs, state.selectedMonth, user.id]);
  useEffect(() => {
    if (report || !isInternshipMonth || healingMonth === state.selectedMonth) return;
    const month = state.selectedMonth;
    setHealingError(false);
    setHealingMonth(month);
    actions.ensureMonth(month).catch(() => setHealingError(true));
  }, [actions, healingMonth, isInternshipMonth, report, state.selectedMonth]);
  const input = useRef();
  const readOnly = [ReportStatus.SUBMITTED, ReportStatus.APPROVED].includes(
    report?.status,
  );
  const change = (id, key, value) =>
    setLogs((v) => v.map((l) => (l.id === id ? { ...l, [key]: value } : l)));
  const upload = async (file) => {
    try {
      await actions.uploadPdf(report, file);
    } catch {
      if (input.current) input.current.value = "";
    }
  };
  if (!isInternshipMonth)
    return (
      <Shell role={Role.STUDENT}>
        <div className="workspace">
          <MonthPicker />
          <Empty title="선택한 월은 실습 기간이 아닙니다." />
        </div>
      </Shell>
    );
  if (!report)
    return (
      <Shell role={Role.STUDENT}>
        <div className="workspace">
          <MonthPicker />
          <div className="panel">
            <p>{healingError ? "월간 출근부 데이터를 준비하지 못했습니다." : "월간 출근부 데이터를 준비하고 있습니다."}</p>
            {healingError && <Button onClick={() => setHealingMonth(null)}>다시 시도</Button>}
          </div>
        </div>
      </Shell>
    );
  return (
    <Shell role={Role.STUDENT}>
      <div className="workspace">
        <PageHead
          eyebrow="MY ATTENDANCE"
          title="월별 출근부"
          description="근무 기록을 수정하고 PDF 출근부를 제출하세요."
        >
          <MonthPicker />
        </PageHead>
        <div className="submission-period">
          <CalendarDays />
          <div>
            <b>제출 기간</b>
            <span>{periodLabel(state.periods.find((p) => p.yearMonth === state.selectedMonth))}</span>
          </div>
          <strong>
            D-{getDday(state.periods.find((p) => p.yearMonth === state.selectedMonth)) ?? "-"}
          </strong>
        </div>
        <div className="table-wrap attendance-table">
          <table>
            <thead>
              <tr>
                <th>날짜</th>
                <th>요일</th>
                <th>상태</th>
                <th>출근</th>
                <th>퇴근</th>
                <th>근무 시간</th>
                <th>근무 내용</th>
                <th>비고</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.date}</td>
                  <td>{weekday(log.date)}</td>
                  <td>
                    <select
                      disabled={readOnly}
                      value={log.status}
                      onChange={(e) => change(log.id, "status", e.target.value)}
                    >
                      {Object.values(AttendanceStatus).map((s) => (
                        <option key={s} value={s}>{statusMeta[s]?.label || s}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      aria-label={`${log.date} 출근`}
                      disabled={readOnly}
                      type="time"
                      value={log.checkIn || ""}
                      onChange={(e) =>
                        change(log.id, "checkIn", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`${log.date} 퇴근`}
                      disabled={readOnly}
                      type="time"
                      value={log.checkOut || ""}
                      onChange={(e) =>
                        change(log.id, "checkOut", e.target.value)
                      }
                    />
                  </td>
                  <td>{durationLabel(workMinutes(log))}</td>
                  <td>
                    <input
                      aria-label={`${log.date} 근무 내용`}
                      disabled={readOnly}
                      value={log.workSummary}
                      onChange={(e) =>
                        change(log.id, "workSummary", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`${log.date} 비고`}
                      disabled={readOnly}
                      value={log.note || ""}
                      onChange={(e) => change(log.id, "note", e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="submission-grid">
          <section className="panel upload-panel">
            <div className="panel-head">
              <h3>PDF 업로드</h3>
              <span>PDF · 최대 10MB</span>
            </div>
            <input
              ref={input}
              id="pdf-upload"
              type="file"
              accept="application/pdf"
              hidden
              disabled={readOnly}
              onChange={(e) => upload(e.target.files[0])}
            />
            <label
              htmlFor="pdf-upload"
              className={`dropzone ${readOnly ? "disabled" : ""}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!readOnly) upload(e.dataTransfer.files[0]);
              }}
            >
              <UploadCloud />
              <b>클릭하거나 PDF를 끌어다 놓으세요.</b>
              <span>학생 정보 기반 파일명으로 자동 변경됩니다.</span>
            </label>
            {report.fileName && (
              <div className="uploaded-file">
                <FileText />
                <span>
                  <b>{report.fileName}</b>
                  <small>자동 생성 파일명</small>
                </span>
                <CheckCircle2 />
              </div>
            )}
          </section>
          <section className="panel submit-panel">
            <div className="panel-head">
              <h3>제출 정보</h3>
              <Status value={report.status} />
            </div>
            <dl>
              <dt>마감일</dt>
              <dd>{periodLabel(state.periods.find((p) => p.yearMonth === state.selectedMonth))}</dd>
              <dt>제출 일시</dt>
              <dd>{formatDateTime(report.submittedAt)}</dd>
              <dt>편집 상태</dt>
              <dd>{readOnly ? "읽기 전용" : "편집 가능"}</dd>
              <dt>최종 수정</dt>
              <dd>{formatDateTime(latestAt([...logs, report]))}</dd>
              <dt>제출 횟수</dt>
              <dd>{report.submissionCount || 0}회</dd>
            </dl>
            {report.rejectionReason && (
              <div className="decision rejected"><CircleAlert /><span><b>반려 사유</b><br />{report.rejectionReason}</span></div>
            )}
            <div className="action-row">
              <Button
                variant="outline"
                disabled={readOnly || state.loading}
                onClick={() => actions.saveDraft(report, logs)}
              >
                임시 저장
              </Button>
              <Button
                disabled={readOnly || !report.filePath || state.loading}
                onClick={() => actions.submitReport(report, logs)}
              >
                최종 제출
              </Button>
            </div>
          </section>
        </div>
        <section className="panel history-panel">
          <div className="panel-head"><h3>제출·검토 이력</h3><span>{state.reportHistory.filter((h) => h.reportId === report.id).length}건</span></div>
          <div className="activity-list">
            {state.reportHistory.filter((h) => h.reportId === report.id).map((h) => <div key={h.id}><Status value={h.status} /><span>{h.previousStatus ? `${statusMeta[h.previousStatus]?.label || h.previousStatus} → ` : ""}{statusMeta[h.status]?.label || h.status}{h.reason ? ` · ${h.reason}` : ""}</span><time>{formatDateTime(h.createdAt)}</time></div>)}
            {!state.reportHistory.some((h) => h.reportId === report.id) && <Empty title="아직 제출 이력이 없습니다." />}
          </div>
        </section>
      </div>
    </Shell>
  );
}

function Profile() {
  const { state, actions } = useApp();
  const u = state.currentUser;
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const myLogs = state.logs.filter((l) => l.studentId === u.id);
  const myHistory = state.reportHistory.filter((h) => h.studentId === u.id);
  const activity = [
    ...myHistory.map((h) => ({ id: h.id, text: `${h.yearMonth} 출근부 ${statusMeta[h.status]?.label || h.status}`, at: h.createdAt })),
    ...state.notifications.filter((n) => n.userId === u.id).map((n) => ({ id: n.id, text: n.message, at: n.createdAt })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 8);
  const saveProfile = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await actions.updateProfile({ name: data.name, contactEmail: data.contactEmail, phone: data.phone, notificationEnabled: data.notificationEnabled === "on" });
    setEditing(false);
  };
  const changePassword = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (data.password !== data.confirmPassword) throw new Error("비밀번호 확인이 일치하지 않습니다.");
      validatePassword(data.password);
      await actions.changePassword(data.password);
      event.currentTarget.reset(); setPasswordError(""); setPasswordOpen(false);
    } catch (error) { setPasswordError(error.message); }
  };
  return (
    <Shell role={Role.STUDENT}>
      <div className="workspace profile">
        <PageHead
          eyebrow="MY PROFILE"
          title="학생 프로필"
          description="연락처와 알림 설정을 관리하고 실습 정보를 확인합니다."
        ><Button variant="outline" onClick={() => setEditing(!editing)}>{editing ? "취소" : "프로필 편집"}</Button></PageHead>
        <section className="profile-card">
          <div className="avatar">{u.name.slice(0, 1)}</div>
          <div>
            <h2>
              {u.name} <Status value="APPROVED" />
            </h2>
            <p>
              {u.school} · {u.classNumber}
            </p>
          </div>
        </section>
        {editing && <form className="panel profile-form" onSubmit={saveProfile}>
          <div className="panel-head"><h3>프로필 편집</h3><span>학교·실습 정보는 관리자만 변경할 수 있습니다.</span></div>
          <div className="two-col">
            <label>이름<input name="name" defaultValue={u.name} required maxLength={60} /></label>
            <label>연락 이메일<input name="contactEmail" type="email" defaultValue={u.contactEmail} placeholder="student@example.com" /></label>
            <label>전화번호<input name="phone" defaultValue={u.phone} pattern="[0-9+() -]{7,24}" placeholder="010-1234-5678" /></label>
            <label className="check setting-check"><input name="notificationEnabled" type="checkbox" defaultChecked={u.notificationEnabled} />서비스 알림 받기</label>
          </div>
          <Button type="submit" disabled={state.loading}>저장</Button>
        </form>}
        <div className="profile-grid">
          <section className="panel">
            <h3>기본 정보</h3>
            <dl className="info-list">
              <dt>학번</dt>
              <dd>{u.studentNumber}</dd>
              <dt>아이디</dt>
              <dd>{u.username}</dd>
              <dt>역할</dt>
              <dd>{u.role}</dd>
              <dt>연락 이메일</dt><dd>{u.contactEmail || "미등록"}</dd>
              <dt>전화번호</dt><dd>{u.phone || "미등록"}</dd>
            </dl>
          </section>
          <section className="panel">
            <h3>현장실습 정보</h3>
            <dl className="info-list">
              <dt>회사</dt>
              <dd>{u.company}</dd>
              <dt>부서</dt><dd>{u.department || "미등록"}</dd>
              <dt>담당자</dt><dd>{u.managerName || "미등록"}</dd>
              <dt>담당자 연락처</dt><dd>{u.managerContact || "미등록"}</dd>
              <dt>실습 유형</dt><dd>{u.internshipType}</dd>
              <dt>근무 일정</dt><dd>{u.workSchedule}</dd>
              <dt>시작일</dt>
              <dd>{u.startDate}</dd>
              <dt>종료일</dt>
              <dd>{u.endDate}</dd>
            </dl>
          </section>
        </div>
        <div className="profile-grid" id="activity">
          <section className="panel"><div className="panel-head"><h3>활동 요약</h3><Button variant="outline" onClick={() => navigate("/student/attendance")}>출근부 바로가기</Button></div><dl className="info-list"><dt>전체 근무 기록</dt><dd>{myLogs.length}일</dd><dt>완료 기록</dt><dd>{myLogs.filter((l) => l.checkIn && l.checkOut).length}일</dd><dt>누적 근무 시간</dt><dd>{durationLabel(myLogs.reduce((sum, l) => sum + workMinutes(l), 0))}</dd><dt>제출 횟수</dt><dd>{state.reports.filter((r) => r.studentId === u.id).reduce((sum, r) => sum + (r.submissionCount || 0), 0)}회</dd></dl></section>
          <section className="panel"><div className="panel-head"><h3>최근 활동</h3></div><div className="activity-list">{activity.map((a) => <div key={a.id}><CheckCircle2 /><span>{a.text}</span><time>{formatDateTime(a.at)}</time></div>)}{!activity.length && <Empty title="최근 활동이 없습니다." />}</div></section>
        </div>
        <section className="panel security-panel"><div className="panel-head"><h3>계정 보안</h3><Button variant="outline" onClick={() => setPasswordOpen(!passwordOpen)}>비밀번호 변경</Button></div>{passwordOpen && <form className="password-form" onSubmit={changePassword}><label>새 비밀번호<input name="password" type="password" minLength={PASSWORD_MIN_LENGTH} required /></label><label>새 비밀번호 확인<input name="confirmPassword" type="password" minLength={PASSWORD_MIN_LENGTH} required /></label><Button type="submit" disabled={state.loading}>변경</Button>{passwordError && <div className="form-error"><CircleAlert />{passwordError}</div>}</form>}<p className="helper">비밀번호는 Supabase Auth에만 저장되며 profiles 테이블에는 저장되지 않습니다.</p></section>
        <Button variant="danger" icon={LogOut} onClick={async () => { await actions.logout(); navigate("/login"); }}>로그아웃</Button>
      </div>
    </Shell>
  );
}

const submittedStatuses = [ReportStatus.SUBMITTED, ReportStatus.APPROVED];
function useAdminRows() {
  const { state } = useApp();
  return state.users
    .filter((u) => u.role === Role.STUDENT)
    .map((user) => ({
      user,
      report: state.reports.find(
        (r) => r.studentId === user.id && r.yearMonth === state.selectedMonth,
      ),
      logs: state.logs.filter(
        (l) => l.studentId === user.id && l.date.startsWith(state.selectedMonth),
      ),
    }));
}
function Metric({ label, value, suffix, Icon }) {
  return (
    <div className="metric">
      <div>
        <span>{label}</span>
        <strong>
          {value}
          <small>{suffix}</small>
        </strong>
      </div>
      <Icon />
    </div>
  );
}
function StudentTable({ rows, onSelect }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>학번</th>
            <th>이름</th>
            <th>반</th>
            <th>학교</th>
            <th>회사</th>
            <th>상태</th>
            <th>제출 일시</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ user, report }) => (
            <tr key={user.id} onClick={() => onSelect?.({ user, report })}>
              <td>{user.studentNumber}</td>
              <td>{user.name}</td>
              <td>{user.classNumber}</td>
              <td>{user.school}</td>
              <td>{user.company}</td>
              <td>
                <Status value={report?.status || ReportStatus.NOT_STARTED} />
              </td>
              <td>{formatDateTime(report?.submittedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function AdminDashboard() {
  const rows = useAdminRows();
  const { state, actions } = useApp();
  const [selected, setSelected] = useState(null);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  useEffect(() => { actions.getDashboard().then(setDashboard).catch(() => setDashboard(null)); }, [state.selectedMonth]);
  const completed = rows.filter((r) =>
    submittedStatuses.includes(r.report?.status),
  ).length;
  const missing = rows.filter(
    (r) => !submittedStatuses.includes(r.report?.status),
  );
  const classes = Object.entries(
    rows.reduce((a, r) => {
      const k = r.user.classNumber;
      (a[k] ??= { total: 0, done: 0 }).total++;
      if (submittedStatuses.includes(r.report?.status)) a[k].done++;
      return a;
    }, {}),
  );
  return (
    <Shell role={Role.ADMIN}>
      <div className="workspace admin-dashboard">
        <PageHead
          eyebrow="ADMINISTRATION"
          title="제출 현황 대시보드"
          description="실제 리포트 데이터로 계산된 제출 현황입니다."
        >
          <div className="page-actions">
            <MonthPicker />
            <Button variant="outline" icon={Send} disabled={!missing.length || state.loading} onClick={() => actions.sendBulkReminders()}>미제출 일괄 알림</Button>
            <Button variant="outline" onClick={() => setPeriodOpen(true)}>제출 기간 설정</Button>
          </div>
        </PageHead>
        <div className="metrics">
          <Metric
            label="전체 학생"
            value={dashboard?.totalStudents ?? rows.length}
            suffix="명"
            Icon={Users}
          />
          <Metric
            label="제출 완료"
            value={dashboard?.submitted ?? completed}
            suffix="명"
            Icon={CheckCircle2}
          />
          <Metric
            label="미제출"
            value={dashboard?.missing ?? rows.length - completed}
            suffix="명"
            Icon={CircleAlert}
          />
          <Metric
            label="제출률"
            value={
              dashboard?.submissionRate ?? (rows.length ? ((completed / rows.length) * 100).toFixed(1) : 0)
            }
            suffix="%"
            Icon={BarChart3}
          />
        </div>
        <div className="admin-grid">
          <section className="panel">
            <div className="panel-head">
              <h3>학생 제출 현황</h3>
              <NavLink to="/admin/students">
                전체 보기 <ChevronRight />
              </NavLink>
            </div>
            {rows.length ? (
              <StudentTable rows={rows} onSelect={setSelected} />
            ) : (
              <Empty />
            )}
          </section>
          <aside className="admin-side">
            <section className="panel">
              <h3>반별 제출률</h3>
              {classes.map(([name, v]) => {
                const rate = Math.round((v.done / v.total) * 100);
                return (
                  <div className="progress-item" key={name}>
                    <div>
                      <b>{name}</b>
                      <span>
                        {rate}% ({v.done}/{v.total})
                      </span>
                    </div>
                    <div className="progress">
                      <i style={{ width: `${rate}%` }} />
                    </div>
                  </div>
                );
              })}
            </section>
            <section className="panel no-submit">
              <div className="panel-head">
                <h3>미제출자 ({missing.length}명)</h3>
                <NavLink to="/admin/missing">전체 보기 <ChevronRight /></NavLink>
              </div>
              {missing.map((r) => (
                <div key={r.user.id}>
                  <span>
                    {r.user.name}
                    <small>
                      {r.user.studentNumber} · {r.user.classNumber}
                    </small>
                  </span>
                  <button
                    aria-label={`${r.user.name} Reminder 재발송`}
                    onClick={() => actions.sendReminder(r.user)}
                  >
                    <Send />
                  </button>
                </div>
              ))}
            </section>
          </aside>
        </div>
        {selected && (
          <StudentModal data={selected} onClose={() => setSelected(null)} />
        )}
        {periodOpen && (
          <PeriodModal
            period={state.periods.find((p) => p.yearMonth === state.selectedMonth)}
            onClose={() => setPeriodOpen(false)}
          />
        )}
      </div>
    </Shell>
  );
}

function PeriodModal({ period, onClose }) {
  const { state, actions } = useApp();
  const [year, month] = state.selectedMonth.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const localValue = (value, fallback) => value
    ? new Date(value).toLocaleString("sv-SE").slice(0, 16).replace(" ", "T")
    : fallback;
  const submit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await actions.savePeriod(new Date(data.startDate).toISOString(), new Date(data.endDate).toISOString());
    onClose();
  };
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal compact-modal" onSubmit={submit}>
        <div className="modal-head">
          <div><p className="eyebrow">SUBMISSION PERIOD</p><h2>{monthLabel(state.selectedMonth)} 제출 기간</h2></div>
          <button type="button" aria-label="닫기" onClick={onClose}><X /></button>
        </div>
        <label>시작 일시<input name="startDate" type="datetime-local" required defaultValue={localValue(period?.startDate, `${state.selectedMonth}-01T00:00`)} /></label>
        <label>종료 일시<input name="endDate" type="datetime-local" required defaultValue={localValue(period?.endDate, `${state.selectedMonth}-${String(lastDay).padStart(2, "0")}T23:59`)} /></label>
        <div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>취소</Button><Button type="submit" disabled={state.loading}>저장</Button></div>
      </form>
    </div>
  );
}

function AddStudentModal({ actions, onClose }) {
  const { state } = useApp();
  const submit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    validatePassword(data.password);
    validateInternshipDates(data.startDate, data.endDate);
    await actions.createStudent(data);
    onClose();
  };
  const fields = [
    ["username", "아이디", "text"], ["password", "초기 비밀번호", "password"],
    ["studentNumber", "학번", "text"], ["name", "이름", "text"],
    ["school", "학교", "text"], ["classNumber", "반", "text"],
    ["company", "실습 회사", "text"], ["startDate", "실습 시작일", "date"],
    ["endDate", "실습 종료일", "date"],
    ["department", "실습 부서 (선택)", "text"], ["managerName", "담당자 (선택)", "text"],
    ["managerContact", "담당자 연락처 (선택)", "text"], ["workSchedule", "근무 일정 (선택)", "text"],
  ];
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit}>
        <div className="modal-head">
          <div><p className="eyebrow">CREATE STUDENT</p><h2>학생 계정 추가</h2></div>
          <button type="button" aria-label="닫기" onClick={onClose}><X /></button>
        </div>
        <p className="helper">비밀번호는 Supabase Auth에만 저장되며 프로필에는 저장되지 않습니다.</p>
        <div className="two-col">
          {fields.map(([name, label, type]) => (
            <label key={name}>{label}<input name={name} type={type} minLength={name === "password" ? PASSWORD_MIN_LENGTH : undefined} required={!label.includes("선택")} /></label>
          ))}
        </div>
        <div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>취소</Button><Button type="submit" disabled={state.loading}>계정 생성</Button></div>
      </form>
    </div>
  );
}

function EditStudentModal({ user, onClose }) {
  const { state, actions } = useApp();
  const submit = async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    validateInternshipDates(data.startDate, data.endDate);
    await actions.updateStudent({ id: user.id, ...data });
    onClose();
  };
  const fields = [
    ["name", "이름", "text"], ["studentNumber", "학번", "text"], ["school", "학교", "text"], ["classNumber", "반", "text"],
    ["company", "실습 회사", "text"], ["department", "실습 부서", "text"], ["managerName", "담당자", "text"], ["managerContact", "담당자 연락처", "text"],
    ["internshipType", "실습 유형", "text"], ["workSchedule", "근무 일정", "text"], ["contactEmail", "학생 이메일", "email"], ["phone", "학생 전화번호", "text"],
    ["startDate", "실습 시작일", "date"], ["endDate", "실습 종료일", "date"],
  ];
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><form className="modal" onSubmit={submit}><div className="modal-head"><div><p className="eyebrow">EDIT STUDENT</p><h2>학생 정보 편집</h2></div><button type="button" aria-label="닫기" onClick={onClose}><X /></button></div><p className="helper">학교·실습 정보는 관리자 전용 RPC를 통해 검증 후 저장됩니다.</p><div className="two-col">{fields.map(([name,label,type]) => <label key={name}>{label}<input name={name} type={type} defaultValue={user[name] || ""} required={["name","studentNumber","school","classNumber","company","startDate","endDate"].includes(name)} /></label>)}</div><div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>취소</Button><Button type="submit" disabled={state.loading}>저장</Button></div></form></div>;
}

function AdminStudents() {
  const rows = useAdminRows();
  const { state, actions } = useApp();
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("ALL"),
    [classNo, setClassNo] = useState("ALL"),
    [selected, setSelected] = useState(null),
    [adding, setAdding] = useState(false),
    [editing, setEditing] = useState(null),
    [page, setPage] = useState(1);
  const pageSize = 10;
  const filtered = rows.filter(
    (r) =>
      (!query || `${r.user.name} ${r.user.studentNumber}`.includes(query)) &&
      (status === "ALL" ||
        (status === "DONE"
          ? submittedStatuses.includes(r.report?.status)
          : !submittedStatuses.includes(r.report?.status))) &&
      (classNo === "ALL" || r.user.classNumber === classNo),
  );
  useEffect(() => setPage(1), [query, status, classNo, state.selectedMonth]);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const exportStudents = () => {
    const header = ["학번","이름","반","학교","회사","부서","담당자","상태","제출일시"];
    const lines = filtered.map(({user,report}) => [user.studentNumber,user.name,user.classNumber,user.school,user.company,user.department,user.managerName,statusMeta[report?.status || ReportStatus.NOT_STARTED]?.label,report?.submittedAt].map(csvCell).join(","));
    const blob = new Blob(["\uFEFF" + [header.map(csvCell).join(","), ...lines].join("\r\n")], {type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `학생목록-${state.selectedMonth}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <Shell role={Role.ADMIN}>
      <div className="workspace">
        <PageHead
          eyebrow="STUDENT DIRECTORY"
          title="학생 관리"
          description="학생 검색과 제출 상태 필터를 이용하세요."
        >
          <div className="page-actions">
            <MonthPicker />
            <Button variant="outline" icon={Download} onClick={exportStudents}>CSV 내보내기</Button>
            <Button variant="outline" icon={Send} onClick={() => actions.sendBulkReminders()}>일괄 알림</Button>
            <Button icon={UserPlus} onClick={() => setAdding(true)}>학생 추가</Button>
          </div>
        </PageHead>
        <section className="filter-bar">
          <div className="segmented">
            {[
              ["ALL", "전체"],
              ["DONE", "제출"],
              ["MISSING", "미제출"],
            ].map(([v, l]) => (
              <button
                className={status === v ? "active" : ""}
                onClick={() => setStatus(v)}
                key={v}
              >
                {l}
              </button>
            ))}
          </div>
          <label className="search">
            <Search />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름 또는 학번 검색"
            />
          </label>
          <select
            aria-label="반 필터"
            value={classNo}
            onChange={(e) => setClassNo(e.target.value)}
          >
            <option value="ALL">전체 반</option>
            {[...new Set(rows.map((r) => r.user.classNumber))].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </section>
        <section className="panel student-list">
          <div className="panel-head">
            <h3>
              검색 결과 <span>{filtered.length}명</span>
            </h3>
            <span>전체 학생 {rows.length}명 · 페이지당 {pageSize}명</span>
          </div>
          {filtered.length ? (
            <><StudentTable rows={visible} onSelect={setSelected} /><Pagination page={page} total={filtered.length} pageSize={pageSize} onChange={setPage} /></>
          ) : (
            <Empty title="조건에 맞는 학생이 없습니다." />
          )}
        </section>
        {selected && (
          <StudentModal data={selected} onClose={() => setSelected(null)} onEdit={() => { setEditing(selected.user); setSelected(null); }} />
        )}
        {adding && <AddStudentModal actions={actions} onClose={() => setAdding(false)} />}
        {editing && <EditStudentModal user={editing} onClose={() => setEditing(null)} />}
      </div>
    </Shell>
  );
}
function AdminAttendance() {
  const rows = useAdminRows();
  const { state } = useApp();
  const [selected, setSelected] = useState(null);
  const [school, setSchool] = useState("ALL");
  const [status, setStatus] = useState(ReportStatus.SUBMITTED);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const filtered = rows.filter((r) => (school === "ALL" || r.user.school === school) && (status === "ALL" || (r.report?.status || ReportStatus.NOT_STARTED) === status)).sort((a,b) => {
    const waiting = Number(b.report?.status === ReportStatus.SUBMITTED) - Number(a.report?.status === ReportStatus.SUBMITTED);
    return waiting || String(b.report?.submittedAt || "").localeCompare(String(a.report?.submittedAt || "")) || a.user.name.localeCompare(b.user.name, "ko");
  });
  useEffect(() => setPage(1), [school, status, state.selectedMonth]);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  return (
    <Shell role={Role.ADMIN}>
      <div className="workspace">
        <PageHead
          eyebrow="REVIEW ATTENDANCE"
          title="출근부 관리"
          description="제출된 출근부를 검토하고 승인 또는 반려합니다."
        />
        <section className="filter-bar">
          <MonthPicker />
          <select aria-label="학교 필터" value={school} onChange={(e) => setSchool(e.target.value)}><option value="ALL">전체 학교</option>{[...new Set(rows.map((r) => r.user.school))].sort().map((v) => <option key={v}>{v}</option>)}</select>
          <select aria-label="상태 필터" value={status} onChange={(e) => setStatus(e.target.value)}><option value="ALL">전체 상태</option>{Object.values(ReportStatus).map((v) => <option value={v} key={v}>{statusMeta[v]?.label}</option>)}</select>
          <span className="filter-result">
            결과 {filtered.length}건 · 검토 대기{" "}
            {
              rows.filter((r) => r.report?.status === ReportStatus.SUBMITTED)
                .length
            }
            건
          </span>
        </section>
        <section className="panel student-list">
          {visible.length ? <><StudentTable rows={visible} onSelect={setSelected} /><Pagination page={page} total={filtered.length} pageSize={pageSize} onChange={setPage} /></> : <Empty title="조건에 맞는 제출 리포트가 없습니다." />}
        </section>
        {selected && (
          <StudentModal data={selected} onClose={() => setSelected(null)} />
        )}
      </div>
    </Shell>
  );
}
function StudentModal({ data, onClose, onEdit }) {
  const { state, actions } = useApp();
  const [rejectionReason, setRejectionReason] = useState("");
  const report = state.reports.find(
    (r) => r.studentId === data.user.id && r.yearMonth === state.selectedMonth,
  );
  const logs = state.logs.filter(
    (l) => l.studentId === data.user.id && l.date.startsWith(state.selectedMonth),
  );
  const canReview = report?.status === ReportStatus.SUBMITTED;
  const totalMinutes = logs.reduce((sum, log) => sum + workMinutes(log), 0);
  const workedDays = logs.filter((log) => workMinutes(log) > 0).length;
  const download = async () => {
    const url = await actions.getReportUrl(report);
    window.open(url, "_blank", "noopener,noreferrer");
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal">
        <div className="modal-head">
          <div>
            <p className="eyebrow">SUBMISSION DETAIL</p>
            <h2>출근부 제출 상세</h2>
          </div>
          <button aria-label="닫기" onClick={onClose}>
            <X />
          </button>
        </div>
        {onEdit && <div className="detail-edit"><Button variant="outline" onClick={onEdit}>학생 정보 편집</Button></div>}
        <div className="detail-top">
          <section>
            <h3>학생 정보</h3>
            <dl>
              <dt>이름</dt>
              <dd>{data.user.name}</dd>
              <dt>학번</dt>
              <dd>{data.user.studentNumber}</dd>
              <dt>학교</dt>
              <dd>{data.user.school}</dd>
              <dt>반</dt>
              <dd>{data.user.classNumber}</dd>
            </dl>
          </section>
          <section>
            <h3>실습·제출 정보</h3>
            <dl>
              <dt>회사</dt>
              <dd>{data.user.company}</dd>
              <dt>기간</dt>
              <dd>
                {data.user.startDate} – {data.user.endDate}
              </dd>
              <dt>제출 일시</dt>
              <dd>{formatDateTime(report?.submittedAt)}</dd>
              <dt>상태</dt>
              <dd>
                <Status value={report?.status || ReportStatus.NOT_STARTED} />
              </dd>
            </dl>
          </section>
        </div>
        <section className="detail-att">
          <div className="panel-head">
            <h3>일별 출근 기록</h3>
            <span>근무 {workedDays}일 · 총 {durationLabel(totalMinutes)}</span>
          </div>
          {logs.length ? (
            <div className="mini-attendance">
              {logs.map((l) => (
                <div key={l.id}>
                  <b>{l.date} ({weekday(l.date).slice(0, 1)})</b>
                  <Status value={l.status} />
                  <span>
                    {l.checkIn || "—"} – {l.checkOut || "—"}
                  </span>
                  <span>{durationLabel(workMinutes(l))}</span>
                  <span>{l.workSummary || "—"}</span>
                  <span>{l.note || "—"}</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="출근 기록이 없습니다." />
          )}
        </section>
        {report?.fileName ? (
          <div className="file-card">
            <FileText />
            <span>
              <b>{report.fileName}</b>
              <small>PDF 제출 파일</small>
            </span>
            <button aria-label="PDF 다운로드" onClick={download}>
              <Download />
            </button>
          </div>
        ) : (
          <Empty title="제출된 PDF가 없습니다." />
        )}
        {report?.rejectionReason && (
          <div className="decision rejected"><CircleAlert /><span><b>반려 사유</b><br />{report.rejectionReason}</span></div>
        )}
        {canReview && (
          <label className="rejection-input">반려 사유<textarea maxLength={500} value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="반려 시 사유를 필수로 입력하세요." /></label>
        )}
        <div className="modal-actions">
          <Button
            variant="outline"
            disabled={!canReview || !rejectionReason.trim()}
            onClick={() =>
              actions.reviewReport(report, data.user, ReportStatus.REJECTED, rejectionReason)
            }
          >
            반려
          </Button>
          <Button
            disabled={!canReview}
            onClick={() =>
              actions.reviewReport(report, data.user, ReportStatus.APPROVED)
            }
          >
            승인
          </Button>
        </div>
      </div>
    </div>
  );
}

function AdminMissing() {
  const rows = useAdminRows().filter((r) => !submittedStatuses.includes(r.report?.status));
  const { state, actions } = useApp();
  const [selected, setSelected] = useState(null);
  return <Shell role={Role.ADMIN}><div className="workspace"><PageHead eyebrow="MISSING SUBMISSIONS" title="미제출 학생" description="선택한 달의 미제출·작성 중·반려 학생 전체입니다."><div className="page-actions"><MonthPicker /><Button icon={Send} disabled={!rows.length || state.loading} onClick={() => actions.sendBulkReminders()}>전체 리마인더</Button></div></PageHead><section className="panel student-list">{rows.length ? <StudentTable rows={rows} onSelect={setSelected} /> : <Empty title="미제출 학생이 없습니다." description="모든 학생이 제출을 완료했습니다." />}</section>{selected && <StudentModal data={selected} onClose={() => setSelected(null)} />}</div></Shell>;
}

function AdminReports() {
  const rows = useAdminRows();
  const { state } = useApp();
  const totalMinutes = rows.reduce((sum, r) => sum + r.logs.reduce((v, l) => v + workMinutes(l), 0), 0);
  const counts = Object.values(ReportStatus).map((status) => ({status, count: rows.filter((r) => (r.report?.status || ReportStatus.NOT_STARTED) === status).length}));
  const exportReport = () => {
    const header = ["연월","학번","이름","학교","반","회사","상태","근무일","근무시간(분)","제출횟수","제출일시"];
    const lines = rows.map(({user,report,logs}) => [state.selectedMonth,user.studentNumber,user.name,user.school,user.classNumber,user.company,statusMeta[report?.status || ReportStatus.NOT_STARTED]?.label,logs.filter((l) => workMinutes(l)>0).length,logs.reduce((s,l)=>s+workMinutes(l),0),report?.submissionCount||0,report?.submittedAt].map(csvCell).join(","));
    const blob = new Blob(["\uFEFF" + [header.map(csvCell).join(","),...lines].join("\r\n")],{type:"text/csv;charset=utf-8"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url;a.download=`출근부보고서-${state.selectedMonth}.csv`;a.click();URL.revokeObjectURL(url);
  };
  return <Shell role={Role.ADMIN}><div className="workspace"><PageHead eyebrow="MONTHLY REPORTS" title="월간 보고서" description="선택한 달의 제출 상태와 근무 실적을 요약합니다."><div className="page-actions"><MonthPicker /><Button icon={Download} onClick={exportReport}>CSV 내보내기</Button></div></PageHead><div className="metrics"><Metric label="대상 학생" value={rows.length} suffix="명" Icon={Users}/><Metric label="총 근무일" value={rows.reduce((s,r)=>s+r.logs.filter((l)=>workMinutes(l)>0).length,0)} suffix="일" Icon={CalendarDays}/><Metric label="총 근무시간" value={(totalMinutes/60).toFixed(1)} suffix="시간" Icon={Clock3}/><Metric label="승인" value={counts.find((v)=>v.status===ReportStatus.APPROVED)?.count||0} suffix="건" Icon={CheckCircle2}/></div><section className="panel"><div className="panel-head"><h3>상태별 리포트</h3></div><div className="report-status-grid">{counts.map((v)=><div key={v.status}><Status value={v.status}/><strong>{v.count}건</strong></div>)}</div></section></div></Shell>;
}

function AdminSettings() {
  const { state } = useApp();
  const [periodOpen, setPeriodOpen] = useState(false);
  const period = state.periods.find((p) => p.yearMonth === state.selectedMonth);
  return <Shell role={Role.ADMIN}><div className="workspace"><PageHead eyebrow="ADMIN SETTINGS" title="운영 설정" description="월별 제출 기간과 시스템 운영 기준을 관리합니다."><MonthPicker /></PageHead><div className="profile-grid"><section className="panel"><div className="panel-head"><h3>제출 기간</h3><Button variant="outline" onClick={()=>setPeriodOpen(true)}>기간 변경</Button></div><dl className="info-list"><dt>대상 월</dt><dd>{monthLabel(state.selectedMonth)}</dd><dt>현재 기간</dt><dd>{periodLabel(period)}</dd></dl></section><section className="panel"><h3>보안·파일 정책</h3><dl className="info-list"><dt>인증</dt><dd>Supabase Auth</dd><dt>PDF 제한</dt><dd>10MB · application/pdf</dd><dt>학생 권한</dt><dd>본인 출근 기록·연락처만</dd><dt>검토 권한</dt><dd>관리자 전용</dd></dl></section></div>{periodOpen&&<PeriodModal period={period} onClose={()=>setPeriodOpen(false)}/>}</div></Shell>;
}

function NotFound() {
  return (
    <div className="loading-screen">
      <CircleAlert />
      <h2>페이지를 찾을 수 없습니다.</h2>
      <NavLink to="/login">로그인으로 돌아가기</NavLink>
    </div>
  );
}
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="/student"
        element={
          <Protected role={Role.STUDENT}>
            <StudentHome />
          </Protected>
        }
      />
      <Route
        path="/student/attendance"
        element={
          <Protected role={Role.STUDENT}>
            <Attendance />
          </Protected>
        }
      />
      <Route
        path="/student/profile"
        element={
          <Protected role={Role.STUDENT}>
            <Profile />
          </Protected>
        }
      />
      <Route
        path="/admin"
        element={<Navigate to="/admin/dashboard" replace />}
      />
      <Route
        path="/admin/dashboard"
        element={
          <Protected role={Role.ADMIN}>
            <AdminDashboard />
          </Protected>
        }
      />
      <Route
        path="/admin/students"
        element={
          <Protected role={Role.ADMIN}>
            <AdminStudents />
          </Protected>
        }
      />
      <Route
        path="/admin/attendance"
        element={
          <Protected role={Role.ADMIN}>
            <AdminAttendance />
          </Protected>
        }
      />
      <Route path="/admin/missing" element={<Protected role={Role.ADMIN}><AdminMissing /></Protected>} />
      <Route path="/admin/reports" element={<Protected role={Role.ADMIN}><AdminReports /></Protected>} />
      <Route path="/admin/settings" element={<Protected role={Role.ADMIN}><AdminSettings /></Protected>} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
