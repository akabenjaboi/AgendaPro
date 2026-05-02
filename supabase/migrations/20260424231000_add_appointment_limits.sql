alter table public.professionals
  add column if not exists max_appointments_per_day integer,
  add column if not exists max_appointments_per_week integer;

alter table public.services
  add column if not exists max_appointments_per_week integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'professionals_max_appointments_per_day_positive'
  ) then
    alter table public.professionals
      add constraint professionals_max_appointments_per_day_positive
      check (max_appointments_per_day is null or max_appointments_per_day >= 1);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'professionals_max_appointments_per_week_positive'
  ) then
    alter table public.professionals
      add constraint professionals_max_appointments_per_week_positive
      check (max_appointments_per_week is null or max_appointments_per_week >= 1);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'services_max_appointments_per_week_positive'
  ) then
    alter table public.services
      add constraint services_max_appointments_per_week_positive
      check (max_appointments_per_week is null or max_appointments_per_week >= 1);
  end if;
end $$;
