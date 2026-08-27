-- Repair Data API privileges and make monthly artifacts/security explicit.

create or replace function public.ensure_student_month(
  p_student_id uuid,
  p_year_month text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  month_start date;
  month_end date;
begin
  if p_year_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception '올바른 연월(YYYY-MM)을 입력해주세요.' using errcode = '22023';
  end if;

  month_start := (p_year_month || '-01')::date;
  month_end := (month_start + interval '1 month - 1 day')::date;

  insert into public.monthly_reports(student_id, year_month)
  select p.id, p_year_month
  from public.profiles p
  where p.id = p_student_id
    and p.role = 'STUDENT'
    and p.start_date <= month_end
    and p.end_date >= month_start
  on conflict (student_id, year_month) do nothing;

  insert into public.attendance_logs(student_id, date)
  select p.id, day::date
  from public.profiles p
  cross join generate_series(
    greatest(month_start, p.start_date),
    least(month_end, p.end_date),
    interval '1 day'
  ) day
  where p.id = p_student_id
    and p.role = 'STUDENT'
    and extract(isodow from day) between 1 and 5
  on conflict (student_id, date) do nothing;
end
$$;

revoke all on function public.ensure_student_month(uuid, text) from public, anon, authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  period record;
begin
  insert into public.profiles(
    id, username, role, student_number, name, school, class_number,
    company, start_date, end_date
  ) values (
    new.id,
    new.raw_user_meta_data->>'username',
    'STUDENT',
    new.raw_user_meta_data->>'student_number',
    coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), '사용자'),
    new.raw_user_meta_data->>'school',
    new.raw_user_meta_data->>'class_number',
    new.raw_user_meta_data->>'company',
    nullif(new.raw_user_meta_data->>'start_date', '')::date,
    nullif(new.raw_user_meta_data->>'end_date', '')::date
  );

  for period in select year_month from public.submission_periods loop
    perform public.ensure_student_month(new.id, period.year_month);
  end loop;
  return new;
end
$$;

create or replace function public.create_period_artifacts() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  student record;
begin
  for student in select id from public.profiles where role = 'STUDENT' loop
    perform public.ensure_student_month(student.id, new.year_month);
  end loop;

  if tg_op = 'INSERT' then
    insert into public.notifications(user_id, type, message)
    select id, 'REMINDER', replace(new.year_month, '-', '년 ') || '월 출근부 제출 기간이 등록되었습니다.'
    from public.profiles
    where role = 'STUDENT'
      and start_date <= (new.year_month || '-01')::date + interval '1 month - 1 day'
      and end_date >= (new.year_month || '-01')::date;
  end if;
  return new;
end
$$;

drop trigger if exists on_submission_period_created on public.submission_periods;
create trigger on_submission_period_saved
after insert or update of start_date, end_date on public.submission_periods
for each row execute procedure public.create_period_artifacts();

create or replace function public.manage_submission_period(
  p_year_month text,
  p_start_date timestamptz,
  p_end_date timestamptz
) returns public.submission_periods
language plpgsql
security definer
set search_path = public
as $$
declare
  period public.submission_periods;
begin
  if not public.is_admin() then
    raise exception '관리자 권한이 필요합니다.' using errcode = '42501';
  end if;
  if p_year_month !~ '^\d{4}-(0[1-9]|1[0-2])$' or p_start_date >= p_end_date then
    raise exception '제출 기간을 올바르게 입력해주세요.' using errcode = '22023';
  end if;

  insert into public.submission_periods(year_month, start_date, end_date)
  values (p_year_month, p_start_date, p_end_date)
  on conflict (year_month) do update
  set start_date = excluded.start_date, end_date = excluded.end_date
  returning * into period;
  return period;
end
$$;

create or replace function public.save_monthly_report_draft(
  p_report_id uuid,
  p_file_name text default null,
  p_file_path text default null
) returns public.monthly_reports
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  report public.monthly_reports;
begin
  select * into report from public.monthly_reports where id = p_report_id for update;
  if report.id is null or report.student_id <> auth.uid() then
    raise exception '리포트를 수정할 권한이 없습니다.' using errcode = '42501';
  end if;
  if report.status in ('SUBMITTED', 'APPROVED') then
    raise exception '제출 완료된 리포트는 수정할 수 없습니다.' using errcode = 'P0001';
  end if;
  if (p_file_name is null) <> (p_file_path is null) then
    raise exception '파일 이름과 경로를 함께 입력해주세요.' using errcode = '22023';
  end if;
  if p_file_path is not null and (
    p_file_path not like report.year_month || '/' || report.student_id::text || '/%'
    or lower(storage.extension(p_file_path)) <> 'pdf'
  ) then
    raise exception '허용되지 않은 PDF 경로입니다.' using errcode = '42501';
  end if;

  update public.monthly_reports
  set status = 'WRITING',
      file_name = coalesce(p_file_name, file_name),
      file_path = coalesce(p_file_path, file_path),
      rejection_reason = null,
      reviewed_at = null,
      reviewed_by = null
  where id = report.id
  returning * into report;
  return report;
