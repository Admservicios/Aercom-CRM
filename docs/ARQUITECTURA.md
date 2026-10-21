# Arquitectura del CRM — Aercom CRM v2

Este documento refleja el estado real del código a la fecha, verificado archivo por archivo (no es un plan aspiracional). Reemplaza la versión anterior, que describía una arquitectura de 7 módulos con dependencia lineal — esa descripción ya no corresponde al proyecto.

---

## 1. Visión general

La aplicación es un CRM de página única (`index.html`) sin build step ni framework: HTML + CSS + JS vanilla, cargado directamente por el navegador vía `<script src>`. No hay backend — toda la persistencia es `localStorage`, sin sincronización remota.

El código está dividido en dos capas:

- **Infraestructura compartida** — vive en `index.html` (el bloque `<script>` principal) y en `js/utils.js`, `js/storage.js`, `js/modal.js`, `js/config.js`, `js/ui.js`, `js/app.js`. No pertenece a ningún módulo de dominio; la usan todos.
- **Módulos de dominio** — 12 archivos en `js/modules/`, cada uno con una responsabilidad de negocio específica y un header de documentación que declara sus dependencias externas y sus decisiones de límite.

---

## 2. Listado completo de módulos (`js/modules/`)

| Módulo | Archivo | Responsabilidad |
|---|---|---|
| Dashboard | `dashboard.js` | KPIs, lista de alertas urgentes priorizada, 3 gráficos (Chart.js) |
| Clientes | `clientes.js` | Alta/baja/modificación, buscador, ficha con 6 pestañas (general, equipos, cotizaciones, facturación, recordatorios, pedidos — todas de solo lectura sobre otros dominios) |
| Equipos | `equipos.js` | Listado, filtros, alta/edición/eliminación, edición inline de fechas de mantenimiento |
| Facturación | `facturacion.js` | Estado de facturación mensual por cliente (Pendiente/Facturado/Cobrado/Excluido), navegación entre meses |
| Cotizaciones (Pipeline) | `cotizaciones.js` | Kanban de 9 estados, drag & drop, alta/edición/eliminación, transición a "Facturada" |
| Pedidos de Servicio | `pedidos.js` | Listado agrupado por estado, alta/edición/eliminación, avance de estado, generación desde una Cotización Aprobada |
| Calendario | `calendario.js` | Vistas mes/semana, agrega en un solo feed los vencimientos de Equipos + follow-ups de Cotizaciones + Recordatorios + Pedidos + eventos propios |
| Recordatorios | `recordatorios.js` | Listado con filtros, alta/edición/eliminación, toggle Pendiente↔Hecho |
| Theme | `theme.js` | Detección de tema claro/oscuro, toggle, persistencia en `localStorage` (clave separada de los datos del CRM) |
| Reportes PDF | `reportes.js` | Documento HTML standalone (KPIs + 2 gráficos + tablas) para imprimir/guardar como PDF, abierto en ventana nueva |
| Excel | `excel.js` | Plantillas de importación, importación con matching por ID/nombre, exportación de reportes con descarga local |
| CSV Import | `csv.js` | Importación masiva vía CSV para Clientes/Equipos/Cotizaciones, con detección de conflictos y elección Saltar/Reemplazar |

Todos siguen el mismo patrón de header: **Responsabilidad**, **Dependencias externas** (qué usan de fuera y por qué no se movió), **Decisiones de límite de módulo** (qué se dejó fuera y por qué).

---

## 3. Infraestructura compartida (`index.html` + `js/utils.js` + `js/storage.js` + `js/modal.js`)

Nada de esto pertenece a un módulo — lo usan 2 o más:

