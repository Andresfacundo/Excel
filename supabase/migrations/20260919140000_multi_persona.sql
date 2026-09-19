-- ============================================================================
-- Seguimiento de Pagos — de una persona a muchas
--
-- Antes: una fila de `settings` por usuario y los pagos colgando del usuario.
-- Ahora: cada usuario administra N personas, cada persona tiene su propio plan
-- (fecha de inicio, objetivo por periodo, numero de periodos) y sus pagos.
--
-- Las tablas anteriores estaban vacias, asi que se reemplazan sin migrar datos.
-- ============================================================================

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop table if exists public.payments;
drop table if exists public.settings;

-- ---------------------------------------------------------------------------
-- people: la persona a la que se le hace seguimiento, con su plan de pagos
-- ---------------------------------------------------------------------------
create table public.people (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid          not null references auth.users (id) on delete cascade,
  name          text          not null check (char_length(btrim(name)) between 1 and 80),
  concept       text          check (char_length(concept) <= 120),
  start_date    date          not null check (start_date between date '2000-01-01' and date '2100-12-31'),
  target_amount numeric(14,2) not null check (target_amount > 0 and target_amount <= 1000000000000),
  period_count  smallint      not null check (period_count between 1 and 240),
  notes         text          check (char_length(notes) <= 280),
  archived      boolean       not null default false,
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now(),

  -- Permite que payments garantice que el pago y la persona son del mismo dueno.
  unique (id, user_id)
);

comment on table public.people is
  'Persona a la que se le lleva seguimiento de pagos, con su plan de periodos.';
comment on column public.people.concept is
  'Que se esta pagando: arriendo, prestamo, cuota... Opcional.';

-- Sin dos personas con el mismo nombre para el mismo usuario (sin distinguir
-- mayusculas ni espacios sobrantes).
create unique index people_user_id_name_key
  on public.people (user_id, lower(btrim(name)));

create index people_user_id_archived_idx
  on public.people (user_id, archived, created_at desc);

create trigger people_set_updated_at
  before update on public.people
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- payments: cada pago pertenece a una persona
-- ---------------------------------------------------------------------------
create table public.payments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid          not null references auth.users (id) on delete cascade,
  person_id  uuid          not null,
  paid_on    date          not null check (paid_on between date '2000-01-01' and date '2100-12-31'),
  amount     numeric(14,2) not null check (amount > 0 and amount <= 1000000000000),
  note       text          check (char_length(note) <= 280),
  created_at timestamptz   not null default now(),
  updated_at timestamptz   not null default now(),

  -- La clave compuesta impide asignar un pago a la persona de otro usuario.
  constraint payments_person_fkey
    foreign key (person_id, user_id) references public.people (id, user_id) on delete cascade
);

comment on table public.payments is
  'Pagos registrados. Se asignan en cascada a los periodos del plan de su persona.';

create index payments_person_id_paid_on_idx
  on public.payments (person_id, paid_on desc, created_at desc);

create index payments_user_id_idx
  on public.payments (user_id);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.people enable row level security;
alter table public.payments enable row level security;

create policy "people_select_own"
  on public.people for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "people_insert_own"
  on public.people for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "people_update_own"
  on public.people for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "people_delete_own"
  on public.people for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "payments_select_own"
  on public.payments for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "payments_insert_own"
  on public.payments for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "payments_update_own"
  on public.payments for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "payments_delete_own"
  on public.payments for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.people;
alter publication supabase_realtime add table public.payments;
