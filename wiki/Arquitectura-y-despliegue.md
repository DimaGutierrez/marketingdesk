# Arquitectura y despliegue

## Ejecución en la nube

La interfaz se sirve desde Cloudflare Pages bajo `/marketingdesk/`. El Worker en modo avanzado atiende esa ruta y `/marketingdesk/api/`; el resto del portfolio continúa como contenido estático. D1 guarda registros, métricas, adjuntos fragmentados e historial. No hay túneles ni conexiones a una PC personal.

## Archivos

- `web/`: interfaz y ejemplo ficticio de solo lectura.
- `cloudflare/worker.template.js`: API y validaciones.
- `cloudflare/schemas.json`: contrato de campos.
- `cloudflare/schema.sql`: tablas e índices.
- `cloudflare/build.mjs`: genera `dist/`, incluyendo `_worker.js` y `_routes.json`.
- `cloudflare/worker.test.mjs`: pruebas con SQLite temporal en memoria.

## Desplegar tu propia copia

1. Crear un proyecto Pages y una base D1 en tu cuenta de Cloudflare.
2. Ejecutar `cloudflare/schema.sql` en D1.
3. Vincular esa base al entorno de Pages con el nombre `MARKETING_DB`.
4. Configurar `MARKETING_KEY` como secreto con una clave aleatoria de al menos 24 caracteres. No incluirla en Git.
5. Usar fecha de compatibilidad `2026-09-30` y comportamiento cerrado ante errores de Functions.
6. Ejecutar `npm run build` y `npm test` con Node 24 o superior.
7. Publicar el contenido de `dist` mediante un despliegue Pages que soporte `_worker.js` en modo avanzado. Ver [documentación oficial](https://developers.cloudflare.com/pages/functions/advanced-mode/).

Si se integra con un portfolio existente, **combinar los archivos de `dist` con el sitio completo**, preservar sus `_headers` y `_redirects`, y añadir `_worker.js` y `_routes.json` como archivos de configuración del despliegue. Subir sólo la carpeta de Marketing Desk reemplazaría el resto del sitio.

## Seguridad y consistencia

Todas las rutas privadas comprueban la clave y el origen. Se utilizan consultas parametrizadas, validación de campos y control de versión al editar. Las importaciones se validan antes de guardarse y usan una operación SQL agrupada. Las respuestas privadas no se almacenan en caché. La aplicación no dispone de usuarios individuales, roles ni trazabilidad de identidad por persona.

## Respaldo y recuperación

La descarga JSON contiene cinco tablas: records, metrics, assets, asset_chunks y activity. `asset_chunks.body` guarda fragmentos base64. Para recuperación administrada, crear una base D1 nueva, ejecutar el esquema, cargar con parámetros primero records/assets y después metrics/asset_chunks/activity, validar cantidades y luego cambiar el binding al destino recuperado. Conservar la base anterior hasta verificar la recuperación. No pegar backups privados en el repositorio. Cloudflare también ofrece [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/).

## Costos y límites

La arquitectura no requiere servicios publicitarios pagos ni APIs de IA. Se diseñó para las cuotas gratuitas de Cloudflare, que son finitas y compartidas con otros proyectos de la cuenta. En el plan gratuito, alcanzar las cuotas puede detener las operaciones hasta su renovación. Si la cuenta se cambia a un plan pago, sus condiciones de facturación son distintas. [Precios y cuotas D1](https://developers.cloudflare.com/d1/platform/pricing/).

## Hoja de ruta abierta

Posibles mejoras: autenticación por usuario, importadores por plataforma, comparación entre períodos y revisiones de contenido. Son propuestas, no funciones actuales. Discutí primero el problema y el alcance antes de implementar.