| Elemento | Qué es |
|---|---|
| `D` | Objeto de estado global — toda la data del CRM vive acá (clientes, equipos, cotizaciones, pedidos, recordatorios, eventos, facturación) |
| `curModule` | Módulo actualmente visible |
| `loadData()` / `_persistBase()` (`js/storage.js`) | Carga/guardado base en `localStorage` (clave `STORAGE_KEY = "aercom-data"`) |
| `persist()` (`index.html`) | Decorador sobre `_persistBase()`: agrega snapshot de undo/redo  — punto de guardado que deben usar los módulos; la infraestructura de restauración conserva sus rutas controladas |
| `showModule()` / `renderModule()` | Dispatcher de navegación entre módulos |
| `equipStatus()`, `clientName()`, `clientCritical()`, `critBadge()` | Helpers de dominio usados por 3+ módulos (Equipos, Dashboard, Clientes, Calendario, Reportes) |
| `ESTADOS`, `E_COLOR` | Constantes del pipeline de Cotizaciones, usadas también por Dashboard (gráfico) y Clientes (ficha) |
| `resetFilters()`, `toggleClear()` | Helpers de filtros compartidos por todas las pantallas con buscador |
| `confirmDel()` / `closeConf()` / `doConf()` | Diálogo de confirmación de borrado genérico |
| `closeModal()` | Cierre del modal genérico (`#modal-overlay`) — única implementación real tras PR-007.2 |
| `requestCloseModal()` / `initializeModals()` | Cierre solicitado con advertencia de borrador; foco, tabulación y fondo inerte sobre los diálogos existentes, sin persistencia |
| `updateSidebarBadges()` | Lee de Equipos, Cotizaciones, Recordatorios y Pedidos para pintar los contadores del sidebar |
| Atajos de teclado | Escape, Ctrl+Z/Y, Ctrl+S, `N` (nuevo registro) — todos despachan a funciones de distintos módulos |
| `_history`/`_future`/`_restoreHistory()`/`undoAction()`/`redoAction()` | Undo/redo global sobre D; `_snapshot()` se conserva sin llamadas de producción |
| `_esc()` (`js/utils.js`) | Escapado para texto/atributos HTML, incluida la vista previa CSV; los scripts del reporte requieren serialización contextual |
| `today()`, `daysDiff()`, `fmtDate()`, `fmtMoney()`, etc. (`js/utils.js`) | Utilidades de fecha/formato sin estado |
| `openModal()`/`_closeModalById()` (`js/modal.js`) | Sistema de modal genérico por `id` — **no está conectado a nada**, ningún punto del proyecto lo invoca con argumento (ver TECH_DEBT.md histórico, ya no aplica tras el renombre de PR-007.2) |

---

## 4. Dependencias y acoplamiento real

No es una cadena lineal. El acoplamiento real es:

```
                          ┌─────────────────────────────┐
                          │   INFRAESTRUCTURA COMPARTIDA │
                          │   D · persist() · storage.js │
                          │   showModule/renderModule    │
                          │   confirmDel · closeModal    │
                          │   _esc() · helpers de fecha   │
                          └───────────────┬──────────────┘
                                          │ (todos leen/escriben D vía persist())
        ┌───────────┬───────────┬────────┼────────┬───────────┬────────────┐
        │           │           │        │        │           │            │
    Clientes ←──┐  Equipos  Facturación  │    Cotizaciones   Pedidos    Recordatorios
        │       │      │                 │     (Pipeline)  ───┘  ↑            │
        │       │      │                 │        │    ↓ genera desde        │
        │       └──────┴─────────────────┤        │  Aprobada               │
        │  (ficha de Clientes muestra    │        └──────────┐              │
        │   equipos/cotizaciones/        │                   │              │
        │   pedidos/recordatorios        │                   ▼              │
        │   de ESE cliente — solo lee)   │              Calendario ←────────┘
        │                                │           (agrega eventos de
        └────────────────────────────────┤            Equipos+Cotizaciones+
                                          │            Recordatorios+Pedidos)
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
                Dashboard             Reportes PDF          Excel / CSV
           (lee TODOS los         (lee Equipos+Clientes  (lee/escribe Clientes+
            dominios, no          para el informe de     Equipos+Cotizaciones+
            escribe nada)          vencimientos)          Facturación)

Theme: sin acoplamiento a datos de dominio — solo toca localStorage['theme'] y el DOM.
```

**Puntos de acoplamiento fuerte a señalar:**

