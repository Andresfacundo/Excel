-- ============================================================================
-- Los periodos dejan de generarse solos y pasan a ser filas propias
--
-- Antes: la persona guardaba (start_date, target_amount, period_count) y la app
-- generaba N periodos mensuales consecutivos. No habia forma de tener un
-- periodo mas corto, uno con otro monto, ni un hueco entre dos.
--
-- Ahora: cada periodo es una fila con su fecha de inicio, su fecha de fin y su
-- propio monto objetivo. Los pagos apuntan al periodo por id.
--
-- La migracion crea los periodos que hoy existen de forma implicita, para que
-- los datos actuales queden exactamente igual.
-- ============================================================================

create extension if not exists btree_gist;

create table public.periods (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid          not null references auth.users (id) on delete cascade,
  person_id     uuid          not null,
  start_date    date          not null check (start_date between date '2000-01-01' and date '2100-12-31'),
  end_date      date          not null check (end_date between date '2000-01-01' and date '2100-12-31'),
  target_amount numeric(14,2) not null check (target_amount > 0 and target_amount <= 1000000000000),
  label         text          check (char_length(label) <= 80),
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now(),

  constraint periods_person_fkey
    foreign key (person_id, user_id) references public.people (id, user_id) on delete cascade,

  -- El fin siempre despues del inicio, y ningun periodo de mas de 10 anios.
  constraint periods_dates_ordered check (end_date > start_date),
  constraint periods_reasonable_length check (end_date - start_date <= 3660),

  -- Permite que payments exija que el pago y el periodo sean de la misma persona.
  unique (id, user_id),
  constraint periods_person_id_id_key unique (person_id, id),

  -- Dos periodos de la misma persona no pueden solaparse: asi cada fecha
  -- pertenece como mucho a un periodo y las cuentas nunca son ambiguas.
  -- Los huecos si se permiten.
  constraint periods_no_overlap exclude using gist (
    person_id with =,
    daterange(start_date, end_date, '[)') with &&
  )
);

comment on table public.periods is
  'Periodo de pago de una persona, con sus fechas y su monto objetivo propio.';
comment on constraint periods_no_overlap on public.periods is
  'Dos periodos de la misma persona no pueden solaparse; los huecos si se permiten.';

create index periods_person_id_start_date_idx on public.periods (person_id, start_date);
create index periods_user_id_idx on public.periods (user_id);

create trigger periods_set_updated_at
  before update on public.periods
  for each row execute function public.set_updated_at();

alter table public.periods enable row level security;

create policy "periods_select_own"
  on public.periods for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "periods_insert_own"
  on public.periods for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "periods_update_own"
  on public.periods for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "periods_delete_own"
  on public.periods for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Crear los periodos que hoy estan implicitos en cada persona
-- ---------------------------------------------------------------------------
insert into public.periods (user_id, person_id, start_date, end_date, target_amount)
select
  p.user_id,
  p.id,
  (p.start_date + (n * interval '1 month'))::date,
  (p.start_date + ((n + 1) * interval '1 month'))::date,
  p.target_amount
from public.people p
cross join lateral generate_series(0, p.period_count - 1) as n;

-- ---------------------------------------------------------------------------
-- Reapuntar los pagos: period_index (posicion) -> period_id (fila)
--
-- La clave foranea empareja (person_id, period_id): asi un pago no puede
-- apuntar al periodo de otra persona, ni siquiera dentro de la misma cuenta.
-- `on delete set null (period_id)` anula SOLO esa columna al borrar el periodo
-- (user_id es NOT NULL), asi que el pago sobrevive como "sin asignar".
-- ---------------------------------------------------------------------------
alter table public.payments add column period_id uuid;

alter table public.payments
  add constraint payments_period_fkey
  foreign key (person_id, period_id) references public.periods (person_id, id)
  on delete set null (period_id);

comment on constraint payments_period_fkey on public.payments is
  'El periodo debe pertenecer a la misma persona que el pago. Al borrar el periodo, el pago queda sin asignar en vez de desaparecer.';

with ordenados as (
  select
    id,
    person_id,
    (row_number() over (partition by person_id order by start_date)) - 1 as posicion
  from public.periods
)
update public.payments pay
   set period_id = o.id
  from ordenados o
 where o.person_id = pay.person_id
   and o.posicion = pay.period_index
   and pay.period_index is not null;

create index payments_period_id_idx on public.payments (period_id);

-- Ya no hace falta la posicion ni el trigger que limpiaba huerfanos: la clave
-- foranea deja period_id en NULL sola cuando se borra un periodo.
drop trigger if exists people_unassign_orphan_payments on public.people;
drop function if exists public.unassign_orphan_payments();
drop index if exists payments_person_id_period_index_idx;
alter table public.payments drop column period_index;

-- ---------------------------------------------------------------------------
-- La persona ya no define el calendario: solo guarda un monto por defecto
-- para precargar el formulario de periodo nuevo.
-- ---------------------------------------------------------------------------
alter table public.people rename column target_amount to default_target_amount;
alter table public.people alter column default_target_amount drop not null;
alter table public.people drop column start_date;
alter table public.people drop column period_count;

comment on column public.people.default_target_amount is
  'Monto sugerido al crear un periodo nuevo para esta persona. No define ningun periodo por si solo.';

alter publication supabase_realtime add table public.periods;