end
$$;

create or replace function public.submit_monthly_report(p_report_id uuid)
returns public.monthly_reports
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  report public.monthly_reports;
  period public.submission_periods;
  object_metadata jsonb;
begin
  select * into report from public.monthly_reports where id = p_report_id for update;
  if report.id is null or report.student_id <> auth.uid() then
    raise exception '리포트를 제출할 권한이 없습니다.' using errcode = '42501';
  end if;
  if report.status not in ('WRITING', 'REJECTED') then
    raise exception '현재 상태에서는 제출할 수 없습니다.' using errcode = 'P0001';
  end if;
  if report.file_name is null or report.file_path is null
     or report.file_path not like report.year_month || '/' || report.student_id::text || '/%'
     or lower(storage.extension(report.file_path)) <> 'pdf' then
    raise exception '유효한 PDF 파일을 먼저 업로드해주세요.' using errcode = 'P0001';
  end if;

  select metadata into object_metadata
  from storage.objects
  where bucket_id = 'attendance-reports' and name = report.file_path;
  if object_metadata is null
     or lower(coalesce(object_metadata->>'mimetype', '')) <> 'application/pdf'
     or coalesce((object_metadata->>'size')::bigint, 0) <= 0
     or coalesce((object_metadata->>'size')::bigint, 0) > 10485760 then
    raise exception 'Storage에서 유효한 PDF 파일을 확인할 수 없습니다.' using errcode = 'P0001';
  end if;

  select * into period from public.submission_periods where year_month = report.year_month;
  if period.id is null or now() not between period.start_date and period.end_date then
    raise exception '제출 기간이 아닙니다.' using errcode = 'P0001';
  end if;

  perform set_config('app.report_submit', 'true', true);
  update public.monthly_reports
  set status = 'SUBMITTED', submitted_at = now(), reviewed_at = null,
      reviewed_by = null, rejection_reason = null
  where id = report.id
  returning * into report;
  return report;
end
$$;

create or replace function public.review_monthly_report(
  p_report_id uuid,
  p_decision public.report_status,
  p_reason text default null
) returns public.monthly_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  report public.monthly_reports;
begin
  if not public.is_admin() then
    raise exception '관리자 권한이 필요합니다.' using errcode = '42501';
  end if;
  if p_decision not in ('APPROVED', 'REJECTED') then
    raise exception '승인 또는 반려 상태만 선택할 수 있습니다.' using errcode = '22023';
  end if;
  if p_decision = 'REJECTED' and coalesce(char_length(trim(p_reason)), 0) = 0 then
    raise exception '반려 사유를 입력해주세요.' using errcode = '22023';
  end if;
  if coalesce(char_length(trim(p_reason)), 0) > 500 then
    raise exception '반려 사유는 500자 이하여야 합니다.' using errcode = '22023';
  end if;

  select * into report from public.monthly_reports where id = p_report_id for update;
  if report.id is null or report.status <> 'SUBMITTED' then
    raise exception '제출 완료 상태만 검토할 수 있습니다.' using errcode = 'P0001';
  end if;
  update public.monthly_reports
  set status = p_decision, reviewed_at = now(), reviewed_by = auth.uid(),
      rejection_reason = case when p_decision = 'REJECTED' then trim(p_reason) else null end
  where id = report.id
  returning * into report;
  return report;
end
$$;

create or replace function public.resend_submission_reminder(
  p_student_id uuid,
  p_year_month text
) returns public.notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  notice public.notifications;
  report_status public.report_status;
  student_name text;
begin
  if not public.is_admin() then
    raise exception '관리자 권한이 필요합니다.' using errcode = '42501';
  end if;
  select r.status, p.name into report_status, student_name
  from public.profiles p
  join public.monthly_reports r
    on r.student_id = p.id and r.year_month = p_year_month
  where p.id = p_student_id and p.role = 'STUDENT';
  if student_name is null then
    raise exception '해당 월의 학생 리포트를 찾을 수 없습니다.' using errcode = 'P0002';
  end if;
  if report_status in ('SUBMITTED', 'APPROVED') then
    raise exception '이미 제출한 학생에게는 리마인더를 보낼 수 없습니다.' using errcode = 'P0001';
  end if;
  insert into public.notifications(user_id, type, message)
  values (p_student_id, 'REMINDER', student_name || '님, ' || split_part(p_year_month, '-', 2)::int || '월 출근부를 제출해주세요.')
  returning * into notice;
  return notice;
end
$$;