- **Pedidos ↔ Cotizaciones**: `openPedidoModal(null, cotId, null)` se invoca desde el kanban de Cotizaciones; `savePedido()`/`advancePedido()` mutan `cot.estado` de Cotizaciones al marcar un pedido como Realizado. Es acoplamiento funcional documentado, no accidental.
- **Calendario** es puramente de lectura sobre 4 dominios ajenos (Equipos, Cotizaciones, Recordatorios, Pedidos) — no los muta, solo arma un feed unificado. Su único dominio propio es `D.eventos`.
- **CSV Import** mantiene acoplamiento con los modelos de dominio: `CSV_SCHEMAS` escribe directamente en `D.clientes`/`D.equipos`/`D.cotizaciones` desde fuera de sus módulos propios — conocido y documentado, no corregido (ver TECH_DEBT.md).
- **Dashboard** y **Reportes PDF** son consumidores puros: leen de todos los dominios relevantes, no escriben en ninguno.
- **Dashboard → Facturación**: `getFactMonthSummary(mStr)` consulta clientes aplicables y estados del período sin escribir. Resumen/progreso/KPI/gráfico comparten el cálculo; excluidos fuera del progreso y no aplicables se identifican. Ambos scripts deben cargar antes de la inicialización del Dashboard. Filtros de Facturación identifican filas por ID, no por posición.

---

## 5. Almacenamiento y persistencia

- **`localStorage['aercom-data']`** — único almacén de datos del CRM (clientes, equipos, cotizaciones, pedidos, recordatorios, eventos, facturación). Formato: JSON de `D` completo, sin particionar por módulo.
- **`localStorage['theme']`** — clave separada, solo Theme la usa.
- **Guardado**: los módulos usan `persist()` para mantener historial. CSV/Excel lo invocan mediante `_applyTableImport()` y `_applyImportedData()`. Undo/redo usa `_origPersist()` dentro de la restauración controlada tras el éxito.
- **Sin particionado ni versionado de esquema**: un cambio de forma en cualquier entidad de `D` es responsabilidad del módulo dueño de esa entidad; no hay migraciones automáticas más allá de las normalizaciones que hace `loadData()` (retrocompatibilidad de `facturacion_clientes`, arrays obligatorios, remapeo de estados heredados de Cotizaciones).

---

## 6. Undo / Redo

Implementado en `index.html`, no en ningún módulo — es infraestructura transversal:

- `persist()` conserva la copia local anterior (o el snapshot de arranque si no había copia), guarda y después agrega el snapshot a `_history` (tope `MAX_HIST = 30`).
- `undoAction()`/`redoAction()` delegan en `_restoreHistory()`: aplicación con recuperación de datos/pilas/almacenamiento, guardado base sin generar otra acción, movimiento de pilas tras el éxito. Las pilas solo viven en memoria y desaparecen al recargar.
- Es undo/redo de **estado completo**, no por-módulo ni por-campo — deshacer una acción en Clientes también revierte cualquier cambio no relacionado que haya ocurrido después.
- Atajos Ctrl/Meta+Z, Ctrl/Meta+Y y Ctrl/Meta+Shift+Z fuera de campos editables; dentro de estos se conserva el deshacer nativo.

---

## 7. Funcionamiento local y respaldo

- Los datos del CRM solo se guardan en localStorage del navegador/origen actual. No hay autenticación, reconexión ni sincronización de Google. La clave aercom-data y el esquema se conservan.
- Guardar JSON descarga D completo para respaldo/traslado; Importar JSON valida y restaura. No se escriben automáticamente las carpetas data/ o backups/ del repositorio. Mantener una copia fuera del navegador y exportarla antes de borrar almacenamiento/cambiar de equipo.
- La recuperación conserva su validación, confirmación y protección ante fallos de cuota/copia cambiada. Ya no depende de sessionStorage. Las preferencias antiguas de Drive quedan ignoradas, sin limpiar datos ni acceder a archivos remotos.
- Excel exporta solo a descarga local. Se retiraron el módulo Drive, sus controles, callbacks y pruebas exclusivas. El PR #3 y los trabajos históricos de Drive quedan fuera del alcance actual; no reintroducirlos como si fueran pendientes del CRM local.
- El guardado local no implica una aplicación offline: Chart.js/SheetJS siguen cargando desde CDN. No se garantiza arranque completo sin conexión ni se cambia el origen del sitio o instala un backend.

---

## 8. Excel

