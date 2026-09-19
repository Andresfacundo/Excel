-- Las extensiones no deberian vivir en el esquema `public`, que es el que la
-- API expone. Las referencias de la restriccion de exclusion son por OID, asi
-- que mover la extension de esquema no la afecta.
create schema if not exists extensions;
alter extension btree_gist set schema extensions;
