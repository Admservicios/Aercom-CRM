# Estado de problemas y verificaciones

Este documento reemplaza una lista histórica de checks sin evidencia, versiones ni casos reproducibles. La lista no demostraba que todos esos problemas estuvieran resueltos. El registro detallado y sus límites se mantienen en [TECH_DEBT.md](../TECH_DEBT.md).

| Estado | Área | Evidencia o pendiente |
|---|---|---|
| Corregido en los flujos revisados | Conservación al editar/importar, validación JSON/CSV/Excel, borrados con referencias, undo/redo y fechas | Suite Node: 186 pruebas; ver [guía de validación](../DEVELOPER_GUIDE.md) |
| Mejorado con alcance acotado | Rendimiento de contadores de clientes y diseño móvil | Comparación de HTML y Chromium en cinco anchos; no incorpora paginación ni certifica dispositivos físicos |
| Retirado de alcance | Conflictos, duplicados y concurrencia de Drive | La integración fue eliminada por decisión del usuario; PR #3 no debe incorporarse al modo local |
| Pendiente | Guardado ordinario de formularios ante cuota y carga inicial corrupta | Los mecanismos de recuperación no cubren todas las mutaciones de la aplicación |
| Pendiente | Integridad referencial de JSON/formularios y huérfanos históricos | La validación tabular revisa registros nuevos/modificados; no repara datos antiguos |
| Pendiente | Límites de tamaño, rendimiento de otros módulos y bibliotecas CDN | Sin límites de importación ni paginación/virtualización; revisar SheetJS y disponibilidad del CDN |
| Pendiente | Responsive/accesibilidad entre navegadores y seguridad de renderizado restante | Chromium verificado; no hay certificación completa de Safari/Firefox, lectores de pantalla o ausencia global de XSS |

Las observaciones originales «Equipos sin fecha», «Facturación duplicada», «Dashboard no refresca siempre» y «Exportación PDF mejorable» no incluían pasos ni evidencia para confirmarlas o cerrarlas. Requieren un caso reproducible antes de decidir una corrección. La mejora de contadores no demuestra resuelto todo problema de búsqueda y el ajuste del calendario no certifica todos sus comportamientos.

Para informar un problema: registrar versión/commit, navegador, pasos con datos ficticios, resultado esperado/obtenido y si sucede al recargar. No adjuntar backups de clientes reales ni credenciales a un issue público.
