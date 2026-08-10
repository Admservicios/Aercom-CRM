# Aercom CRM v2

## Objetivo

Desarrollar un CRM moderno para la gestión administrativa del área de Servicios de Aercom SA.

El sistema debe ser:

- rápido
- modular
- fácil de mantener
- fácil de ampliar
- compatible con GitHub Pages
- compatible con IA (ChatGPT, Claude, Gemini, Copilot)

Nunca se priorizará escribir código rápido por sobre escribir código limpio.

---

# Filosofía

Cada módulo debe tener una única responsabilidad.

No se permiten funciones gigantes.

No se permite código duplicado.

Todo cambio debe mantener compatibilidad con los datos existentes.

---

# Arquitectura

## Clientes

Responsable de:

- alta
- baja
- modificación
- buscador
- filtros
- ficha

Archivo:

js/clientes.js

---

## Equipos

Responsable de:

- equipos
- preventivos
- refrigerantes
- baterías
- estado
- vencimientos

Archivo:

js/equipos.js

---

## Facturación

Responsable de:

- abonos
- OC
- HES
- ajustes
- modalidades
- estados

Archivo:

js/facturacion.js

---

## Calendario

Responsable de:

- eventos
- visitas
- recordatorios
- follow up

Archivo:

js/calendario.js

---

## Dashboard

Responsable de:

- indicadores
- KPIs
- estadísticas

Archivo:

js/dashboard.js

---

## Reportes

Responsable de:

- PDF
- Excel
- impresión
- estadísticas

Archivo:

js/reportes.js

---

## Storage

Responsable de:

- LocalStorage
- importar
- exportar
- backup

Archivo:

js/storage.js

---

# Reglas

Nunca modificar datos desde varios módulos.

Cada dato tiene un único responsable.

Nunca repetir código.

Siempre reutilizar funciones.

Toda función nueva debe tener un nombre descriptivo.

---

# Objetivos de la versión 2

- Código modular
- Mejor rendimiento
- Menor consumo de memoria
- Mejor diseño
- Responsive
- Corrección de bugs
- Buscadores rápidos
- Filtros rápidos
- Dashboard moderno

---

# Roadmap

Sprint 1
- Separar CSS

Sprint 2
- Separar JavaScript

Sprint 3
- Modularizar

Sprint 4
- Optimizar

Sprint 5
- Nuevas funciones

Sprint 6
- CRM Profesional
