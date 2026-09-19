-- ============================================================================
-- Comprobantes de pago + datos del emisor para el PDF
--
-- Los archivos viven en Supabase Storage, en un bucket PRIVADO. La tabla
-- `receipts` guarda el metadato (a que pago pertenece, nombre original, tipo,
-- tamano) y la ruta dentro del bucket. Se ven con URL firmada de corta vida;
-- nunca hay una URL publica.
--
-- La ruta del archivo siempre empieza por el id del usuario:
--   <user_id>/<person_id>/<payment_id>/<uuid>.<ext>
-- y las politicas de storage comprueban justo ese primer segmento.
-- ============================================================================

-- Necesario para que receipts pueda exigir que el pago sea del mismo dueno.
alter table public.payments add constraint payments_id_user_id_key unique (id, user_id);

-- ---------------------------------------------------------------------------
-- receipts
-- ---------------------------------------------------------------------------
create table public.receipts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users (id) on delete cascade,
  payment_id   uuid        not null,
  storage_path text        not null check (char_length(storage_path) between 1 and 400),
  file_name    text        not null check (char_length(file_name) between 1 and 200),
  mime_type    text        not null check (char_length(mime_type) between 1 and 100),
  size_bytes   integer     not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint receipts_payment_fkey
    foreign key (payment_id, user_id) references public.payments (id, user_id) on delete cascade,

  constraint receipts_storage_path_key unique (storage_path)
);

comment on table public.receipts is
  'Comprobante de un pago: la imagen o PDF que respalda que ese abono existio.';
comment on column public.receipts.storage_path is
  'Ruta dentro del bucket privado "comprobantes": <user_id>/<person_id>/<payment_id>/<uuid>.<ext>';

create index receipts_payment_id_idx on public.receipts (payment_id);
create index receipts_user_id_idx on public.receipts (user_id);

create trigger receipts_set_updated_at
  before update on public.receipts
  for each row execute function public.set_updated_at();

alter table public.receipts enable row level security;

create policy "receipts_select_own"
  on public.receipts for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "receipts_insert_own"
  on public.receipts for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "receipts_update_own"
  on public.receipts for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "receipts_delete_own"
  on public.receipts for delete to authenticated
  using ((select auth.uid()) = user_id);

alter publication supabase_realtime add table public.receipts;

-- ---------------------------------------------------------------------------
-- issuer_settings: quien emite el estado de cuenta
-- ---------------------------------------------------------------------------
create table public.issuer_settings (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text        check (char_length(display_name) <= 120),
  phone        text        check (char_length(phone) <= 40),
  email        text        check (char_length(email) <= 254),
  note         text        check (char_length(note) <= 280),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.issuer_settings is
  'Datos que salen en el encabezado del PDF de estado de cuenta.';

create trigger issuer_settings_set_updated_at
  before update on public.issuer_settings
  for each row execute function public.set_updated_at();

alter table public.issuer_settings enable row level security;

create policy "issuer_settings_select_own"
  on public.issuer_settings for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "issuer_settings_insert_own"
  on public.issuer_settings for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "issuer_settings_update_own"
  on public.issuer_settings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "issuer_settings_delete_own"
  on public.issuer_settings for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Bucket privado de comprobantes
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprobantes',
  'comprobantes',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Cada usuario solo toca los archivos cuya ruta empieza por su propio id.
create policy "comprobantes_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "comprobantes_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "comprobantes_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "comprobantes_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
