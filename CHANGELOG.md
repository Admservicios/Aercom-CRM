# Changelog — Aercom CRM v2

Historia de la modularización del proyecto, agrupada por PR. No detalla línea por línea — para eso está el historial de cada módulo en su propio header de documentación (`js/modules/*.js`) y el detalle de deuda técnica en `TECH_DEBT.md`.

---

## Sin publicar — Paso 5: conciliar copias y conservar conflictos

- Se reemplaza la comparación por fecha sin hora por comparación SHA-256 del contenido normalizado (sin `lastSaved`) y una base compartida por carpeta/archivo. La base se captura por pestaña y se persiste para la próxima sesión.
- Copias iguales no se suben; si solo cambió una respecto de la base se actualiza la otra. Sin base conocida o con cambios en ambas, la sincronización se detiene y ofrece conservar local, usar Drive o decidir después. No se fusionan registros automáticamente.
- Antes de una elección se respaldan ambas copias en el navegador. Se pueden descargar individualmente y descargar el historial de respaldos, incluso después de recargar. Si falta espacio, se bloquea el reemplazo y se ofrece reintentar el respaldo.
- Se buscan backups al reconectar y antes de crear; listas ambiguas detienen la operación sin elegir ni eliminar archivos. El alta del backup usa multipart (metadata y contenido juntos), evitando un archivo vacío si falla una segunda petición.
- Se serializan las operaciones de sincronización de cada sesión, se reevalúan ediciones recibidas durante lecturas/subidas y se invalidan respuestas de sesiones desconectadas. Las actualizaciones envían `If-Match`; un 412 vuelve a pedir elección y, sin ETag, no se sobrescribe.
- Validación: 102 pruebas aprobadas; Chromium aislado verificó el diálogo, descargas, posponer/reabrir, ambas elecciones, falta de espacio, reintento y cambio concurrente. HTTP/ETag/Chart simulados; pendiente validar el comportamiento ETag/If-Match con Drive real antes de fusionar este paso.
- Limitación: dos dispositivos pueden crear a la vez el primer archivo o carpeta porque Drive no impone nombres únicos. Se preservan los archivos y se detecta la ambigüedad en la siguiente búsqueda, sin eliminación automática.

## Sin publicar — Paso 4: confirmar guardados de Drive

- Las búsquedas y creaciones de carpetas/archivos y los PATCH de backups/reportes comprueban HTTP. Las respuestas de búsqueda y creación deben contener IDs válidos; un error no se interpreta como archivo ausente.
- El backup solo muestra guardado exitoso después del PATCH confirmado. Los fallos mantienen el estado pendiente y distinguen si la copia local pudo conservarse. Una edición posterior al snapshot enviado sigue pendiente aunque termine la subida anterior.
- La preparación de carpetas debe terminar antes de anunciar que Drive está listo; los callbacks OAuth capturan sus errores. Se retiró el mensaje temporizado de reconexión que afirmaba ausencia de cambios sin comprobarla.
- Se conserva el ID creado si falla la subida posterior, para que otro intento en la misma sesión no cree un segundo backup. No se añaden reintentos automáticos ni se resuelven conflictos entre dispositivos.
- Validación: 24 pruebas nuevas (76 en total con `node --test tests/*.test.js`) y Chromium aislado para indicadores, exportación Excel y conexión fallida. HTTP, OAuth, SheetJS y Chart simulados; no se accedió a una cuenta real.

## Sin publicar — Paso 3: validar backups antes de reemplazar datos

- Validación compartida de JSON local y descargado de Drive: raíz, colecciones, registros, IDs únicos/no reservados, tipos conocidos, fechas y estructura de facturación. Los campos adicionales se conservan y los tipos incompatibles se rechazan sin conversiones silenciosas.
- Las normalizaciones existentes (arrays opcionales, clientes y migraciones heredadas) se comparten con el arranque. No se cambia el formato de exportación.
- Render previo al guardado y recuperación de memoria, copia local e historial ante errores. Si el navegador impide restaurar la copia local, se informa que debe exportarse la copia en memoria antes de recargar.
- La búsqueda y descarga de Drive comprueban HTTP y rechazan contenido incompatible antes de decidir una subida. No se modifican las reglas de conflictos ni la implementación de subidas.
- Validación: 52 pruebas con `node --test tests/*.test.js`, más Chromium aislado para importación, recarga, pantallas y fallos de render/cuota. Drive se verificó con respuestas simuladas y Chart con un doble; no se validó acceso a cuentas reales.

