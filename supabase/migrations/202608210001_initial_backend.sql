create extension if not exists pgcrypto;

create type public.user_role as enum ('STUDENT','ADMIN');
create type public.attendance_status as enum ('PRESENT','LATE','ABSENT','VACATION');
create type public.report_status as enum ('NOT_STARTED','WRITING','SUBMITTED','APPROVED','REJECTED');
create type public.notification_type as enum ('REMINDER','SUBMITTED','APPROVED','REJECTED');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 3 and 40),
  role public.user_role not null default 'STUDENT',
  student_number text unique,
  name text not null check (char_length(name) between 1 and 60),
  school text,
  class_number text,
  company text,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_fields_required check (
    role = 'ADMIN' or (
      student_number is not null and school is not null and class_number is not null and
      company is not null and start_date is not null and end_date is not null and start_date <= end_date
    )
  )
);

create table public.submission_periods (
  id uuid primary key default gen_random_uuid(),
  year_month text unique not null check (year_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  start_date timestamptz not null,
  end_date timestamptz not null,
  created_at timestamptz not null default now(),
  constraint valid_submission_period check (start_date < end_date)
);

create table public.attendance_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  check_in time,
  check_out time,
  work_summary text not null default '' check (char_length(work_summary) <= 1000),
  status public.attendance_status not null default 'PRESENT',
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id,date),
  constraint valid_work_times check (check_in is null or check_out is null or check_in <= check_out)
);

create table public.monthly_reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  year_month text not null check (year_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status public.report_status not null default 'NOT_STARTED',
  file_name text,
  file_path text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id,year_month),
  constraint report_file_pair check ((file_name is null) = (file_path is null))
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.notification_type not null,
  message text not null check (char_length(message) between 1 and 500),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index attendance_logs_student_date_idx on public.attendance_logs(student_id,date);
create index monthly_reports_month_status_idx on public.monthly_reports(year_month,status);
create index notifications_user_unread_idx on public.notifications(user_id,is_read,created_at desc);

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path=public as $$
begin new.updated_at=now(); return new; end $$;
create trigger profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger logs_updated_at before update on public.attendance_logs for each row execute procedure public.set_updated_at();
create trigger reports_updated_at before update on public.monthly_reports for each row execute procedure public.set_updated_at();

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='ADMIN')
$$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
declare profile_role public.user_role := 'STUDENT';
begin
  insert into public.profiles(id,username,role,student_number,name,school,class_number,company,start_date,end_date)
  values(
    new.id, new.raw_user_meta_data->>'username', profile_role,
    new.raw_user_meta_data->>'student_number', coalesce(new.raw_user_meta_data->>'name','사용자'),
    new.raw_user_meta_data->>'school', new.raw_user_meta_data->>'class_number', new.raw_user_meta_data->>'company',
    nullif(new.raw_user_meta_data->>'start_date','')::date, nullif(new.raw_user_meta_data->>'end_date','')::date
  );
  insert into public.monthly_reports(student_id,year_month)
  select new.id,p.year_month from public.submission_periods p on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.create_period_artifacts() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.monthly_reports(student_id,year_month)
  select id,new.year_month from public.profiles where role='STUDENT' on conflict do nothing;
  insert into public.notifications(user_id,type,message)
  select id,'REMINDER',replace(new.year_month,'-','년 ')||'월 출근부 제출 기간이 시작되었습니다.' from public.profiles where role='STUDENT';
  return new;
end $$;
create trigger on_submission_period_created after insert on public.submission_periods for each row execute procedure public.create_period_artifacts();

create or replace function public.guard_attendance_write() returns trigger language plpgsql security definer set search_path=public as $$
declare target_student uuid:=coalesce(new.student_id,old.student_id); target_date date:=coalesce(new.date,old.date); locked boolean;
begin
  if auth.uid() is not null and auth.uid()<>target_student then raise exception '본인의 출근 기록만 변경할 수 있습니다.' using errcode='42501'; end if;
  select status in ('SUBMITTED','APPROVED') into locked from public.monthly_reports where student_id=target_student and year_month=to_char(target_date,'YYYY-MM');
  if coalesce(locked,false) then raise exception '제출 완료된 출근부는 수정할 수 없습니다.' using errcode='P0001'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger attendance_write_guard before insert or update or delete on public.attendance_logs for each row execute procedure public.guard_attendance_write();

