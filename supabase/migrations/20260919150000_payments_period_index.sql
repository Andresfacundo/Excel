-- ============================================================================
-- Pagos asignados a un periodo concreto
--
-- Hasta ahora los pagos caian en un bolsillo comun y se repartian en cascada,
-- asi que no habia forma de decir "estos $500.000 son del periodo de agosto".
-- Con `period_index` cada pago puede apuntar a un periodo (base 0).
--
-- NULL sigue significando "sin asignar": ese dinero se reparte en cascada sobre
-- lo que falte, que es exactamente el comportamiento anterior. Por eso los
-- pagos que ya existen no se tocan: quedan en NULL y sus cuentas no cambian.
-- ============================================================================

alter table public.payments
  add column period_index smallint check (period_index >= 0 and period_index <= 239);

comment on column public.payments.period_index is
  'Periodo del plan al que se abona este pago, empezando en 0. NULL = sin asignar: se reparte en cascada sobre los periodos pendientes.';

create index payments_person_id_period_index_idx
  on public.payments (person_id, period_index);

-- ---------------------------------------------------------------------------
-- Si el plan se acorta, los pagos que apuntaban a periodos que ya no existen
-- vuelven a "sin asignar" en vez de quedar colgando de un periodo inexistente.
-- ---------------------------------------------------------------------------
create or replace function public.unassign_orphan_payments()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.period_count < old.period_count then
    update public.payments
       set period_index = null
     where person_id = new.id
       and period_index is not null
       and period_index >= new.period_count;
  end if;
  return new;
end;
$$;

comment on function public.unassign_orphan_payments is
  'Al reducir el numero de periodos de una persona, deja sin asignar los pagos que apuntaban a periodos eliminados.';

create trigger people_unassign_orphan_payments
  after update of period_count on public.people
  for each row execute function public.unassign_orphan_payments();

revoke all on function public.unassign_orphan_payments() from public, anon, authenticated;
