# Changelog — Aercom CRM v2

Historia de la modularización del proyecto, agrupada por PR. No detalla línea por línea — para eso está el historial de cada módulo en su propio header de documentación (`js/modules/*.js`) y el detalle de deuda técnica en `TECH_DEBT.md`.

---

## Sin publicar — navegación mensual del calendario

- Corregido el salto de meses al avanzar o retroceder desde el día 29, 30 o 31: se visita el mes contiguo y se ajusta el día al último disponible. Ejemplo: 31/01/2026 → 28/02/2026; en 2024, → 29/02/2024.
- Se conserva la navegación semanal de siete días, los eventos, el diseño de celdas fijas y el botón Hoy. URL del módulo versionada para evitar la caché anterior.
- Validación: 281 pruebas Node aprobadas, 8 nuevas en cuatro zonas horarias con reproducción previa del error, fin de mes, bisiestos, cambio de año, recorridos de doce meses y cambio de vista. Chromium aislado a 375/1440 px: navegación real, detalle de evento, Hoy y dimensiones de celdas; bibliotecas reales y datos ficticios. Cero errores JS/escrituras de aercom-data; D y almacenamiento intactos.

## Sin publicar — filtros de cotizaciones completos

- Búsqueda por ID, cliente y descripción completa a partir de los datos, aunque la tarjeta muestre un resumen. El responsable se compara con su nombre completo, evitando leer el texto de toda la tarjeta.
- Incorporado «A facturar» al selector de estados. Se conservan filtros combinados, limpieza y contadores; URL del módulo versionada para actualizar la caché.
- Validación: 273 pruebas Node aprobadas (8 nuevas); los casos nuevos reprodujeron los errores antes de corregirlos. Chromium aislado a 375/1440 px verificó responsable, descripción, cliente, ID, estado, combinaciones, sin resultados, limpieza y apertura de edición. Datos ficticios, Chart.js/SheetJS reales, cero errores JS y escrituras de aercom-data. Sin cambios de esquema ni datos de usuario.

## Sin publicar — CRM con datos exclusivamente locales

- Retirada la integración de Google Drive por decisión del usuario: módulo, autenticación, reconexión, avisos, programación del guardado y destinos de exportación remotos. Excel conserva importaciones, plantillas y descarga de reportes; JSON/CSV y las funcionalidades actuales se mantienen.
- La clave aercom-data y el esquema no cambian. Preferencias antiguas se ignoran, sin eliminar datos locales ni acceder a archivos de Google. La recuperación deja de depender de sessionStorage. URLs de Storage/Excel versionadas.
- Documentación activa actualizada al modo local y al respaldo/traslado manual JSON. Las entradas de Drive anteriores son históricas; no se reintroduce PR #3.
- Validación: 265 pruebas locales aprobadas. Retirados 54 casos exclusivos de la integración eliminada; pruebas locales adaptadas sin reducir controles de persistencia/recuperación. Chromium aislado: nueve vistas, edición/historial/recarga, JSON, CSV, cuatro reportes y tres plantillas XLSX reales, cuota/borrador, flags antiguos y sessionStorage bloqueado; 375/1440 px, cero errores JS y solicitudes de autenticación/API Google. Chart simulado; SheetJS 0.18.5 desde la fuente de cdnjs. No se incluyen archivos de usuario en Git.

## Sin publicar — revisión de Drive antes de sincronizar

- Autenticación separada de verificación del backup: conexión manual y automática comparan contenido normalizado antes de habilitar guardados del CRM. Ninguna fecha elige una versión.
- Diferencias, JSON rechazado, duplicados/paginación o errores de lectura pausan la sincronización conservando el local y el texto remoto leído. Se pueden descargar ambas copias y seguir editando localmente; un guardado posterior no crea un backup como alternativa a un rechazo. Resolución/aplicación de una copia diferente queda pendiente.
- Se rechazan carpetas ambiguas y se invalidan respuestas de revisión/preparación y confirmaciones de otra sesión. Reportes independientes y creación del primer backup tras ausencia verificada mantienen su comportamiento. URL de Drive versionada.
- Verificación: 319 pruebas Node, 25 nuevas y expectativas de importación por fecha actualizadas. Chromium aislado: backup anterior rechazado, versiones válidas distintas/iguales, duplicados/HTTP, revisión automática, descargas y edición local en pausa; sin errores JS. OAuth/HTTP/Chart simulados, sin validar una cuenta real ni integrar el PR #3.

