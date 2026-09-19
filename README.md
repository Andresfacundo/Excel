# Seguimiento de Pagos

PWA para llevar el control de pagos de varias personas a la vez. Cada persona
tiene sus propios periodos —cada uno con su fecha de inicio, su fecha de fin y
su propio monto objetivo— y cada pago se abona a un periodo concreto, de modo
que se ve exactamente cuanto falta en cada uno por separado.

Empezo siendo un `index.html` de 355 lineas para una sola persona. Hoy es una
aplicacion React con TypeScript estricto y Supabase como base de datos.

---

## Que hay dentro

| Antes | Ahora |
| --- | --- |
| Una sola persona, cableada en el codigo | N personas, cada una con sus periodos |
| Periodos mensuales generados automaticamente | Periodos con fechas y monto propios, editables uno a uno |
| Un `index.html` con todo mezclado | Componentes React por feature |
| JavaScript sin tipos | TypeScript en modo estricto |
| `localStorage` como fuente de verdad | Supabase (Postgres) como fuente de verdad |
| Firestore con un documento publico | Postgres con Row Level Security por usuario |
| Sin login | Login con correo y contrasena |
| `sw.js` escrito a mano | `vite-plugin-pwa` (Workbox), con aviso de version nueva |
| Sin validacion | Validacion en el cliente y CHECK constraints en la base |
| Sin pruebas | 122 pruebas unitarias |
| Sin soportes | Comprobantes adjuntos y estado de cuenta en PDF |
| Montos a pelo en un `type="number"` | Separacion de miles mientras se escribe |
| Ocho tarjetas apiladas por persona | Resumen fijo + pestanas (Pagos, Periodos, PDF, Ajustes) |

---

## Periodos

Un periodo es una fila con **fecha de inicio, fecha de fin y monto objetivo**.
Nada se genera solo, asi que puedes tener una quincena de $500.000 seguida de un
bimestre de $3.000.000, o dejar un mes de gracia en el medio.

Dos reglas:

- **Ningun periodo de la misma persona puede solaparse con otro.** Lo impide la
  base con una restriccion de exclusion (`daterange` + `btree_gist`), no solo el
  formulario. Asi cada fecha pertenece como mucho a un periodo y las cuentas
  nunca son ambiguas.
- **Los huecos si se permiten.** Un pago con fecha dentro de un hueco
  simplemente no tiene periodo preseleccionado; tu decides a cual abonarlo.

La fecha de fin es *exclusiva*: del 21 de julio al 21 de agosto significa que el
21 de agosto ya pertenece al periodo siguiente.

Para no crear doce periodos a mano, el boton **"Generar mensuales"** los crea de
una vez y despues cada uno se edita por separado. Al agregar un periodo suelto,
las fechas vienen precargadas justo donde termino el ultimo.

Borrar un periodo **no borra sus pagos**: quedan sin asignar. Eso lo garantiza la
clave foranea (`on delete set null (period_id)`), no el cliente.

---

## Como se reparte el dinero

Este es el corazon de la app, y el orden importa:

1. **Cada pago con periodo asignado suma a ESE periodo.** Es lo que permite
   decir "estos $500.000 son del periodo de agosto" aunque el de julio siga
   debiendo. El dinero de agosto no tapa la deuda de julio.
2. **Si un periodo recibe mas de su objetivo, el excedente baja al siguiente**
   periodo pendiente, y de ahi al siguiente si vuelve a sobrar.
3. **Los pagos sin asignar forman un bolsillo comun** que tapa los huecos que
   queden, del periodo mas antiguo al mas nuevo. Es el comportamiento que tenia
   la app antes de separar por periodo.
4. **Lo que sobre al final** queda como saldo a favor sin asignar.

Cada tarjeta de periodo desglosa de donde salio su dinero: *abonado
directamente*, *viene del periodo anterior*, *cubierto con pagos sin asignar*.
Asi siempre se puede reconstruir por que un periodo esta como esta.

Un pago se puede reasignar en cualquier momento desde el `<select>` que lleva
cada fila, incluido dejarlo "sin asignar".

---

## Comprobantes y estado de cuenta

Estas dos piezas existen por un caso real: un cliente afirmo no deber un periodo
completo, y sin soporte a la mano la discusion se vuelve palabra contra palabra.

