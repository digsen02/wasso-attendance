begin;

alter table public.profiles
  add column if not exists contact_email text,
  add column if not exists phone text,
  add column if not exists department text,
  add column if not exists manager_name text,
  add column if not exists manager_contact text,
  add column if not exists internship_type text not null default '현장실습',
  add column if not exists work_schedule text not null default '주 5일 · 09:00–18:00',
  add column if not exists notification_enabled boolean not null default true;

alter table public.profiles
  drop constraint if exists profiles_contact_email_check,
  add constraint profiles_contact_email_check
    check (contact_email is null or contact_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  drop constraint if exists profiles_phone_check,
  add constraint profiles_phone_check
    check (phone is null or phone ~ '^[0-9+() -]{7,24}$');

alter table public.monthly_reports
  add column if not exists submission_count integer not null default 0
    check (submission_count >= 0);

create table if not exists public.report_status_history (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.monthly_reports(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  year_month text not null check (year_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  previous_status public.report_status,
  status public.report_status not null,
  reason text check (reason is null or char_length(reason) <= 500),
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists report_status_history_student_month_idx
  on public.report_status_history(student_id, year_month, created_at desc);

create or replace function public.capture_report_status_history() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into public.report_status_history(
      report_id, student_id, year_month, previous_status, status, reason, actor_id
    ) values (
      new.id, new.student_id, new.year_month, old.status, new.status,
      case when new.status = 'REJECTED' then new.rejection_reason else null end,
      auth.uid()
    );
  end if;
  return new;
end
$$;

drop trigger if exists report_status_history_capture on public.monthly_reports;
create trigger report_status_history_capture
after update of status on public.monthly_reports
for each row execute procedure public.capture_report_status_history();

update public.monthly_reports
set submission_count = 1
where submission_count = 0 and status in ('SUBMITTED', 'APPROVED', 'REJECTED');

insert into public.report_status_history(
  report_id, student_id, year_month, previous_status, status, reason, actor_id, created_at
)
select id, student_id, year_month, null, status,
  case when status = 'REJECTED' then rejection_reason else null end,
  reviewed_by, coalesce(reviewed_at, submitted_at, updated_at)
from public.monthly_reports
where status <> 'NOT_STARTED'
  and not exists (select 1 from public.report_status_history h where h.report_id = monthly_reports.id);

create or replace function public.update_my_profile(
  p_name text,
  p_contact_email text default null,
  p_phone text default null,
  p_notification_enabled boolean default true
) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare profile public.profiles;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  if coalesce(char_length(trim(p_name)), 0) not between 1 and 60 then
    raise exception '이름은 1자 이상 60자 이하로 입력해주세요.' using errcode = '22023';
  end if;
  if nullif(trim(p_contact_email), '') is not null
     and trim(p_contact_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception '연락 이메일 형식이 올바르지 않습니다.' using errcode = '22023';
  end if;
  if nullif(trim(p_phone), '') is not null
     and trim(p_phone) !~ '^[0-9+() -]{7,24}$' then
    raise exception '전화번호 형식이 올바르지 않습니다.' using errcode = '22023';
  end if;

  update public.profiles
  set name = trim(p_name),
      contact_email = nullif(lower(trim(p_contact_email)), ''),
      phone = nullif(trim(p_phone), ''),
      notification_enabled = coalesce(p_notification_enabled, true)
  where id = auth.uid()
  returning * into profile;
  if profile.id is null then raise exception '프로필을 찾을 수 없습니다.' using errcode = 'P0002'; end if;
  return profile;
end
$$;

create or replace function public.update_student_profile(
  p_student_id uuid,
  p_name text,
  p_student_number text,
  p_school text,
  p_class_number text,
  p_company text,
  p_start_date date,
  p_end_date date,
  p_department text default null,
  p_manager_name text default null,
  p_manager_contact text default null,
  p_internship_type text default '현장실습',
  p_work_schedule text default '주 5일 · 09:00–18:00',
  p_contact_email text default null,
  p_phone text default null
) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare profile public.profiles; period record;
begin
  if not public.is_admin() then raise exception '관리자 권한이 필요합니다.' using errcode = '42501'; end if;
  if p_start_date is null or p_end_date is null or p_start_date > p_end_date then
    raise exception '실습 시작일은 종료일보다 늦을 수 없습니다.' using errcode = '22023';
  end if;
  if coalesce(char_length(trim(p_name)), 0) = 0
     or coalesce(char_length(trim(p_student_number)), 0) = 0
     or coalesce(char_length(trim(p_school)), 0) = 0
     or coalesce(char_length(trim(p_class_number)), 0) = 0
     or coalesce(char_length(trim(p_company)), 0) = 0 then
    raise exception '필수 학생 정보를 모두 입력해주세요.' using errcode = '22023';
  end if;

  update public.profiles set
    name = trim(p_name), student_number = trim(p_student_number),
    school = trim(p_school), class_number = trim(p_class_number), company = trim(p_company),
    start_date = p_start_date, end_date = p_end_date,
    department = nullif(trim(p_department), ''), manager_name = nullif(trim(p_manager_name), ''),
    manager_contact = nullif(trim(p_manager_contact), ''),
    internship_type = coalesce(nullif(trim(p_internship_type), ''), '현장실습'),
    work_schedule = coalesce(nullif(trim(p_work_schedule), ''), '주 5일 · 09:00–18:00'),
    contact_email = nullif(lower(trim(p_contact_email)), ''), phone = nullif(trim(p_phone), '')
  where id = p_student_id and role = 'STUDENT'
  returning * into profile;
  if profile.id is null then raise exception '학생을 찾을 수 없습니다.' using errcode = 'P0002'; end if;

  for period in select year_month from public.submission_periods loop
    perform public.ensure_student_month(profile.id, period.year_month);
  end loop;
  return profile;
end
$$;

create or replace function public.send_bulk_submission_reminders(p_year_month text)
returns integer language plpgsql security definer set search_path = public as $$
declare sent integer;
begin
  if not public.is_admin() then raise exception '관리자 권한이 필요합니다.' using errcode = '42501'; end if;
  if p_year_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception '올바른 연월(YYYY-MM)을 입력해주세요.' using errcode = '22023';
  end if;
  insert into public.notifications(user_id, type, message)
  select p.id, 'REMINDER', p.name || '님, ' || split_part(p_year_month, '-', 2)::int || '월 출근부를 제출해주세요.'
  from public.profiles p
  join public.monthly_reports r on r.student_id = p.id and r.year_month = p_year_month
  where p.role = 'STUDENT' and r.status not in ('SUBMITTED', 'APPROVED')
    and p.notification_enabled;
  get diagnostics sent = row_count;
  return sent;
end
$$;

create or replace function public.resend_submission_reminder(
  p_student_id uuid, p_year_month text
) returns public.notifications
language plpgsql security definer set search_path = public as $$
declare notice public.notifications; report_status public.report_status; student_name text; notices_enabled boolean;
begin
  if not public.is_admin() then raise exception '관리자 권한이 필요합니다.' using errcode = '42501'; end if;
  select r.status, p.name, p.notification_enabled into report_status, student_name, notices_enabled
  from public.profiles p join public.monthly_reports r on r.student_id = p.id and r.year_month = p_year_month
  where p.id = p_student_id and p.role = 'STUDENT';
  if student_name is null then raise exception '해당 월의 학생 리포트를 찾을 수 없습니다.' using errcode = 'P0002'; end if;
  if not notices_enabled then raise exception '학생이 서비스 알림을 받지 않도록 설정했습니다.' using errcode = 'P0001'; end if;
  if report_status in ('SUBMITTED', 'APPROVED') then raise exception '이미 제출한 학생에게는 리마인더를 보낼 수 없습니다.' using errcode = 'P0001'; end if;
  insert into public.notifications(user_id, type, message)
  values (p_student_id, 'REMINDER', student_name || '님, ' || split_part(p_year_month, '-', 2)::int || '월 출근부를 제출해주세요.')
  returning * into notice;
  return notice;
end
$$;

create or replace function public.notify_report_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare student_name text; month_label text := split_part(new.year_month, '-', 2)::int::text || '월';
begin
  if new.status is not distinct from old.status then return new; end if;
  select name into student_name from public.profiles where id = new.student_id;
  if new.status = 'SUBMITTED' then
    insert into public.notifications(user_id, type, message)
    select new.student_id, 'SUBMITTED', month_label || ' 출근부 제출이 완료되었습니다.'
    where (select notification_enabled from public.profiles where id = new.student_id);
    insert into public.notifications(user_id, type, message)
    select id, 'SUBMITTED', student_name || ' 학생이 ' || month_label || ' 출근부를 제출했습니다.'
    from public.profiles where role = 'ADMIN' and notification_enabled;
  elsif new.status = 'APPROVED' then
    insert into public.notifications(user_id, type, message)
    select new.student_id, 'APPROVED', month_label || ' 출근부가 승인되었습니다.'
    where (select notification_enabled from public.profiles where id = new.student_id);
  elsif new.status = 'REJECTED' then
    insert into public.notifications(user_id, type, message)
    select new.student_id, 'REJECTED', month_label || ' 출근부가 반려되었습니다. 사유: ' || new.rejection_reason
    where (select notification_enabled from public.profiles where id = new.student_id);
  end if;
  return new;
end
$$;

create or replace function public.submit_monthly_report(p_report_id uuid)
returns public.monthly_reports
language plpgsql security definer set search_path = public, storage as $$
declare report public.monthly_reports; period public.submission_periods; object_metadata jsonb;
begin
  select * into report from public.monthly_reports where id = p_report_id for update;
  if report.id is null or report.student_id <> auth.uid() then raise exception '리포트를 제출할 권한이 없습니다.' using errcode = '42501'; end if;
  if report.status not in ('WRITING', 'REJECTED') then raise exception '현재 상태에서는 제출할 수 없습니다.' using errcode = 'P0001'; end if;
  if report.file_name is null or report.file_path is null
     or report.file_path not like report.year_month || '/' || report.student_id::text || '/%'
     or lower(storage.extension(report.file_path)) <> 'pdf' then
    raise exception '유효한 PDF 파일을 먼저 업로드해주세요.' using errcode = 'P0001';
  end if;
  select metadata into object_metadata from storage.objects
  where bucket_id = 'attendance-reports' and name = report.file_path;
  if object_metadata is null or lower(coalesce(object_metadata->>'mimetype', '')) <> 'application/pdf'
     or coalesce((object_metadata->>'size')::bigint, 0) not between 1 and 10485760 then
    raise exception 'Storage에서 유효한 PDF 파일을 확인할 수 없습니다.' using errcode = 'P0001';
  end if;
  select * into period from public.submission_periods where year_month = report.year_month;
  if period.id is null or now() not between period.start_date and period.end_date then raise exception '제출 기간이 아닙니다.' using errcode = 'P0001'; end if;
  perform set_config('app.report_submit', 'true', true);
  update public.monthly_reports set status = 'SUBMITTED', submitted_at = now(),
    reviewed_at = null, reviewed_by = null, rejection_reason = null,
    submission_count = submission_count + 1
  where id = report.id returning * into report;
  return report;
end
$$;

alter table public.report_status_history enable row level security;
create policy report_history_select on public.report_status_history
for select to authenticated using (student_id = auth.uid() or public.is_admin());

revoke all on table public.report_status_history from anon, authenticated;
grant select on table public.report_status_history to authenticated;

grant execute on function public.update_my_profile(text, text, text, boolean) to authenticated;
grant execute on function public.update_student_profile(uuid, text, text, text, text, text, date, date, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.send_bulk_submission_reminders(text) to authenticated;
revoke execute on function public.update_my_profile(text, text, text, boolean) from public, anon;
revoke execute on function public.update_student_profile(uuid, text, text, text, text, text, date, date, text, text, text, text, text, text, text) from public, anon;
revoke execute on function public.send_bulk_submission_reminders(text) from public, anon;

commit;
