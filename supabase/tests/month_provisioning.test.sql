begin;
create extension if not exists pgtap;

select plan(14);

insert into auth.users(id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'provision-student@example.test', crypt('password', gen_salt('bf')), '{}', '{"username":"provision_student","student_number":"PRO001","name":"프로비저닝 학생","school":"테스트학교","class_number":"1반","company":"테스트회사","start_date":"2026-07-15","end_date":"2026-09-10"}', now(), now()),
('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'provision-other@example.test', crypt('password', gen_salt('bf')), '{}', '{"username":"provision_other","student_number":"PRO002","name":"다른 학생","school":"테스트학교","class_number":"2반","company":"테스트회사","start_date":"2026-08-01","end_date":"2026-08-31"}', now(), now()),
('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'provision-admin@example.test', crypt('password', gen_salt('bf')), '{}', '{"username":"provision_admin","student_number":"PRO003","name":"관리자","school":"테스트학교","class_number":"관리","company":"테스트회사","start_date":"2026-08-01","end_date":"2026-08-31"}', now(), now());

update public.profiles set role = 'ADMIN', student_number = null, school = null,
  class_number = null, company = null, start_date = null, end_date = null
where id = '20000000-0000-0000-0000-000000000003';

select is(
  (select array_agg(year_month order by year_month) from public.monthly_reports where student_id = '20000000-0000-0000-0000-000000000001'),
  array['2026-07','2026-08','2026-09']::text[],
  '새 학생은 실습기간과 겹치는 모든 월 리포트를 받는다'
);
select is(
  (select count(*)::integer from public.attendance_logs where student_id = '20000000-0000-0000-0000-000000000001'),
  42,
  '새 학생은 실습 범위 내 평일 출근 기록을 받는다'
);
select is(
  (select count(*)::integer from public.attendance_logs where student_id = '20000000-0000-0000-0000-000000000001' and (date < '2026-07-15' or date > '2026-09-10')),
  0,
  '출근 기록은 실습 시작일과 종료일을 벗어나지 않는다'
);
select is(
  (select count(*)::integer from public.attendance_logs where student_id = '20000000-0000-0000-0000-000000000001' and extract(isodow from date) > 5),
  0,
  '주말 출근 기록은 프로비저닝하지 않는다'
);
insert into public.submission_periods(year_month, start_date, end_date)
values ('2026-10', '2026-10-01 00:00:00+09', '2026-10-31 23:59:59+09')
on conflict (year_month) do update set start_date = excluded.start_date, end_date = excluded.end_date;
select is((select count(*)::integer from public.monthly_reports where student_id = '20000000-0000-0000-0000-000000000001' and year_month = '2026-10'), 0, '제출 기간 생성은 월 데이터를 만들지 않는다');

delete from public.attendance_logs where student_id = '20000000-0000-0000-0000-000000000001' and date between '2026-08-01' and '2026-08-31';
delete from public.monthly_reports where student_id = '20000000-0000-0000-0000-000000000001' and year_month = '2026-08';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is((public.ensure_my_month('2026-08')).year_month, '2026-08', '누락된 2026-08 리포트를 본인이 복구한다');
select is((select count(*)::integer from public.monthly_reports where student_id = auth.uid() and year_month = '2026-08'), 1, '복구된 월 리포트는 한 건이다');
select is((select count(*)::integer from public.attendance_logs where student_id = auth.uid() and date between '2026-08-01' and '2026-08-31'), 21, '복구 RPC가 해당 월 평일 출근 기록을 만든다');
select lives_ok($$select public.ensure_my_month('2026-08')$$, '같은 월 복구를 반복 호출할 수 있다');
select is((select count(*)::integer from public.monthly_reports where student_id = auth.uid() and year_month = '2026-08'), 1, '반복 호출에도 리포트가 중복되지 않는다');
select is((select count(*)::integer from public.attendance_logs where student_id = auth.uid() and date between '2026-08-01' and '2026-08-31'), 21, '반복 호출에도 출근 기록이 중복되지 않는다');
select throws_ok($$select public.ensure_my_month('2026-10')$$, '22023', '선택한 월은 실습 기간에 포함되지 않습니다.', '실습기간 밖의 월은 거부한다');
select is((select count(*)::integer from public.monthly_reports where student_id = auth.uid() and year_month = '2026-10'), 0, '실습기간 밖에는 데이터를 만들지 않는다');

select set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select throws_ok($$select public.ensure_my_month('2026-08')$$, '42501', '학생 계정만 본인 월 데이터를 생성할 수 있습니다.', '관리자는 학생 self-healing RPC를 호출할 수 없다');

select * from finish();
rollback;
