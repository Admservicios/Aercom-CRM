# Deuda técnica — Aercom CRM v2

Registro de bugs preexistentes, código muerto y duplicaciones detectados durante la modularización. No se corrigen automáticamente — quedan documentados para decidir su abordaje en un sprint dedicado. Ver `CHANGELOG.md` para el historial completo por PR.

---

## Iniciador Windows sin instalación de Python

El usuario no dispone de Python ni puede descargarlo en su PC. INICIAR_CRM.cmd ahora invoca el Windows PowerShell de System32, con ruta absoluta para evitar depender de PATH o ejecutar un binario homónimo de la carpeta. Usa NoProfile y ExecutionPolicy Bypass solo en el proceso; no cambia políticas persistentes ni el registro y las directivas corporativas prevalecen. No usa privilegios de administrador ni HttpListener/URLACL: un TcpListener .NET en puerto no privilegiado sirve el contenido estático en 127.0.0.1:8000. El origen no cambia respecto de la versión anterior.

iniciar_crm_windows.ps1 usa APIs/sintaxis de PowerShell 5.1, BOM UTF-8 y líneas CRLF. Soporta GET/HEAD, Content-Length/MIME, cierre de conexión y no-store/nosniff. Solo index/js/css/img, sin listado, rutas ocultas, traversal decodificado, backslash/ADS, NUL ni enlaces/junctions dentro de recursos. POST/PUT/DELETE se rechazan; no escribe datos ni carpetas. Cliente con lectura/escritura atascada tiene timeout; cabeceras limitadas. Puerto ocupado falla explícitamente y no abre otro origen. El protocolo es deliberadamente un servidor estático de escritorio, no un backend ni un servidor para exponer a la red.

Verificación: 8 pruebas HTTP contra PowerShell real, con script copiado a una ruta con espacios/Unicode; GET/HEAD y MIME, directorios/404, rutas privadas/traversal/backslash/ADS/NUL, enlaces, rechazo de escritura, recuperación tras error, cabeceras grandes y puerto ocupado. Recorrido Chromium de escritorio con el servidor PowerShell y proxy externo inoperante: nueve módulos, bibliotecas reales, cuatro reportes/tres plantillas XLSX, Excel importado, JSON descargado/restaurado en otro perfil y recarga, edición/undo/redo y reporte/PDF. Cero solicitudes externas y errores JS, solo datos ficticios. CRM y formato de datos no cambian.

Para validar se extrajo temporalmente PowerShell oficial 7.4.13 Linux en /tmp, verificado con SHA-256 de la publicación. No se instaló en el sistema ni se distribuye en el ZIP. Sus cachés de prueba también quedan en /tmp. No se ejecutó Windows PowerShell 5.1 ni el CMD en la PC del usuario: esa comprobación final debe hacerse allí. Un bloqueo corporativo de PowerShell requiere revisar la directiva con soporte, no instalar Python ni cambiar políticas desde el CRM. El iniciador Python sigue siendo opcional para otras plataformas. Se mantienen respaldos JSON, una pestaña y mismo navegador/perfil/origen; los datos no están en el ZIP.

## Paquete local de escritorio — 2026-10-28

La rama de preparación incluye el cambio pendiente de ficha (3a9cad0) y los arreglos puntuales confirmados en la revisión. saveFichaFacturacion() ya no escribe la descripción del servicio en facturacion: conserva modalidad/día y usa descripcionServicio. El cambio previene futuras sobrescrituras, no deduce ni repara modalidades históricas dañadas. La salida HTML de Facturación escapa ajuste, nombres de meses desconocidos y el día; no cambia los datos ni sustituye una revisión completa de todos los renderizadores.

Se eliminan las cargas CDN del documento principal y del reporte. Chart.js se conserva en 4.4.1; SheetJS pasa de 0.18.5 a CE 0.20.3. Los bundles están versionados por nombre, con licencias y SHA-256. La fuente de SheetJS es el redistribuidor @e965/xlsx en npm, no una publicación oficial de SheetJS; se verificó SHA-512 del tarball y no se instalaron/ejecutaron scripts. El origen se documenta porque el CDN oficial estuvo bloqueado en el entorno. No se promete ausencia futura de vulnerabilidades.