**Comprobantes.** Cada pago admite varios archivos (imagen o PDF, hasta 10 MB
cada uno): la foto de la consignacion y el extracto del banco, por ejemplo. Se
adjuntan al registrar el pago o despues, desde la fila del pago. Los archivos
viven en un bucket **privado** de Supabase Storage; no existe ninguna URL
publica. Cada vez que pulsas "Ver" se pide una URL firmada que caduca en diez
minutos, y las politicas del bucket comprueban que la ruta empiece por tu propio
id de usuario, asi que un usuario no puede leer ni escribir archivos de otro.
Borrar un pago borra sus comprobantes en cascada.

**Estado de cuenta en PDF.** Desde la pantalla de la persona, un boton genera un
documento con:

1. Encabezado con tus datos (los configuras en *Mis datos para el PDF*) y la
   fecha de generacion.
2. Resumen: objetivo total, pagado, pendiente, vencido y avance.
3. Tabla periodo por periodo con lo cubierto y lo que falta en cada uno.
4. Historial de pagos, indicando cual tiene soporte y cual no.
5. Anexo con las imagenes de los comprobantes, cada una rotulada con la fecha y
   el monto del pago al que pertenece.

La tarjeta avisa cuantos pagos no tienen comprobante antes de generar el
documento: son justo los que no podrias sustentar.

Detalles de implementacion que valen la pena:

- **jsPDF se carga con `import()` dinamico.** Pesa mas que toda la app junta, y
  solo hace falta al pulsar el boton; el arranque no lo paga.
- **Las imagenes pasan por un canvas** antes de incrustarse (jsPDF solo entiende
  JPEG y PNG) y se reescalan a 1400 px de lado mayor. Un HEIC que el navegador no
  sepa decodificar se lista al final en vez de romper la generacion, y los
  comprobantes en PDF se mencionan sin incrustarse.
- **`statementData.ts` es puro**: arma filas y totales sin saber que existe
  jsPDF, y por eso las cifras del documento estan cubiertas por pruebas.

---

## La pantalla

Cada persona tiene un resumen fijo arriba —pagado, objetivo, avance y lo
vencido— y debajo cuatro pestanas: **Pagos**, **Periodos**, **PDF** y
**Ajustes**. El resumen no entra en las pestanas a proposito: responde a "como
va esta persona", que es lo que se pregunta siempre, sin importar en que se este
trabajando. Las pestanas llevan su contador, y el de Periodos se pone rojo
cuando hay periodos vencidos.

Los montos se escriben con separacion de miles en vivo: se teclea `2508000` y el
campo muestra `$ 2.508.000`. Por dentro nada cambia —el formulario sigue
guardando el numero crudo, asi que los validadores y la base reciben lo de
siempre—; la mascara vive solo en `MoneyField` y `lib/amountMask.ts`, que
ademas devuelve el cursor a su sitio para poder corregir un digito por la mitad
sin que salte al final.

Por eso es un `<input type="text">` con `inputMode="decimal"` y no un
`type="number"`: los navegadores no admiten puntos de miles dentro de un campo
numerico, pero `inputMode` conserva el teclado de numeros en el celular.

Debajo del monto aparecen uno o dos atajos —**Lo que falta**, **Periodo
completo**— que rellenan la cifra exacta de un toque. Son los dos montos que se
escriben casi siempre, y teclearlos a mano es justo donde se cuela un cero de
mas.

---

## Arranque rapido

```bash
npm install
cp .env.example .env     # y completa las dos variables
npm run dev
```

| Comando | Que hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de produccion en `dist/` (incluye el service worker) |
| `npm run preview` | Sirve `dist/` para probar la PWA instalada |
| `npm test` | Pruebas unitarias (Vitest) |
| `npm run typecheck` | Chequeo de tipos |
| `npm run lint` | ESLint |

### Variables de entorno

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Las dos son publicas por diseno: viajan al navegador. Lo que protege los datos
es Row Level Security, no el secreto de la clave. **Nunca** pongas aqui la
`service_role` key.

El proyecto Supabase de esta app es `seguimiento-pagos`
(`bbjgxdbtoapxlishdhpn`, region us-east-1).

### Primer ingreso

Supabase exige confirmar el correo antes del primer inicio de sesion. Al crear
la cuenta llega un mensaje con un enlace; al abrirlo la cuenta queda activa. Si
prefieres entrar sin ese paso, apaga *Confirm email* en el panel, en
**Authentication -> Sign In / Providers -> Email**.

---

## Estructura

