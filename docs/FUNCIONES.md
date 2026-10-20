# Índice de funciones compartidas y flujos principales

Guía de entrada al código actual; no pretende enumerar todos los globals. Para relaciones entre módulos ver [ARQUITECTURA.md](ARQUITECTURA.md).

| Función | Archivo | Responsabilidad |
|---|---|---|
| renderClientes | [clientes.js](../js/modules/clientes.js) | Tabla, orden y contadores; usa Maps locales por render. La llaman saveClient, delClientConfirm y el dispatcher renderModule |
| saveClient | [clientes.js](../js/modules/clientes.js) | Guarda formulario conservando campos y actualiza referencias al renombrar código, incluidos eventos |
| canDeleteRecord | [utils.js](../js/utils.js) | Revisa dependencias y bloquea borrados de clientes/equipos/cotizaciones; no elimina en cascada |
| today / daysDiff / addDays / _localDateString | [utils.js](../js/utils.js) | Día local, aritmética de días sin hora y claves del calendario |
| persist | [index.html](../index.html) | Guardado base, historial del estado previo y programación de Drive |
| undoAction / redoAction / _restoreHistory | [index.html](../index.html) | Restauración de estado completo con recuperación; mueve pilas tras éxito y programa Drive |
| showModule / renderModule | [index.html](../index.html) | Navegación y dispatcher; showModule también cierra el menú móvil |
| setMobileMenu / toggleMobileMenu | [index.html](../index.html) | Estado, foco e inert del menú hasta 800 px |
| _parseImportedData | [storage.js](../js/storage.js) | Valida JSON y comparte normalizaciones, sin reemplazar datos por sí sola |
| _applyImportedData | [storage.js](../js/storage.js) | Aplica un candidato y recupera memoria/copia local/historial ante fallos |
| _applyTableImport | [storage.js](../js/storage.js) | Construye/valida el lote CSV/Excel sobre una copia antes de aplicarlo |
| parseCsv / confirmCsvImport | [csv.js](../js/modules/csv.js) | Parseo y lote con elección de conflictos |
| xlsImport / _xlsDate / xlsExport | [excel.js](../js/modules/excel.js) | Importación, fechas Excel y reportes |
| _gdriveLoadData / _gdriveSaveData / _scheduleDriveSave | [drive.js](../js/modules/drive.js) | Revisión previa por contenido; pausa ante diferencias/errores/duplicados y guardado habilitado tras revisión. Resolución completa del PR #3 pendiente |

applyCliFilter filtra filas existentes; no llama a renderClientes. Las referencias antiguas a saveCliente/deleteCliente en este índice no correspondían a las funciones reales y se corrigieron.

La revisión de funciones sin llamadas de interfaz se registra en [TECH_DEBT.md](../TECH_DEBT.md). No se eliminaron helpers ni se modificó código de la aplicación en este paso documental.
