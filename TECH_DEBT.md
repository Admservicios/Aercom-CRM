# Deuda técnica — Aercom CRM v2

Registro de bugs preexistentes, código muerto y duplicaciones detectados durante la modularización. No se corrigen automáticamente — quedan documentados para decidir su abordaje en un sprint dedicado. Ver `CHANGELOG.md` para el historial completo por PR.

---

## Recuperación — plan revisado sin archivo nuevo

La pantalla permite pegar un plan JSON de separación de sucursales, sin descargar ni seleccionar un backup corregido. Es un plan de datos, nunca código ejecutable. Se mantienen la descarga del original y la confirmación del usuario de que lo guardó/verificó, seguidas de una confirmación específica con cantidades de códigos y asignaciones. El original y los datos del usuario no se publican en Git.

_prepareStorageBranchRepair() exige un SHA-256 de la cadena original exacta y un esquema cerrado (sha256, clientes, referencias). Cada cambio de cliente debe afectar un ID duplicado; deben indicarse todas las fichas del grupo y todas las referencias conocidas al código en equipos/cotizaciones/pedidos/recordatorios/eventos. Los códigos nuevos usan A-Z/0-9/guion/guion bajo, hasta 64 caracteres, y el parser final comprueba unicidad y estructura. Los registros y campos restantes se conservan: no hay eliminación, fusión, inferencia por dirección ni búsqueda aproximada. Facturación mensual del grupo y facturación heredada impiden esta vía y exigen una revisión adicional. No se certifican referencias personalizadas fuera de las colecciones conocidas.

La preparación verifica la huella mediante Web Crypto (HTTPS o contexto seguro) y trabaja sobre una copia, sin escribir. La aplicación usa la restauración validada existente: revalida candidato, sesión de recuperación y copia local actual antes de una escritura, pausa Drive en esta pestaña y recarga. Un error, cancelación, sesión/copia cambiada o hash diferente no modifica aercom-data. El guard compartido impide aplicar planes/importaciones simultáneas. La normalización existente se ejecuta al restaurar, igual que en la importación validada. No se instala una migración particular ni se incrustan planes de clientes reales en el código.

Verificación: 29 pruebas nuevas, 294 Node aprobadas, cero fallidas/omitidas. Cubren conservación exacta durante preparación, hash/formato, códigos/índices, asignaciones incompletas/duplicadas/ajenas, facturación, copia previa, confirmación/cancelación, sesión/copia cambiada, doble aplicación, cuota, sessionStorage, plan inválido, Web Crypto no disponible y recarga impedida. Chromium aislado verificó la copia revisada por el usuario, descarga exacta del original, hash incorrecto y cancelación sin escritura, plan confirmado, nueve vistas, conservación de las colecciones, asignaciones autorizadas y Drive pausado; además cuota/copia cambiada sin sobrescritura. Anchos 375/1440 px, cero errores JS. Chart simulado, recursos externos bloqueados, sin cuenta real de Drive. Archivos privados y scripts temporales quedan fuera del repositorio.

Límites: la huella compara el texto exacto (también formato/espacios); si cambia se necesita revisar un plan nuevo. No sustituye una firma del plan ni la revisión/confirmación humana de las asignaciones. La comparación seguida de escritura conserva las limitaciones de concurrencia de la restauración previa; cerrar otras pestañas. No representa un nuevo modelo de empresas/sucursales, no valida todos los huérfanos ni todos los renderizadores y no resuelve la sincronización de main. La conexión manual de Drive requiere revisar la copia remota. URL de Storage versionada.

## Recuperación — restauración explícita de una copia validada

La pantalla de recuperación ahora muestra el motivo de rechazo como texto y permite seleccionar un backup para reemplazar la copia local. La interfaz exige solicitar la descarga del original y que el usuario confirme haberlo guardado/verificado. El archivo se valida antes de pedir confirmación del reemplazo completo (con cantidades); no se fusionan registros ni se reparan referencias automáticamente. Una descarga solicitada no certifica que el archivo haya quedado guardado: la verificación es explícita del usuario.

_restoreStorageBackup() vuelve a validar, comprueba la sesión de recuperación y compara el original con el almacenamiento actual antes de una única escritura de aercom-data. Rechaza una copia cambiada/eliminada desde otra pestaña, una lectura denegada o un archivo incompatible. Web Storage mantiene el valor anterior cuando setItem falla por cuota/permisos. No se cambia D ni se habilita la aplicación hasta recargar. Los lectores tardíos de otra sesión se rechazan; cancelación, error/aborto de lectura y fallos liberan el selector para reintentar.