create or replace function public.guard_report_update() returns trigger language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); admin boolean:=public.is_admin();
begin
  if actor is null then return new; end if;
  if admin then
    if new.status is distinct from old.status and not (old.status='SUBMITTED' and new.status in ('APPROVED','REJECTED')) then
      raise exception '관리자는 제출 완료 리포트만 승인 또는 반려할 수 있습니다.' using errcode='P0001';
    end if;
  elsif actor=old.student_id then
    if old.status in ('SUBMITTED','APPROVED') and new is distinct from old then raise exception '제출 완료된 리포트는 수정할 수 없습니다.' using errcode='P0001'; end if;
    if new.status in ('APPROVED','REJECTED') and new.status is distinct from old.status then raise exception '해당 상태는 관리자를 통해서만 변경할 수 있습니다.' using errcode='42501'; end if;
    if new.status='SUBMITTED' and new.status is distinct from old.status and coalesce(current_setting('app.report_submit',true),'false')<>'true' then raise exception '제출 상태는 전용 제출 API를 통해서만 변경할 수 있습니다.' using errcode='42501'; end if;
  else raise exception '리포트를 변경할 권한이 없습니다.' using errcode='42501';
  end if;
  return new;
end $$;
create trigger report_update_guard before update on public.monthly_reports for each row execute procedure public.guard_report_update();

create or replace function public.notify_report_status() returns trigger language plpgsql security definer set search_path=public as $$
declare student_name text; month_label text:=split_part(new.year_month,'-',2)::int::text||'월';
begin
  if new.status is not distinct from old.status then return new; end if;
  select name into student_name from public.profiles where id=new.student_id;
  if new.status='SUBMITTED' then
    insert into public.notifications(user_id,type,message) values(new.student_id,'SUBMITTED',month_label||' 출근부 제출이 완료되었습니다.');
    insert into public.notifications(user_id,type,message) select id,'SUBMITTED',student_name||' 학생이 '||month_label||' 출근부를 제출했습니다.' from public.profiles where role='ADMIN';
  elsif new.status='APPROVED' then insert into public.notifications(user_id,type,message) values(new.student_id,'APPROVED',month_label||' 출근부가 승인되었습니다.');
  elsif new.status='REJECTED' then insert into public.notifications(user_id,type,message) values(new.student_id,'REJECTED',month_label||' 출근부가 반려되었습니다.');
  end if;
  return new;
end $$;
create trigger report_status_notification after update of status on public.monthly_reports for each row execute procedure public.notify_report_status();

create or replace function public.submit_monthly_report(p_report_id uuid) returns public.monthly_reports language plpgsql security definer set search_path=public as $$
declare report public.monthly_reports; period public.submission_periods;
begin
  select * into report from public.monthly_reports where id=p_report_id for update;
  if report.id is null or report.student_id<>auth.uid() then raise exception '리포트를 제출할 권한이 없습니다.' using errcode='42501'; end if;
  if report.status not in ('WRITING','REJECTED') then raise exception '현재 상태에서는 제출할 수 없습니다.' using errcode='P0001'; end if;
  if report.file_name is null or report.file_path is null then raise exception 'PDF 파일을 먼저 업로드해주세요.' using errcode='P0001'; end if;
  select * into period from public.submission_periods where year_month=report.year_month;
  if period.id is null or now() not between period.start_date and period.end_date then raise exception '제출 기간이 아닙니다.' using errcode='P0001'; end if;
  perform set_config('app.report_submit','true',true);
  update public.monthly_reports set status='SUBMITTED',submitted_at=now(),reviewed_at=null,reviewed_by=null,rejection_reason=null where id=report.id returning * into report;
  return report;
end $$;

create or replace function public.review_monthly_report(p_report_id uuid,p_decision public.report_status,p_reason text default null) returns public.monthly_reports language plpgsql security definer set search_path=public as $$
declare report public.monthly_reports;
begin
  if not public.is_admin() then raise exception '관리자 권한이 필요합니다.' using errcode='42501'; end if;
  if p_decision not in ('APPROVED','REJECTED') then raise exception '승인 또는 반려 상태만 선택할 수 있습니다.' using errcode='22023'; end if;
  if p_decision='REJECTED' and coalesce(char_length(trim(p_reason)),0)>500 then raise exception '반려 사유는 500자 이하여야 합니다.' using errcode='22023'; end if;
  select * into report from public.monthly_reports where id=p_report_id for update;
  if report.id is null or report.status<>'SUBMITTED' then raise exception '제출 완료 상태만 검토할 수 있습니다.' using errcode='P0001'; end if;
  update public.monthly_reports set status=p_decision,reviewed_at=now(),reviewed_by=auth.uid(),rejection_reason=case when p_decision='REJECTED' then nullif(trim(p_reason),'') else null end where id=report.id returning * into report;
  return report;
end $$;

