begin;

alter table public.monthly_reports
  add column if not exists reviewed_at timestamptz;

alter table public.monthly_reports
  add column if not exists reviewed_by uuid
  references public.profiles(id)
  on delete set null;

alter table public.monthly_reports
  add column if not exists rejection_reason text;

commit;