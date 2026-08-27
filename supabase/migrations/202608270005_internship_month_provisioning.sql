begin;

-- Monthly working data belongs to the internship period. Submission periods are
-- intentionally not consulted anywhere in this provisioning path.
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
    and p.start_date <= month_end
    and p.end_date >= month_start
    and extract(isodow from day) between 1 and 5
  on conflict (student_id, date) do nothing;
end
$$;

create or replace function public.provision_student_internship(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  student public.profiles;
  month_start date;
begin
  select * into student
  from public.profiles
  where id = p_student_id and role = 'STUDENT';

  if student.id is null then
    return;
  end if;

  for month_start in
    select generate_series(
      date_trunc('month', student.start_date)::date,
      date_trunc('month', student.end_date)::date,
      interval '1 month'
    )::date
  loop
    perform public.ensure_student_month(student.id, to_char(month_start, 'YYYY-MM'));
  end loop;
end
$$;

revoke all on function public.ensure_student_month(uuid, text) from public, anon, authenticated;
revoke all on function public.provision_student_internship(uuid) from public, anon, authenticated;

-- Admin profile edits can extend an internship and invoke provisioning. Direct
-- admin writes are still denied by attendance_logs RLS/table policies.
create or replace function public.guard_attendance_write() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_student uuid := coalesce(new.student_id, old.student_id);
  target_date date := coalesce(new.date, old.date);
  locked boolean;
begin
  if auth.uid() is not null
     and auth.uid() <> target_student
     and not public.is_admin() then
    raise exception '본인의 출근 기록만 변경할 수 있습니다.' using errcode = '42501';
  end if;
  select status in ('SUBMITTED', 'APPROVED') into locked
  from public.monthly_reports
  where student_id = target_student and year_month = to_char(target_date, 'YYYY-MM');
  if coalesce(locked, false) then
    raise exception '제출 완료된 출근부는 수정할 수 없습니다.' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

create or replace function public.ensure_my_month(p_year_month text)
returns public.monthly_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  student public.profiles;
  month_start date;
  month_end date;
  report public.monthly_reports;
begin
  if p_year_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception '올바른 연월(YYYY-MM)을 입력해주세요.' using errcode = '22023';
  end if;

  select * into student
  from public.profiles
  where id = auth.uid() and role = 'STUDENT';
  if student.id is null then
    raise exception '학생 계정만 본인 월 데이터를 생성할 수 있습니다.' using errcode = '42501';
  end if;

  month_start := (p_year_month || '-01')::date;
  month_end := (month_start + interval '1 month - 1 day')::date;
  if student.start_date > month_end or student.end_date < month_start then
    raise exception '선택한 월은 실습 기간에 포함되지 않습니다.' using errcode = '22023';
  end if;

  perform public.ensure_student_month(student.id, p_year_month);
  select * into strict report
  from public.monthly_reports
  where student_id = student.id and year_month = p_year_month;
  return report;
end
$$;

grant execute on function public.ensure_my_month(text) to authenticated;
revoke execute on function public.ensure_my_month(text) from public, anon;

create or replace function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

  perform public.provision_student_internship(new.id);
  return new;
end
$$;

-- Saving a submission window must not create reports or attendance rows.
drop trigger if exists on_submission_period_saved on public.submission_periods;
drop function if exists public.create_period_artifacts();

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
declare profile public.profiles;
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

  perform public.provision_student_internship(profile.id);
  return profile;
end
$$;

-- Repair every existing student independently of configured submission windows.
do $$
declare student record;
begin
  for student in select id from public.profiles where role = 'STUDENT' loop
    perform public.provision_student_internship(student.id);
  end loop;
end
$$;

commit;
