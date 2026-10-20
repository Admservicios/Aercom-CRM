# Guía de desarrollo — Aercom CRM v2

Guía práctica para alguien que abre este proyecto por primera vez. Para el detalle completo de arquitectura y acoplamiento entre módulos, ver [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md). Para las reglas y convenciones a seguir al contribuir, ver [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## Cómo está organizado

```
index.html          → infraestructura compartida (estado global, persistencia,
                       navegación, undo/redo) + carga todos los <script>
css/style.css        → único stylesheet real del proyecto
js/
  utils.js           → fechas/formato/escapado y canDeleteRecord() (lee D)
  storage.js         → carga/guardado, validación y aplicación con recuperación
  modal.js           → helpers por ID heredados; modal real definido en index.html
  config.js, ui.js, app.js → utilidades menores de arranque/UI
  modules/           → 13 módulos de dominio, uno por pantalla
docs/ARQUITECTURA.md → arquitectura real, diagrama de acoplamiento
TECH_DEBT.md         → deuda técnica conocida (bugs, código muerto, duplicaciones)
CHANGELOG.md         → historial de cambios por PR
```

No hay build step: `index.html` carga cada archivo directamente vía `<script src>`, en un orden específico (los módulos de dominio antes que `config.js`/`ui.js`/`modal.js`/`app.js`). Para correr el proyecto alcanza con servir la carpeta con cualquier servidor de archivos estáticos y abrir `index.html`.

---

## Flujo principal

Todo el estado de la aplicación vive en un único objeto global, `D` (definido en `index.html`), con una clave por dominio (`D.clientes`, `D.equipos`, `D.cotizaciones`, `D.pedidos`, `D.recordatorios`, `D.eventos`, `D.facturacion_estados`, etc.). Cada módulo:

1. Lee de `D` para renderizar su pantalla.
2. Modifica `D` directamente en memoria en respuesta a una acción del usuario (guardar, editar, eliminar).
3. Llama a `persist()` para guardar ese cambio.
4. Vuelve a renderizar (`renderModule()` o su propia función de render) para reflejar el nuevo estado.

No hay eventos, store centralizado ni sistema de reactividad: cada módulo re-renderiza explícitamente lo que cambió.

---

## Persistencia

Contrato de guardado: `persist()` devuelve `true` al completar la operación y `false` al fallar. Los consumidores directos deben detener su flujo con `if(persist()===false) return;` antes de cerrar formularios o anunciar éxito. La recuperación restaura el estado confirmado y las pilas; si el navegador impide restaurar/verificar la copia local, la interfaz pide exportar antes de recargar. El borrador visible sigue sin estar guardado.

`_lastSavedSnapshot` (Storage) se actualiza en arranque, guardados base y aplicaciones exitosas de backups, y se restaura si falla una aplicación. `_applyImportedData()` trata un callback que devuelve false como fallo. No omitir esta comprobación al agregar un nuevo consumidor ni mezclar scripts anteriores con el contrato nuevo: las URLs afectadas están versionadas en index.html.

- **LocalStorage**: `D` completo se guarda como JSON en `localStorage['aercom-data']` (constante `STORAGE_KEY` en `js/storage.js`). `loadData()` devuelve true solo tras validar un candidato con `_parseImportedData()` y normalizarlo en memoria. Solo una clave ausente permite DEFAULT; una copia dañada/incompatible o una lectura denegada devuelve false, conserva el original y activa `_storageLoadError`. El inicio no escribe migraciones. El bootstrap muestra recuperación y no habilita edición/reconexión de Drive hasta cargar correctamente; las preferencias opcionales de tema/Drive no deben interrumpirlo. La descarga de recuperación conserva el texto original como .txt, sin validarlo ni desbloquear el CRM. Reintentar recarga sin borrar claves. La pantalla ofrece restaurar un backup validado tras descargar/verificar el original y confirmar el reemplazo completo. `_restoreStorageBackup()` valida de nuevo, comprueba sesión y copia actual, pausa la reconexión de Drive mediante sessionStorage y escribe una vez antes de recargar. La pausa dura esta pestaña; no afirma resolver conflictos de Drive ni concurrencia entre pestañas. Una reparación particular requiere revisión/autorización y no debe incorporarse como datos personales al repositorio.
- **`persist()`** (index.html): guarda mediante `_persistBase()` y agrega al historial la copia local anterior después del guardado exitoso; si no había copia usa el snapshot de arranque. Limpia rehacer y programa Drive. Los módulos llaman a esta función; CSV/Excel la invocan mediante `_applyTableImport()`/`_applyImportedData()`. Ante fallos recupera el checkpoint confirmado y conserva el borrador del modal; si no puede verificar/restaurar la copia local, informa que debe exportarse la memoria recuperada antes de recargar.
- **Undo/Redo**: `_restoreHistory()` aplica el snapshot mediante `_applyImportedData(candidate,_origPersist)`, mueve las pilas solo tras el éxito y programa Drive. Límite de 30 acciones, estado completo y sesión actual; no persiste al recargar. Los campos editables conservan Ctrl/Meta+Z nativo; fuera de ellos funcionan Ctrl/Meta+Z, Ctrl/Meta+Y y Ctrl/Meta+Shift+Z.
- **Google Drive**: conexión OAuth2 opcional (`js/modules/drive.js`). Sincroniza `D` completo como `aercom-data.json` en una carpeta propia del Drive del usuario (`Aercom Gestion/`). `_scheduleDriveSave()` hace debounce de 5s y se invoca desde `persist()`. El token se mantiene solo en memoria, nunca en `localStorage`. Main compara fechas de día, sin resolución de conflictos/duplicados. El PR #3 sigue en borrador y necesita comprobar ETag/If-Match con una cuenta real. No usar la conexión como garantía de edición simultánea segura.

---

## Render

- **`showModule(name)`** (en `index.html`): oculta el módulo visible actual, muestra el módulo `name`, actualiza el ítem activo del sidebar, y llama a `renderModule()`.
- **`renderModule()`** (en `index.html`): dispatcher que, según `curModule`, llama a la función de render propia de ese módulo (`renderDashboard()`, `renderClientes()`, `renderEquipos()`, etc.). Cada módulo define su propia función de render — no hay una convención de componentes reutilizables, cada una reconstruye su porción del DOM vía `innerHTML`.
- Todas las pantallas están presentes en el DOM desde el arranque (`index.html`); `showModule()` alterna cuál es visible con una clase CSS, no monta/desmonta nada.
- Los datos de usuario interpolados en ese `innerHTML` deben pasar por `_esc()` (`js/utils.js`) para escapar texto/atributos HTML. El código JavaScript embebido requiere serialización y protección contextual propias (por ejemplo, el JSON del reporte impide cerrar su script con `<`). El alcance revisado no certifica todos los módulos; es la convención de seguridad establecida en el proyecto (ver `TECH_DEBT.md`, sección "Resueltos", PR-014.1 a PR-014.5).

---

## Helpers compartidos

Todos viven en `index.html` o `js/utils.js`, y los usan 2 o más módulos — no deben moverse a un módulo de dominio:

| Función | Dónde | Qué hace |
|---|---|---|
| `equipStatus()`, `clientName()`, `clientCritical()`, `critBadge()` | `index.html` | Helpers de dominio usados por Equipos, Dashboard, Clientes, Calendario, Reportes |
| `resetFilters()`, `toggleClear()` | `index.html` | Helpers de filtros de búsqueda, usados por toda pantalla con buscador |
| `confirmDel()` / `closeConf()` / `doConf()` | `index.html` | Diálogo de confirmación de borrado genérico |
| `closeModal()` | `index.html` | Cierre del modal genérico |
| `updateSidebarBadges()` | `index.html` | Contadores del sidebar (Equipos, Cotizaciones, Recordatorios, Pedidos) |
| `today()`, `daysDiff()`, `addDays()`, `fmtDate()`, `fmtDateTime()`, `fmtMoney()`, `toTitleCase()` | `js/utils.js` | Fecha y formato, sin estado |
| `_esc(s)` | `js/utils.js` | Escapado HTML — obligatorio antes de interpolar datos de usuario en `innerHTML` |

---

## Cómo agregar un módulo nuevo

1. Crear `js/modules/<nombre>.js` con el header estándar (ver `CONTRIBUTING.md`).
2. Definir su propia función de render, ej. `render<Nombre>()`.
3. Agregar la rama correspondiente en `renderModule()` (`index.html`).
4. Agregar el `<script src="js/modules/<nombre>.js">` en `index.html`, respetando que cargue después de `utils.js`/`storage.js` y antes de `config.js`/`ui.js`/`modal.js`/`app.js`.
5. Si el módulo tiene datos propios, agregar su clave a `D` en `DEFAULT` (`index.html`) y a la normalización de `loadData()` si corresponde (array obligatorio, etc.).
6. Agregar el ítem de navegación en el sidebar (HTML) y su sección en el `<main>`.

---

## Cómo agregar un campo nuevo

Ejemplo: agregar un campo `observaciones` a Equipos.

1. En `js/modules/equipos.js`: agregar el `<input>`/`<textarea>` correspondiente en la función que arma el formulario del modal (con su `_esc()` si se prellenan datos existentes).
2. En la función que guarda el formulario (`saveEquip()` o equivalente): leer el valor del nuevo campo y agregarlo al objeto que se guarda en `D.equipos`.
3. Si el campo debe mostrarse en la tabla/ficha: agregarlo en la función de render correspondiente, pasado por `_esc()` si es texto libre.
4. Llamar a `persist()` después de guardar — nunca `_persistBase()`/`_origPersist()` directamente.
5. Si el campo debe poder exportarse/importarse, actualizar `XLS_HEADERS`/plantillas en `js/modules/excel.js` y el `CSV_SCHEMAS` correspondiente en `js/modules/csv.js`.

---

## Cómo agregar una pantalla nueva

Una "pantalla nueva" dentro de un módulo existente (ej. una nueva pestaña en la ficha de Clientes) se agrega dentro del mismo archivo del módulo dueño de ese dominio — no se crea un módulo aparte solo por ser una vista distinta. Ejemplo real: las pestañas de la ficha de Clientes (equipos, cotizaciones, facturación, recordatorios, pedidos del cliente) están todas en `js/modules/clientes.js`, aunque leen datos de otros dominios, porque son parte de la misma pantalla "ficha de cliente".

Si la pantalla es un dominio de negocio genuinamente nuevo (no una vista sobre datos existentes), corresponde un módulo nuevo — ver la sección anterior.

---

## Cómo agregar un botón nuevo

1. Usar las clases existentes del sistema de botones (`btn btn-primary`, `btn btn-outline`, `btn btn-ghost`, `btn btn-danger`, con `btn-sm` opcional para variantes chicas) — no crear una clase nueva para un botón que cumple el mismo rol que uno existente.
2. Si dispara una acción sobre un registro con ID (editar, eliminar, ver ficha), usar el patrón `data-*` + lectura vía `this.dataset.*` dentro del handler, en vez de interpolar el ID directamente como argumento del string del `onclick` (evita reintroducir el riesgo de inyección ya corregido en PR-014.2 — ver `TECH_DEBT.md`).
3. Si es una acción de borrado, reutilizar `confirmDel()` (diálogo genérico) en vez de escribir un `confirm()` nativo o un modal propio.

---

## Buenas prácticas (basadas en este proyecto)

- Guardar siempre a través de `persist()`, nunca directamente en `localStorage` ni con `_persistBase()`/`_origPersist()`.
- Escapar con `_esc()` todo dato de usuario antes de insertarlo vía `innerHTML`, incluido dentro de atributos y de `<option>`.
- No interpolar datos de usuario como argumento de string dentro de un atributo `onclick` — usar `data-*`.
- Mantener las funciones de un módulo dentro de su propio archivo, aunque lean datos de otros dominios; documentar esa lectura cruzada en el header, no ocultarla.
- No introducir un segundo mecanismo de guardado, navegación o modal en paralelo al ya existente (el proyecto ya sufrió una colisión real por esto — ver `TECH_DEBT.md`, sección "Resueltos", `closeModal()` PR-007.2).
- Validar todo cambio abriendo la aplicación en un navegador real, no solo por lectura del código.


## Validación reproducible y revisión manual

Desde la raíz, con Node 24 verificado, ejecutar `node --test tests/*.test.js`: 186 pruebas en nueve archivos. No se necesita npm ni instalar dependencias. La suite usa dobles, no un navegador ni una cuenta Google reales.

| Pruebas | Comportamiento cubierto |
|---|---|
| security-rendering.test.js | Escapado y serialización de los renderizadores revisados |
| client-editing.test.js / client-counts.test.js | Conservación de campos, renombrado, contadores y recorridos |
| data-import.test.js / table-import.test.js | Validación, recuperación y lotes JSON/CSV/Excel |
| referential-integrity.test.js | Borrados con asociaciones y revalidación al confirmar |
| undo-redo.test.js / calendar-dates.test.js | Historial, fallos, atajos, zonas horarias y DST |
| drive-save.test.js | Respuestas HTTP y confirmaciones de subida simuladas |

Para una comprobación manual, usar un perfil temporal del navegador y datos ficticios. Servir la raíz con `python3 -m http.server 8000 --bind 127.0.0.1` y abrir la aplicación localmente. Chart.js 4.4.1 y SheetJS 0.18.5 se cargan desde cdnjs.cloudflare.com. Drive requiere además configurar el origen autorizado del cliente OAuth y conectarse explícitamente; no es necesario para los casos locales.

1. Editar y recargar un cliente con campos adicionales/facturación; comprobar conservación y renombrado de referencias.
2. Intentar borrar registros con asociaciones y comprobar el bloqueo; eliminar uno independiente y comprobar persistencia.
3. Importar JSON/CSV/Excel válidos e inválidos, verificar que un error no aplica filas parcialmente y que una importación exitosa se puede deshacer. Exportar/reimportar las plantillas y reportes de clientes/equipos/cotizaciones.
4. Probar undo/redo desde la primera edición y atajos dentro/fuera de campos; recordar que recargar vacía las pilas.
5. Revisar las nueve pantallas, formularios y navegación a 320/375/768/1024/1440 px, temas claro/oscuro y calendario mes/semana en distintas zonas horarias. Las revisiones previas usaron UTC, Buenos Aires, Nueva York, Berlín y Kiritimati.

Los scripts de Chromium/benchmarks de las sesiones anteriores vivían en /tmp y no están incluidos. La suite Node sí es reproducible con los archivos del repositorio. Los resultados históricos de navegador no sustituyen volver a revisar la versión que se quiera publicar.

## Límites y código conservado

Los controles referenciales de importación tabular revisan registros nuevos/modificados; JSON y formularios no tienen todavía la misma cobertura. No se reparan huérfanos históricos automáticamente. Antes de agregar un campo, revisar también `_parseImportedData()` y la política de conservación del lote, además de formularios, plantillas y exportaciones.

`quoteFromEquip()`, `delFactConfirm()`, `_snapshot()`, `openModal()` y `_closeModalById()` se revisaron por referencias. No se encontraron llamadas de producción para esos helpers, pero existen referencias en comentarios/documentación y, para `delFactConfirm`, pruebas compartidas. Se conservan. `initializeModals()` sí se invoca desde initializeUI(); no debe confundirse con un helper sin uso.