## Sin publicar — aplicar un plan de sucursales sin archivo nuevo

- Recuperación mediante un plan JSON revisado pegado en la pantalla: huella SHA-256 exacta del original, códigos únicos por sucursal y asignaciones explícitas a registros. Sin descargar el backup corregido ni usar la consola del navegador.
- La preparación no escribe: restringe campos/colecciones, exige cubrir el grupo duplicado y sus referencias conocidas, rechaza facturación que requiera revisión y valida el candidato completo. Descarga/verificación del original y confirmación antes de aplicar con el mecanismo de restauración existente; pausa de Drive, controles de sesión/copia y manejo de fallos conservados.
- 294 pruebas Node aprobadas (29 nuevas). Chromium aislado verificó la copia revisada, conservación, asignaciones, nueve vistas, cancelación/hash incorrecto/cuota/cambio externo y pausa Drive, sin errores JS; 375/1440 px. Ningún dato o plan particular de usuario se publica en Git.

## Sin publicar — restauración validada desde recuperación

- Pantalla de recuperación con motivo de rechazo y restauración explícita desde un archivo validado, previa descarga/verificación del original y confirmación del reemplazo completo. Se conserva el bloqueo de edición mientras los datos no carguen correctamente.
- Validación antes de confirmar y al aplicar, control de sesión/copia actual y manejo de cancelación, cuota y errores de lectura. El reemplazo usa una única escritura de datos; recarga manual indicada si la recarga automática falla después de guardar.
- Pausa de reconexión automática a Drive en esta pestaña tras recuperar; no se toca la preferencia compartida ni se conecta una cuenta real. Storage tiene URL versionada.
- 265 pruebas Node aprobadas (17 nuevas). Chromium aislado verificó el flujo, reintentos, pausa y nueve vistas con una copia de usuario revisada, sin errores JS. Los archivos del usuario y sus correcciones particulares quedan fuera del repositorio.

## Sin publicar — inicio seguro con almacenamiento dañado o bloqueado

- Carga validada antes de asignar D; DEFAULT se utiliza únicamente si la clave no existe. Los datos incompatibles o inaccesibles bloquean la edición y la reconexión automática con Drive sin sustituir la copia local.
- Pantalla de recuperación con descarga del texto original y reintento sin limpiar datos; Escape y los atajos no habilitan operaciones sobre datos sin cargar. Guardas en las rutas compartidas de almacenamiento impiden reemplazos/exportaciones en ese estado.
- Las migraciones heredadas se realizan en memoria, sin escribir al iniciar. Las preferencias opcionales del tema y de conexión no interrumpen el arranque si no pueden leerse. URLs de Storage/Theme versionadas.
- Verificación: 248 pruebas Node (21 nuevas). Chromium aislado comprueba recuperación, texto descargado, bloqueo, reintento y carga normal, incluidos cuota, tema/preferencia Drive y migración; 375/1440 px, cero errores JS. Datos ficticios, Chart simulado y ninguna cuenta real de Drive.

## Sin publicar — recuperación de guardados locales fallidos

- persist() devuelve true al completar el guardado y false ante fallo, recuperando D, las pilas e intentando restaurar la copia local. Se mantiene un checkpoint del estado confirmado de esta pestaña para recuperarse incluso si la lectura está bloqueada.
- Los consumidores de Clientes/Equipos/Cotizaciones/Pedidos/Recordatorios/Calendario/Facturación detienen el cierre y los mensajes de éxito ante false. El formulario queda abierto con el borrador. Importaciones detectan false como fallo y mantienen su recuperación; el reset conserva la copia anterior hasta confirmar el reemplazo.
- Se restablecen indicadores y se informa si la copia local no pudo verificarse/restaurarse, indicando exportar el estado recuperado antes de recargar. No se programa un nuevo guardado de Drive en el camino de fallo.
- URLs versionadas de Storage y los siete módulos afectados evitan combinar el contrato nuevo con scripts anteriores en caché.
- Verificación: 227 pruebas Node (20 nuevas y actualización del contrato en una prueba de historial). Chromium aislado: siete formularios con cuota simulada, borrador, reintento y recarga, estado mensual, lectura bloqueada, error posterior a escritura, recuperación impedida y undo/redo. Cero errores JS; datos ficticios, Chart simulado y Drive desconectado.

## Sin publicar — conservar campos al editar equipos y cotizaciones

