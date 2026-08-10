# Deuda técnica — Aercom CRM v2

Registro de bugs preexistentes, código muerto y duplicaciones detectados durante la modularización. No se corrigen automáticamente — quedan documentados para decidir su abordaje en un sprint dedicado. Ver `CHANGELOG.md` para el historial completo por PR.

---

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

- `_gdriveLoadData()`/`_gdriveSaveData()` (`js/modules/drive.js`) usan el literal `'aercom-data'` en vez de la constante `STORAGE_KEY` de `js/storage.js` (mismo valor, sin impacto funcional) — inconsistencia de estilo, no un bug.
- Sincronización de Google Drive sin validación de contenido: un `aercom-data.json` editado a mano y subido a la carpeta de Drive se carga tal cual en `_gdriveLoadData()`, sin chequeo de forma ni de origen.

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
