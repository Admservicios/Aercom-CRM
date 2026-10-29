# Aercom CRM — abrir y guardar en una carpeta

Versión del 29/10/2026 para Google Chrome de escritorio. Sin Python, PowerShell, servidor ni instalación. El usuario confirmó que index.html abre el CRM directamente en su Chrome.

## Primera vez: llevar tus datos actuales

1. En el CRM donde tenés tus datos actuales, exportá un respaldo JSON y verificá que se descargó. Conservá el original sin editar.
2. Creá una carpeta para los datos, por ejemplo **Documentos / Datos Aercom**. Copiá allí el respaldo actual con el nombre exacto **aercom-data.json**. Si el navegador lo descargó como aercom-data (1).json, renombrá la copia, conservando el original.
3. Extraé el ZIP del programa completo. Abrí **index.html** con Google Chrome, como ya comprobaste en tu PC. No se usa ningún iniciador.
4. En el CRM, pulsá **Conectar carpeta de datos**, elegí Datos Aercom y autorizá a Chrome a ver/editar esa carpeta.
5. Si el archivo tiene datos distintos, el CRM muestra cantidades y pide confirmar antes de cargarlos. Si ya había datos en ese navegador, primero guarda otra copia JSON en la carpeta, con prefijo aercom-respaldo-navegador-. Si esa copia no puede guardarse, la carga se cancela.
6. Comprobá clientes, equipos, sucursales y fechas. Para verificar el circuito, guardá una edición de prueba y esperá el mensaje **Archivo aercom-data.json actualizado**. Revisá el archivo en la carpeta y, si corresponde, deshacé la edición y esperá nuevamente la confirmación.

Si la carpeta está vacía, el CRM pide permiso para crear aercom-data.json con los datos que se ven en pantalla. Antes de aceptar, comprobá que sean los datos que querés guardar: el ZIP contiene el programa y puede mostrar datos de ejemplo si todavía no cargaste los tuyos. No reemplaza automáticamente un JSON vacío, dañado o incompatible.

## Cada vez que lo uses

- Abrí index.html con el mismo Chrome y perfil.
- Pulsá **Conectar carpeta de datos**, seleccioná la misma carpeta y autorizá el acceso. Esta versión no conserva el permiso ni recuerda la carpeta al cerrar; el navegador requiere esa selección por sesión.
- Mientras esté conectada, cada cambio confirmado con Guardar, deshacer/rehacer o una importación se copia a aercom-data.json. Escribir en un formulario sin pulsar Guardar todavía no guarda ese borrador.
- Esperá el mensaje de archivo actualizado antes de cerrar. El estado pendiente se mantiene hasta que termina la escritura. Una descarga JSON no elimina una advertencia de escritura aún pendiente.
- Si no conectás carpeta, el CRM conserva el funcionamiento anterior: guarda en el navegador y permite Exportar respaldo JSON, pero no actualiza el archivo de la carpeta.

## Si hay un error o dos copias distintas

- Un fallo de permiso, escritura o cierre pausa la copia al archivo y lo muestra en pantalla. Los cambios confirmados siguen en el navegador. Exportá un respaldo JSON y verificá el archivo antes de reconectar.
- Si el archivo fue cambiado por otra aplicación, no se sobrescribe automáticamente. Al reconectar podés confirmar cargarlo, conservando antes la copia del navegador como otro JSON. Cancelar conserva los datos actuales. Para mantener la versión del navegador sin cargar la otra, cancelá y elegí una carpeta vacía o exportá un JSON aparte para revisarlo.
- No edites el mismo JSON con otro programa ni uses dos pestañas del CRM a la vez. La comprobación de cambios es preventiva, no una transacción entre aplicaciones.
- Si el JSON existente es inválido, conservá ese original; se rechaza sin reemplazarlo. Si falló el primer guardado de un archivo nuevo, puede haber quedado vacío: exportá primero los datos del navegador a otro JSON antes de revisar/reemplazar esa copia.
- Si Chrome bloquea elegir una carpeta o escribir, copiá el mensaje. No se necesitan cambios de política de Windows ni permisos de administrador para la opción normal; las restricciones de la empresa pueden impedir el acceso.

## Conservar tus datos

El archivo aercom-data.json de la carpeta elegida contiene tus datos; el navegador mantiene otra copia de trabajo. No es sincronización con Drive. Conservá respaldos con fecha en otra ubicación o medio; guardar siempre sobre el mismo JSON no sustituye una copia histórica. Usá la misma carpeta de datos al actualizar el programa. Si movés el programa o cambiás de perfil, conectá la carpeta para cargar los datos; no dependas de la copia que quede en el navegador.

Las bibliotecas están incluidas en js/vendor con sus licencias. El reporte reutiliza el Chart ya cargado del CRM para poder generarse sin un servidor. El ZIP de esta edición no incluye iniciadores, herramientas de desarrollo, archivos privados ni datos reales del usuario.

## Alcance de las comprobaciones

350 pruebas Node; pruebas de navegador con File System Access nativo en almacenamiento aislado OPFS y selector de carpeta simulado, sobre HTTP local de desarrollo. Se verifican creación, lectura/escritura/cierre, edición, historial/importación, cambios externos, conservación de ambas copias y reconexión. El entorno de pruebas bloquea file:// por política de administración; no se desactivó esa política. El usuario confirmó apertura directa del CRM en su Chrome, pero falta verificar el selector real y la escritura en su carpeta Windows. Si no está disponible, Exportar respaldo JSON sigue siendo la alternativa manual. No se certifica Firefox/Safari ni uso móvil.


## Equipos y Excel actualizados (29/10/2026)

El formulario muestra Equipo y Próximo cambio de batería; ya no muestra gas ni horómetro. La próxima batería se propone a dos años calendario desde el último cambio (29/02 se ajusta a 28/02 si corresponde). Se puede indicar otra fecha explícita; las fechas guardadas anteriormente no se recalculan al abrir.

Volvé a descargar las plantillas de Equipos. Incluyen Equipo, último/próximo refrigerante, última/próxima batería y visitas; gas/horómetro no se exportan. Las planillas anteriores siguen siendo aceptadas: Ultimo Aceite corresponde al refrigerante actual, mientras Ultimo Refrigerante era el gas histórico. La importación preserva los históricos sin mostrarlos en la nueva plantilla. Una próxima batería explícita se conserva; si cambiás la última fecha y dejás vacía la próxima, el CRM calcula los dos años al importar. El CSV mantiene el formato anterior, con recálculo de próxima batería si cambia la última fecha.

Antes de cambiar la carpeta del programa, exportá/verificá un JSON actual y conservá la carpeta de datos separada. Abrí el nuevo index.html y conectá esa misma carpeta; no se elimina información histórica del JSON.
