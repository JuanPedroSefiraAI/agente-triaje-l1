-- Historial de conversaciones del chat de soporte. Ejecutar en el SQL
-- Editor de Supabase. El servidor es la única fuente de verdad: el cliente
-- nunca escribe aquí directamente (solo vía la service role key).

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- Última vez que se añadió un mensaje. Se usa para la retención (ver
  -- abajo) en lugar de created_at, para no borrar sesiones activas de larga
  -- duración: la mantiene actualizada el trigger de conversation_messages.
  last_message_at timestamptz not null default now()
);

create table if not exists conversation_messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists conversation_messages_conv_idx
  on conversation_messages (conversation_id, created_at);

-- Mantiene conversations.last_message_at al día cada vez que se inserta un
-- mensaje, sin que el backend tenga que hacer un UPDATE aparte.
-- search_path = '' + nombres con esquema: evita que la función resuelva
-- `conversations` contra un objeto de otro esquema que alguien con permiso
-- de CREATE haya colado antes en el search_path (hardening recomendado por
-- el linter de Supabase para funciones SECURITY DEFINER/trigger).
create or replace function touch_conversation_last_message()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.conversations set last_message_at = now() where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists conversation_messages_touch on conversation_messages;
create trigger conversation_messages_touch
  after insert on conversation_messages
  for each row execute function touch_conversation_last_message();

-- RLS activada y sin policies para anon/authenticated: por defecto nadie
-- puede leer ni escribir salvo el rol service_role (que siempre evita RLS).
-- El backend accede con la service role key, así que no necesita policy.
alter table conversations enable row level security;
alter table conversation_messages enable row level security;

-- ---------------------------------------------------------------------
-- Retención de datos (RGPD): las conversaciones son soporte a clientes
-- finales en España y pueden contener datos personales, así que no deben
-- guardarse más de lo necesario. Se borran automáticamente a los 30 días
-- de inactividad (last_message_at), vía pg_cron, el mecanismo más simple
-- dentro de Supabase (sin necesidad de un cron externo).
-- ---------------------------------------------------------------------

-- Si el proyecto no deja crear la extensión por SQL, actívala primero
-- desde el dashboard: Database -> Extensions -> pg_cron.
create extension if not exists pg_cron;

-- conversation_messages se borra en cascada al borrar la conversación
-- (on delete cascade en la FK), así que basta con borrar de `conversations`.
select cron.schedule(
  'delete-old-conversations',
  '0 3 * * *', -- cada día a las 03:00 UTC
  $$ delete from conversations where last_message_at < now() - interval '30 days'; $$
);

-- Para cambiar el horario o la condición más adelante, primero quita el
-- job existente y vuelve a programarlo (cron.schedule con el mismo nombre
-- no lo actualiza, crea un duplicado):
--   select cron.unschedule('delete-old-conversations');
