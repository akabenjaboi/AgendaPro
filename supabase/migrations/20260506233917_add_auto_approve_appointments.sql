ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS auto_approve_appointments boolean NOT NULL DEFAULT false;