Antes de escribir se registra aercom-recovery-pause-drive en sessionStorage; si no puede guardarse, se aborta el reemplazo. La marca evita reconexión automática durante la vida de esta pestaña, incluida la recarga posterior a restaurar. No se elimina la preferencia compartida de conexión, se autentica ni se escribe en Drive. La conexión manual sigue disponible, pero conserva los riesgos conocidos de sincronización de main: revisar la copia remota antes de conectar. Si falla la escritura de datos, la pausa puede quedar activa igualmente, sin perder la copia original. Si la recarga falla tras una escritura exitosa se informa que la copia ya se restauró y debe recargarse manualmente.

Verificación: 17 pruebas nuevas, 265 Node aprobadas (cero fallidas/omitidas), con reemplazo, rechazo/cancelación, cuota, acceso de lectura/sesión, cambios externos, lectores tardíos/concurrentes, fallos/aborto de archivo y recarga impedida. Chromium aislado comprobó el flujo completo, descarga previa exacta, confirmación, validación, cancelación, restauración/recarga, reintentos, pausa Drive persistente y copia cambiada; 375/1440 px. Una copia proporcionada por el usuario se revisó y una copia corregida autorizada se validó/restauró solo en un perfil aislado; nueve vistas sin errores JS. Chart simulado, recursos externos bloqueados y reconexión interceptada, sin cuentas reales. Datos personales y archivos de usuario no se incluyen en Git ni en las pruebas versionadas.

Límites: comparar antes de escribir no constituye una transacción entre pestañas; otra pestaña podría escribir entre ambas operaciones o después. Cerrar otras pestañas al recuperar. No se crean copias locales adicionales que puedan consumir cuota: se exige conservar el archivo descargado. La validación estructural existente no detecta todos los huérfanos ni certifica todos los renderizadores. La agrupación comercial de sucursales sigue representada por fichas separadas con ID único; no se introduce un modelo nuevo de empresas/sucursales ni se versionan migraciones particulares del usuario.

## Inicio — copia local dañada o inaccesible

loadData() valida un candidato con el mismo parser de backups antes de asignar D. Solo una clave ausente (null de getItem) permite DEFAULT; cadena vacía, JSON inválido, raíz incompatible, registros/tipos/fechas rechazados o lectura denegada bloquean el inicio. La validación estructural no resuelve referencias huérfanas. Las normalizaciones y migraciones heredadas se aplican solo en memoria: no se escribe ni se elimina la copia original al arrancar, incluso con cuota agotada.

El bootstrap solo prepara snapshot, dashboard, indicadores y reconexión automática de Drive tras un inicio válido. Ante rechazo muestra un dialog modal nativo sin cierre por Escape y desactiva los atajos del CRM; el fondo queda inerte. El guardado decorado devuelve false, y las rutas compartidas de persistencia, reemplazo de backups, exportación, reset e importación tabular rechazan operar en ese estado. La preferencia opcional del tema y la bandera de Drive toleran lecturas bloqueadas; guardar el tema informa si solo pudo aplicarse en memoria.

La recuperación permite solicitar la descarga del texto original como aercom-data-original.txt, sin parsear, normalizar ni declarar válido ese contenido. Si no pudo leerse, la descarga se deshabilita. Reintentar recarga la página sin limpiar claves: solo continúa si puede cargar una copia válida. No incluye reparación automática. La restauración explícita desde un backup revisado se describe en la sección anterior. Una descarga solicitada debe comprobarse en el navegador; no se afirma que el usuario la haya conservado.

Verificación: 21 pruebas nuevas, 248 Node aprobadas; copia inicial ausente, daños estructurales, duplicados/fechas, lectura/acceso denegados, migración sin escrituras, recuperación, bloqueo de rutas y descarga con fallo. Chromium aislado cubre JSON dañado/vacío/null, tipos incompatibles, almacenamiento inaccesible, tema oscuro, descarga exacta del original, Escape/atajos/fondo inerte, reintento, carga válida, preferencias bloqueadas y migración sin cuota. Anchos 375/1440 px; cero errores JS. Datos ficticios, Chart simulado, sin conexión real a Drive; la reconexión se intercepta para comprobar su programación sin autenticar. El script temporal de navegador no integra la suite versionada.

