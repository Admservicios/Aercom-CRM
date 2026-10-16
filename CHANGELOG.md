# Changelog — Aercom CRM v2

Historia de la modularización del proyecto, agrupada por PR. No detalla línea por línea — para eso está el historial de cada módulo en su propio header de documentación (`js/modules/*.js`) y el detalle de deuda técnica en `TECH_DEBT.md`.

---

## Sin publicar — Paso 7: deshacer/rehacer y fechas de calendario

- Se conserva un snapshot inicial en memoria para deshacer también la primera edición cuando aún no existe `aercom-data`. El guardado agrega historial y descarta rehacer después de completarse correctamente.
- Deshacer/rehacer reutiliza la aplicación con recuperación de Storage: un error de parseo, renderizado o persistencia no consume la acción ni confirma éxito. Las restauraciones exitosas programan la sincronización habitual con Drive y mantienen el límite de 30 acciones.
- Ctrl/Meta+Z conserva el deshacer nativo en campos editables; Ctrl/Meta+Shift+Z funciona con `Z` mayúscula.
- Hoy se obtiene del calendario local. Las diferencias y sumas de fechas sin hora usan días UTC para evitar offsets y cambios DST. El calendario mensual/semanal construye sus claves y rangos con fechas locales.
- Validación: 134 pruebas Node (20 nuevas), con cinco zonas horarias y transiciones DST. Chromium aislado en esas cinco zonas comprobó primera edición, botones/atajos, fallo de cuota y recuperación, recarga y fechas/eventos del mes y semana. Cero errores JS; Chart simulado, Drive desconectado y datos ficticios.

## Sin publicar — Paso 6: proteger borrados y referencias del calendario

- Bloqueo compartido en las seis rutas de borrado de clientes, equipos y cotizaciones cuando existen referencias. Clientes incluye recordatorios, eventos e historial mensual de facturación, incluso estados Pendiente/Excluido; equipos incluye cotizaciones/pedidos; cotizaciones incluye pedidos de cualquier estado.
- Se informa el número de asociaciones y se revalida al confirmar. No se borran registros en cascada ni se modifica el historial. Los registros sin dependencias mantienen su borrado habitual.
- Al cambiar el código de un cliente, también se actualizan sus eventos propios del calendario.
- Verificación: 90 pruebas Node (38 nuevas y ampliación del caso de renombrado), más Chromium aislado: seis rutas bloqueadas sin mutación, seis borrados con recarga, asociación agregada durante la confirmación y renombrado desde el formulario con persistencia. Sin errores JS; Chart simulado y Drive desconectado.
- Tras integrar main con el PR #2: 114 pruebas aprobadas y repetición satisfactoria del flujo de Chromium aislado.
- Rama creada desde main y actualizada con el PR #2 ya fusionado; no incorpora el PR #3 de conflictos de Drive. No repara huérfanos preexistentes ni valida todas las relaciones en importaciones o cambios de asociación.

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