create or replace function public.resend_submission_reminder(p_student_id uuid,p_year_month text) returns public.notifications language plpgsql security definer set search_path=public as $$
declare notice public.notifications; report_status public.report_status; student_name text;
begin
  if not public.is_admin() then raise exception '관리자 권한이 필요합니다.' using errcode='42501'; end if;
  select r.status,p.name into report_status,student_name from public.profiles p left join public.monthly_reports r on r.student_id=p.id and r.year_month=p_year_month where p.id=p_student_id and p.role='STUDENT';
  if student_name is null then raise exception '학생을 찾을 수 없습니다.' using errcode='P0002'; end if;
  if report_status in ('SUBMITTED','APPROVED') then raise exception '이미 제출한 학생에게는 Reminder를 보낼 수 없습니다.' using errcode='P0001'; end if;
  insert into public.notifications(user_id,type,message) values(p_student_id,'REMINDER',student_name||'님, '||split_part(p_year_month,'-',2)::int||'월 출근부를 제출해주세요.') returning * into notice;
  return notice;
end $$;

create or replace function public.get_admin_dashboard(p_year_month text) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception '관리자 권한이 필요합니다.' using errcode='42501'; end if;
  with student_reports as (
    select p.class_number,coalesce(r.status,'NOT_STARTED'::public.report_status) status from public.profiles p left join public.monthly_reports r on r.student_id=p.id and r.year_month=p_year_month where p.role='STUDENT'
  ), totals as (
    select count(*) total,count(*) filter(where status in ('SUBMITTED','APPROVED')) submitted from student_reports
  ), classes as (
    select class_number,count(*) total,count(*) filter(where status in ('SUBMITTED','APPROVED')) submitted from student_reports group by class_number order by class_number
  )
  select jsonb_build_object('totalStudents',t.total,'submitted',t.submitted,'missing',t.total-t.submitted,'submissionRate',case when t.total=0 then 0 else round(t.submitted::numeric/t.total*100,1) end,'classes',coalesce((select jsonb_agg(jsonb_build_object('classNumber',c.class_number,'total',c.total,'submitted',c.submitted,'rate',case when c.total=0 then 0 else round(c.submitted::numeric/c.total*100,1) end)) from classes c),'[]'::jsonb)) into result from totals t;
  return result;
end $$;

grant execute on function public.submit_monthly_report(uuid) to authenticated;
grant execute on function public.review_monthly_report(uuid,public.report_status,text) to authenticated;
grant execute on function public.resend_submission_reminder(uuid,text) to authenticated;
grant execute on function public.get_admin_dashboard(text) to authenticated;
revoke execute on function public.submit_monthly_report(uuid) from public,anon;
revoke execute on function public.review_monthly_report(uuid,public.report_status,text) from public,anon;
revoke execute on function public.resend_submission_reminder(uuid,text) from public,anon;
revoke execute on function public.get_admin_dashboard(text) from public,anon;

alter table public.profiles enable row level security;
alter table public.attendance_logs enable row level security;
alter table public.monthly_reports enable row level security;
alter table public.submission_periods enable row level security;
alter table public.notifications enable row level security;

create policy profiles_select on public.profiles for select to authenticated using (id=auth.uid() or public.is_admin());
create policy profiles_student_update on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid() and role='STUDENT');
create policy profiles_admin_update on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy logs_select on public.attendance_logs for select to authenticated using (student_id=auth.uid() or public.is_admin());
create policy logs_student_insert on public.attendance_logs for insert to authenticated with check (student_id=auth.uid());
create policy logs_student_update on public.attendance_logs for update to authenticated using (student_id=auth.uid()) with check (student_id=auth.uid());
create policy logs_student_delete on public.attendance_logs for delete to authenticated using (student_id=auth.uid());
create policy reports_select on public.monthly_reports for select to authenticated using (student_id=auth.uid() or public.is_admin());
create policy reports_student_update on public.monthly_reports for update to authenticated using (student_id=auth.uid()) with check (student_id=auth.uid());
create policy periods_select on public.submission_periods for select to authenticated using (true);
create policy periods_admin_write on public.submission_periods for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy notifications_select on public.notifications for select to authenticated using (user_id=auth.uid());
create policy notifications_read on public.notifications for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
revoke insert,delete,update on public.notifications from authenticated;
grant update(is_read) on public.notifications to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('attendance-reports','attendance-reports',false,10485760,array['application/pdf']) on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['application/pdf'];
create policy report_owner_upload on storage.objects for insert to authenticated with check (bucket_id='attendance-reports' and (storage.foldername(name))[2]=auth.uid()::text and lower(storage.extension(name))='pdf');
create policy report_owner_replace on storage.objects for update to authenticated using (bucket_id='attendance-reports' and (storage.foldername(name))[2]=auth.uid()::text) with check (bucket_id='attendance-reports' and (storage.foldername(name))[2]=auth.uid()::text and lower(storage.extension(name))='pdf');
create policy report_owner_or_admin_read on storage.objects for select to authenticated using (bucket_id='attendance-reports' and ((storage.foldername(name))[2]=auth.uid()::text or public.is_admin()));

insert into public.submission_periods(year_month,start_date,end_date) values('2026-08','2026-08-01 00:00:00+09','2026-08-31 23:59:59+09') on conflict(year_month) do nothing;