Límites: se conserva el contrato estricto existente del parser; datos históricos con campos de tipo inválido ahora requieren revisión en lugar de reparación silenciosa. La validación recorre el JSON completo y no introduce un límite de tamaño. El bloqueo de interfaz usa dialog/showModal de navegadores modernos; Chromium verificado, sin certificar Safari/Firefox. Continúan pendientes concurrencia entre pestañas/dispositivos, validación referencial y conflictos de Drive. Las URLs de Storage/Theme se versionan para evitar scripts antiguos cacheados.

## Guardado — recuperación ante fallos locales

persist() en index.html recupera el estado anterior y las pilas ante fallos, devuelve false y no programa una nueva subida a Drive. Los consumidores directos comprueban false antes de continuar con cierre, render o mensajes de éxito. La interfaz conserva el borrador de los formularios porque la recuperación refresca el fondo, no el modal. Ese borrador no está persistido: recargar/cerrar/navegar puede descartarlo.

Storage mantiene _lastSavedSnapshot al cargar, confirmar guardado base y aplicar un backup; _applyImportedData restaura ese checkpoint cuando falla y considera false un fallo del callback. Esto conserva la compatibilidad de importaciones, descargas controladas y undo/redo. Se distingue el estado normalizado en memoria de la cadena previa en almacenamiento. resetStorage deja de eliminar la copia antes de reemplazarla. Las URLs de los scripts afectados incluyen versión para no mezclar el contrato nuevo con módulos antiguos cacheados.

Ante cuota agotada o error posterior a escritura se intenta recuperar la copia local original. Si leer/restaurar está bloqueado, se recupera la copia confirmada de esta pestaña en memoria, se informa la limitación y se pide exportar antes de recargar. No se afirma una restauración local que el navegador impide verificar. Los indicadores de guardado se restablecen; el temporizador de exportación manual puede reiniciarse, sin preservar su plazo exacto previo.

Veinte pruebas nuevas en tests/local-save-recovery.test.js y adaptación de una prueba de historial al resultado false: 227 aprobadas, cero fallidas/omitidas. Cubren cuota, lectura bloqueada, primera copia, fallos posteriores/restauración impedida, siete dominios y factura, referencias cruzadas, borrado, alta, reset, reintento, checkpoint e importaciones/undo/redo existentes. Chromium aislado verificó siete formularios reales, recuperación y permanencia del borrador, reintento y valor tras recarga, estado mensual, errores de lectura/escritura/interfaz y undo/redo. Sin errores JS; datos ficticios, Chart simulado y Drive desconectado. El script temporal de navegador no integra la suite versionada.

Pendiente: concurrencia entre pestañas/dispositivos y peticiones remotas ya iniciadas, validación de referencias/IDs y mutaciones en otros flujos de Drive/exportación fuera de persist(). La recuperación no incorpora datos de otra pestaña al borrador ni implementa fusión. Si la memoria no tiene una copia recuperable, el mensaje lo informa y no confirma éxito. Si el renderizado de recuperación también falla se preservan los datos recuperados, sin prometer una interfaz reparada. En edición inline se recupera la vista; el borrador de la celda no se mantiene como un modal. No se garantiza conservación del borrador tras recargar ni disponibilidad del almacenamiento.

## Edición — conservación de equipos y cotizaciones

saveEquip() y saveQuote() conservan propiedades existentes ajenas al formulario al construir el objeto actualizado. Se preservan campos conocidos como marca/ubicacion/proximoBateria, metadatos adicionales, objetos, cero, false y null; las altas mantienen sus valores anteriores. Los selectores muestran valores históricos fuera del catálogo como opciones escapadas, evitando sustituciones implícitas al guardar.

La próxima batería guardada se conserva cuando no se cambia la fecha de último cambio. Comparar una fecha anterior null/ausente como vacía evita borrar una próxima fecha importada al guardar otro dato. Cambiar explícitamente el último cambio recalcula la próxima fecha +730 días o null al vaciarla, de acuerdo con la edición inline existente. Las fechas de próximo refrigerante/visita siguen siendo campos editables con las sugerencias actuales del formulario.

