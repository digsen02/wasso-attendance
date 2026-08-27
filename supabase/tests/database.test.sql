begin;
create extension if not exists pgtap;

select plan(38);
select has_table('public','profiles','profiles 테이블');
select has_table('public','attendance_logs','attendance_logs 테이블');
select has_table('public','monthly_reports','monthly_reports 테이블');
select has_table('public','submission_periods','submission_periods 테이블');
select has_table('public','notifications','notifications 테이블');
select has_function('public','is_admin',array[]::text[],'관리자 권한 함수');
select has_function('public','submit_monthly_report',array['uuid'],'제출 RPC');
select has_function('public','review_monthly_report',array['uuid','report_status','text'],'검토 RPC');
select has_function('public','resend_submission_reminder',array['uuid','text'],'Reminder RPC');
select has_function('public','get_admin_dashboard',array['text'],'대시보드 RPC');
select col_is_pk('public','profiles','id','profiles 기본 키');
select col_not_null('public','attendance_logs','student_id','출근 기록 학생 필수');
select col_not_null('public','monthly_reports','year_month','리포트 월 필수');
select policies_are('public','notifications',array['notifications_select','notifications_read'],'알림 RLS 정책');
select has_function('public','ensure_student_month',array['uuid','text'],'월별 레코드 생성 함수');
select has_function('public','ensure_my_month',array['text'],'학생 본인 월 복구 RPC');
select ok(has_function_privilege('authenticated','public.ensure_my_month(text)','EXECUTE'),'인증 사용자는 본인 월 복구 RPC를 호출할 수 있다');
select has_function('public','manage_submission_period',array['text','timestamp with time zone','timestamp with time zone'],'제출 기간 관리 RPC');
select has_function('public','save_monthly_report_draft',array['uuid','text','text'],'초안 저장 RPC');
select ok(has_table_privilege('authenticated','public.profiles','SELECT'),'인증 사용자는 profiles 조회 가능');
select ok(not has_table_privilege('authenticated','public.profiles','UPDATE'),'인증 사용자는 profiles 직접 수정 불가');
select ok(has_table_privilege('authenticated','public.attendance_logs','UPDATE'),'인증 사용자는 RLS 범위에서 출근 기록 수정 가능');
select ok(not has_table_privilege('authenticated','public.monthly_reports','UPDATE'),'월 리포트는 RPC로만 수정');
select ok(not has_table_privilege('authenticated','public.monthly_reports','INSERT'),'월 리포트는 프런트엔드에서 직접 생성할 수 없다');
select ok(not has_function_privilege('authenticated','public.ensure_student_month(uuid,text)','EXECUTE'),'학생 ID를 받는 내부 프로비저닝 함수는 외부 호출할 수 없다');
select ok(not has_table_privilege('authenticated','public.submission_periods','INSERT'),'제출 기간은 RPC로만 생성');
select policies_are('public','profiles',array['profiles_select','profiles_admin_update'],'profiles RLS 정책');
select policies_are('public','monthly_reports',array['reports_select'],'월 리포트 RLS 정책');
select ok(
  exists(
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'monthly_reports'
      and c.conname = 'rejected_report_requires_reason'
  ),
  '반려 사유 필수 제약'
);
select hasnt_trigger('public','submission_periods','on_submission_period_saved','제출 기간은 월별 데이터를 생성하지 않는다');
select has_table('public','report_status_history','리포트 상태 이력 테이블');
select has_column('public','profiles','contact_email','프로필 연락 이메일');
select has_column('public','profiles','notification_enabled','프로필 알림 설정');
select has_column('public','monthly_reports','submission_count','월 리포트 제출 횟수');
select has_function('public','update_my_profile',array['text','text','text','boolean'],'본인 프로필 수정 RPC');
select has_function('public','update_student_profile',array['uuid','text','text','text','text','text','date','date','text','text','text','text','text','text','text'],'관리자 학생 수정 RPC');
select has_function('public','send_bulk_submission_reminders',array['text'],'일괄 리마인더 RPC');
select policies_are('public','report_status_history',array['report_history_select'],'리포트 이력 RLS 정책');
select * from finish();
rollback;
