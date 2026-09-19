/**
 * Traduccion de los errores al generar el PDF.
 *
 * El caso interesante es el fallo de un `import()` dinamico, que el navegador
 * reporta con un mensaje tecnico inutil para el usuario. Pasa en dos
 * situaciones, y las dos tienen solucion:
 *  - en desarrollo, cuando faltan las dependencias del generador (`npm install`);
 *  - en produccion, cuando la pestana lleva abierta desde antes de un despliegue
 *    y el trozo de codigo que pide ya no existe en el servidor.
 */

const CHUNK_FAILURE =
  /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to fetch/i

export const CHUNK_FAILURE_MESSAGE =
  'No se pudo cargar el generador de PDF. ' +
  'Si acabas de actualizar el proyecto, corre `npm install` y reinicia el servidor: ' +
  'el PDF usa dos dependencias nuevas (jspdf y jspdf-autotable). ' +
  'Si la app ya estaba abierta durante un despliegue, recarga la pagina.'

export function describeStatementError(caught: unknown): string {
  const message = caught instanceof Error ? caught.message : 'No se pudo generar el PDF.'
  return CHUNK_FAILURE.test(message) ? CHUNK_FAILURE_MESSAGE : message
}
