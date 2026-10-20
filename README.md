# Aercom CRM v2

CRM interno para la gestión administrativa del área de Servicios de Aercom SA. Centraliza clientes, equipos, cotizaciones, pedidos de servicio, facturación, calendario y recordatorios en una única aplicación web, reemplazando el seguimiento manual disperso en planillas y documentos sueltos.

Desarrollado para uso interno del equipo de Servicios: alta y seguimiento de clientes y sus equipos, control de vencimientos de mantenimiento, pipeline comercial de cotizaciones, generación de pedidos de servicio y estado de facturación mensual, todo en un solo lugar y sin depender de un servidor propio.

---

## Características

- **Dashboard** — KPIs operativos, lista de alertas urgentes priorizada y gráficos (Chart.js) con el estado general del negocio.
- **Clientes** — Alta, baja y modificación de clientes, buscador, y ficha con pestañas de solo lectura hacia sus equipos, cotizaciones, facturación, recordatorios y pedidos asociados.
- **Equipos** — Listado y filtros, alta/edición/eliminación, edición inline de fechas de mantenimiento (preventivo, refrigerante, batería) y cálculo de estado/vencimiento.
- **Cotizaciones** — Pipeline tipo kanban de 9 estados con drag & drop, alta/edición/eliminación y transición a pedido de servicio.
- **Pedidos de Servicio** — Listado agrupado por estado, alta/edición/eliminación, avance de estado y generación automática desde una cotización aprobada.
- **Facturación** — Estado de facturación mensual por cliente (Pendiente/Facturado/Cobrado/Excluido) con navegación entre meses.
- **Calendario** — Vistas de mes y semana que unifican en un solo feed los vencimientos de equipos, follow-ups de cotizaciones, recordatorios, pedidos y eventos propios.
- **Recordatorios** — Listado con filtros, alta/edición/eliminación y toggle Pendiente↔Hecho.
- **Excel** — Plantillas de importación y exportación de reportes (Clientes, Equipos, Cotizaciones, Facturación), con descarga local.
- **CSV Import** — Importación masiva de Clientes, Equipos y Cotizaciones con detección de conflictos (saltar/reemplazar).
- **Reportes PDF** — Informe de vencimientos con KPIs, gráficos y tablas, generado como documento HTML para imprimir o guardar como PDF.
- **Tema Claro/Oscuro** — Detección automática y toggle manual, persistido en el navegador.

---

## Funcionalidades

- Dashboard operativo
- Gestión de clientes
- Gestión de equipos
- Pipeline de cotizaciones
- Pedidos de servicio
- Facturación
- Calendario
- Recordatorios
- Exportación a Excel
- Importación desde CSV
- Reportes en PDF
- Undo / Redo (deshacer y rehacer sobre el estado completo)
- Persistencia local (sin servidor)

---

## Tecnologías

- HTML5
- CSS3
- JavaScript Vanilla (sin framework, sin build step)
- SheetJS (`xlsx`) — lectura/escritura de archivos Excel
- Chart.js — gráficos del Dashboard y de Reportes
- LocalStorage — persistencia de datos en el navegador

---

## Arquitectura

El proyecto está dividido en **12 módulos de dominio** (`js/modules/`), cada uno con una responsabilidad de negocio específica: Dashboard, Clientes, Equipos, Facturación, Cotizaciones, Pedidos, Calendario, Recordatorios, Theme, Reportes, Excel y CSV Import.

Además existe una **infraestructura compartida** (estado global `D`, persistencia, navegación entre módulos, undo/redo, helpers de dominio y de formato) que vive en `index.html` y en `js/utils.js`, `js/storage.js`, `js/modal.js`, `js/config.js`, `js/ui.js` y `js/app.js`.

El detalle completo de responsabilidades, dependencias y acoplamiento entre módulos está documentado en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

---

## Estructura del proyecto

```
Aercom-CRM-v2/
├── index.html
├── README.md
├── CHANGELOG.md
├── RELEASE_NOTES.md
├── TECH_DEBT.md
├── PROJECT.md
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── config.js
│   ├── modal.js
│   ├── storage.js
│   ├── ui.js
│   ├── utils.js
│   └── modules/
│       ├── calendario.js
│       ├── clientes.js
│       ├── cotizaciones.js
│       ├── csv.js
│       ├── dashboard.js
│       ├── equipos.js
│       ├── excel.js
│       ├── facturacion.js
│       ├── pedidos.js
│       ├── recordatorios.js
│       ├── reportes.js
│       └── theme.js
├── tests/              # pruebas Node sin paquetes adicionales
├── docs/
│   ├── ARQUITECTURA.md
│   ├── BUGS.md
│   └── FUNCIONES.md
├── backups/
├── data/
└── img/
```

---

## Instalación

