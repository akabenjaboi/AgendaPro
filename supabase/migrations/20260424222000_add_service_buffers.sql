alter table public.services
  add column if not exists buffer_before_minutes integer not null default 0,
  add column if not exists buffer_after_minutes integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'services_buffer_before_minutes_non_negative'
  ) then
    alter table public.services
      add constraint services_buffer_before_minutes_non_negative
      check (buffer_before_minutes >= 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'services_buffer_after_minutes_non_negative'
  ) then
    alter table public.services
      add constraint services_buffer_after_minutes_non_negative
      check (buffer_after_minutes >= 0);
  end if;
end $$;
