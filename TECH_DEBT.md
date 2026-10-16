# Deuda técnica — Aercom CRM v2

Registro de bugs preexistentes, código muerto y duplicaciones detectados durante la modularización. No se corrigen automáticamente — quedan documentados para decidir su abordaje en un sprint dedicado. Ver `CHANGELOG.md` para el historial completo por PR.

---

## Drive — seguimiento del paso 4

Las operaciones de preparación y subida verifican respuestas HTTP y la estructura mínima de listas/IDs. Un fallo de búsqueda no dispara creación; un fallo de PATCH no confirma el backup ni devuelve éxito al exportador Excel. El indicador conserva los cambios pendientes y solo afirma que hay una copia local cuando su escritura terminó. La confirmación se compara con el snapshot enviado para no limpiar cambios realizados mientras esperaba la red.

Los callbacks manual y automático capturan errores de preparación y no dejan Drive listo en ese caso. La reconexión ya no muestra tras tres segundos un mensaje de ausencia de cambios sin verificarlos. Se conservó la lógica de no descargar al reconectar automáticamente.

Verificación: 24 pruebas con HTTP/OAuth/DOM/almacenamiento simulados y las 52 anteriores (76 aprobadas). Chromium comprobó copia local y estado pendiente tras 403, confirmación 204, cambios durante una subida, mensajes del exportador Excel y preparación fallida. No se probó una cuenta real; SheetJS y Chart se sustituyeron por dobles en el navegador.

Pendiente: conflictos y duplicados entre dispositivos/sesiones, respuestas fuera de orden entre subidas simultáneas, desconexión durante una petición y renovación de credenciales. La comparación de snapshots evita un indicador falso, pero no serializa ni fusiona escrituras remotas. Un error no se reintenta automáticamente; el siguiente guardado puede volver a intentar la subida.

## Integridad — seguimiento del paso 3

La importación JSON local y la descarga del backup de Drive validan una copia antes de reemplazar el estado. Se exigen las listas `clientes`, `equipos` y `cotizaciones`; las colecciones posteriores ausentes o null se normalizan como en los backups heredados. Se verifican registros, IDs, tipos de campos conocidos, fechas y estructura de estados de facturación. Los campos adicionales se conservan. No se convierten silenciosamente números/textos o booleanos incompatibles: se rechaza el archivo y se informa el campo para su revisión.

La normalización existente se extrajo a `_normalizeData()` para compartir migraciones y valores predeterminados con el arranque. `_applyImportedData()` intenta renderizar antes de persistir y recupera D, almacenamiento e historial si falla la aplicación del backup. Si una falla posterior al guardado impide también restaurar el almacenamiento, D se conserva y se advierte que debe exportarse antes de recargar. Los errores de lectura y de búsqueda/descarga HTTP en Drive se informan; un JSON remoto rechazado no provoca una subida como alternativa.

Verificación: 36 pruebas nuevas en `tests/data-import.test.js`, más las 16 anteriores (52 en total). Cubren casos incompatibles, backup semilla, migración heredada, exportación/reimportación, errores de lectura, cuota, render y restauración, y descargas de Drive simuladas. Chromium comprobó importación y recarga local, nueve pantallas con un backup representativo, recuperación ante render/cuota y carga remota simulada. No se usó Drive real ni se verificó el dibujo de gráficos.

Pendiente: integridad referencial entre entidades, reglas de conflictos/duplicados de Drive y endurecimiento de la carga inicial de localStorage corrupto. La validación estructural no certifica seguridad del renderizado en los módulos restantes ni limita el tamaño de los archivos. Los backups con tipos incompatibles requieren revisión; no se reparan automáticamente.

## Integridad — seguimiento del paso 2

Corregida la pérdida de prioridad y campos de facturación detallada al guardar desde el formulario general de Clientes. Se parte del registro existente y se reemplazan los campos del formulario. Los valores previos fuera de los catálogos se conservan como opciones escapadas; el usuario puede elegir explícitamente otra modalidad. No se modifica el formato almacenado ni la implementación de sincronización o renombrado de referencias.

Verificación: nueve pruebas nuevas en `tests/client-editing.test.js`, más las siete pruebas del paso 1. El flujo real se comprobó en Chromium con un contexto temporal, almacenamiento local de prueba y Drive desconectado: conservación completa del cliente tras edición/recarga, renombrado con referencias, duplicados sin mutación, cambio de modalidad y alta sin copiar campos de otro cliente.