Quince pruebas nuevas en tests/equipment-quote-editing.test.js; suite completa: 207 aprobadas. Los casos originales reprodujeron pérdida de campos y sustitución de selectores antes del cambio. Chromium aislado verificó formularios reales, cancelación, conservación exacta al editar otro dato, tipos/estados históricos, valores cero, batería, altas sin herencia, undo/redo y recarga, sin errores JS. Chart simulado; sin Drive real. Script de navegador temporal, no incluido en la suite versionada.

Pendiente: recuperación transaccional ante cuota/fallos de guardado, validación de asociaciones e IDs en formularios (incluido el comportamiento de alta de equipo con ID existente), pérdida de campos en otros dominios y revisión de interpolaciones restantes. Conservar un tipo/estado histórico no certifica su validez de negocio ni lo agrega al catálogo global. No se reparan datos perdidos antes del cambio y no se modifica el formato del backup.

## Seguridad — confirmación de facturación

Corregidas tres interpolaciones de confirmFacturacion() en js/modules/cotizaciones.js: cotId se escapa dentro de strong; nroFactura y fechaFactura se escapan en atributos HTML entre comillas. El título usa textContent y el botón sigue leyendo el ID desde su data-id escapado. doFacturar conserva los valores originales, sin guardar entidades HTML.

Seis pruebas nuevas en tests/invoice-confirmation.test.js; tres casos fallaban contra el código anterior y pasan después de corregir. Suite completa: 192 aprobadas, ninguna fallida/omitida. Chromium aislado comprobó ausencia de etiquetas y atributos ejecutables en el formulario ante datos manipulados, foco, cancelación sin mutación, confirmación y recarga con ID y número literales, campos adicionales y otra cotización intacta. Sin errores JS; Chart simulado y sin Drive real. El script de navegador es temporal y no integra la suite versionada.

Alcance limitado a este formulario. Siguen pendientes la revisión de otras interpolaciones de Cotizaciones/Pedidos, conservación de campos al editar equipos/cotizaciones, transacciones de formularios, carga local corrupta e integridad referencial. No se valida toda fecha por este cambio: se evita que su texto construya HTML adicional. Los conflictos de Drive del PR #3 continúan fuera de main.

## Publicación — versión del enlace CSS

El index usa css/style.css?v=calendar-cells-20261019 para que la publicación de las celdas uniformes no reutilice la URL anterior. Se comprobó que el CSS de main en 9c52ee9 contiene la corrección. La consulta del dominio de Pages devolvió 403 desde el entorno, por lo que el estado servido al usuario no pudo inspeccionarse directamente.

En Chromium con caché HTTP habilitada y max-age, una navegación reutilizó el CSS anterior y mantuvo una columna sobredimensionada; cambiar el enlace versionado produjo una nueva petición y columnas iguales. El calendario completo volvió a pasar las comprobaciones a tres anchos. Esta prueba demuestra la protección frente a caché; no diagnostica definitivamente la captura sin conocer su URL/recursos cargados. Si el HTML publicado también está en caché, puede requerir recarga completa. No limpiar localStorage ni los datos del navegador para resolver estilos.

## Calendario — dimensiones independientes del contenido

Corregida la expansión de columnas por el tamaño mínimo intrínseco de tracks 1fr y de filas por alturas mínimas abiertas. css/style.css usa siete columnas minmax(0,1fr), filas mensuales de 120 px y eventos semanales de 180 px. Las celdas tienen mínimo cero y overflow vertical interno. El ancho se adapta al contenedor, con columnas iguales; el contenido no modifica la geometría. No se modificó JavaScript, persistencia ni formato de eventos.

Reproducción previa con títulos largos: una columna podía crecer hasta unos 13.149 px; con 40 eventos la fila semanal alcanzaba unos 989 px. Después se mantuvieron las mismas dimensiones antes/después de cargar eventos en 375/768/1440 px. Chromium comprobó detalles completos, «+37 más» mensual, último evento semanal mediante scroll y texto ampliado en mes; sin errores JS. Chart simulado, Drive desconectado y datos ficticios. Las 186 pruebas Node siguen pasando; no cubren geometría CSS. El script temporal de navegador no forma parte de la suite versionada.

Pendiente independiente: calPrev/calNext aún usan setMonth conservando el día y pueden saltar un mes desde los días 29–31. Este cambio es visual y no corrige ese comportamiento. Alturas elegidas: 120/180 px; un ajuste posterior de densidad debe conservar scroll y acceso a todos los eventos. No se certificaron otros motores de navegador.

## Cierre documental — paso 10