- Librería externa: SheetJS (`xlsx.full.min.js`, CDN, sin Subresource Integrity).
- Plantillas de descarga (`xlsDownloadPlantilla`) para Clientes/Equipos/Cotizaciones, con hoja de instrucciones y hoja de referencia de IDs.
- Importación (`xlsImport`) por ID o nombre exacto único de cliente; equipos/cotizaciones requieren ID explícito. El lote se prepara y valida sobre una copia, preserva campos adicionales y se rechaza completo ante error. No usa coincidencia parcial/fuzzy. Las celdas vacías conservan valores existentes; se rechazan fechas inválidas y libros 1904.
- Exportación de reportes (`xlsExport`) para Clientes/Equipos/Cotizaciones/Facturación, a descarga local.
- No usa `_esc()` en ningún lado — no genera HTML, solo estructuras de datos para SheetJS.

---

## 9. CSV Import

- Sin librería externa — parseo propio (`parseCsv`/`csvSplitLine`).
- Cubre Clientes/Equipos/Cotizaciones (no Facturación, no Pedidos, no Recordatorios).
- Detección por clave con elección Saltar/Reemplazar (Excel actualiza tras confirmación, sin ese selector). CSV usa coma, admite comillas escapadas y campos multilínea, conserva campos ausentes y aplica vacío/predeterminado para columnas incluidas vacías.
- CSV y Excel escriben sobre los tres dominios mediante conversiones propias y el constructor compartido de lote en Storage; el acoplamiento entre importadores y modelos de dominio permanece.

---

## 10. Seguridad — saneamiento de datos de usuario

`_esc()` (`js/utils.js`) se usa para representar datos como texto HTML y atributos entre comillas dobles. El endurecimiento histórico de PR-014.1 a PR-014.5 no garantiza que todas las interpolaciones del proyecto estén protegidas: la auditoría posterior encontró omisiones.

El paso 1 protege los puntos revisados de Clientes (listado, formularios y ficha), Equipos (listado, formulario y fechas inline), la vista previa y los conflictos CSV, y las tablas del Reporte de Vencimientos. Las etiquetas del gráfico del reporte usan serialización JSON con `<` representado como `\u003c`, para impedir que datos importados cierren el elemento `<script>`; el escapado HTML no sustituye esa protección. Los datos originales se conservan sin escapar en `D`. Los handlers revisados conservan su lógica y leen los IDs desde atributos `data-*` escapados.

Cobertura reproducible sin paquetes adicionales: `node --test tests/security-rendering.test.js` (requiere Node con `node:test`; Node no es necesario para ejecutar el CRM). Las pruebas usan un DOM simulado y verifican los renderizadores y el script generado. La comprobación adicional en Chromium utiliza datos ficticios y un contexto aislado. Este alcance no certifica ausencia de XSS en los módulos restantes ni reemplaza la validación de estructura e integridad de las importaciones.

---

## 11. Archivos eliminados del repositorio (PR-016)

El repositorio ya no contiene archivos huérfanos, vacíos o históricos. Fueron eliminados en PR-016, tras verificar cero referencias en el proyecto:

- `js/modules/navigation.js` — duplicaba de forma inerte `showModule()`/`renderModule()`, nunca enlazado vía `<script src>`.
- `js/cotizaciones.js`, `js/facturacion.js`, `js/events.js` (raíz de `js/`, fuera de `js/modules/`) — stubs vacíos, superados por sus equivalentes en `js/modules/`.
- `css/dashboard.css`, `css/modals.css`, `css/responsive.css`, `css/tables.css` — vacíos o placeholder, sin enlazar. Todo el estilo real vive en `css/style.css`.
- `Legacy` (raíz del proyecto) — snapshot histórico de una versión anterior de `index.html`.

Deuda técnica vigente (bugs activos, código muerto, duplicaciones no unificadas): ver `TECH_DEBT.md`.


## Protección de borrados (paso 6)

`js/utils.js` expone `canDeleteRecord(colección, id)`: lee D, informa asociaciones mediante toast y no modifica estado. Las seis rutas de borrado de Clientes/Facturación, Equipos y Cotizaciones lo llaman antes de confirmar y dentro del callback. No existe cascada.

