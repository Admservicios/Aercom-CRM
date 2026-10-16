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

    const legacy = D.facturacion_clientes && D.facturacion_clientes.length;
    D = _normalizeData(D);
    if (legacy) localStorage.setItem(STORAGE_KEY, JSON.stringify(D));

}

/** Normalización existente compartida por el arranque y los backups validados. */
function _normalizeData(data) {
    if (!data.facturacion_estados) data.facturacion_estados = {};
    if (!data.recordatorios) data.recordatorios = [];

    // Validar integridad de arrays (evitar crashes con datos corruptos)
    if (!Array.isArray(data.clientes)) data.clientes = [];
    if (!Array.isArray(data.equipos)) data.equipos = [];
    if (!Array.isArray(data.cotizaciones)) data.cotizaciones = [];
    if (!Array.isArray(data.recordatorios)) data.recordatorios = [];

    // Migrar facturacion_clientes → data.clientes (retrocompatibilidad)
    if (data.facturacion_clientes && data.facturacion_clientes.length) {
        const factMap = {};
        data.facturacion_clientes.forEach(fc => {
            const c = data.clientes.find(cl => cl.nombre === fc.nombre);
            if (c) {
                if (!c.ajuste) c.ajuste = fc.ajuste || "IPC";
                if (c.requiereOC === undefined) c.requiereOC = !!fc.requiereOC;
                if (c.requiereHES === undefined) c.requiereHES = !!fc.requiereHES;
                if (!c.facturacion) c.facturacion = fc.facturacion || "Manual";
                factMap[fc.id] = c.id;
            }
        });
        Object.keys(data.facturacion_estados).forEach(month => {
            const old = data.facturacion_estados[month];
            const updated = {};
            Object.keys(old).forEach(fid => { updated[factMap[fid] || fid] = old[fid]; });
            data.facturacion_estados[month] = updated;
        });
        delete data.facturacion_clientes;
    }

    data.clientes.forEach(c => {
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
    data.cotizaciones.forEach(c => { if (_sm[c.estado]) c.estado = _sm[c.estado]; });

    if (!data.pedidos) data.pedidos = [];
    if (!data.eventos) data.eventos = [];

    return data;
}

/**
 * JSON de backup: validar una copia antes de tocar D o localStorage.
 * Se conservan campos adicionales y valores de catálogos históricos.
 * No resuelve referencias huérfanas ni conflictos entre dispositivos.
 */
function _parseImportedData(text) {
    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error("El archivo no contiene JSON válido."); }
    const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
    if (!object(data)) throw new Error("La raíz del backup debe ser un objeto.");
    const strings = new Set([
        'id', 'nombre', 'tipo', 'clienteId', 'equipoId', 'cotizacionId', 'descripcion',
        'observaciones', 'notas', 'contacto', 'telefono', 'email', 'ciudad', 'estadoCliente',
        'prioridad', 'frecuenciaVisita', 'ajuste', 'facturacion', 'tipoAbono', 'codigoServicio',
        'descripcionServicio', 'monedaAbono', 'nroOC', 'nroPresupuesto', 'otraReferencia',
        'textoFactura', 'adjOtros', 'incluyeOtro', 'estado', 'titulo', 'fechaHora',
        'fechaSolicitud', 'fechaProgramada', 'fechaARealizar', 'fechaRealizado', 'fechaEnvio', 'fechaFollowup',
        'fechaFactura', 'tecnico', 'detalle', 'responsable', 'nroFactura', 'marca', 'ubicacion',
        'ultimoPreventivo', 'proximoPreventivo', 'ultimoAceite', 'proximoAceite',
        'ultimoBateria', 'proximoBateria', 'ultimoRefrigerante', 'ultimaVisita', 'proximaVisita',
        'vigenciaDesde', 'vigenciaHasta', 'fecha', 'hora'
    ]);
    const numbers = new Set(['presupuesto', 'monto', 'horometro', 'facturacionDia',
        'precioAbono', 'cantidadAbono', 'descuentoAbono']);
    const booleans = new Set(['critico', 'requiereOC', 'requiereHES', 'requiereHJS',
        'requierePeriodo', 'enviarEmail', 'adjPresupuesto', 'adjOC', 'adjHJS', 'incluyeNS',
        'incluyePreventivo', 'incluyeCombustible', 'incluyePlataforma', 'incluyeBateria']);
    const dates = new Set(['fechaSolicitud', 'fechaProgramada', 'fechaARealizar',
        'fechaRealizado', 'fechaEnvio', 'fechaFollowup', 'fechaFactura', 'ultimoPreventivo',
        'proximoPreventivo', 'ultimoAceite', 'proximoAceite', 'ultimoBateria', 'proximoBateria',
        'ultimoRefrigerante', 'ultimaVisita', 'proximaVisita', 'vigenciaDesde', 'vigenciaHasta', 'fecha']);
    const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
    const required = ['clientes', 'equipos', 'cotizaciones'];
    const collections = [...required, 'recordatorios', 'pedidos', 'eventos', 'facturacion_clientes'];
    for (const key of collections) {
        if (!required.includes(key) && data[key] == null) continue;
        if (!Array.isArray(data[key])) throw new Error(`${key} debe ser una lista.`);
        const ids = new Set();
        data[key].forEach((record, index) => {
            const location = `${key}[${index}]`;
            if (!object(record)) throw new Error(`${location} debe ser un objeto.`);
            if (typeof record.id !== 'string' || !record.id.trim()) {
                throw new Error(`${location} necesita un ID de texto no vacío.`);
            }
            if (['__proto__', 'constructor', 'prototype'].includes(record.id) || ids.has(record.id)) {
                throw new Error(`${location} tiene un ID duplicado o reservado.`);
            }
            ids.add(record.id);
            if (key === 'clientes' && (typeof record.nombre !== 'string' || !record.nombre.trim())) {
                throw new Error(`${location} necesita un nombre de texto no vacío.`);
            }
            if (key === 'recordatorios' && typeof record.titulo !== 'string') {
                throw new Error(`${location} necesita un título de texto.`);
            }
            for (const [field, value] of Object.entries(record)) {
                if (value == null) continue;
                if ((strings.has(field) && typeof value !== 'string') ||
                    (numbers.has(field) && (typeof value !== 'number' || !Number.isFinite(value))) ||
                    (booleans.has(field) && typeof value !== 'boolean')) {
                    throw new Error(`${location}.${field} tiene un tipo incompatible.`);
                }
                if (field === 'mesesFacturacion' &&
                    (!Array.isArray(value) || value.some(month => typeof month !== 'string'))) {
                    throw new Error(`${location}.mesesFacturacion debe ser una lista de textos.`);
                }
                if (value !== '' && ((dates.has(field) && !validDate(value)) ||
                    (field === 'fechaHora' && (!validDate(value.slice(0, 10)) ||
                    !Number.isFinite(Date.parse(value)))))) {
                    throw new Error(`${location}.${field} contiene una fecha inválida.`);
                }
            }
        });
    }
    if (data.lastSaved != null && data.lastSaved !== '' && !validDate(data.lastSaved)) {
        throw new Error("lastSaved debe ser una fecha YYYY-MM-DD válida.");
    }
    if (data.facturacion_estados != null) {
        if (!object(data.facturacion_estados)) throw new Error("facturacion_estados debe ser un objeto.");
        for (const states of Object.values(data.facturacion_estados)) {
            if (!object(states) || Object.values(states).some(state => typeof state !== 'string')) {
                throw new Error("Cada mes de facturación debe contener estados de texto por cliente.");
            }
        }
    }
    return _normalizeData(data);
}

/** Reemplazo con recuperación de datos e historial ante errores de render o guardado. */
function _applyImportedData(candidate, save) {
    const previous = D;
    const stored = localStorage.getItem(STORAGE_KEY);
    const history = typeof _history === 'undefined' ? null : _history.slice();
    const future = typeof _future === 'undefined' ? null : _future.slice();
    try {
        D = candidate;
        // Render antes de persistir: un fallo no debe guardar datos incompatibles.
        renderModule();
        updateSidebarBadges();
        save();
    } catch (error) {
        D = previous;
        if (history) _history.splice(0, _history.length, ...history);
        if (future) _future.splice(0, _future.length, ...future);
        let restored = true;
        try {
            if (localStorage.getItem(STORAGE_KEY) !== stored) {
                if (stored === null) localStorage.removeItem(STORAGE_KEY);
                else localStorage.setItem(STORAGE_KEY, stored);
            }
        } catch { restored = false; }
        try { renderModule(); updateSidebarBadges(); } catch { /* conservar D aunque falle la interfaz */ }
        if (!restored) throw new Error("No se pudo restaurar la copia local; exportá los datos en memoria antes de recargar.");
        throw error;
    }
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
 * Restaura un backup manual tras validarlo. Mantiene el decorador persist()
 * y recupera la copia anterior si falla el render o el guardado.
 */
function importData(ev) {

    const f = ev.target.files[0];
    if (!f) return;

    const r = new FileReader();

    r.onload = e => {
        try {
            const candidate = _parseImportedData(e.target.result);
            _applyImportedData(candidate, () => persist());
            toast("Datos importados correctamente");
        } catch (error) {
            toast("⚠ Importación rechazada: " + error.message);
        }
        ev.target.value = "";
    };

    r.onerror = () => {
        toast("⚠ No se pudo leer el archivo. Los datos actuales se conservan.");
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