## Sin publicar — Paso 2: conservar datos al editar clientes

- El guardado general conserva la prioridad y los campos existentes ajenos al formulario, incluida la configuración detallada de facturación y campos adicionales importados. Las altas mantienen sus valores predeterminados.
- Los selectores muestran el valor histórico existente aunque no pertenezca al catálogo, evitando sustituir silenciosamente tipos como `Clínica` y descripciones de facturación personalizadas. Esas opciones mantienen el escapado del paso 1.
- Una modalidad personalizada conserva su día existente al editar otros datos; cambiar explícitamente a una modalidad distinta de `Por fecha` limpia el día. La modalidad `Por fecha` sigue usando el día del formulario.
- Pruebas: `node --test tests/client-editing.test.js tests/security-rendering.test.js` (16 pruebas). Chromium aislado verificó edición, persistencia y recarga, renombrado y referencias, rechazo de duplicados, modalidades y alta con datos ficticios; sin acceso a Drive.

## Sin publicar — Paso 1: renderizado seguro

- Escapado de datos en listados, formularios y ficha de Clientes; listado, formulario y fechas inline de Equipos; vista previa y conflictos CSV; tablas del Reporte de Vencimientos.
- Serialización de etiquetas del gráfico del reporte que impide cerrar el script desde datos importados, conservando su valor original.
- Pruebas de regresión con Node sin dependencias adicionales (`node --test tests/security-rendering.test.js`) y verificación aislada en Chromium. La comprobación de navegador usa un doble de Chart y no valida el dibujo de gráficos ni la conexión con Drive.
- Documentación del alcance: no cambia la persistencia ni certifica los módulos restantes.

## Fase inicial — Core, Utils, Storage, Dashboard, Clientes, Equipos, Facturación, Cotizaciones

Sesiones previas al historial registrado en este archivo. Se estableció la convención de módulo (`js/modules/*.js`, header con Responsabilidad + Dependencias externas + Decisiones de límite) y se migraron desde el `<script>` inline de `index.html`:

- **Core / Config / Utils / Storage** — `js/utils.js`, `js/storage.js`, `js/config.js`, `js/ui.js`, `js/app.js`.
- **Dashboard** (Sprint 4) — `js/modules/dashboard.js`.
- **Clientes** (Sprint 5) — `js/modules/clientes.js`, incluida la ficha de 6 pestañas.
- **Equipos** (Sprint 6) — `js/modules/equipos.js`.
- **Facturación** (Sprint 7) — `js/modules/facturacion.js`.
- **Cotizaciones / Pipeline** (Sprint 8) — `js/modules/cotizaciones.js`.

## PR-006 — Modularización de Pedidos de Servicio

Extracción de `js/modules/pedidos.js` (Sprint 9) desde `index.html`. Validación funcional completa: listado, alta, edición, eliminación, cambio de estado, generación desde una Cotización Aprobada, persistencia, integración con Clientes/Equipos/Cotizaciones.

## PR-007 — Modularización de Calendario

Extracción de `js/modules/calendario.js` (Sprint 10). Feed unificado de vencimientos de Equipos + follow-ups de Cotizaciones + Recordatorios + Pedidos + eventos propios.

### PR-007.1 — Fix: grilla de Calendario corrompida por comillas en `onclick`
`JSON.stringify(ev.title)` dentro de un atributo `onclick` delimitado por comillas dobles cortaba el HTML en todo evento. Corregido escapando `"` → `&quot;` en el resultado.

### PR-007.2 — Fix: `closeModal()` global no cerraba ningún modal
`js/modal.js` declaraba su propio `closeModal(id)`, pisando a la implementación real de `index.html` por orden de carga. Renombrada a `_closeModalById(id)` (sin uso real en el proyecto), liberando el nombre global.

## PR-008 — Modularización de Recordatorios

Extracción de `js/modules/recordatorios.js` (Sprint 11), reubicado desde el stub inerte `js/recordatorios.js` (nunca enlazado) a la convención `js/modules/`.

## PR-009 — Modularización de Theme

