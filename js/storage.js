/**
 * ============================================================
 * AERCOM CRM v2
 * Storage Manager
 * Versión: 2.1.0
 * ============================================================
 */

const STORAGE_KEY = "aercom-data";

/**
 * NOTA: la variable global `D` ya es declarada por el script
 * principal de index.html (fuente de verdad de los datos del CRM).
 * No se vuelve a declarar acá para evitar el SyntaxError de
 * "Identifier 'D' has already been declared" (los `let` de nivel
 * superior comparten scope entre todos los <script> del documento).
 * Las funciones de este archivo referencian esa misma `D` global.
 *
 * `DEFAULT` (datos semilla) se mantiene definido en index.html por
 * decisión del Sprint 3 (no era estrictamente necesario moverlo).
 * `today()` proviene de js/utils.js, cargado antes que este archivo.
 */

/**
 * Carga los datos desde LocalStorage a `D`, migrado tal cual desde
 * index.html (Sprint 3). Incluye la migración de retrocompatibilidad
 * de `facturacion_clientes` y la normalización de arrays/objetos
 * obligatorios y de estados de cotización heredados.
 */
function loadData() {

    const s = localStorage.getItem(STORAGE_KEY);

    if (s) {
        try { D = JSON.parse(s); }
        catch { D = JSON.parse(JSON.stringify(DEFAULT)); }
    } else {
        D = JSON.parse(JSON.stringify(DEFAULT));
    }

    if (!D.facturacion_estados) D.facturacion_estados = {};
    if (!D.recordatorios) D.recordatorios = [];

    // Validar integridad de arrays (evitar crashes con datos corruptos)
    if (!Array.isArray(D.clientes)) D.clientes = [];
    if (!Array.isArray(D.equipos)) D.equipos = [];
    if (!Array.isArray(D.cotizaciones)) D.cotizaciones = [];
    if (!Array.isArray(D.recordatorios)) D.recordatorios = [];

    // Migrar facturacion_clientes → D.clientes (retrocompatibilidad)
    if (D.facturacion_clientes && D.facturacion_clientes.length) {
        const factMap = {};
        D.facturacion_clientes.forEach(fc => {
            const c = D.clientes.find(cl => cl.nombre === fc.nombre);
            if (c) {
                if (!c.ajuste) c.ajuste = fc.ajuste || "IPC";
                if (c.requiereOC === undefined) c.requiereOC = !!fc.requiereOC;
                if (c.requiereHES === undefined) c.requiereHES = !!fc.requiereHES;
                if (!c.facturacion) c.facturacion = fc.facturacion || "Manual";
                factMap[fc.id] = c.id;
            }
        });
        Object.keys(D.facturacion_estados).forEach(month => {
            const old = D.facturacion_estados[month];
            const updated = {};
            Object.keys(old).forEach(fid => { updated[factMap[fid] || fid] = old[fid]; });
            D.facturacion_estados[month] = updated;
        });
        delete D.facturacion_clientes;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(D));
    }

    D.clientes.forEach(c => {
        if (!c.prioridad) c.prioridad = c.critico ? "Crítico" : "Normal";
        if (!c.tipo) c.tipo = "Otro";
        if (!c.estadoCliente) c.estadoCliente = "Activo";
        if (!c.ciudad) c.ciudad = "";
        if (!c.email) c.email = "";
        if (!c.frecuenciaVisita) c.frecuenciaVisita = "";
        if (c.presupuesto === undefined) c.presupuesto = 0;
        if (!c.ajuste) c.ajuste = "IPC";
        if (c.requiereOC === undefined) c.requiereOC = false;
        if (c.requiereHES === undefined) c.requiereHES = false;
        if (!c.facturacion) c.facturacion = "Manual";
    });

    const _sm = { "Borrador": "Solicitud", "Enviada": "Enviar" };
    D.cotizaciones.forEach(c => { if (_sm[c.estado]) c.estado = _sm[c.estado]; });

    if (!D.pedidos) D.pedidos = [];
    if (!D.eventos) D.eventos = [];

}

/**
 * Guarda `D` en LocalStorage y refleja el guardado en la UI.
 * Migrada tal cual desde index.html (Sprint 3).
 *
 * Sprint 3.1: renombrada de `persist` a `_persistBase` para eliminar
 * la auto-referencia con el decorador de index.html. Ambos scripts
 * declaraban una función llamada `persist`; dentro del bloque
 * <script> del index.html, la declaración `function persist(){}`
 * del decorador se hoistea ANTES de que se ejecute cualquier línea
 * de ese bloque — incluida `const _origPersist = persist` — así que
 * `_origPersist` terminaba apuntando al propio decorador (llamada
 * recursiva sobre sí mismo, cortada por el guard `_inPersist` antes
 * de llegar al `localStorage.setItem` real). Al no compartir nombre
 * con ninguna función declarada en el bloque inline, `_persistBase`
 * queda inmune a ese hoisting: `_origPersist` ahora captura
 * correctamente esta función. index.html sigue "decorando" el guardado
 * (undo/redo + sincronización con Drive) sobre `_persistBase` — esa
 * decoración no es responsabilidad de Storage y permanece donde está.
 * La API pública sigue siendo `persist()` (la función decorada).
 */
function _persistBase() {

    D.lastSaved = today();

    localStorage.setItem(STORAGE_KEY, JSON.stringify(D));

    document.getElementById("sb-saved").textContent = "Guardado en memoria ✓";

    markUnsaved();

    updateSidebarBadges();

}

/**
 * Descarga `D` como archivo JSON (backup manual). Migrada tal cual
 * desde index.html (Sprint 3).
 */
function exportData() {

    D.lastSaved = today();

    const blob = new Blob([JSON.stringify(D, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "aercom-data.json";
    a.click();

    URL.revokeObjectURL(url);

    toast("aercom-data.json descargado correctamente");

}

/**
 * Restaura `D` desde un archivo JSON (backup manual). Migrada tal
 * cual desde index.html (Sprint 3).
 */
function importData(ev) {

    const f = ev.target.files[0];
    if (!f) return;

    const r = new FileReader();

    r.onload = e => {
        try {
            D = JSON.parse(e.target.result);
            if (!D.facturacion_estados) D.facturacion_estados = {};
            persist();
            renderModule();
            toast("Datos importados correctamente");
        } catch {
            toast("⚠ Error al importar: JSON inválido.");
        }
        ev.target.value = "";
    };

    r.readAsText(f);

}

function resetStorage() {

    localStorage.removeItem(STORAGE_KEY);

    D = JSON.parse(JSON.stringify(DEFAULT));

    persist();

}

/**
 * Punto de entrada del módulo Storage para app.js.
 * Placeholder inerte: no ejecuta loadData() ni toca `D` para no
 * duplicar la inicialización que ya realiza index.html (que llama
 * a loadData() directamente). Queda preparado para cuando el
 * bootstrap de la app se centralice en app.js.
 */
function loadStorage() {

    debugLog("Storage module cargado (placeholder — preparado para refactor)");

}