- Los guardados parten del registro existente y reemplazan los campos del formulario, conservando marca, ubicación, metadatos importados, valores 0/false/null y datos de facturación. Las altas mantienen sus valores predeterminados sin heredar datos de otro registro.
- Los selectores conservan tipos de equipo y estados históricos fuera del catálogo con valores escapados; editar otro dato no sustituye silenciosamente ese valor.
- La próxima batería existente se conserva si la última fecha no cambia (incluida una fecha previa vacía/null/ausente). Si se cambia explícitamente, se recalcula con +730 días o se limpia al vaciarla, como en edición inline.
- Verificación: 207 pruebas Node, 15 nuevas. Chromium aislado comprobó edición/cancelación, conservación completa, valores históricos, cambios explícitos, batería, altas, undo/redo y recarga. Cero errores JS; Chart simulado, datos ficticios y Drive desconectado.

## Sin publicar — seguridad de la confirmación de facturación

- Escapado contextual del ID en texto HTML y del número/fecha de factura en sus atributos value. Los datos originales y el guardado de la factura se conservan; no se alteran estados ni lógica de persistencia.
- Seis pruebas nuevas reproducen las tres interpolaciones sin protección y cubren también valores vacíos, ausencia de mutación al abrir, guardado literal, campos adicionales y cotización inexistente. Antes de corregir fallaban los tres casos de renderizado; después pasan 192 pruebas Node.
- Chromium aislado verificó que etiquetas/atributos manipulados no crean imágenes ni manejadores en el formulario; cancelar no modifica datos y confirmar/recargar conserva los valores literales. Cero errores JS; Chart simulado, datos ficticios y Drive desconectado.

## Sin publicar — recarga de estilos del calendario

- El enlace de css/style.css incluye una versión para solicitar una URL nueva tras publicar las celdas uniformes. La corrección de geometría ya está en main; una copia anterior de CSS en caché puede conservar la distribución vieja.
- Chromium reprodujo caché HTTP real: la URL sin versión reutilizó el CSS anterior; al cambiar a la URL versionada se solicitaron los estilos actuales y las columnas quedaron iguales. Se repitieron las pruebas de calendario en 375/768/1440 px con 40 eventos, detalles y scroll, sin errores JS.
- No se pudo consultar la publicación de Pages desde este entorno (403); la prueba de caché es local y no confirma por sí sola qué versión está viendo cada usuario. No se modifican datos, lógica ni sincronización.

## Sin publicar — celdas uniformes del calendario

- Las columnas de mes/semana usan minmax(0,1fr) para que el texto no ensanche un día. La vista mensual conserva seis filas de 120 px y la semanal una fila de eventos de 180 px, con desplazamiento interno si hace falta.
- Se conserva el truncado de títulos, sus detalles completos, los tres eventos visibles y el acceso «+ más» mensual. El ancho sigue respondiendo al contenedor y al desplazamiento horizontal móvil.
- Verificación: 186 pruebas Node aprobadas; Chromium aislado en 375/768/1440 px, con y sin 40 eventos, títulos largos sin espacios, comparación de dimensiones, apertura de detalles, acceso al último evento semanal, «+ más» y texto ampliado en mes. Sin errores JS; Chart simulado y Drive desconectado.
- Solo CSS y documentación. La navegación mensual desde días 29–31 continúa como pendiente independiente.

## Sin publicar — Paso 10: documentación del estado integrado

- README, guía de desarrollo, arquitectura, notas, índice de funciones y estado de bugs reflejan los PR integrados. Se corrigen descripciones previas de guardado, historial, identificación Excel y alcance de seguridad.
- Instrucciones de pruebas Node y checklist manual; se distinguen dobles de las verificaciones de Chromium/bibliotecas reales y resultados históricos de la suite integrada de 186 pruebas.
- Revisión de referencias de helpers obsoletos, conservando funciones con referencias de documentación/pruebas. Sin cambios a código ejecutable ni dependencias.
- El PR #3 permanece en borrador y la validación de conflictos de Drive sigue pendiente. No se crea una versión nueva ni se certifica seguridad global.

## Paso 8 — PR #6 integrado: importaciones CSV/Excel sin pérdidas parciales