Extracción de `js/modules/theme.js` (Sprint 12): detección de tema, toggle, persistencia en `localStorage['theme']`.

## PR-010 — Modularización de Reportes PDF

Extracción de `js/modules/reportes.js` (Sprint 13): `generarReporteVencimientos()` y `_LOGO_RPT`. Migración verificada con diff línea por línea contra el original (incluida una corrección propia, durante la migración, de un string base64 mal transcripto antes de integrarlo).

## PR-011 — Modularización de Excel

Extracción de `js/modules/excel.js` (Sprint 14): plantillas, importación, exportación (local y a Drive). Hallazgos documentados: `updateExcelCounts()` no-op (IDs de DOM inexistentes) y `xlsImport()` usa `_origPersist()` en vez de `persist()`.

## PR-012 — Modularización de Google Drive

Extracción de `js/modules/drive.js` (Sprint 15): OAuth, carpetas, sincronización de `D`, subida de archivos. `persist()` permaneció en `index.html` sin tocar; Drive expone `_scheduleDriveSave()` como único punto de enganche.

## PR-013 — Modularización de CSV Import

Extracción de `js/modules/csv.js` (Sprint 16), creado desde cero (no existía stub previo). Con esto, `index.html` quedó reducido a infraestructura compartida — sin lógica funcional de dominio pendiente.

## PR-014 — Auditoría Técnica Final

Auditoría de solo lectura sobre arquitectura, código, `index.html`, módulos, performance, seguridad y archivos. Bloqueo detectado: uso sistemático de `innerHTML` con datos de usuario sin sanitizar.

### PR-014.1 — Hardening: XSS por `innerHTML`
74 interpolaciones de datos de usuario envueltas con `_esc()` en los 9 módulos con render de dominio (Clientes, Equipos, Cotizaciones, Pedidos, Calendario, Recordatorios, Facturación, Dashboard, Reportes). Hallazgo residual: inyección de JS vía IDs libres embebidos en `onclick`.

### PR-014.2 — Hardening: inyección vía atributos JavaScript
34 atributos `onclick`/`ondblclick` que interpolaban datos de usuario como argumento de string JS reemplazados por `data-*` (escapado) + lectura `this.dataset.*` — sin `addEventListener`, sin reescritura de módulos. Efecto colateral: resuelto también el `SyntaxError` de `calShowEventDetail()` con comillas en el detalle.

### PR-014.3 — Hardening: `<textarea>` de Notas en Recordatorios
Único `<textarea>` del proyecto sin `_esc()`, permitía cerrar el tag con `</textarea>` e inyectar HTML/JS. Corregido en una línea.

### PR-014.4 — Hardening: `<option>${c.nombre}</option>` sin escapar
6 ubicaciones corregidas. Confirmado en navegador real que el navegador cierra `</option>` como tag válido, dejando el resto del payload como HTML hermano dentro del `<select>` — un `<img onerror>` ahí sí ejecuta.

### PR-014.5 — Cierre definitivo del patrón `<option>`
Auditoría de los 106 `<option>` del proyecto completo. 11 interpolaban datos de `D` (5 no cubiertas por PR-014.4); las 95 restantes son enums estáticos. Las 11 quedaron con `_esc()`. Confirmado sin vectores XSS explotables conocidos relacionados con `<option>`.

## PR-015 — Actualización completa de la documentación técnica

Reescritura de `docs/ARQUITECTURA.md` (arquitectura real, 13 módulos, diagrama de acoplamiento no lineal), `CHANGELOG.md` (este archivo) y reestructuración de `TECH_DEBT.md` (separación en deuda vigente vs. resueltos). Sin cambios de código.

## PR-016 — Limpieza final del repositorio

Eliminación de archivos obsoletos sin referencias en el proyecto: `Legacy`, `js/cotizaciones.js`, `js/facturacion.js`, `js/events.js`, `js/modules/navigation.js`, `css/dashboard.css`, `css/modals.css`, `css/responsive.css`, `css/tables.css`. Verificado mediante búsqueda real que ninguno tenía `<script src>`, `<link>`, import ni referencia dinámica. Sin cambios funcionales.

## PR-018 — Cierre oficial de la versión 2.0

Actualización final de documentación. Preparación del repositorio para publicación. Sin cambios funcionales.