```
src/
├── app/                      Composicion y rutas
│   ├── App.tsx               Sesion o pantalla de login, y el router
│   ├── AppLayout.tsx         Cabecera comun + estado de sincronizacion
│   ├── HomePage.tsx          Lista de personas y resumen global
│   └── PersonPage.tsx        Detalle de una persona
├── components/
│   ├── ui/                   Card, Button, Badge, ProgressBar, TextField, MoneyField, Tabs...
│   ├── layout/AppHeader      Cabecera con el estado de sincronizacion
│   ├── pwa/UpdatePrompt      Aviso de "hay una version nueva"
│   └── ErrorBoundary.tsx
├── features/
│   ├── auth/                 Sesion con Supabase Auth
│   ├── receipts/            Comprobantes: subida, listado y borrado
│   ├── reports/             Estado de cuenta en PDF
│   ├── issuer/              Tus datos para el encabezado del PDF
│   ├── people/               Personas: alta, edicion, archivado y borrado
│   ├── periods/              Alta, edicion y generador de periodos
│   ├── payments/             API, hooks y UI de pagos
│   ├── tracking/             Logica de calculo (pura) y su UI
│   └── sync/                 Suscripcion realtime
├── hooks/                    useForm, useOnlineStatus
├── lib/                      Cliente Supabase, cache, formato, mascara de montos, validacion
├── styles/global.css         Tokens de diseno
└── types/                    Tipos de dominio y de la base de datos
```

Tres reglas guian el reparto:

1. **`features/tracking/domain.ts` no sabe que existen React ni Supabase.** Es
   matematica pura y por eso se puede probar sin montar nada.
2. **Cada feature expone `api.ts` (habla con Supabase) y `hooks.ts` (habla con
   la cache).** Los componentes nunca llaman a Supabase directamente.
3. **`lib/validation.ts` es el unico lugar donde vive una regla de validacion.**
   Los formularios la consumen a traves de `hooks/useForm.ts`.

---

## Validacion

Cada regla existe en dos capas: el cliente para dar feedback inmediato, la base
de datos porque es la unica frontera en la que se puede confiar.

| Campo | Regla | Donde se refuerza |
| --- | --- | --- |
| Nombre de la persona | 2–80 caracteres, con al menos una letra o numero, unico por usuario (sin distinguir mayusculas ni espacios) | `CHECK` + indice unico |
| Concepto | Hasta 120 caracteres | `CHECK` |
| Notas | Hasta 280 caracteres | `CHECK` |
| Monto habitual (opcional) | Vacio, o mayor que cero con maximo 2 decimales | — |
| Fecha de inicio del periodo | Fecha real, entre 2000 y 2100 | `CHECK` |
| Fecha de fin del periodo | Fecha real, posterior al inicio, maximo 10 anios de duracion | `CHECK` |
| Cruce entre periodos | Ningun periodo de la misma persona puede solaparse | `EXCLUDE USING gist` |
| Objetivo del periodo | Mayor que cero, maximo 2 decimales | `CHECK` |
| Nombre del periodo | Hasta 80 caracteres | `CHECK` |
| Periodos a generar | Entero entre 1 y 240 | — |
| Fecha del pago | Fecha real, nunca futura | `CHECK` + `max` en el input |
| Monto del pago | Mayor que cero, maximo 2 decimales | `CHECK` |
| Periodo del pago | Un periodo de esa misma persona, o sin asignar | Clave foranea compuesta |
| Comprobante | Imagen o PDF, hasta 10 MB, maximo 10 por vez | `CHECK` + limites del bucket |
| Telefono del emisor | Solo numeros y `+ ( ) - .`, minimo 7 digitos | — |
| Correo | Formato valido, hasta 254 caracteres | Supabase Auth |
| Contrasena (registro) | 8–72 caracteres, con letra y numero | Supabase Auth |

Detalles de comportamiento que valen la pena conocer:

- El error de un campo aparece cuando sales de el o cuando intentas enviar, no
  mientras escribes por primera vez.
- Los botones de envio se bloquean mientras la peticion esta en vuelo, asi que
  no hay doble registro por doble clic.
- Borrar un pago pide confirmacion en dos pasos; **borrar una persona exige
  escribir su nombre**, porque arrastra todo su historial.
- El formulario de periodo avisa del cruce **antes** de guardar, nombrando con
  que periodo choca, y muestra la duracion en dias.
