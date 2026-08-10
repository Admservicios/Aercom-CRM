/**
 * ============================================================
 * AERCOM CRM v2
 * Configuración Global
 * Versión: 2.1.0
 * ============================================================
 */

const CONFIG = {

    app: {
        name: "AERCOM CRM",
        version: "2.1.0",
        company: "Aercom S.A."
    },

    storage: {
        key: "aercom-data"
    },

    ui: {
        animationTime: 200,
        toastTime: 3000
    },

    debug: true

};

/**
 * Log controlado por Debug
 */
function debugLog(...msg) {

    if (CONFIG.debug) {
        console.log(...msg);
    }

}

/**
 * Punto de entrada del módulo Config para app.js.
 * Placeholder inerte: no modifica CONFIG ni datos del CRM.
 * Queda preparado para recibir lógica real de configuración
 * (ej. carga de settings externos) en un sprint posterior.
 */
function loadConfig() {

    debugLog("Config module cargado (placeholder — preparado para refactor)");

}

/**
 * Información del sistema
 */
function appInfo() {

    debugLog(`
==========================================
${CONFIG.app.name}
Versión ${CONFIG.app.version}
${CONFIG.app.company}
==========================================
`);

}