El reporte crea una carga asíncrona del Chart local con URL absoluta del origen de la app, inicializa los gráficos al cargar y avisa si falla. Continúa generando HTML de impresión/PDF en otra ventana; necesita el servidor mientras se genera. No se requiere CDN. El botón de JSON siempre indica Exportar respaldo JSON; las notificaciones distinguen solicitud de descarga y persistencia del navegador, sin certificar que un archivo haya quedado guardado. Se conserva el temporizador de exportación existente y el contrato de persistencia.

iniciar_crm.py usa Python estándar 3.10+, enlaza solo 127.0.0.1 y fija puerto 8000. Permite únicamente archivos de index/js/css/img, deniega rutas ocultas, traversal, directorios y acceso fuera de la raíz; no acepta escrituras. No expone archivos JSON que el usuario pudiera guardar en backups ni .git/attachments. INICIAR_CRM.cmd invoca Python y no instala programas. LEEME.html se abre sin servidor; GUIA_LOCAL.md explica el respaldo actual/importación, origen fijo, perfil estable, una pestaña y verificación tras recarga.

Verificación: 322 pruebas Node, 5 Python aprobadas (loopback/index, MIME/HEAD, rutas privadas/traversal, POST y puerto ocupado). Chromium aislado a 1440 px, bibliotecas reales locales y proxy externo inoperante: nueve vistas sin mutar datos al navegar, gráficos, cuatro reportes/tres plantillas XLSX descargados y leídos, importación real Excel, JSON descargado/importado y restaurado en otro perfil con recarga, edición/undo/redo, modalidad/día conservados, HTML tratado como texto y PDF de reporte con dos gráficos. Cero solicitudes externas y errores JS. Se usaron datos ficticios; no se incluyen datos privados en el paquete.

Límites operativos: requiere Python y navegador en la PC; servidor verificado en Linux, CMD revisado pero no ejecutado en Windows ni en la PC del usuario. Se mantiene localStorage por origen/perfil: no hay base de datos en la carpeta ni backup automático garantizado. Usar una sola pestaña, conservar respaldos y no usar incógnito/limpieza del sitio. No hay bloqueo transaccional entre pestañas, autenticación/cifrado propios, instantáneas históricas de configuración ni protección nueva frente a cierre/recarga de formularios. No se adapta móvil. No se certifica que una importación particular del usuario sea correcta hasta verificar su copia actual y cantidades. La última versión de main será la aprobada por el usuario; no se fusiona automáticamente.

## Ficha del cliente — protección de la configuración en edición

_fichaDraft guarda solo en memoria la comparación inicial de campos de la configuración de facturación. Reutiliza _modalSnapshot() de js/modal.js (cargado antes de la interacción), incluidos texto, checks y radios. _confirmFichaDiscard() pide confirmación nativa constante si hay diferencias. El cierre, cambio de pestaña/render y apertura de otra ficha comprueban antes de reemplazar contenido o identidad; cancelar conserva pestaña activa y formulario. Un destino inexistente no elimina la protección ni cambia cliente/pestaña.

closeFicha() ahora devuelve false al rechazar el descarte y true al cerrar. Los dos enlaces de Pedidos respetan ese resultado antes de abrir el modal. No se cambian el guardado ni sus conversiones actuales: solo se limpia _fichaDraft después de persistir exitosamente, antes de regresar a la vista de lectura. Si falla la cuota, la recuperación existente conserva D/storage/historial y el formulario permanece protegido para reintentar. No hay borradores en localStorage ni escrituras al navegar/descartar.

La prueba móvil confirmó que la cruz quedaba fuera del viewport por el ancho mínimo de la cabecera. Dos reglas flex dentro del breakpoint existente permiten encoger el contenido y mantienen el botón sin contracción, con nombre accesible. No es un rediseño de las cinco estadísticas, que siguen pendientes de adaptación móvil. CSS y Clientes tienen nuevas URLs de caché.

