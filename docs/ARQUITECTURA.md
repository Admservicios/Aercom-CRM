# Arquitectura del CRM — Aercom CRM v2

Este documento refleja el estado real del código a la fecha, verificado archivo por archivo (no es un plan aspiracional). Reemplaza la versión anterior, que describía una arquitectura de 7 módulos con dependencia lineal — esa descripción ya no corresponde al proyecto.

---

## 1. Visión general

La aplicación es un CRM de página única (`index.html`) sin build step ni framework: HTML + CSS + JS vanilla, cargado directamente por el navegador vía `<script src>`. No hay backend — toda la persistencia es `localStorage`, con sincronización opcional a Google Drive.

El código está dividido en dos capas:

- **Infraestructura compartida** — vive en `index.html` (el bloque `<script>` principal) y en `js/utils.js`, `js/storage.js`, `js/modal.js`, `js/config.js`, `js/ui.js`, `js/app.js`. No pertenece a ningún módulo de dominio; la usan todos.
- **Módulos de dominio** — 13 archivos en `js/modules/`, cada uno con una responsabilidad de negocio específica y un header de documentación que declara sus dependencias externas y sus decisiones de límite.

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
| Excel | `excel.js` | Plantillas de importación, importación con matching por ID/nombre, exportación de reportes (local o a Drive) |
| Google Drive | `drive.js` | OAuth (Google Identity Services), estructura de carpetas, sincronización de `aercom-data.json`, subida de archivos |
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
| `persist()` (`index.html`) | Decorador sobre `_persistBase()`: agrega snapshot de undo/redo y dispara `_scheduleDriveSave()` — **único punto de guardado real** que deben usar todos los módulos |
| `showModule()` / `renderModule()` | Dispatcher de navegación entre módulos |
| `equipStatus()`, `clientName()`, `clientCritical()`, `critBadge()` | Helpers de dominio usados por 3+ módulos (Equipos, Dashboard, Clientes, Calendario, Reportes) |
| `ESTADOS`, `E_COLOR` | Constantes del pipeline de Cotizaciones, usadas también por Dashboard (gráfico) y Clientes (ficha) |
| `resetFilters()`, `toggleClear()` | Helpers de filtros compartidos por todas las pantallas con buscador |
| `confirmDel()` / `closeConf()` / `doConf()` | Diálogo de confirmación de borrado genérico |
| `closeModal()` | Cierre del modal genérico (`#modal-overlay`) — única implementación real tras PR-007.2 |
| `updateSidebarBadges()` | Lee de Equipos, Cotizaciones, Recordatorios y Pedidos para pintar los contadores del sidebar |
| Atajos de teclado | Escape, Ctrl+Z/Y, Ctrl+S, `N` (nuevo registro) — todos despachan a funciones de distintos módulos |
| `_history`/`_future`/`_snapshot()`/`undoAction()`/`redoAction()` | Undo/redo global sobre `D` completo |
| `_esc()` (`js/utils.js`) | Escapado HTML — usado por los 9 módulos con render de datos de usuario (todos excepto Theme, Excel, Drive, CSV) |
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
                                                                 │
                                                            Google Drive
                                                        (sincroniza D completo,
                                                         sube archivos de Excel
                                                         y Reportes)

