# Changelog — Aercom CRM v2

Historia de la modularización del proyecto, agrupada por PR. No detalla línea por línea — para eso está el historial de cada módulo en su propio header de documentación (`js/modules/*.js`) y el detalle de deuda técnica en `TECH_DEBT.md`.

---

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