Verificación: 317 pruebas Node aprobadas, 12 nuevas para rechazo de cierre/pestaña/render/otro cliente/reentrada, aceptar, revertir valores, checks, guardado sin advertencia, cuota/reintento e inexistentes. La prueba XSS carga el helper real con DOM simulado sin omitir sus controles. Chromium aislado a 375/1440 px verificó los cinco caminos con clicks reales (incluida la cruz dentro del viewport), aceptación/rechazo, radios/checks/texto, limpieza, guardar/cuota/reintento, modal superior sin cerrar la ficha y generación de pedido. Datos ficticios y bibliotecas reales; sin errores JS y sin escrituras ni cambios de D/storage al navegar/descartar. No se modifican archivos del usuario.

Límites: protege la configuración editable actual dentro de la ficha, no recarga/cierre de pestaña ni navegación fuera de la página. Se conserva beforeunload existente y no se almacena un borrador automático. No extiende aún el manejo de foco/tabulación a la ficha lateral completa ni corrige sus estadísticas móviles. Tampoco cambia reglas de negocio, conversiones o validación de campos de saveFichaFacturacion(). Verificado en Chromium, sin certificación de lectores de pantalla/Firefox/Safari.

## Modales — descarte explícito y manejo del foco

initializeModals() en js/modal.js ahora conecta el gestor al modal real y a la confirmación de eliminación. Un MutationObserver de clases y del cuerpo captura los valores iniciales cuando se abre/reemplaza el contenido. Los valores se comparan al solicitar cierre con requestCloseModal(); no se usa un simple flag de eventos, por lo que volver al valor inicial no advierte y se detectan cambios programáticos. Texto, fechas, números, checks/radios, selección múltiple y metadatos de archivos participan. Confirmación nativa constante antes de descartar; no lee el contenido de archivos, escribe datos ni almacena borradores.

Cancelar/cruz/fondo/Escape usan la solicitud protegida. closeModal() en index.html conserva su API de cierre interno después de guardar/importar/eliminar correctamente. No se modifican los caminos de persistencia ni su recuperación ante cuota. Debe seguir utilizándose requestCloseModal() para cierres iniciados por el usuario en formularios y closeModal() solo cuando el llamador ya resolvió el borrador. Los helpers antiguos por ID se conservan sin nuevas llamadas.

Tab/Shift+Tab y foco programático quedan en el diálogo superior; la confirmación de eliminación prevalece y cancelar no descarta el formulario. El fondo (incluida ficha lateral) es inerte mientras haya un diálogo, restaurando el estado previo y el del menú al cambiar de ancho. El foco vuelve al origen si existe o al buscador activo si un render reemplazó la fila. Atajos N y Ctrl/Meta Z/Y/S no actúan sobre el CRM detrás del diálogo; deshacer/rehacer nativos se conservan en campos y Ctrl/Meta+S no abre el guardado de página. Etiquetas existentes se enlazan solo cuando contienen un único control con ID, evitando inferencias ambiguas.

Verificación: 305 pruebas Node aprobadas (15 nuevas: comparaciones de campos, revertir cambios, rechazo/aceptación, archivos sin lectura, selección múltiple, controles no enfocables, etiquetas y cierre interno). Chromium aislado a 375/1440 px con bibliotecas reales y datos ficticios verificó cuatro formas de cierre, seis formularios más CSV, foco/tabulación/retorno, etiquetas, confirmación anidada, guardado exitoso sin aviso adicional y cuota con borrador conservado/reintento. También deshacer nativo, ficha subyacente, detalle→edición en el mismo modal y cambios de ancho con diálogo abierto. Lectura/descarte sin escrituras de aercom-data ni cambios en D/storage; solo acciones de guardado ficticias escriben en el perfil aislado. Cero errores JS.

Alcance original del gestor: ventanas de #modal-overlay. La extensión a la edición incrustada de la ficha se documenta en la sección «Ficha del cliente»; recarga/cierre de pestaña sigue fuera del alcance. No guarda borradores automáticamente ni modifica la advertencia beforeunload existente. Reemplazar todo el cuerpo inicia una nueva referencia de valores; un nuevo flujo que reemplace un formulario editado debe resolver el descarte antes de hacerlo. No se cambian diseño, validación de negocio ni mecanismos de importación. Verificado en Chromium; sin certificación de lectores de pantalla/Firefox/Safari. El formulario de clientes sigue requiriendo un paso separado para los grupos de controles cuyas etiquetas no tienen una asociación inequívoca.

