-- Tests psicométricos (PHQ-9, GAD-7, ...) que el profesional envía al paciente.
-- El paciente no tiene cuenta: responde mediante un enlace con token.
-- Todo el acceso pasa por la Edge Function `assessments` (service_role).
-- RLS activado SIN políticas: anon y authenticated no pueden leer ni escribir
-- estas tablas directamente (son datos sensibles de salud).

create table if not exists public.assessment_assignments (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  patient_name text not null,
  patient_email text not null,
  instrument_codes text[] not null,
  token text not null unique,
  status text not null default 'pending',
  sent_via_email boolean not null default false,
  consent_at timestamptz,
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_assignments_status_check
    check (status in ('pending', 'completed', 'revoked')),
  constraint assessment_assignments_instruments_not_empty
    check (cardinality(instrument_codes) > 0)
);

create index if not exists assessment_assignments_professional_idx
  on public.assessment_assignments (professional_id, patient_email);

create index if not exists assessment_assignments_appointment_idx
  on public.assessment_assignments (appointment_id);

create table if not exists public.assessment_results (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assessment_assignments(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  instrument_code text not null,
  instrument_version integer not null,
  answers jsonb not null,
  total_score integer not null,
  max_score integer not null,
  severity text not null,
  subscales jsonb,
  flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (assignment_id, instrument_code)
);

create index if not exists assessment_results_professional_idx
  on public.assessment_results (professional_id);

drop trigger if exists set_assessment_assignments_updated_at on public.assessment_assignments;
create trigger set_assessment_assignments_updated_at
  before update on public.assessment_assignments
  for each row execute function public.update_updated_at_column();

alter table public.assessment_assignments enable row level security;
alter table public.assessment_results enable row level security;

revoke all on public.assessment_assignments from anon, authenticated;
revoke all on public.assessment_results from anon, authenticated;
