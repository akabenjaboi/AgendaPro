-- Endurece la seguridad de la BD sin cambiar el comportamiento de la app.
-- Las reservas, cancelaciones, reagendamientos y la página pública de reservas
-- pasan por Edge Functions con service_role (que ignora RLS), por lo que no
-- dependen de las políticas públicas que se eliminan aquí.

-- 1) Nadie puede insertar citas directamente con la anon key.
--    Las citas se crean solo vía la Edge Function `appointments`, que valida
--    choques de horario, límites y estado inicial.
drop policy if exists "Anyone can create appointment" on public.appointments;

-- 2) El público ya no puede leer la tabla professionals completa
--    (exponía email y teléfono de todos los profesionales).
--    Cada profesional sigue viendo su propio perfil con
--    "Professional can view own profile".
drop policy if exists "Public can view active professionals" on public.professionals;

--    Reemplazo para la validación de slug en Configuración: solo responde
--    si el slug está tomado, sin exponer ningún otro dato.
create or replace function public.is_slug_taken(p_slug text, p_exclude_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.professionals
    where slug = p_slug
      and id is distinct from p_exclude_id
  );
$$;

revoke execute on function public.is_slug_taken(text, uuid) from public, anon;
grant execute on function public.is_slug_taken(text, uuid) to authenticated;

-- 3) Los bloqueos de horario (incluido el motivo) ya no son públicos.
--    Cada profesional sigue gestionando los suyos con
--    "Professional manages own blocked slots".
drop policy if exists "Public can view blocked slots" on public.blocked_slots;

-- 4) handle_new_user es una función de trigger; no debe poder llamarse por la API.
--    (Los triggers no requieren privilegio EXECUTE, así que el registro sigue igual.)
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 5) Fijar search_path en funciones (aviso function_search_path_mutable).
alter function public.update_updated_at_column() set search_path = '';
alter function public.generate_unique_slug(text) set search_path = '';