- CSV y Excel construyen el lote sobre una copia de D y comparten validación estructural, comprobaciones de relaciones y aplicación con recuperación. Un error de fila, render o persistencia rechaza el lote sin consumir historial. Un lote sin cambios no guarda ni programa Drive.
- Reemplazar CSV conserva campos no incluidos y permite vaciar columnas incluidas; Excel conserva campos adicionales y celdas vacías mantienen el valor existente. Los valores 0/false se conservan y admiten explícitamente.
- CSV admite BOM, comillas escapadas, comas y saltos de línea dentro de campos. Rechaza encabezados inválidos/desconocidos, filas desalineadas y claves repetidas. Lecturas antiguas no reemplazan selecciones nuevas; seleccionar otro CSV restablece Saltar existentes tanto en los controles como en el estado interno.
- Números/booleanos/fechas inválidos y asociaciones inexistentes/ambiguas se rechazan. Excel exige ID para equipos/cotizaciones, usa ID o nombre exacto único para identificar clientes y deja de asignar por coincidencia parcial. No se permite reasignar equipos con cotizaciones/pedidos ni cotizaciones con pedidos.
- Fechas Excel: validación de texto y seriales 1900, rechazo del serial ficticio 60 y libros con sistema 1904. Se alinean los diez encabezados de cotizaciones con sus valores y los 21 valores del reporte de clientes con sus encabezados.
- Verificación: 182 pruebas Node (48 nuevas). Chromium con SheetJS 0.18.5 real verificó archivos XLSX, CSV, conservación de campos, undo/redo, errores de lote/cuota, recarga y exportación/reimportación de tres plantillas y tres reportes. Cero errores JS; Chart simulado y Drive desconectado. Sin dependencias nuevas.

## Paso 7 — PR #5 integrado: deshacer/rehacer y fechas de calendario

- Se conserva un snapshot inicial en memoria para deshacer también la primera edición cuando aún no existe `aercom-data`. El guardado agrega historial y descarta rehacer después de completarse correctamente.
- Deshacer/rehacer reutiliza la aplicación con recuperación de Storage: un error de parseo, renderizado o persistencia no consume la acción ni confirma éxito. Las restauraciones exitosas programan la sincronización habitual con Drive y mantienen el límite de 30 acciones.
- Ctrl/Meta+Z conserva el deshacer nativo en campos editables; Ctrl/Meta+Shift+Z funciona con `Z` mayúscula.
- Hoy se obtiene del calendario local. Las diferencias y sumas de fechas sin hora usan días UTC para evitar offsets y cambios DST. El calendario mensual/semanal construye sus claves y rangos con fechas locales.
- Validación: 134 pruebas Node (20 nuevas), con cinco zonas horarias y transiciones DST. Chromium aislado en esas cinco zonas comprobó primera edición, botones/atajos, fallo de cuota y recuperación, recarga y fechas/eventos del mes y semana. Cero errores JS; Chart simulado, Drive desconectado y datos ficticios.

## Paso 9 — PR #7 integrado: navegación móvil y contadores de clientes

- Menú desplegable hasta 800 px, con cierre por selección, fondo y Escape, foco y controles inert; el escritorio conserva la barra lateral. Opciones de navegación activables con Enter/Espacio.
- Formularios y ficha pasan a una columna en pantallas pequeñas; facturación y calendario desplazan sus áreas horizontalmente sin ensanchar el módulo. En 320 px el contenido principal pasa de 104 a 320 px disponibles.
- Los contadores del listado de clientes se calculan con Map en una pasada por equipos/pedidos, conservando estados, orden, escapado y HTML. No se mantienen cachés entre renders.
- Verificación: 138 pruebas Node (cuatro nuevas) en la rama del paso 9 antes de integrar el PR #6. Chromium con Chart.js 4.4.1 real: nueve pantallas en cinco anchos de 320–1440 px, formularios/ficha, edición, menú por teclado/fondo/Escape, cambio a escritorio y temas claro/oscuro, sin errores JS. Drive desconectado.
- Combinación de prueba con el PR #6 en snapshot temporal: sin conflictos, 186 pruebas aprobadas; no se fusionó ni publicó esa combinación.
- Comparación sintética con 2.000 clientes, 20.000 equipos y 20.000 pedidos: HTML idéntico; mediana de tres generaciones en Node de 520 ms antes a 10 ms después. DOM y badges simulados; no representa tiempo total del navegador ni una garantía para otros equipos.

## Paso 6 — PR #4 integrado: proteger borrados y referencias del calendario