Limitaciones: el cambio previene pérdidas futuras; no recupera información eliminada anteriormente. Sigue pendiente separar conceptualmente modalidad y descripción en `facturacion`, así como resolver los restantes hallazgos; la validación JSON se agregó en el paso 3. No se cambió esa semántica de negocio en este paso.

## Seguridad — seguimiento del paso 1

Se protegieron interpolaciones de datos en Clientes, Equipos, vista previa/conflictos CSV y Reporte de Vencimientos. El reporte también protege las etiquetas JSON insertadas en su script. No se cambió el formato almacenado ni la lógica de guardado, importación o sincronización.

Verificación reproducible: `node --test tests/security-rendering.test.js`, con módulos nativos de Node. Cubre contenido HTML, ruptura de atributos, entidades literales, salida de facturación, equipos, etiquetas del reporte y conservación del estado. También se verificaron estos flujos en Chromium aislado; los recursos externos se bloquearon y Chart se sustituyó por un doble que captura su configuración, por lo que no se validó el dibujo real de gráficos.

Pendiente: revisión contextual de los demás módulos y restantes hallazgos de integridad/sincronización. La validación y recuperación de importaciones JSON se agregaron en el paso 3. Las entradas históricas de XSS resuelto describen su alcance original, no una garantía global de seguridad.

## Bugs vigentes

### Filas `.row-err`/`.row-warn` ilegibles en modo oscuro (Sprint 6)
`css/style.css:505-506`. Fondo claro hardcodeado sin override para `.dark-theme`; texto claro sobre fondo claro en la tabla de Equipos.

### `updateExcelCounts()` no muestra nada — apunta a IDs que no existen en el HTML (Sprint 14)
`js/modules/excel.js`. La función busca `document.getElementById('excel-count-clientes')`, `'excel-count-equipos'` y `'excel-count-cotizaciones'`, pero ninguno de esos IDs existe en `index.html` (confirmado por búsqueda: cero coincidencias). Los `if(ec)`/`if(ee)`/`if(eq)` evitan el crash, así que la función corre sin error en cada render de la pantalla "Excel / Drive" — pero nunca actualiza nada visible. Es un no-op silencioso, no un crash.

---

## Código muerto vigente

- `quoteFromEquip(eid)` — `js/modules/equipos.js` (Sprint 6). Sin ningún punto de llamada en el proyecto.
- `delFactConfirm(cid)` — `js/modules/facturacion.js` (Sprint 7). Sin ningún punto de llamada en el proyecto.
- CSS "AERCOM POLISH" dentro del `<style>` del Reporte de Vencimientos (Sprint 13) — `js/modules/reportes.js`. El documento HTML standalone que genera `generarReporteVencimientos()` incluye ~80 líneas de reglas (`.k-col`, `.nav-item`, `.stat-card`, `#modal-overlay`, scrollbar, etc.) que no tienen ningún elemento correspondiente en ese documento — son estilos de la app principal, copiados junto con el resto del `<style>` pero inertes ahí.

## Duplicaciones funcionales vigentes (no unificadas)

- `deleteEquip(id)` (modal) vs `delEquipConfirm(eid)` (tabla) — `js/modules/equipos.js` (Sprint 6). Mismo efecto, distinta forma de armar el mensaje de confirmación.
- `deleteQuote(id)` (modal) vs `delQuoteConfirm(qid)` (tarjeta) — `js/modules/cotizaciones.js` (Sprint 8). Mismo patrón que el anterior.
- `delFactConfirm(cid)` (Facturación, código muerto) vs `delClientConfirm(id)` (Clientes) — ambas eliminan un cliente completo, con textos/refrescos distintos.

## Otras observaciones vigentes

- La carga y el guardado de Drive usan `STORAGE_KEY` desde los pasos 3 y 4; la observación anterior sobre literales duplicados quedó resuelta.
- La descarga JSON de Drive valida su estructura desde el paso 3. Siguen pendientes los conflictos entre dispositivos y la revisión de todos los contextos de renderizado; validar la forma no autentica el origen del contenido del archivo.

---

## Resueltos

