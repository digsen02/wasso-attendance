insert into public.submission_periods(year_month,start_date,end_date)
values(
  to_char(current_date,'YYYY-MM'),
  date_trunc('month',current_date)::timestamptz,
  (date_trunc('month',current_date)+interval '1 month' - interval '1 second')::timestamptz
)
on conflict(year_month) do update set start_date=excluded.start_date,end_date=excluded.end_date;