Theme: sin acoplamiento a datos de dominio — solo toca localStorage['theme'] y el DOM.
```

**Puntos de acoplamiento fuerte a señalar:**

- **Pedidos ↔ Cotizaciones**: `openPedidoModal(null, cotId, null)` se invoca desde el kanban de Cotizaciones; `savePedido()`/`advancePedido()` mutan `cot.estado` de Cotizaciones al marcar un pedido como Realizado. Es acoplamiento funcional documentado, no accidental.
- **Calendario** es puramente de lectura sobre 4 dominios ajenos (Equipos, Cotizaciones, Recordatorios, Pedidos) — no los muta, solo arma un feed unificado. Su único dominio propio es `D.eventos`.
- **CSV Import** es el punto de mayor acoplamiento del proyecto: `CSV_SCHEMAS` escribe directamente en `D.clientes`/`D.equipos`/`D.cotizaciones` desde fuera de sus módulos propios — conocido y documentado, no corregido (ver TECH_DEBT.md).
- **Excel** exportación a Drive (`xlsExport(tipo,'drive')`) depende de `_gdriveReady`/`_gdriveUploadFile`/`_folderReportId`, todos definidos en Drive — Excel llama a Drive, nunca al revés.
- **Dashboard** y **Reportes PDF** son consumidores puros: leen de todos los dominios relevantes, no escriben en ninguno.

---

## 5. Almacenamiento y persistencia

- **`localStorage['aercom-data']`** — único almacén de datos del CRM (clientes, equipos, cotizaciones, pedidos, recordatorios, eventos, facturación). Formato: JSON de `D` completo, sin particionar por módulo.
- **`localStorage['theme']`** — clave separada, solo Theme la usa.
- **`localStorage['aercom-drive-connected']`** — flag booleano que recuerda si el usuario conectó Drive, para reintentar reconexión silenciosa al arrancar.
- **Guardado**: todo módulo que muta `D` debe llamar a `persist()` (no a `_persistBase()`/`_origPersist()` directamente) para mantener consistencia con undo/redo y sync de Drive. Única excepción conocida: `xlsImport()` en Excel, que llama a `_origPersist()` — deuda técnica documentada, no corregida.
- **Sin particionado ni versionado de esquema**: un cambio de forma en cualquier entidad de `D` es responsabilidad del módulo dueño de esa entidad; no hay migraciones automáticas más allá de las normalizaciones que hace `loadData()` (retrocompatibilidad de `facturacion_clientes`, arrays obligatorios, remapeo de estados heredados de Cotizaciones).

---

## 6. Undo / Redo

Implementado en `index.html`, no en ningún módulo — es infraestructura transversal:

- `persist()` empuja un snapshot de `JSON.stringify(D)` a `_history` **antes** de guardar (tope `MAX_HIST = 30`).
- `undoAction()`/`redoAction()` restauran `D` completo desde el snapshot y llaman a `_origPersist()` directamente (no a `persist()`, para no generar un nuevo snapshot al deshacer).
- Es undo/redo de **estado completo**, no por-módulo ni por-campo — deshacer una acción en Clientes también revierte cualquier cambio no relacionado que haya ocurrido después.
- Atajos: `Ctrl+Z` / `Ctrl+Y` / `Ctrl+Shift+Z`.

---

## 7. Google Drive

- Autenticación OAuth2 implícita vía Google Identity Services (`_loadGIS()` carga el script de `accounts.google.com` on-demand).
- Scope `drive.file` — la app solo puede ver/tocar archivos que ella misma crea, no todo el Drive del usuario.
- Estructura de carpetas creada automáticamente: `Aercom Gestion/` → `Reportes/` + `Importaciones/`.
- Sincronización de `D` completo como `aercom-data.json` en la carpeta raíz — al conectar, compara `lastSaved` local vs remoto y usa el más reciente.
- El token OAuth se mantiene solo en memoria (`_gdriveToken`), nunca se persiste en `localStorage` — solo se guarda el flag booleano de "conectado" para reintentar reconexión silenciosa.
- `_scheduleDriveSave()` hace debounce de 5s sobre el guardado remoto, invocado desde `persist()`.
- Desde el paso 4, las búsquedas/creaciones de carpetas y archivos y las subidas verifican HTTP y los IDs devueltos. `_gdriveSaveData()` devuelve éxito solo tras confirmar el PATCH y mantiene el indicador pendiente ante errores. Si D cambió durante el envío, ese snapshot confirmado no limpia las ediciones posteriores. `_gdriveUploadFile()` devuelve false ante errores para que Excel no anuncie una subida fallida como exitosa.
- La preparación debe terminar antes de marcar Drive listo. Los callbacks OAuth manejan errores de esa preparación; no se añadieron reintentos automáticos ni se cambiaron las reglas de comparación de fechas. Sigue pendiente coordinar subidas simultáneas y resolver conflictos entre dispositivos.
- Desde el paso 3, la descarga valida el JSON con `_parseImportedData()` antes de comparar fechas: exige las tres colecciones principales, verifica registros, IDs, tipos conocidos, fechas y facturación, y aplica las normalizaciones heredadas. Los campos adicionales se conservan; los datos incompatibles se rechazan sin reparación automática. La búsqueda y descarga comprueban HTTP. `_applyImportedData()` protege el reemplazo y recupera datos e historial ante errores; si el almacenamiento impide restaurar la copia, se informa la necesidad de exportar D antes de recargar.
- Esta validación también se usa al importar un archivo JSON local. No verifica todas las relaciones entre entidades, no autentica el contenido, no corrige conflictos entre dispositivos ni sustituye el escapado contextual del renderizado. La carga inicial de localStorage mantiene su comportamiento existente.

---

## 8. Excel

- Librería externa: SheetJS (`xlsx.full.min.js`, CDN, sin Subresource Integrity).
- Plantillas de descarga (`xlsDownloadPlantilla`) para Clientes/Equipos/Cotizaciones, con hoja de instrucciones y hoja de referencia de IDs.
- Importación (`xlsImport`) con matching por ID o por nombre/nombre-fuzzy (equipos), merge no destructivo (agrega nuevos, actualiza coincidentes).
- Exportación de reportes (`xlsExport`) para Clientes/Equipos/Cotizaciones/Facturación, a descarga local o subida a Drive.
- No usa `_esc()` en ningún lado — no genera HTML, solo estructuras de datos para SheetJS.

---

## 9. CSV Import

- Sin librería externa — parseo propio (`parseCsv`/`csvSplitLine`).
- Cubre Clientes/Equipos/Cotizaciones (no Facturación, no Pedidos, no Recordatorios).
- Mismo patrón de conflictos que Excel: detección por clave, elección Saltar/Reemplazar.
- Es el único punto del proyecto que escribe en 3 dominios de datos ajenos (`CSV_SCHEMAS.clientes/equipos/cotizaciones`) desde un módulo que no es dueño de ninguno de los tres — acoplamiento conocido y aceptado, documentado en el header del propio archivo.

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

`index.html` conserva un snapshot del estado normalizado de arranque, usado cuando la primera edición todavía no tiene copia previa en localStorage. El decorador de persistencia agrega historial después del guardado exitoso. `_restoreHistory()` usa `_applyImportedData()` de Storage para recuperar memoria, copia local y pilas ante errores; solo mueve la acción entre pilas tras el éxito y entonces llama al programador de Drive. Undo/redo no crea una acción adicional mediante `persist()`. Los atajos respetan campos editables y el historial mantiene su límite de 30 acciones por sesión.

`_localDateString(Date)` serializa año/mes/día locales sin convertirlos a UTC; lo usan `today()` y el calendario. `daysDiff()` compara fechas YYYY-MM-DD como días UTC respecto de hoy local; `addDays()` suma sobre días UTC. Esta distinción conserva el día civil y evita duraciones de 23/25 horas en la aritmética. No convierte horas ni altera el formato de datos existente.