create or replace function public.get_admin_dashboard(
  p_year_month text
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception '관리자 권한이 필요합니다.' using errcode = '42501';
  end if;
  if p_year_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception '올바른 연월(YYYY-MM)을 입력해주세요.' using errcode = '22023';
  end if;

  with student_reports as (
    select
      p.class_number,
      coalesce(r.status, 'NOT_STARTED'::public.report_status) as status
    from public.profiles p
    left join public.monthly_reports r
      on r.student_id = p.id
     and r.year_month = p_year_month
    where p.role = 'STUDENT'
  ), totals as (
    select
      count(*) as total,
      count(*) filter (where status in ('SUBMITTED', 'APPROVED')) as submitted
    from student_reports
  ), classes as (
    select
      class_number,
      count(*) as total,
      count(*) filter (where status in ('SUBMITTED', 'APPROVED')) as submitted
    from student_reports
    group by class_number
    order by class_number
  )
  select jsonb_build_object(
    'totalStudents', t.total,
    'submitted', t.submitted,
    'missing', t.total - t.submitted,
    'submissionRate', case
      when t.total = 0 then 0
      else round(t.submitted::numeric / t.total * 100, 1)
    end,
    'classes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'classNumber', c.class_number,
        'total', c.total,
        'submitted', c.submitted,
        'rate', case
          when c.total = 0 then 0
          else round(c.submitted::numeric / c.total * 100, 1)
        end
      ))
      from classes c
    ), '[]'::jsonb)
  into result
  from totals t;

  return result;
end
$$;

create or replace function public.notify_report_status() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  student_name text;
  month_label text := split_part(new.year_month, '-', 2)::int::text || '월';
begin
  if new.status is not distinct from old.status then return new; end if;
  select name into student_name from public.profiles where id = new.student_id;
  if new.status = 'SUBMITTED' then
    insert into public.notifications(user_id, type, message) values (new.student_id, 'SUBMITTED', month_label || ' 출근부 제출이 완료되었습니다.');
    insert into public.notifications(user_id, type, message)
    select id, 'SUBMITTED', student_name || ' 학생이 ' || month_label || ' 출근부를 제출했습니다.' from public.profiles where role = 'ADMIN';
  elsif new.status = 'APPROVED' then
    insert into public.notifications(user_id, type, message) values (new.student_id, 'APPROVED', month_label || ' 출근부가 승인되었습니다.');
  elsif new.status = 'REJECTED' then
    insert into public.notifications(user_id, type, message)
    values (new.student_id, 'REJECTED', month_label || ' 출근부가 반려되었습니다. 사유: ' || new.rejection_reason);
  end if;
  return new;
end
$$;

update public.monthly_reports
set rejection_reason = '사유가 기록되지 않은 기존 반려 건입니다.'
where status = 'REJECTED' and coalesce(trim(rejection_reason), '') = '';

alter table public.monthly_reports
  add constraint rejected_report_requires_reason
  check (status <> 'REJECTED' or coalesce(char_length(trim(rejection_reason)), 0) > 0);

create or replace function public.guard_profile_update() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() = old.id and not public.is_admin() and (
    new.id is distinct from old.id or
    new.username is distinct from old.username or
    new.role is distinct from old.role or
    new.student_number is distinct from old.student_number or
    new.school is distinct from old.school or
    new.class_number is distinct from old.class_number or
    new.company is distinct from old.company or
    new.start_date is distinct from old.start_date or
    new.end_date is distinct from old.end_date
  ) then
    raise exception '학생은 민감한 프로필 정보를 변경할 수 없습니다.' using errcode = '42501';
  end if;
  return new;
end
$$;

drop trigger if exists profile_sensitive_fields_guard on public.profiles;
create trigger profile_sensitive_fields_guard
before update on public.profiles
for each row execute procedure public.guard_profile_update();

drop policy if exists profiles_student_update on public.profiles;
drop policy if exists reports_student_update on public.monthly_reports;

grant usage on schema public to authenticated;
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.attendance_logs from anon, authenticated;
revoke all on table public.monthly_reports from anon, authenticated;
revoke all on table public.submission_periods from anon, authenticated;
revoke all on table public.notifications from anon, authenticated;

grant select on table public.profiles to authenticated;
grant select, insert, update, delete on table public.attendance_logs to authenticated;
grant select on table public.monthly_reports to authenticated;
grant select on table public.submission_periods to authenticated;
grant select on table public.notifications to authenticated;
grant update(is_read) on table public.notifications to authenticated;

grant execute on function public.manage_submission_period(text, timestamptz, timestamptz) to authenticated;
grant execute on function public.save_monthly_report_draft(uuid, text, text) to authenticated;
grant execute on function public.submit_monthly_report(uuid) to authenticated;
grant execute on function public.review_monthly_report(uuid, public.report_status, text) to authenticated;
grant execute on function public.resend_submission_reminder(uuid, text) to authenticated;
grant execute on function public.get_admin_dashboard(text) to authenticated;

revoke execute on function public.manage_submission_period(text, timestamptz, timestamptz) from public, anon;
revoke execute on function public.save_monthly_report_draft(uuid, text, text) from public, anon;
revoke execute on function public.get_admin_dashboard(text) from public, anon;

-- Backfill artifacts for periods and students created before this migration.
do $$
declare
  item record;
begin
  for item in
    select p.id student_id, s.year_month
    from public.profiles p
    cross join public.submission_periods s
    where p.role = 'STUDENT'
  loop
    perform public.ensure_student_month(item.student_id, item.year_month);
  end loop;
end
$$;