PR #1, #2 y #4–#7 fusionados en main; 186 pruebas Node en nueve archivos. El PR #3 sigue en borrador: falta comprobar la exposición de ETag y la semántica de If-Match desde un navegador con una cuenta de Drive real. El plan no se considera cerrado en esa parte y no se incorporó su implementación a main.

Se corrigieron descripciones antiguas de persistencia/historial, Excel, identificación de clientes, seguridad y navegación; se documentaron pruebas reproducibles y casos manuales. README, guía de desarrollo, arquitectura e índice de funciones distinguen estado integrado de historial. BUGS.md dejó de presentar checks sin evidencia como problemas resueltos. RELEASE_NOTES.md conserva las notas originales como históricas. Las referencias de versión (2.0.0/2.1.0) siguen desalineadas; se informa sin crear una versión ni alterar CONFIG.

La revisión de helpers sin llamadas conserva cualquier referencia existente, incluidas las pruebas parametrizadas de delFactConfirm. No hubo cambios a archivos ejecutables, dependencias, almacenamiento de la aplicación ni datos de clientes. Los resultados de suites/benchmarks citados dentro de los pasos anteriores corresponden a sus ramas y momentos; la suite integrada actual tiene 186 pruebas.

## Importación tabular — seguimiento del paso 8

CSV y Excel usan `_applyTableImport()` de Storage: copia temporal síncrona de D, validación completa del candidato mediante `_parseImportedData()`, controles de relaciones sobre registros nuevos/modificados y `_applyImportedData(candidate,persist)` con recuperación de memoria/almacenamiento/pilas ante errores. La copia temporal se descarta en finally. No se aplican filas sueltas ni se guardan lotes sin cambios.

CSV conserva campos ausentes al reemplazar y los campos adicionales del objeto existente; una columna presente vacía aplica sus valores vacíos/predeterminados. Excel conserva propiedades adicionales y valores financieros cero/falsos; las celdas vacías conservan valores existentes. Se validan números finitos con punto decimal, booleanos SI/NO/true/false/1/0, IDs y fechas. CSV admite comillas dobles escapadas y campos multilínea; errores de encabezado/columnas/claves bloquean el archivo. Lecturas antiguas de ambos formatos no pisan una selección posterior. Al seleccionar otro CSV se restablece Saltar existentes, evitando que la interfaz marque saltar mientras el estado interno todavía ordena reemplazar.

Se retiraron las coincidencias parciales/normalizadas de clientes en Excel: ahora se requiere Cliente ID válido (con nombre coherente si se incluye) o nombre exacto único. Equipos/cotizaciones requieren ID explícito. El lote rechaza una reasignación de equipo con cotizaciones/pedidos y de cotización con pedidos; no modifica relaciones ajenas en cascada. Los estados de cotización nuevos/modificados se comprueban contra el catálogo actual, admitiendo las dos migraciones heredadas existentes.

Hallazgos corregidos de exportación: plantilla de cotizaciones con diez valores y nueve encabezados; reporte de clientes con 14 valores y 21 encabezados. Se alinearon los campos y se agregó Cliente ID al reporte/plantilla de cotizaciones. Las planillas antiguas mal alineadas deben descargarse nuevamente; no se adivinan columnas. Fechas Excel 1900: se rechaza el serial ficticio 60; los libros 1904 se rechazan con mensaje para conversión explícita.

Verificación: 48 pruebas nuevas y las 134 anteriores, todas aprobadas. Chromium aislado con SheetJS 0.18.5 real (misma URL/version usada por la aplicación) y archivos XLSX generados/descargados comprobó los tres dominios, preservación, undo/redo de CSV, fallos tardíos/cuota sin aplicación parcial y recarga. Se exportaron/reimportaron las tres plantillas y tres reportes. Chart simulado; sin cuenta de Drive. No se actualizó ni instaló una dependencia.

