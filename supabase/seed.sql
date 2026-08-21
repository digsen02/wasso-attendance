insert into public.submission_periods(year_month,start_date,end_date)
values('2026-08','2026-08-01 00:00:00+09','2026-08-31 23:59:59+09')
on conflict(year_month) do update set start_date=excluded.start_date,end_date=excluded.end_date;
