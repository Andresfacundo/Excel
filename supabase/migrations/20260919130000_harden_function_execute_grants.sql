-- ============================================================================
-- Endurecimiento: las funciones de trigger no deben ser invocables por la API.
--
-- Postgres verifica el permiso EXECUTE cuando se crea el trigger, no cada vez
-- que se dispara, asi que revocar el permiso no afecta a los triggers: solo
-- cierra la puerta de /rest/v1/rpc/<funcion>.
-- ============================================================================

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