- El generador mensual muestra una vista previa ("se crearan 5 periodos: el
  primero 16 dic 26 - 16 ene 27, y el ultimo termina el 16 de mayo de 2027").
- Si un `CHECK` de la base salta igual, el mensaje se traduce al espanol en
  `lib/supabase.ts` en vez de mostrar el error crudo de Postgres.

---

## Base de datos

El esquema vive en `supabase/migrations/`. Cinco tablas y un bucket:

- **`people`** — la persona: nombre, concepto, notas, si esta archivada y el
  monto que se precarga al crear un periodo nuevo.
- **`periods`** — cada periodo con sus fechas, su monto objetivo y un nombre
  opcional.
- **`payments`** — los pagos, cada uno colgando de una persona y, opcionalmente,
  de uno de sus periodos (`period_id`; `NULL` = sin asignar).
- **`receipts`** — metadato de cada comprobante: a que pago pertenece, nombre
  original, tipo, tamano y su ruta dentro del bucket privado.
- **`issuer_settings`** — tus datos para el encabezado del PDF.

Puntos de diseno:

- **RLS activo en ambas tablas**, con politicas separadas para `select`,
  `insert`, `update` y `delete`. Todas comparan `(select auth.uid()) = user_id`
  (con el `select` envolvente para que Postgres evalue la funcion una vez por
  consulta, no una vez por fila).
- **Claves foraneas compuestas**: `payments (person_id, user_id) -> people` y
  `payments (person_id, period_id) -> periods (person_id, id)`. A nivel de base
  es imposible colgar un pago de la persona de otro usuario, ni de un periodo
  que no sea de esa misma persona, aunque el cliente lo intentara.
- **Restriccion de exclusion** en `periods`: dos periodos de la misma persona no
  pueden solaparse.
- **Borrado en cascada**: eliminar una persona elimina sus periodos y sus pagos.
  Eliminar un periodo deja sus pagos sin asignar, no los borra.
- **Indice unico** sobre `(user_id, lower(btrim(name)))`: no hay dos personas
  con el mismo nombre para el mismo usuario.
- **Trigger `set_updated_at`** en las tres tablas, sin permiso de ejecucion para
  `anon` ni `authenticated`, asi que no es invocable por la API REST.
- **Bucket privado `comprobantes`**, con limite de 10 MB y lista blanca de tipos
  en el propio bucket, y politicas sobre `storage.objects` que comparan el primer
  segmento de la ruta con `auth.uid()`.
- **Realtime habilitado** en las tablas de datos: sustituye al `onSnapshot` de
  Firestore.

### Aplicar las migraciones

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

O pegando el contenido de `supabase/migrations/*.sql` en el SQL Editor del
panel. Para regenerar los tipos despues de cambiar el esquema:

```bash
npx supabase gen types typescript --project-id <project-ref> > src/types/database.ts
```

(y vuelve a anadir al final los alias `PersonRow` / `PeriodRow` / `PaymentRow`).

---

## Como funciona sin conexion

Tres piezas distintas, que a veces se confunden:

1. **El service worker** (`vite-plugin-pwa`) cachea el HTML, el JS y el CSS. Es
   lo que hace que la app *abra* sin internet.
2. **La cache de TanStack Query, persistida en `localStorage`**, guarda los
   ultimos datos leidos. Es lo que hace que la app *muestre algo* sin internet.
3. **Las mutaciones en pausa.** Si registras un pago sin conexion, TanStack
   Query lo deja en pausa, lo persiste y lo reenvia al reconectar — incluso si
   cerraste la app en medio. Por eso las mutaciones se definen en
   `lib/mutationDefaults.ts` y no dentro de los componentes: al rehidratar, la
   libreria necesita encontrar la funcion asociada a cada `mutationKey`.

La cabecera muestra en todo momento cual de estos estados aplica.

La subida de comprobantes es la excepcion: un `File` no se puede guardar en la
cache persistida, asi que esa mutacion no se pone en cola. Si no hay red, el pago
se guarda igual y el archivo se adjunta despues; la app lo dice con esas
palabras en vez de fingir que quedo subido.

---

## Despliegue

`npm run build` deja todo en `dist/`, que es estatico: sirve en Netlify, Vercel,
Cloudflare Pages o GitHub Pages sin backend. El `base` es relativo y el router
usa hash (`#/persona/...`), asi que funciona igual en la raiz de un dominio o en
un subdirectorio, y no hace falta configurar redirecciones en el servidor.

En el hosting solo hay que definir `VITE_SUPABASE_URL` y
`VITE_SUPABASE_PUBLISHABLE_KEY` en las variables del build. Y en el panel de
Supabase, en **Authentication -> URL Configuration**, agrega la URL final a los
*Redirect URLs*.