- Bloqueo compartido en las seis rutas de borrado de clientes, equipos y cotizaciones cuando existen referencias. Clientes incluye recordatorios, eventos e historial mensual de facturación, incluso estados Pendiente/Excluido; equipos incluye cotizaciones/pedidos; cotizaciones incluye pedidos de cualquier estado.
- Se informa el número de asociaciones y se revalida al confirmar. No se borran registros en cascada ni se modifica el historial. Los registros sin dependencias mantienen su borrado habitual.
- Al cambiar el código de un cliente, también se actualizan sus eventos propios del calendario.
- Verificación: 90 pruebas Node (38 nuevas y ampliación del caso de renombrado), más Chromium aislado: seis rutas bloqueadas sin mutación, seis borrados con recarga, asociación agregada durante la confirmación y renombrado desde el formulario con persistencia. Sin errores JS; Chart simulado y Drive desconectado.
- Tras integrar main con el PR #2: 114 pruebas aprobadas y repetición satisfactoria del flujo de Chromium aislado.
- Rama creada desde main y actualizada con el PR #2 ya fusionado; no incorpora el PR #3 de conflictos de Drive. No repara huérfanos preexistentes ni valida todas las relaciones en importaciones o cambios de asociación.

## Paso 4 — PR #2 integrado: confirmar guardados de Drive

- Las búsquedas y creaciones de carpetas/archivos y los PATCH de backups/reportes comprueban HTTP. Las respuestas de búsqueda y creación deben contener IDs válidos; un error no se interpreta como archivo ausente.
- El backup solo muestra guardado exitoso después del PATCH confirmado. Los fallos mantienen el estado pendiente y distinguen si la copia local pudo conservarse. Una edición posterior al snapshot enviado sigue pendiente aunque termine la subida anterior.
- La preparación de carpetas debe terminar antes de anunciar que Drive está listo; los callbacks OAuth capturan sus errores. Se retiró el mensaje temporizado de reconexión que afirmaba ausencia de cambios sin comprobarla.
- Se conserva el ID creado si falla la subida posterior, para que otro intento en la misma sesión no cree un segundo backup. No se añaden reintentos automáticos ni se resuelven conflictos entre dispositivos.
- Validación: 24 pruebas nuevas (76 en total con `node --test tests/*.test.js`) y Chromium aislado para indicadores, exportación Excel y conexión fallida. HTTP, OAuth, SheetJS y Chart simulados; no se accedió a una cuenta real.

## Paso 3 — PR #1 integrado: validar backups antes de reemplazar datos

- Validación compartida de JSON local y descargado de Drive: raíz, colecciones, registros, IDs únicos/no reservados, tipos conocidos, fechas y estructura de facturación. Los campos adicionales se conservan y los tipos incompatibles se rechazan sin conversiones silenciosas.
- Las normalizaciones existentes (arrays opcionales, clientes y migraciones heredadas) se comparten con el arranque. No se cambia el formato de exportación.
- Render previo al guardado y recuperación de memoria, copia local e historial ante errores. Si el navegador impide restaurar la copia local, se informa que debe exportarse la copia en memoria antes de recargar.
- La búsqueda y descarga de Drive comprueban HTTP y rechazan contenido incompatible antes de decidir una subida. No se modifican las reglas de conflictos ni la implementación de subidas.
- Validación: 52 pruebas con `node --test tests/*.test.js`, más Chromium aislado para importación, recarga, pantallas y fallos de render/cuota. Drive se verificó con respuestas simuladas y Chart con un doble; no se validó acceso a cuentas reales.

## Paso 2 — PR #1 integrado: conservar datos al editar clientes

- El guardado general conserva la prioridad y los campos existentes ajenos al formulario, incluida la configuración detallada de facturación y campos adicionales importados. Las altas mantienen sus valores predeterminados.
- Los selectores muestran el valor histórico existente aunque no pertenezca al catálogo, evitando sustituir silenciosamente tipos como `Clínica` y descripciones de facturación personalizadas. Esas opciones mantienen el escapado del paso 1.
- Una modalidad personalizada conserva su día existente al editar otros datos; cambiar explícitamente a una modalidad distinta de `Por fecha` limpia el día. La modalidad `Por fecha` sigue usando el día del formulario.
- Pruebas: `node --test tests/client-editing.test.js tests/security-rendering.test.js` (16 pruebas). Chromium aislado verificó edición, persistencia y recarga, renombrado y referencias, rechazo de duplicados, modalidades y alta con datos ficticios; sin acceso a Drive.

## Paso 1 — PR #1 integrado: renderizado seguro

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
