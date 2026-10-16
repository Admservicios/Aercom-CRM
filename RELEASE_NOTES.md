# Aercom CRM — notas de cambios

## Estado integrado al 16 de octubre de 2026

Los PR #1, #2 y #4–#7 están fusionados en main. Incorporan protección de renderizado en los puntos revisados, conservación de campos, validación/recuperación de importaciones, confirmación HTTP de Drive, bloqueo de borrados con asociaciones, historial y fechas, importación tabular y navegación móvil/contadores. La suite integrada tiene 186 pruebas aprobadas; los resultados de Chromium y sus límites están en [TECH_DEBT.md](TECH_DEBT.md).

El PR #3 sigue en borrador: la resolución de conflictos de Drive no está en main y requiere validar ETag/If-Match con una cuenta real. No hay garantía de edición simultánea segura ni certificación de seguridad global. Los valores de versión heredados difieren (README v2.0.0, CONFIG 2.1.0); este cierre documental no crea una versión nueva.

## Notas históricas de v2.0.0

El contenido siguiente describe el cierre original de modularización. Las afirmaciones históricas de cobertura de seguridad o limpieza no sustituyen el alcance revisado y los pendientes actuales.


## Resumen ejecutivo

Aercom CRM v2 es un CRM interno de página única (HTML/CSS/JavaScript vanilla, sin backend) para la gestión administrativa del área de Servicios de Aercom SA: clientes, equipos, cotizaciones, pedidos de servicio, facturación, calendario y recordatorios. Esta versión marca el cierre de la modularización completa del proyecto, el endurecimiento de seguridad de su capa de renderizado, y la actualización de toda su documentación técnica.

---

## Principales mejoras respecto a la versión inicial

### Arquitectura modular

El código de dominio, que originalmente vivía embebido en `index.html`, quedó dividido en 13 módulos independientes bajo `js/modules/` (Dashboard, Clientes, Equipos, Facturación, Cotizaciones, Pedidos, Calendario, Recordatorios, Theme, Reportes, Excel, Google Drive y CSV Import), cada uno con una única responsabilidad y un header de documentación propio. `index.html` quedó reducido a infraestructura compartida (estado global, persistencia, navegación, undo/redo).

### Modularización completa

La modularización se realizó de forma incremental, módulo por módulo, con validación funcional en navegador real en cada paso, sin alterar el comportamiento existente del sistema.

### Documentación técnica

Se reescribió `docs/ARQUITECTURA.md` describiendo el estado real del código (13 módulos, acoplamiento entre dominios, infraestructura compartida), se completó `CHANGELOG.md` con el historial de todos los PR del proyecto, y se reorganizó `TECH_DEBT.md` separando deuda vigente de deuda resuelta.

### Hardening de seguridad (PR-014.x)

Se realizó una ronda de endurecimiento de seguridad enfocada en XSS:
- Escapado (`_esc()`) de datos de usuario en todas las interpolaciones dentro de `innerHTML`, incluyendo texto, atributos y elementos `<option>`.
- Reemplazo de atributos `onclick`/`ondblclick` que interpolaban datos de usuario como argumento de string JavaScript por atributos `data-*` (escapados) leídos vía `this.dataset.*`.
- Corrección del único `<textarea>` del proyecto que no escapaba su contenido.

### Persistencia

Toda la información del CRM se guarda en `localStorage` como un único objeto JSON, sin necesidad de servidor ni base de datos.

### Google Drive

Sincronización opcional vía OAuth2 (Google Identity Services): los datos del CRM y los reportes/importaciones generados pueden guardarse automáticamente en una carpeta propia del Drive del usuario, permitiendo continuar el trabajo desde otro dispositivo.

### Importación / Exportación

- **Excel**: plantillas de carga y exportación de reportes para Clientes, Equipos, Cotizaciones y Facturación, con descarga local o subida directa a Drive.
- **CSV**: importación masiva de Clientes, Equipos y Cotizaciones, con detección de conflictos y elección de saltar o reemplazar registros existentes.

---

## Estado final

- Repositorio libre de archivos huérfanos, vacíos o históricos sin uso (limpieza realizada y verificada).
- Documentación técnica (`README.md`, `CHANGELOG.md`, `docs/ARQUITECTURA.md`, `TECH_DEBT.md`) sincronizada con el estado real del código.
- Deuda técnica preexistente identificada y documentada en `TECH_DEBT.md`, pendiente de abordaje en un sprint dedicado.

**Versión:** v2.0.0
**Estado:** Release