## Facturación — alcance mensual compartido y filtros por ID

getFactMonthSummary(mStr), en facturacion.js, es una consulta sin escritura usada por la pantalla de Facturación y el Dashboard. Conserva la regla existente de mesesFacturacion: lista vacía/ausente aplica todos los meses; lista no vacía debe incluir el nombre del mes. Solo las fichas aplicables participan del resumen; Excluido no integra el denominador y Facturado/Cobrado integran el numerador. Estados de clientes ausentes/no aplicables no se borran ni contabilizan. El gráfico mantiene Excluido como categoría separada y explica su diferencia respecto del progreso. Mes y año explícitos en el Dashboard, conservando curMonth como período compartido.

Las filas llevan data-client-id escapado; applyFactFilter() busca por ID en los clientes del período en lugar del índice de D.clientes, que era incorrecto tras el filtrado mensual. La cantidad de resultados se compara con las filas del mes (incluidos los excluidos si el filtro los permite), sin alterar el progreso general cuando se busca. Cada render reaplica los filtros y limpia contadores en listas vacías. No se cambian mutaciones, persistencia, historial ni esquema.

Verificación: 290 pruebas Node aprobadas, 9 nuevas: población mensual, estados fuera del mes/huérfanos, filtros combinados e identidad, mes siguiente, no aplicables, todos excluidos, base vacía, lectura sin persistencia y escape del nuevo atributo. Chromium aislado a 375/1440 px verificó cálculos, gráfico real, etiquetas, búsqueda, filtros, cambios de mes, limpieza y ausencia de desborde general. Navegar/filtrar conservó D y aercom-data sin escrituras; acciones de estado/excluir/restablecer y deshacer/rehacer se ejecutaron únicamente sobre datos ficticios, preservando otros estados. Cero errores JS; sin datos privados versionados ni dependencias instaladas.

Límites: los reportes Excel/PDF no se modifican. Como antes, la configuración vigente de meses del cliente se aplica también al consultar períodos anteriores: no se crea una fotografía histórica de dicha configuración. Los estados guardados se preservan aunque una ficha no aplique al período. El gráfico incluye excluidos en su distribución y los identifica; el progreso los omite. La tabla móvil conserva desplazamiento horizontal y las pruebas de navegador son Chromium, no una certificación de Firefox/Safari. Accesibilidad de modales y mejoras visuales de tablas quedan para pasos separados.

## Calendario — navegación sin desborde de mes

calPrev()/calNext() usan _calShiftMonth() únicamente en vista mensual: guardan el día, fijan el primero antes de cambiar de mes y limitan el día al último del destino. Evita que setMonth() lleve el 31 de enero a marzo o que retroceder desde marzo permanezca en marzo. La vista semanal mantiene setDate(±7); no se altera el feed, los datos ni la persistencia. El helper addMonths() compartido trabaja con cadenas YYYY-MM y no resuelve el ajuste de una fecha local con día; no se cambia su contrato.

Verificación: 281 pruebas Node aprobadas, 8 nuevas en UTC, Buenos Aires, Nueva York y Berlín. Casos de días 29/30/31, febrero bisiesto/no bisiesto, año nuevo, doce meses consecutivos en ambos sentidos, semana y cambio de vista; se comprueba render único y conservación de datos/hora local. Chromium aislado a 375/1440 px con bibliotecas reales y datos ficticios comprobó flechas, títulos, evento de febrero y su detalle, Hoy, semana/mes y celdas de igual ancho y 120 px de alto. Sin errores JS ni escrituras de aercom-data; D/almacenamiento intactos.

