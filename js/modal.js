/**
 * ============================================================
 * AERCOM CRM v2
 * Modal Manager
 * ============================================================
 */

function initializeModals() {

    debugLog("Sistema de modales iniciado");

}

/**
 * Abrir modal
 */
function openModal(id) {

    const modal = document.getElementById(id);

    if (!modal) return;

    modal.classList.remove("hidden");

}

/**
 * Cerrar modal
 *
 * NOTA: renombrada de `closeModal` a `_closeModalById` (PR-007.2).
 * `index.html` ya declara su propio `closeModal()` (sin argumento)
 * para el modal real de la app (#modal-overlay). Al compartir
 * nombre y scope global, la declaración de este archivo — cargado
 * después via <script src> — pisaba a la de index.html, dejando
 * `closeModal()` inservible en todos los módulos (mismo patrón que
 * ya se resolvió en js/storage.js con `_persistBase()`). Ningún
 * llamado real en el proyecto invoca esta función con un `id`
 * (búsqueda confirmó cero usos de `closeModal(id)`/`openModal(id)`
 * con argumento), así que el renombre no cambia comportamiento
 * observable — solo libera el nombre global `closeModal` para la
 * única implementación que la app realmente usa.
 */
function _closeModalById(id) {

    const modal = document.getElementById(id);

    if (!modal) return;

    modal.classList.add("hidden");

}
