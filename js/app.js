/**
 * ======================================================
 * AERCOM CRM v2
 * Archivo: app.js
 * Función: Punto de entrada de la aplicación
 * Versión: 2.0.0
 * ======================================================
 */

document.addEventListener("DOMContentLoaded", initApp);

function initApp() {
    console.log("==================================");
    console.log("AERCOM CRM v2");
    console.log("Inicializando aplicación...");
    console.log("==================================");

    loadConfig();
    loadStorage();
    initializeUI();

    console.log("Aplicación iniciada correctamente.");
}