Límites: el día ajustado pasa a ser el ancla actual; 31 de enero → 28 de febrero → 28 de marzo. No se guarda un día preferido ni se implementa una recurrencia de eventos. La grilla mensual sigue teniendo 42 celdas y el mismo diseño; no es un rediseño móvil ni certifica Firefox/Safari. El alcance de facturación y la accesibilidad de modales quedan para pasos separados.

## Cotizaciones — filtros sobre los datos completos

applyPipeFilter() consulta cotizaciones/clientes mediante mapas por ID; ya no obtiene responsable del contenido completo de la tarjeta ni descripción del resumen de 60 caracteres. Comparación exacta de responsable y búsqueda sin distinguir mayúsculas por ID, nombre de cliente y descripción completa. Se conserva el comportamiento de columnas y contadores y se ofrece A facturar en el selector. No se modifica D ni se llama a persistencia. Una tarjeta sin registro se oculta.

Verificación: 8 pruebas nuevas, 273 aprobadas; reproducción previa de responsable/descripción/estado ausente y Chromium aislado a 375/1440 px con datos ficticios, bibliotecas reales, filtros combinados, limpieza y apertura de edición. Sin errores JS ni escrituras de aercom-data; almacenamiento y D intactos.

Límites: búsqueda por subcadena, sensible a tildes; los montos y el resumen superior conservan su alcance general. No se rediseña el tablero móvil ni se corrigen aquí navegación de fechas, alcance de facturación o accesibilidad de modales; son pasos separados de la revisión visual/funcional. No constituye una certificación de Firefox/Safari.

## Funcionamiento local — retirada de Google Drive

Por decisión del usuario se retira la integración completa de Drive: script/módulo, OAuth, reconexión, revisión, llamadas de guardado y subida de reportes. Menú/pantalla quedan como Excel, con importaciones y descargas locales. Se eliminan las referencias de impresión obsoletas y se versionan Storage/Excel para evitar scripts antiguos cacheados. Antes de eliminar el módulo se buscaron sus consumidores reales; tras retirar llamadas/cargas solo quedaban las pruebas exclusivas y el propio módulo. No se crea un stub de sincronización ni se conserva código remoto inactivo.

No se cambia aercom-data, su esquema, origen ni validación. No hay limpieza de preferencias antiguas ni de archivos/carpetas de Google: se ignoran las claves de conexión existentes. Restauración y plan de sucursales siguen comprobando copia/sesión de recuperación y validando antes de una escritura, pero no leen/escriben sessionStorage ni requieren registrar una pausa remota. Su bloqueo no impide una recuperación local. Persistencia, recuperación ante cuota, borrados, XSS revisado y undo/redo conservan sus controles; Excel sigue exportando las mismas columnas a descarga local. Las secciones históricas de Drive de este documento describen trabajos retirados, no un pendiente para reactivar. PR #3 no debe incorporarse al modo local.

Verificación: 265 pruebas Node aprobadas, cero fallidas/omitidas. Se retiran 54 casos exclusivamente remotos (25 preflight, 24 subida/reportes/OAuth y 5 descarga en data-import); los casos que dependían del antiguo programador ahora comprueban persistencia local/historial. Las dos pruebas que exigían fallo por sessionStorage se sustituyen por pruebas que demuestran restauración/plan válidos aunque ese almacenamiento esté bloqueado. No se omiten controles de cuota, lectura, copia cambiada, validación ni conservación del borrador.

Chromium aislado: 49 clientes/122 equipos preservados y ninguna escritura de aercom-data al iniciar, nueve vistas, flags antiguos de Drive ignorados y sessionStorage denegado; edición/undo/redo/recarga y respaldo/restauración JSON reales. SheetJS 0.18.5 real produjo cuatro reportes y tres plantillas descargados y abiertos; CSV con historial, cuota fallida y borrador conservado. Anchos 375/1440 px sin desborde, cero errores JS ni solicitudes de autenticación/API Google. Chart simulado; SheetJS obtenido de la fuente de cdnjs en GitHub porque el CDN respondió 403 en el entorno. Misma versión declarada por la aplicación, sin instalación ni cambio de dependencia. Datos de usuario y scripts temporales fuera de Git.

