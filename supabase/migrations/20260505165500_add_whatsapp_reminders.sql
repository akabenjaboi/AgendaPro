alter table public.appointments
  add column if not exists patient_attendance_response text not null default 'pending',
  add column if not exists patient_attendance_responded_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'appointments_patient_attendance_response_check'
  ) then
    alter table public.appointments
      add constraint appointments_patient_attendance_response_check
      check (patient_attendance_response in ('pending', 'yes', 'no'));
  end if;
end $$;

create table if not exists public.whatsapp_reminders (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  patient_phone text not null,
  reminder_type text not null default 'attendance_confirmation',
  response_token text not null unique,
  message_sid text unique,
  status text not null default 'sent',
  response_raw text,
  sent_at timestamptz not null default now(),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (appointment_id, reminder_type)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'whatsapp_reminders_status_check'
  ) then
    alter table public.whatsapp_reminders
      add constraint whatsapp_reminders_status_check
      check (status in ('sent', 'failed', 'responded_yes', 'responded_no', 'ambiguous'));
  end if;
end $$;

create index if not exists whatsapp_reminders_patient_phone_idx
  on public.whatsapp_reminders (patient_phone);

create index if not exists whatsapp_reminders_status_idx
  on public.whatsapp_reminders (status);

alter table public.whatsapp_reminders enable row level security;

drop policy if exists "Professionals can read own WhatsApp reminders" on public.whatsapp_reminders;
create policy "Professionals can read own WhatsApp reminders"
  on public.whatsapp_reminders
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.professionals p
      where p.id = whatsapp_reminders.professional_id
        and p.user_id = auth.uid()
    )
  );
