# Guía de uso

## Del brief al reporte

1. Creá una campaña con objetivo, canal, fechas, presupuesto y responsable.
2. Cargá contenidos vinculados a ella. Adjuntá PNG, JPEG, WebP o PDF de hasta 5 MB. El total de piezas del espacio es de 20 MB.
3. Asigná tareas con responsable, agencia/proveedor, fecha y prioridad. Actualizá el estado cuando avance el trabajo.
4. Registrá resultados diarios. Podés corregir una carga: la combinación campaña/fecha se reemplaza íntegramente.
5. Seleccioná período y campaña. Exportá un reporte HTML para compartir o imprimir como PDF, o un CSV para seguir analizando.
6. Registrá una hipótesis de mejora y documentá qué aprendiste.

## Importación CSV

Descargá la plantilla desde Métricas y reportes. Conservá las columnas y los identificadores de campaña. Usá UTF-8, comas, fechas AAAA-MM-DD y números enteros no negativos. Los campos `spend_cents` y `revenue_cents` están en centavos de pesos argentinos.

Validar y previsualizar no guarda datos. Revisá cuántas filas reemplazarían registros existentes antes de confirmar. Se admiten 2.000 filas y 2 MB por importación; filas inválidas o combinaciones duplicadas rechazan el archivo completo.

## Cómo leer las métricas

CTR = clics / impresiones × 100. CPC = inversión / clics. CPL = inversión / leads. CPA = inversión / conversiones. ROAS = ingresos atribuidos / inversión. “—” significa que el denominador es cero, no un rendimiento de cero.

El período filtra resultados y reportes. Los presupuestos y la agenda muestran el total. No hay deduplicación entre plataformas: revisá la atribución antes de sumar conversiones de canales distintos.

## Contenidos y coordinación

“Publicado” exige el enlace HTTPS de la publicación realizada. Cambiar el estado no publica nada automáticamente. Los nombres de responsables y agencias sirven para organizar el trabajo de un espacio compartido; no representan cuentas ni envían notificaciones.

## Respaldo

Descargar backup genera JSON con registros, métricas, metadatos de piezas, sus fragmentos base64 e historial. No contiene la clave. Guardalo en un lugar privado. La restauración administrativa está explicada en Arquitectura y despliegue; no hay un botón que reemplace datos desde la interfaz.

## Acceso

La clave se conserva en memoria durante la sesión y debe ingresarse después de recargar. No la compartas en Issues, Discussions, capturas ni repositorios. El ejemplo público no necesita clave y no puede editar tus datos.
