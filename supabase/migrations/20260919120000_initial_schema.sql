-- ============================================================================
-- Seguimiento de Pago Wilfer — esquema inicial
--
-- Dos tablas por usuario:
--   public.settings  -> configuracion del plan (una fila por usuario)
--   public.payments  -> pagos registrados
--
-- Todo queda cerrado con Row Level Security: cada usuario solo ve y modifica
-- sus propias filas. Las politicas usan `(select auth.uid())` para que el
-- planner evalue la funcion una sola vez por consulta y no fila por fila.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Utilidad: mantener updated_at al dia
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at is
  'Trigger BEFORE UPDATE: refresca la columna updated_at.';

-- ---------------------------------------------------------------------------
-- settings
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  start_date    date          not null default current_date,
  target_amount numeric(14,2) not null default 0 check (target_amount >= 0),
  period_count  smallint      not null default 1 check (period_count between 1 and 240),
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now()
);

comment on table public.settings is
  'Configuracion del plan de pagos: fecha de inicio, objetivo por periodo y numero de periodos.';

create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid          not null references auth.users (id) on delete cascade,
  paid_on    date          not null,
  amount     numeric(14,2) not null check (amount > 0),
  note       text          check (char_length(note) <= 280),
  created_at timestamptz   not null default now(),
  updated_at timestamptz   not null default now()
);

comment on table public.payments is
  'Pagos registrados. Se asignan en cascada a los periodos definidos en settings.';

-- La lista se consulta siempre por usuario y ordenada por fecha.
create index if not exists payments_user_id_paid_on_idx
  on public.payments (user_id, paid_on desc, created_at desc);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.settings enable row level security;
alter table public.payments enable row level security;

-- settings
create policy "settings_select_own"
  on public.settings for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "settings_insert_own"
  on public.settings for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "settings_update_own"
  on public.settings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "settings_delete_own"
  on public.settings for delete to authenticated
  using ((select auth.uid()) = user_id);

-- payments
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
-- Alta de usuario: crear su fila de configuracion con los valores por defecto
-- del proyecto original (21 jul 2026, 2.508.000 por periodo, 5 periodos).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.settings (user_id, start_date, target_amount, period_count)
  values (new.id, date '2026-07-21', 2508000, 5)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_user is
  'Crea la fila de settings por defecto cuando se registra un usuario nuevo.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Realtime: la app se suscribe a los cambios para sincronizar entre
-- dispositivos, igual que hacia onSnapshot en Firestore.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.settings;
alter publication supabase_realtime add table public.payments;
