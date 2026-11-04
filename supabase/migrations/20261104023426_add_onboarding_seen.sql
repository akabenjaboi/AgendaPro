-- Tutorial guiado (onboarding) del panel del profesional.
-- Guarda qué recorridos ya vio cada profesional, para mostrarlos solo una vez
-- aunque cambie de dispositivo. Cada profesional actualiza su propia fila con
-- la política existente "Professional can update own profile".

alter table public.professionals
  add column if not exists onboarding_seen text[] not null default '{}';

-- Los profesionales que ya usaban la plataforma no ven el tutorial
-- automáticamente; pueden abrirlo con "Ver tutorial" en el menú.
update public.professionals
set onboarding_seen = array['dashboard', 'calendar', 'appointments', 'availability', 'services', 'settings']
where created_at < now();
