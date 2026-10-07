-- Tabla de tickets escalados a Nivel 2 (Freshdesk o respaldo local cuando
-- Freshdesk falla o no está configurado). Ejecutar en el SQL Editor de Supabase.

create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  summary text not null,
  priority smallint not null default 2 check (priority between 1 and 4),
  status text not null default 'Abierto',
  source text not null check (source in ('freshdesk', 'local')),
  freshdesk_id bigint,
  created_at timestamptz not null default now()
);

create index if not exists tickets_created_at_idx on tickets (created_at desc);

-- RLS activada y sin policies para anon/authenticated: por defecto, con RLS
-- activada y ninguna policy, nadie puede leer ni escribir salvo el rol
-- service_role (que siempre evita RLS). El backend accede con la service
-- role key, así que no necesita una policy explícita; esto es lo que impide
-- que la tabla quede expuesta si alguna vez se usa la anon key en el frontend.
alter table tickets enable row level security;
