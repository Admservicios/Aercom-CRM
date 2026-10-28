# Aercom CRM — uso local en esta PC

Paquete de escritorio local del 28/10/2026. Datos en el navegador, sin Google Drive ni CDN. La versión móvil no forma parte de esta preparación.

## Requisitos e inicio

- Windows 10/11 con Windows PowerShell 5.1 (incluido en Windows) y Chrome o Edge. **No requiere Python, Node ni descargar programas adicionales.**
- El iniciador usa el PowerShell del sistema para servir archivos solo en esta PC. No requiere administrador ni instala componentes. Si una directiva de la empresa bloquea PowerShell, conservá el mensaje para revisarlo con soporte.
- Descargá el ZIP completo y usá **Extraer todo**. No abras los archivos desde dentro del ZIP.
- Abrí **INICIAR_CRM.cmd** dentro de la carpeta extraída. Dejá abierta su ventana mientras trabajás. Se abrirá el navegador en **http://127.0.0.1:8000/**.
- Si el navegador no se abre, copiá esa dirección manualmente. Si el puerto está ocupado, cerrá la otra ventana del servidor y reintentá. El iniciador no elige otro puerto para evitar crear un almacenamiento distinto.
- No abras index.html con doble clic ni alternes localhost/127.0.0.1, puertos, perfiles o navegadores: son almacenamientos diferentes. Servidor y dirección quedan fijos; usá una sola pestaña del CRM.

El iniciador Windows ejecuta el script incluido con `-ExecutionPolicy Bypass` solo para ese proceso; no cambia la política persistente ni las directivas corporativas. El servidor lee archivos del programa y no guarda información del CRM en disco.

Como alternativa opcional para Linux/macOS con Python 3.10+: `python3 iniciar_crm.py`. Ambos iniciadores se limitan a 127.0.0.1 y no publican el CRM en la red. No escribe archivos de datos ni acepta operaciones HTTP de escritura. No expone .git, attachments ni backups.

## Trasladar los datos que usás hoy

1. En el CRM actual, solicitá un respaldo con **Exportar respaldo JSON** (o Guardar JSON en versiones anteriores). Comprobá que el archivo se haya descargado y guardalo fuera de la carpeta del programa. Usá una copia actual, no un archivo antiguo de la reparación de sucursales.
2. Conservá esa copia original sin editar. Copiá también el ZIP del programa a esta PC.
3. Iniciá el CRM local con la dirección indicada y el navegador/perfil que usarás habitualmente.
4. Elegí **Importar JSON** y seleccioná el respaldo actual. La importación reemplaza el conjunto de datos local validado; no fusiona dos copias. Si ya hay información local, exportala antes.
5. Comprobá cantidades de clientes, equipos, cotizaciones y pedidos, sucursales y algunas fechas/estados de facturación. Cerrá y reabrí el CRM con la misma dirección y perfil; verificá que sigan presentes.
Si una modalidad de facturación ya quedó reemplazada por una descripción en una versión anterior, revisala con la información original: esta versión no adivina ni repara modalidades históricas automáticamente.

6. Exportá otra copia JSON desde la instalación local y conservá ambas hasta completar la revisión.

El ZIP no incluye datos privados. GitHub y las carpetas data/backups del programa no contienen la información del navegador ni hacen respaldos automáticos. Si al iniciar aparecen datos de ejemplo o una pantalla de recuperación, no los confundas con tu información; importá la copia válida o conservá el original antes de revisar el error.

## Trabajo diario y respaldos

- Editar y guardar confirma cambios en localStorage del navegador. El botón **Exportar respaldo JSON** descarga otra copia: no significa que exista una base de datos en la carpeta del programa.
- Exportá al terminar la jornada y antes de actualizar/restaurar. Verificá el archivo en Descargas y guardá copias con fecha, por ejemplo aercom-2026-10-28.json, en otra ubicación (idealmente también un medio distinto).
- El temporizador de exportación existente puede solicitar una descarga después de cinco minutos de cambios. Eso no garantiza que el navegador la haya guardado. Las copias manuales verificadas siguen siendo necesarias.
- No uses modo incógnito ni limpieza automática de datos del sitio. Borrar datos del navegador, perder el perfil o fallar el disco puede eliminar la única copia si no conservás respaldos externos.
- Usá una sola pestaña/perfil para editar; no hay bloqueo transaccional ni fusión entre pestañas. Deshacer/rehacer es temporal y no sustituye un respaldo.
- No importes archivos de origen desconocido. No hay autenticación ni cifrado propio: se usa el perfil de Windows/navegador de esta PC.
- No hay que conectar Drive ni mantener Internet para gráficos, Excel o reportes. El servidor local debe seguir abierto para cargar archivos y generar el reporte; el PDF ya guardado se puede consultar por separado.

## Actualizar o mover el programa

Exportá y verificá el JSON antes. Cerrá el servidor, extraé la nueva carpeta completa y volvé a iniciarlo en **127.0.0.1:8000** con el mismo navegador/perfil. La carpeta puede cambiar, pero el origen debe mantenerse. Conservá siempre el JSON aunque el navegador mantenga los datos.

## Bibliotecas y comprobaciones

Chart.js 4.4.1 y SheetJS CE 0.20.3 están incluidos con licencias y huellas en js/vendor/NOTICES.md. SheetJS se obtuvo de la redistribución pública @e965/xlsx con integridad SHA-512 verificada porque el CDN oficial no fue accesible; no se ejecutaron scripts de instalación.

Pruebas de escritorio realizadas con Chromium aislado y datos ficticios, bloqueando todas las solicitudes externas. Se verifican módulos, gráficos reales, Excel, respaldo/restauración en otro perfil, recarga y reporte/PDF. El nuevo servidor se verificó con PowerShell 7.4.13 portátil en Linux, rutas con espacios/Unicode y Chromium. Usa sintaxis/API disponibles en Windows PowerShell 5.1, sin ejecutar todavía el CMD en tu PC. La distribución portátil usada para probar no está en el ZIP; Windows utiliza su PowerShell incluido. El alcance no incluye adaptación móvil completa, colaboración simultánea ni almacenamiento automático fuera del navegador.