No requiere Node.js, ni gestor de paquetes, ni proceso de build. Es HTML/CSS/JS estático servido tal cual.

Para ejecutarlo localmente basta con levantar cualquier servidor de archivos estáticos apuntando a la raíz del proyecto y abrir `index.html` en el navegador, por ejemplo:

```bash
python -m http.server 8000
```

o cualquier otro servidor estático equivalente (Live Server de VS Code, `npx serve`, IIS, etc.). También es compatible con GitHub Pages, sirviendo la raíz del repositorio directamente.

---

## Persistencia

- **LocalStorage** — toda la información del CRM (clientes, equipos, cotizaciones, pedidos, recordatorios, eventos, facturación) se guarda como un único objeto JSON en `localStorage['aercom-data']`. No requiere backend ni base de datos.
- **Respaldo y traslado** — usá Guardar JSON para descargar todos los datos y conservá copias periódicas fuera del navegador. Importar JSON restaura una copia validada en otra computadora/navegador. No hay sincronización entre dispositivos ni escritura automática de respaldos en las carpetas del repositorio. Los archivos que ya existan en Google Drive no se modifican.
- **Acceso a bibliotecas** — los datos permanecen locales, pero Chart.js y SheetJS todavía se cargan desde un CDN. No se garantiza un arranque completo sin conexión; esta modificación no instala una aplicación de escritorio ni un modo offline.

---

## Desarrollo

Para sumarte al desarrollo de este proyecto, el orden recomendado de lectura es:

1. [`DEVELOPER_GUIDE.md`](DEVELOPER_GUIDE.md) — guía práctica: cómo está organizado el código, cómo fluye la información, persistencia, render, helpers compartidos y ejemplos paso a paso para agregar un módulo, un campo, una pantalla o un botón.
2. [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) — arquitectura completa: los 12 módulos, la infraestructura compartida y el acoplamiento real entre dominios.
3. [`CONTRIBUTING.md`](CONTRIBUTING.md) — filosofía, convenciones y checklist a seguir antes de hacer, crear o eliminar algo.
4. [`TECH_DEBT.md`](TECH_DEBT.md) — bugs conocidos, código muerto y duplicaciones vigentes, para no re-descubrir lo ya documentado.
5. [`CHANGELOG.md`](CHANGELOG.md) — historial completo de cambios por PR.

---

## Estado del proyecto

**Versión:** v2.0.0
**Estado:** funcionamiento local con respaldo/restauración JSON, importación CSV/Excel y exportación de reportes. La integración de Drive fue retirada; el PR #3 no forma parte del funcionamiento actual. Las referencias de versión heredadas no están unificadas: este README indica v2.0.0 y CONFIG.app.version indica 2.1.0.


## Comportamiento actual y comprobaciones

- Los borrados de clientes/equipos/cotizaciones con registros asociados se bloquean; no se elimina historial en cascada.
- CSV y Excel validan el lote antes de aplicarlo y recuperan datos/almacenamiento/historial ante fallos. CSV conserva columnas ausentes y aplica vacíos/predeterminados si la columna está incluida; Excel conserva el valor existente ante una celda vacía. Los campos adicionales del registro se conservan. Excel requiere IDs de equipos/cotizaciones y un cliente identificado por ID o nombre exacto único. Descargá nuevamente las plantillas antiguas de cotizaciones con columnas desplazadas.
- Deshacer/rehacer actúa sobre todo D, hasta 30 acciones en la sesión; se pierde al recargar. Dentro de campos editables se conserva el deshacer nativo del navegador.
- Hasta 800 px se usa el botón Menú; el escritorio conserva el sidebar. Tablas, facturación y calendario pueden desplazarse horizontalmente en su propia área. Verificación realizada en Chromium, sin certificación de otros navegadores.
- Los datos de localStorage pertenecen al navegador y origen actuales. Servir desde otro puerto/dominio o borrar el almacenamiento no traslada ni conserva esa copia; exportá el JSON para llevarla a otro origen. Las carpetas data/ y backups/ no son una base de datos ni un respaldo automático.

La aplicación no requiere Node. Para ejecutar las pruebas de desarrollo desde la raíz, con Node 24 (versión verificada):

```bash
node --test tests/*.test.js
```

265 pruebas aprobadas del funcionamiento local. Se retiraron 54 casos exclusivos de Drive y se adaptaron las pruebas locales relacionadas. Usan módulos nativos, datos ficticios y dobles de DOM/SheetJS. Las comprobaciones adicionales de Chromium y bibliotecas CDN reales se describen en [TECH_DEBT.md](TECH_DEBT.md); los scripts temporales de esas sesiones no forman parte de la suite del repositorio. Consultá [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) para repetir la revisión manual y [docs/BUGS.md](docs/BUGS.md) para pendientes.