Límites: no hay sincronización entre dispositivos/navegadores ni copia automática en las carpetas data/backups del repositorio. Guardar JSON descarga un archivo que el usuario debe conservar y trasladar/importar para otro equipo; borrar datos del navegador o cambiar de origen no conserva la copia. El recordatorio/temporizador de descarga de cinco minutos existente no garantiza que el navegador haya guardado físicamente el archivo. Local no significa offline: Chart.js y SheetJS todavía se cargan desde CDN. Continúan pendientes concurrencia entre pestañas, huérfanos, límites de importación, rendimiento y revisión de bibliotecas/renderizadores; no se declara una aplicación de escritorio ni una certificación en Firefox/Safari.

## Drive — revisión previa y pausa sin sobrescritura

La conexión autenticada ya no basta para guardar el CRM. _gdriveSyncChecked inicia false y se habilita tras validar el backup y comparar contenido normalizado; _gdriveSaveData y _scheduleDriveSave lo exigen además de autenticación. Tanto conexión manual como automática revisan el remoto. Se ignora lastSaved y el orden de propiedades de objetos, no el orden de registros ni datos adicionales. Ninguna fecha decide qué copia reemplazar. Si las copias coinciden, se verifica sin escribir ni reemplazar D. Si no existe backup en una búsqueda válida, se permite crearlo como antes.

Si el contenido difiere, hay duplicados/paginación, JSON incompatible o error de búsqueda/descarga, se pausa: no se importa el remoto, no se crea otro backup como alternativa ni un guardado posterior elude la revisión. El modal permite descargar D actual y el texto remoto tal como se leyó (aun inválido). No guarda cuerpos en logs ni en claves extra de localStorage. Al reconectar automáticamente no abre el modal; queda el botón de revisión. Se conservan ambas versiones: no se implementa todavía la elección/aplicación de una copia diferente. Los reportes son archivos independientes y continúan disponibles con autenticación.

La preparación de carpetas rechaza duplicados; los IDs se publican solo al terminar en la misma sesión. Las revisiones identifican sesión y solicitud para descartar respuestas anteriores. Desconectar invalida la revisión, oculta el aviso y evita confirmar/resignar IDs desde una respuesta de subida anterior. Una petición remota enviada puede completarse: estos controles no la deshacen.

Verificación: 25 pruebas nuevas y adaptación de expectativas existentes al nuevo contrato (ya no importar por fecha): 319 Node aprobadas, cero fallidas/omitidas. Cubren códigos duplicados remotos, diferencias en fechas antiguas/iguales/nuevas, coincidencia normalizada, listas ambiguas, HTTP, creación permitida solo tras ausencia verificada, edición local durante revisión, sesiones/solicitudes fuera de orden, descargas, guardas de guardado/timer y callbacks OAuth manual/automático. Chromium aislado verificó una copia corregida y el backup previo rechazado, contenido válido distinto/igual, duplicados/403 y reconexión automática: ninguna sustitución local, ninguna escritura remota estando pausado, descargas exactas y edición/persistencia local real; con coincidencia permite un PATCH simulado. 375/1440 px, cero errores JS. Chart/OAuth/HTTP simulados, sin cuenta real de Drive; datos privados y scripts temporales fuera de Git. URL de Drive versionada.

Cambio de comportamiento intencional: ya no se descarga automáticamente una copia distinta, aunque parezca más reciente, ni se sube el local sobre ella al conectar. Hay que revisar y resolver la diferencia en un paso separado; esta protección no promete sincronización completada. La revisión ocurre al conectar, no antes de cada subida. Persisten concurrencia de subidas/pestañas/dispositivos, cambios remotos posteriores, dos fases de creación que pueden dejar un archivo vacío si falla PATCH y mutaciones del guardado directo de Drive fuera de persist(). No hay ETag/If-Match ni fusión. El PR #3 completo necesita adaptación a main y validación real; no se fusiona por estas pruebas. El texto remoto se conserva solo durante esta sesión/revisión, no se garantiza su disponibilidad tras recargar: descargarlo para conservarlo. Carpetas preparadas y reportes pueden escribirse como antes, aunque el backup del CRM esté pausado.

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