### `closeModal()` sin argumento no cierra el modal genérico — PR-007.2
`js/modal.js` definía `closeModal(id)`, pisando a la versión real sin argumento por orden de carga. Renombrada a `_closeModalById(id)`.

### Grilla de Calendario corrompida por comillas sin escapar en `onclick` — PR-007.1
`JSON.stringify(ev.title)` rompía el atributo `onclick`. Corregido escapando `"` → `&quot;`.

### XSS por `innerHTML` sin escapar (sistémico) — PR-014.1
74 interpolaciones de datos de usuario sin `_esc()` en 9 módulos.

### `calShowEventDetail()`/`calShowDay()` — `SyntaxError` por comillas en `detail` — PR-014.2
Resuelto como efecto colateral de eliminar la interpolación de datos en atributos JS (ver siguiente entrada).

### Inyección de JS arbitrario vía IDs libres embebidos en `onclick` — PR-014.2
34 atributos `onclick`/`ondblclick` en 7 módulos reemplazados por `data-*` + `this.dataset.*`.

### `<textarea id="rem-notas">` sin escapar — PR-014.3
Permitía cerrar el tag con `</textarea>` e inyectar HTML/JS.

### `<option>` sin escapar (11 ubicaciones en total, en dos tandas) — PR-014.4 y PR-014.5
`${c.nombre}` (6 ubicaciones, PR-014.4) y `${e.id}`/`${c.responsable}`/`${c.id}` (5 ubicaciones adicionales encontradas en la auditoría de cierre, PR-014.5). Confirmado explotable y corregido: el navegador cierra `</option>` como tag real, dejando el resto del payload como HTML hermano dentro del `<select>`.

### `_renderCalSemana()` — el click en un evento abría "Nuevo evento" en vez del detalle — RC2 (BUG-003)
Faltaba `event.stopPropagation()` en el `onclick` del evento, a diferencia de `_renderCalMes()`. Agregado, igualando el patrón de la vista mes.

### `applyPipeFilter()` — el buscador por N° de cotización no funcionaba — RC2 (BUG-008)
Buscaba `card.querySelector('.k-title')`, clase que `buildCard()` nunca genera (el ID se renderiza en `.k-id`). Corregido el selector.

### Undo/Redo no revertía la última acción, en ningún módulo — RC2 (BUG-001)
`persist()` guardaba el snapshot de `D` después de que el módulo llamante ya lo había mutado, no antes. Corregido: el snapshot ahora se toma del último estado guardado en `localStorage` (el estado real previo a la mutación) en vez de `D` actual.

### Clientes — buscador y filtros ocultaban toda la tabla — RC2 (BUG-002)
`applyCliFilter()` parseaba el ID del cliente desde el string del atributo `onclick` del botón "Ver ficha" con una regex de comillas simples, patrón que quedó obsoleto tras la migración a `data-*` de PR-014.2. Corregido: ahora lee `btn.dataset.id` directamente.

### Calendario — CRUD incompleto de eventos propios (Reuniones) — RC2 (BUG-004)
Solo se podían crear y visualizar; no había forma de editar ni eliminar desde la interfaz. Agregado editar y eliminar en `calShowEventDetail()`/`openCalEventModal()`, sin tocar `D.eventos` ni `_calGetEventos()`.

### Calendario — contador "N eventos este período" mostraba el total histórico — RC2 (BUG-006)
`renderCalendario()` sumaba todos los eventos futuros de toda la base, sin filtrar por el mes/semana visible. Corregido: ahora filtra por el rango de fechas del período mostrado.

### Google Drive — no había forma de desconectar — RC2 (BUG-007)
Agregada `gdriveDisconnect()`, reutilizando el botón del sidebar (antes quedaba con `onclick=null` una vez conectado).

### Excel — `window.open()` nulo (popup bloqueado) tiraba una excepción no controlada — RC2 (BUG-009)
`generarReporteVencimientos()` no verificaba si `window.open()` devolvía `null`. Agregado control con mensaje claro al usuario.

### `xlsImport()` llamaba a `_origPersist()` en vez de `persist()` — RC2 (BUG-010)
Una importación masiva desde Excel no quedaba disponible para deshacer con Ctrl+Z ni disparaba sincronización con Drive. Corregido: ahora usa `persist()` como el resto de los flujos de guardado del proyecto.
