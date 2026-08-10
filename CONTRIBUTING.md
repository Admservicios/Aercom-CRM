# Contribuir a Aercom CRM v2

## Objetivo del proyecto

Aercom CRM v2 es un CRM interno de página única (HTML/CSS/JavaScript vanilla, sin build step, sin backend) para la gestión administrativa del área de Servicios de Aercom SA: clientes, equipos, cotizaciones, pedidos de servicio, facturación, calendario y recordatorios. Resuelve la necesidad de centralizar ese seguimiento — antes disperso en planillas y documentos sueltos — en una sola aplicación que corre en el navegador sin infraestructura de servidor.

---

## Filosofía del proyecto

Estas reglas se aplicaron de forma consistente durante toda la modularización (ver `CHANGELOG.md`, PR-006 a PR-013) y deben mantenerse en cualquier trabajo futuro:

- **Una responsabilidad por módulo.** Cada archivo en `js/modules/` corresponde a un único dominio de negocio (Clientes, Equipos, Cotizaciones, etc.). Si una función pertenece claramente a otro dominio, vive en el módulo de ese dominio, aunque otro módulo la use.
- **No duplicar lógica.** Antes de escribir una función nueva, verificar si ya existe algo equivalente (helpers en `js/utils.js`, o funciones de otro módulo). El proyecto ya tiene duplicaciones conocidas sin unificar (ver `TECH_DEBT.md`) — no agregar más.
- **La infraestructura compartida queda en `index.html`** (o en `js/utils.js`/`js/storage.js`/`js/modal.js` cuando corresponde) cuando la usan 2 o más módulos: el estado global `D`, `persist()`, `showModule()`/`renderModule()`, el sistema de confirmación de borrado, el modal genérico, undo/redo, y los helpers de fecha/formato/escapado. No mover esto a un módulo de dominio.
- **Cambios mínimos.** Cada PR de este proyecto tuvo un alcance explícito y acotado. Un cambio funcional no debe arrastrar refactors, optimizaciones ni limpieza no pedida — eso se documenta como deuda técnica para un PR dedicado, no se hace "de paso".
- **Evitar reescrituras.** Migrar o modificar código existente preservando su comportamiento exacto salvo que el objetivo explícito del cambio sea otro. Las migraciones de módulos de este proyecto se hicieron línea por línea, verificadas por diff contra el original.
- **Documentar los límites de cada módulo.** Todo módulo nuevo debe dejar explícito, en su propio header, qué datos de otros dominios lee (y por qué) y qué decidió no incluir.

---

## Convenciones

**Nombres de funciones**: verbo + entidad, en español, camelCase (`renderClientes`, `saveCliente`, `deleteEquip`, `applyCliFilter`, `openCalEventModal`). Las funciones de confirmación de borrado siguen el patrón `del{Entidad}Confirm(id)`.

**Nombres de archivos**: un archivo por módulo en `js/modules/`, nombre en minúsculas igual al dominio (`clientes.js`, `equipos.js`, `calendario.js`).

**Organización de módulos**: todas las funciones de un módulo son globales (no hay namespacing, IIFE ni clases) — el proyecto no usa ningún sistema de módulos de JavaScript (no hay `import`/`export`), se apoya en el orden de los `<script src>` en `index.html`. Por eso los nombres de función deben ser únicos en todo el proyecto.

**Comentario de cabecera** (obligatorio en todo archivo de `js/modules/`):

```js
/**
 * ============================================================
 * AERCOM CRM v2
 * <Nombre> Module
 * <origen: migrado desde index.html / creado desde cero>
 * ============================================================
 *
 * Responsabilidad: qué pantalla(s) cubre y su dominio propio en D.
 *
 * Dependencias externas (definidas en index.html / js/utils.js,
 * sin mover — no son responsabilidad de este módulo):
 *   D, persist(), toast(), closeModal(), confirmDel(), _esc(), etc.
 *
 * Decisiones de límite de módulo:
 *   - qué datos de otros dominios se leen y por qué
 *   - qué se dejó deliberadamente fuera
 */
```

Ejemplo real: [`js/modules/recordatorios.js`](js/modules/recordatorios.js).

**Estructura**: `index.html` contiene solo infraestructura compartida (sin lógica de dominio). Los 13 módulos de dominio viven en `js/modules/`. El detalle completo está en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

---

## Antes de hacer un cambio

- [ ] Leer `TECH_DEBT.md` — puede que el comportamiento "raro" que encontraste ya esté documentado como bug conocido, código muerto o duplicación aceptada, y no haga falta re-investigarlo.
- [ ] Leer `docs/ARQUITECTURA.md` — para entender qué módulo es dueño del dato que vas a tocar y qué otros módulos lo leen.
- [ ] Leer `CHANGELOG.md` — para entender el historial de PRs sobre esa zona del código y no repetir una discusión ya resuelta.

---

## Antes de crear un módulo nuevo

**Corresponde crear un módulo nuevo cuando:**
- El dominio de negocio es nuevo y no es sub-funcionalidad de un dominio existente (así se crearon los 13 módulos actuales).
- La función tiene una responsabilidad clara y propia, aún si depende de leer datos de otros dominios (como hace Calendario, que solo lee).

**No corresponde crear un módulo nuevo cuando:**
- La función es una vista/reporte sobre datos que ya son dominio de otro módulo (ej. una pestaña dentro de la ficha de Clientes se queda en `clientes.js`, no se separa).
- Es un helper genérico sin dominio propio — eso va en `js/utils.js`.

---

## Antes de eliminar código

Antes de borrar cualquier archivo o función, verificar mediante búsqueda real en todo el proyecto (no por memoria ni suposición):

- Que no exista ningún `<script src>` o `<link>` que lo cargue.
- Que no exista ningún `import`, referencia textual o llamada dinámica (`onclick`, `data-*` leído por JS, etc.).
- Si existe una sola referencia, no borrar.

Este es el criterio real usado para la limpieza de archivos del proyecto (ver `CHANGELOG.md`, PR-016).

---

## Pull Requests

Cada cambio debería:

- Tener un objetivo único y explícito, con un alcance de archivos declarado por adelantado.
- No mezclar corrección de bugs con refactor, ni migración con optimización.
- Validarse funcionalmente en el navegador (no alcanza con lectura estática del código) antes de darse por terminado.
- Documentar en `TECH_DEBT.md` cualquier hallazgo nuevo que quede fuera del alcance del cambio, en lugar de corregirlo "de paso".
- Sumar una entrada a `CHANGELOG.md` describiendo qué se hizo, sin detalle línea por línea (eso queda en el propio código y su header).
