begin;
create extension if not exists pgtap;

select plan(14);

insert into auth.users(id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-student-1@example.test', crypt('password', gen_salt('bf')), '{}', '{"username":"rls_student_1","student_number":"RLS001","name":"학생일","school":"테스트학교","class_number":"1반","company":"테스트회사","start_date":"2026-01-01","end_date":"2027-12-31"}', now(), now()),
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-student-2@example.test', crypt('password', gen_salt('bf')), '{}', '{"username":"rls_student_2","student_number":"RLS002","name":"학생이","school":"테스트학교","class_number":"2반","company":"테스트회사","start_date":"2026-01-01","end_date":"2027-12-31"}', now(), now()),
('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-admin@example.test', crypt('password', gen_salt('bf')), '{}', '{"username":"rls_admin","student_number":"RLS003","name":"관리자","school":"테스트학교","class_number":"관리","company":"테스트회사","start_date":"2026-01-01","end_date":"2027-12-31"}', now(), now());

update public.profiles set role = 'ADMIN', student_number = null, school = null,
  class_number = null, company = null, start_date = null, end_date = null
where id = '10000000-0000-0000-0000-000000000003';

update public.monthly_reports set status = 'SUBMITTED', submitted_at = now(), submission_count = 1
where student_id = '10000000-0000-0000-0000-000000000001' and year_month = to_char(current_date, 'YYYY-MM');
update public.monthly_reports set status = 'WRITING'
where student_id = '10000000-0000-0000-0000-000000000002' and year_month = to_char(current_date, 'YYYY-MM');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is((select count(*)::integer from public.profiles), 1, '학생은 본인 프로필만 조회한다');
select is((select count(*)::integer from public.report_status_history), 1, '학생은 본인의 상태 이력만 조회한다');
select throws_ok(
  $$update public.profiles set school = '변경시도' where id = '10000000-0000-0000-0000-000000000001'$$,
  '42501', null, '학생은 profiles를 직접 수정할 수 없다'
);
select lives_ok(
  $$select public.update_my_profile('학생일수정', 'student1@example.test', '010-1111-2222', false)$$,
  '학생은 허용된 연락처와 알림 설정을 RPC로 수정한다'
);
select is((select contact_email from public.profiles where id = auth.uid()), 'student1@example.test', '연락 이메일이 저장된다');
select is((select school from public.profiles where id = auth.uid()), '테스트학교', '학생 RPC는 관리자 통제 학교 정보를 보존한다');
select throws_ok(
  $$select public.review_monthly_report((select id from public.monthly_reports where student_id=auth.uid() and year_month=to_char(current_date,'YYYY-MM')), 'APPROVED', null)$$,
  '42501', '관리자 권한이 필요합니다.', '학생은 리포트를 검토할 수 없다'
);
select throws_ok(
  $$select public.send_bulk_submission_reminders(to_char(current_date,'YYYY-MM'))$$,
  '42501', '관리자 권한이 필요합니다.', '학생은 일괄 리마인더를 보낼 수 없다'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select is((select count(*)::integer from public.profiles where id in ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003')), 3, '관리자는 전체 학생 프로필을 조회한다');
select is(public.send_bulk_submission_reminders(to_char(current_date,'YYYY-MM')), 1, '일괄 리마인더는 미제출 학생에게만 발송한다');
select is(
  (public.review_monthly_report((select id from public.monthly_reports where student_id='10000000-0000-0000-0000-000000000001' and year_month=to_char(current_date,'YYYY-MM')), 'APPROVED', null)).status::text,
  'APPROVED', '관리자가 제출 리포트를 승인한다'
);
select is((select count(*)::integer from public.report_status_history where student_id='10000000-0000-0000-0000-000000000001'), 2, '승인 상태 전이가 이력에 기록된다');
select throws_ok(
  $$select public.review_monthly_report((select id from public.monthly_reports where student_id='10000000-0000-0000-0000-000000000001' and year_month=to_char(current_date,'YYYY-MM')), 'REJECTED', '재검토')$$,
  'P0001', '제출 완료 상태만 검토할 수 있습니다.', '승인된 리포트는 다시 검토할 수 없다'
);
select throws_ok(
  $$select public.update_student_profile('10000000-0000-0000-0000-000000000002','학생이','RLS002','테스트학교','2반','테스트회사','2027-02-01','2027-01-01',null,null,null,'현장실습','주 5일',null,null)$$,
  '22023', '실습 시작일은 종료일보다 늦을 수 없습니다.', '관리자 편집도 실습 기간을 검증한다'
);

select * from finish();
rollback;