Pendiente: límites de tamaño/filas, procesamiento fuera del hilo principal y rendimiento de copias/validación; evaluación/actualización de SheetJS 0.18.5 y dependencia del CDN; política de archivos 1904; importación JSON y formularios interactivos todavía sin validación referencial equivalente; reparación explícita de huérfanos históricos. La validación estructural de todo el candidato puede bloquear importaciones si el estado previo ya contiene tipos/fechas incompatibles; esos datos requieren revisión, no conversión silenciosa. El control referencial revisa registros nuevos/modificados, conservando huérfanos históricos intactos. No garantiza seguridad de renderizado en todos los módulos ni resuelve concurrencia entre pestañas/dispositivos (PR #3). CSV requiere comas y encabezados reconocidos; variantes con punto y coma y columnas personalizadas se rechazan. Excel usa la primera hoja. No se agregan fusiones automáticas ni recuperación de datos perdidos antes de este cambio.

## Historial y fechas — seguimiento del paso 7

Corregidos: primera edición imposible de deshacer sin copia previa, consumo de pilas al fallar una restauración, ausencia de programación de Drive tras undo/redo, interceptación del deshacer nativo de formularios y atajo Shift+Z sensible a mayúsculas. `_restoreHistory()` reutiliza `_applyImportedData()` y solo mueve las pilas después de restaurar con éxito. El snapshot de arranque vive en memoria; el historial sigue limitado a 30 acciones y no persiste tras recargar.

`today()` y los rangos/claves del calendario usan fecha local; `daysDiff()`/`addDays()` operan sobre fechas YYYY-MM-DD como días sin hora. Corrige alertas desplazadas un día al oeste de UTC y desplazamientos en las celdas al este de UTC o en semanas navegadas a última hora. No cambia el formato de los backups ni repara fechas históricas ya guardadas incorrectamente.

Verificación: 15 pruebas nuevas de historial/atajos y cinco procesos con zonas horarias reales (UTC, Buenos Aires, Nueva York, Berlín y Kiritimati), incluyendo límites de mes/año, bisiestos y DST; 134 pruebas aprobadas. Chromium repitió los flujos reales en las cinco zonas con datos ficticios, sin errores JS; Chart simulado y sin Drive real. Se comprobó la invocación del programador de sincronización, no su entrega a una cuenta real.

Pendiente: el guardado ordinario de formularios sigue sin revertir la mutación en memoria si falla por cuota; se conserva el historial previo, pero eso no constituye una transacción de edición. Si el navegador impide también recuperar una copia local tras una falla parcial, Storage advierte exportar los datos en memoria. Los indicadores de guardado no se restauran como parte de la transacción. Peticiones remotas ya iniciadas/concurrencia siguen bajo el PR #3 pendiente. Las funciones de fechas esperan YYYY-MM-DD; validación universal de formularios, navegación de meses desde el día 29–31 y conversión de fechas Excel requieren revisión separada.

## Rendimiento y responsive — seguimiento del paso 9

Antes, el sidebar fijo de 216 px dejaba solo 104 px de contenido principal en una ventana de 320 px. Ahora se despliega como menú hasta 800 px; el fondo y Escape lo cierran, seleccionar módulo devuelve el foco al botón y el cambio a escritorio elimina inert del contenido. El menú cerrado no recibe foco y las opciones admiten Enter/Espacio. CSS reorganiza formularios/ficha y mantiene el desplazamiento horizontal dentro de tablas, facturación y calendario. No se ocultan operaciones para hacerlas caber.

`renderClientes()` calcula Map de equipos/pedidos activos por cliente una vez por render. Pasa de recorrer equipos y pedidos por cada cliente a una pasada por ambas colecciones y consultas por ID. Los Maps son locales, por lo que altas, bajas y cambios de estado se reflejan al renderizar. Se conserva el HTML byte por byte en la comparación con el código previo.

Verificación: cuatro pruebas nuevas y las 134 de main aprobadas (138 en la rama del paso 9; PR #6 entonces separado). Chromium con Chart.js 4.4.1 real, nueve pantallas en 320/375/768/1024/1440 px, formularios de clientes/equipos/cotizaciones/pedidos/recordatorios, ficha, edición, menú por teclado/clic/fondo/Escape, resize y temas claro/oscuro; cero errores JS. Sin Drive. Inspección visual de la vista móvil y el menú. Benchmark de generación HTML en Node con DOM/badges simulados, 2.000 clientes y 20.000 equipos/20.000 pedidos, tres ejecuciones por versión: medianas 520 ms/10 ms, HTML idéntico. Es una medición local del generador, no de la pantalla completa. También se generó una combinación temporal con el PR #6: sin conflictos y 186 pruebas aprobadas; esa combinación no se fusionó ni publicó.

Pendiente: paginación/virtualización del DOM, límites de importación/tamaño y cuota de localStorage, consultas repetidas en otros módulos, renderización de grandes volúmenes en dispositivos físicos, navegación de foco/lectores de pantalla en los modales existentes y evaluación completa en Firefox/Safari. Facturación y calendario mantienen desplazamiento horizontal intencional en móvil. CSS usa inert (HTML) y unidades dvh de navegadores modernos; se comprobó Chromium, sin certificar navegadores antiguos. En esa revisión el PR #6 todavía estaba separado; hoy está integrado. El PR #3 de Drive sigue pendiente de validación real. No se cambia persistencia, esquema ni sincronización.

## Integridad — seguimiento del paso 6

Las rutas `delClientConfirm`, `delFactConfirm`, `deleteEquip`, `delEquipConfirm`, `deleteQuote` y `delQuoteConfirm` comparten `canDeleteRecord()` en utils. Comprueba referencias directas antes de abrir la confirmación y nuevamente antes de eliminar. También protege historial mensual de clientes, incluidos estados Pendiente/Excluido. Un ID inexistente no genera guardado. No hay eliminación en cascada. `saveClient()` ahora actualiza también `D.eventos` al cambiar el código.

Verificación: 38 pruebas nuevas de borrados y ampliación de la prueba de renombrado; 90 pruebas en esta rama basada en main. Chromium aislado verificó las seis rutas, persistencia/recarga, revalidación y edición real del código con eventos. Chart simulado; sin conexión a Drive.

Pendiente: detectar y resolver huérfanos preexistentes y validar referencias de JSON/formularios al reasignar cliente/equipo/cotización (CSV/Excel incorporaron controles para registros nuevos/modificados en el paso 8), y definir archivo lógico para equipos/cotizaciones con historial. No se reparan ni desconectan asociaciones automáticamente. La protección comprueba D en esta pestaña; no resuelve concurrencia entre pestañas/dispositivos ni reemplazos completos de estado. La confirmación de subidas de Drive del PR #2 ya está incorporada desde main. Los conflictos de Drive siguen separados en el PR #3, que requiere validar ETag/If-Match con una cuenta real. El cambio de código puede seguir colisionando con estados mensuales huérfanos cuyo código coincide con el nuevo; requiere validación específica antes de renombrar. Los errores de cuota al guardar siguen siendo un riesgo de los formularios existentes.

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

## Helpers conservados tras revisión de referencias

- `quoteFromEquip(eid)` — `js/modules/equipos.js`: sin llamadas de producción detectadas; tiene referencias en cabeceras/comentarios y documentación. Se conserva.
- `delFactConfirm(cid)` — `js/modules/facturacion.js`: sin llamada desde la interfaz detectada; figura en `tests/referential-integrity.test.js` mediante una tabla de rutas, además de comentarios/documentación. Se conserva con su protección de referencias.
- CSS "AERCOM POLISH" dentro del `<style>` del Reporte de Vencimientos (Sprint 13) — `js/modules/reportes.js`. El documento HTML standalone que genera `generarReporteVencimientos()` incluye ~80 líneas de reglas (`.k-col`, `.nav-item`, `.stat-card`, `#modal-overlay`, scrollbar, etc.) que no tienen ningún elemento correspondiente en ese documento — son estilos de la app principal, copiados junto con el resto del `<style>` pero inertes ahí.

- `_snapshot()` — `index.html`: sin llamadas detectadas, referenciado en documentación; se conserva.
- `openModal()`/`_closeModalById()` — `js/modal.js`: sin llamadas detectadas, referenciados en comentarios/documentación; se conservan. `initializeModals()` sí tiene llamada en `js/ui.js`.

La búsqueda incluyó nombres en código, handlers, pruebas y Markdown. Ausencia de llamadas detectadas no prueba ausencia de consumidores externos de globals. No se eliminaron funciones ni estilos en el paso 10.

## Duplicaciones funcionales vigentes (no unificadas)

- `deleteEquip(id)` (modal) vs `delEquipConfirm(eid)` (tabla) — `js/modules/equipos.js` (Sprint 6). Mismo efecto, distinta forma de armar el mensaje de confirmación.
- `deleteQuote(id)` (modal) vs `delQuoteConfirm(qid)` (tarjeta) — `js/modules/cotizaciones.js` (Sprint 8). Mismo patrón que el anterior.
- `delFactConfirm(cid)` (Facturación, sin llamada de interfaz detectada) vs `delClientConfirm(id)` (Clientes) — ambas eliminan un cliente completo, con textos/refrescos distintos.

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