| Registro a eliminar | Asociaciones que bloquean |
|---|---|
| Cliente | Equipos, cotizaciones, pedidos, recordatorios, eventos propios y cualquier entrada mensual de facturación |
| Equipo | Cotizaciones y pedidos |
| Cotización | Pedidos |

Los pedidos bloquean independientemente de su estado y la facturación bloquea incluso entradas Pendiente/Excluido. Sin dependencias, se conserva el flujo de guardado/renderizado de cada ruta. Al renombrar el código de cliente, `saveClient()` actualiza también los eventos propios, además de las referencias que ya actualizaba.

Esto protege las operaciones indicadas sobre D en la pestaña actual. No es una validación global: importaciones, reasignaciones, conflictos entre pestañas y huérfanos preexistentes requieren controles propios. No cambia el formato de los backups.


## Navegación y listado de clientes (paso 9)

En anchos hasta 800 px, CSS muestra el control de menú y usa el sidebar existente como panel. `setMobileMenu()`/`toggleMobileMenu()` en index.html coordinan aria-expanded, foco, inert y cierre al seleccionar un módulo o cambiar a escritorio. Escape y el fondo cierran el panel; las opciones de navegación admiten teclado. En escritorio se conserva el sidebar. Las tablas/calendario/facturación usan desplazamiento horizontal interno y los formularios/ficha se reorganizan en una columna.

`renderClientes()` genera contadores en Maps locales por cliente a partir de una pasada por equipos y pedidos. No hay índices persistentes ni invalidación de cachés; cada render usa los datos actuales. Esto reduce los recorridos de contadores, manteniendo el resto del renderizado, filtrado y almacenamiento. No incorpora paginación ni virtualización.

## Historial y fechas (paso 7)

`index.html` conserva un snapshot del estado normalizado de arranque, usado cuando la primera edición todavía no tiene copia previa en localStorage. El decorador de persistencia agrega historial después del guardado exitoso. `_restoreHistory()` usa `_applyImportedData()` de Storage para recuperar memoria, copia local y pilas ante errores; solo mueve la acción entre pilas tras el éxito sin programar subidas remotas. Undo/redo no crea una acción adicional mediante `persist()`. Los atajos respetan campos editables y el historial mantiene su límite de 30 acciones por sesión.

`_localDateString(Date)` serializa año/mes/día locales sin convertirlos a UTC; lo usan `today()` y el calendario. `daysDiff()` compara fechas YYYY-MM-DD como días UTC respecto de hoy local; `addDays()` suma sobre días UTC. Esta distinción conserva el día civil y evita duraciones de 23/25 horas en la aritmética. No convierte horas ni altera el formato de datos existente.


## Importaciones tabulares (paso 8)

CSV y Excel comparten `_applyTableImport(build)` en `js/storage.js`. `build` ejecuta las conversiones existentes sobre una copia temporal síncrona de D; se descarta ante cualquier error. Los registros nuevos/modificados se validan contra clientes/equipos y se impiden reasignaciones que comprometan cotizaciones/pedidos asociados. El candidato completo pasa por el validador JSON y se aplica mediante `_applyImportedData(candidate,persist)`, con recuperación y una acción de historial para el lote. No hay persistencia durante la construcción ni para lotes sin cambios.

| Aspecto | CSV | Excel |
|---|---|---|
| Identidad | Clientes por nombre exacto único; equipos/cotizaciones por ID | Clientes por ID o nombre exacto único; equipos/cotizaciones requieren ID |
| Conflicto | Saltar o reemplazar, según elección | Actualizar coincidentes y agregar nuevos, tras confirmación |
| Campo ausente | Conserva el valor existente | Conserva el valor existente |
| Celda vacía | Aplica vacío/predeterminado de esa columna | Conserva el valor existente |
| Error de lote | Rechazo completo con mensaje | Rechazo completo con mensaje |

Ambos preservan campos adicionales de registros existentes. No se asigna un cliente por coincidencia parcial. Se rechazan claves repetidas, columnas desconocidas, conversiones inválidas y asociaciones ambiguas. Los encabezados/valores de plantillas y reportes quedan alineados; cotizaciones incluye Cliente ID. Los libros Excel 1904 requieren conversión explícita y no se importan automáticamente. El formato de los backups JSON y la versión de SheetJS permanecen iguales.
