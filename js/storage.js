/**
 * ============================================================
 * AERCOM CRM v2
 * Storage Manager
 * Versión: 2.1.0
 * ============================================================
 */

const STORAGE_KEY = "aercom-data";
// Última copia confirmada en esta pestaña: recuperación si no se puede leer storage.
let _lastSavedSnapshot = null;
// Un arranque rechazado nunca habilita edición ni sincronización con semillas.
let _storageLoadError = null;
let _storageRecoveryExported = false;
let _storageRecoveryBusy = false;

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
 * Valida una copia antes de asignar D. Solo la ausencia de la clave
 * permite usar DEFAULT. La normalización/migración se hace en memoria:
 * el inicio no sobrescribe el original ni requiere cuota para escribir.
 * Devuelve false ante datos incompatibles o almacenamiento inaccesible.
 */
function loadData() {

    let raw = null;
    _storageRecoveryExported = false;
    try {
        raw = localStorage.getItem(STORAGE_KEY);
        const candidate = _parseImportedData(raw === null ? JSON.stringify(DEFAULT) : raw);
        const snapshot = JSON.stringify(candidate);
        D = candidate;
        _lastSavedSnapshot = snapshot;
        _storageLoadError = null;
        return true;
    } catch (error) {
        _lastSavedSnapshot = null;
        _storageLoadError = { raw, reason: error.message };
        return false;
    }
}

function _assertStorageReady() {
    if (_storageLoadError) throw new Error("El inicio está bloqueado para proteger la copia local.");
}

/** Pantalla bloqueante: no interpretar el original como HTML ni como un backup válido. */
function _showStorageRecovery() {
    const dialog = document.getElementById('storage-recovery');
    const readable = _storageLoadError.raw !== null;
    document.getElementById('storage-recovery-message').textContent = readable
        ? 'La copia local contiene datos dañados o incompatibles. No se reemplazó por datos de ejemplo. Descargá el original y conservá una copia antes de revisarlo.'
        : 'El navegador no permite leer el almacenamiento local. No se cargaron datos de ejemplo. Revisá los permisos del sitio y reintentá; no borres los datos del navegador.';
    document.getElementById('storage-recovery-download').disabled = !readable;
    document.getElementById('storage-recovery-restore').disabled = !readable;
    document.getElementById('storage-recovery-repair').disabled = !readable;
    document.getElementById('storage-recovery-detail').textContent = readable
        ? 'Detalle: ' + _storageLoadError.reason : '';
    dialog.addEventListener('cancel', event => event.preventDefault());
    dialog.showModal();
    document.getElementById('storage-recovery-retry').focus();
}

function _downloadStorageOriginal() {
    if (!_storageLoadError || _storageLoadError.raw === null) return;
    const status = document.getElementById('storage-recovery-status');
    let url;
    try {
        const blob = new Blob([_storageLoadError.raw], { type: 'text/plain;charset=utf-8' });
        url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'aercom-data-original.txt';
        link.click();
        _storageRecoveryExported = true;
        status.textContent = 'Descarga solicitada. Verificá el archivo antes de revisar la copia local. El CRM sigue bloqueado.';
    } catch {
        status.textContent = 'No se pudo iniciar la descarga. La copia local sigue intacta; no borres los datos del navegador.';
    } finally {
        if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}

/** Reemplazo explícito desde recuperación; no inferir ni reparar relaciones. */
function _restoreStorageBackup(text, session) {
    if (!session || session !== _storageLoadError || session.raw === null) {
        throw new Error('La recuperación ya no corresponde a la copia actual. Reintentá la carga.');
    }
    const candidate = _parseImportedData(text);
    const serialized = JSON.stringify(candidate);
    if (localStorage.getItem(STORAGE_KEY) !== session.raw) {
        throw new Error('La copia local cambió desde otra pestaña. No se reemplazó; reintentá la carga.');
    }
    // setItem es atómico: si falla por cuota/permisos conserva la cadena anterior.
    localStorage.setItem(STORAGE_KEY, serialized);
}

function _importStorageRecovery(ev) {
    const input = ev.target, file = input.files[0];
    const status = document.getElementById('storage-recovery-status');
    if (!file || _storageRecoveryBusy) { input.value = ''; return; }
    if (!_storageRecoveryExported || !document.getElementById('storage-recovery-backed-up').checked) {
        status.textContent = 'Primero descargá el original y confirmá que guardaste la copia.';
        input.value = '';
        return;
    }
    const session = _storageLoadError;
    const reader = new FileReader();
    _storageRecoveryBusy = true;
    const finish = () => { _storageRecoveryBusy = false; input.value = ''; };
    reader.onload = event => {
        let restored = false;
        try {
            // Validar antes de pedir confirmación; validar de nuevo al aplicar.
            const candidate = _parseImportedData(event.target.result);
            const counts = ['clientes', 'equipos', 'cotizaciones'].map(key => `${candidate[key].length} ${key}`).join(', ');
            if (!window.confirm(`La copia seleccionada contiene ${counts}. Se reemplazará toda la copia local, no se fusionarán registros. ¿Restaurar y recargar el CRM?`)) return;
            _restoreStorageBackup(event.target.result, session);
            restored = true;
            status.textContent = 'Copia restaurada. Recargando el CRM con los datos locales.';
        } catch (error) {
            status.textContent = 'No se restauró la copia: ' + error.message;
        } finally { finish(); }
        if (restored) {
            try { location.reload(); }
            catch { status.textContent = 'La copia se restauró. Recargá el CRM manualmente para cargar los datos.'; }
        }
    };
    reader.onerror = () => { status.textContent = 'No se pudo leer el archivo. La copia local se conserva.'; finish(); };
    reader.onabort = () => { status.textContent = 'Lectura cancelada. La copia local se conserva.'; finish(); };
    try { reader.readAsText(file); }
    catch { status.textContent = 'No se pudo leer el archivo. La copia local se conserva.'; finish(); }
}

/** Plan de datos revisado, nunca código: solo separar IDs duplicados y sus referencias. */
async function _prepareStorageBranchRepair(raw, plan) {
    if (!plan || Object.keys(plan).sort().join(',') !== 'clientes,referencias,sha256' ||
        typeof plan.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(plan.sha256) || !Array.isArray(plan.clientes) ||
        !plan.clientes.length || !Array.isArray(plan.referencias)) {
        throw new Error('El plan de corrección no tiene el formato esperado.');
    }
    if (!globalThis.crypto?.subtle || typeof TextEncoder === 'undefined') {
        throw new Error('El navegador no permite verificar la copia. Abrí el CRM mediante HTTPS en un navegador actualizado.');
    }
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    if (hash !== plan.sha256) throw new Error('La copia no coincide con la revisada. No se aplicó el plan; hace falta revisar la copia actual.');
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.clientes)) throw new Error('La copia no contiene una lista de clientes.');
    const targets = new Map(), oldIds = new Set();
    for (const row of plan.clientes) {
        if (!Array.isArray(row) || row.length !== 2 || !Number.isInteger(row[0]) ||
            row[0] < 0 || typeof row[1] !== 'string' || !/^[A-Z0-9][A-Z0-9_-]{0,63}$/.test(row[1]) || targets.has(row[0])) {
            throw new Error('El plan contiene una sucursal o código incompatible.');
        }
        const client = data.clientes[row[0]];
        if (!client || typeof client.id !== 'string' || row[1] === client.id ||
            data.clientes.filter(c => c?.id === client.id).length < 2) {
            throw new Error('El plan solo puede separar códigos de clientes duplicados.');
        }
        targets.set(row[0], { oldId: client.id, newId: row[1] });
        oldIds.add(client.id);
    }
    data.clientes.forEach((client, index) => {
        if (oldIds.has(client?.id) && !targets.has(index)) throw new Error('Falta indicar el código de alguna sucursal del grupo duplicado.');
    });
    if (data.facturacion_clientes?.length || Object.values(data.facturacion_estados || {}).some(states =>
        states && Array.from(oldIds).some(id => Object.prototype.hasOwnProperty.call(states, id)))) {
        throw new Error('Hay facturación asociada que requiere revisión antes de separar sucursales.');
    }
    const collections = ['equipos', 'cotizaciones', 'pedidos', 'recordatorios', 'eventos'];
    const references = new Set();
    for (const row of plan.referencias) {
        if (!Array.isArray(row) || row.length !== 3 || !collections.includes(row[0]) ||
            !Number.isInteger(row[1]) || row[1] < 0 || !targets.has(row[2])) {
            throw new Error('El plan contiene una referencia incompatible.');
        }
        const key = `${row[0]}:${row[1]}`, record = data[row[0]]?.[row[1]], target = targets.get(row[2]);
        if (references.has(key) || !record || record.clienteId !== target.oldId) {
            throw new Error('Una referencia no pertenece al código duplicado o está repetida.');
        }
        references.add(key);
        record.clienteId = target.newId;
    }
    for (const key of collections) {
        if (data[key] != null && !Array.isArray(data[key])) throw new Error('La copia contiene una colección incompatible.');
        (data[key] || []).forEach((record, index) => {
            if (oldIds.has(record?.clienteId) && !references.has(`${key}:${index}`)) {
                throw new Error('Falta asignar una referencia del código duplicado a su sucursal.');
            }
        });
    }
    for (const [index, target] of targets) data.clientes[index].id = target.newId;
    const text = JSON.stringify(data);
    _parseImportedData(text); // Validar otra copia; no normalizar silenciosamente el plan.
    return { text, clients: targets.size, references: references.size };
}

async function _applyStorageBranchRepair() {
    const status = document.getElementById('storage-recovery-status');
    if (_storageRecoveryBusy) return;
    if (!_storageRecoveryExported || !document.getElementById('storage-recovery-backed-up').checked) {
        status.textContent = 'Primero descargá el original y confirmá que guardaste la copia.';
        return;
    }
    const session = _storageLoadError;
    if (!session || session.raw === null) return;
    _storageRecoveryBusy = true;
    let restored = false;
    try {
        const plan = JSON.parse(document.getElementById('storage-recovery-plan').value);
        const prepared = await _prepareStorageBranchRepair(session.raw, plan);
        if (!window.confirm(`Se cambiarán ${prepared.clients} códigos de sucursal y ${prepared.references} asignaciones a clientes, según el plan revisado. No se eliminarán fichas. ¿Aplicar la corrección y recargar?`)) return;
        _restoreStorageBackup(prepared.text, session);
        restored = true;
        status.textContent = 'Corrección guardada. Recargando el CRM con los datos locales.';
    } catch (error) {
        status.textContent = 'No se aplicó la corrección: ' + error.message;
    } finally { _storageRecoveryBusy = false; }
    if (restored) {
        try { location.reload(); }
        catch { status.textContent = 'La corrección se guardó. Recargá el CRM manualmente para cargar los datos.'; }
    }
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
    _assertStorageReady();
    const previous = D;
    const previousSnapshot = _lastSavedSnapshot;
    const stored = localStorage.getItem(STORAGE_KEY);
    const history = typeof _history === 'undefined' ? null : _history.slice();
    const future = typeof _future === 'undefined' ? null : _future.slice();
    try {
        D = candidate;
        // Render antes de persistir: un fallo no debe guardar datos incompatibles.
        renderModule();
        updateSidebarBadges();
        if (save() === false) throw new Error("No se pudo guardar el cambio. Los datos anteriores se conservan.");
        _lastSavedSnapshot = JSON.stringify(D);
    } catch (error) {
        D = previous;
        _lastSavedSnapshot = previousSnapshot;
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
 * (undo/redo) sobre `_persistBase` — esa
 * decoración no es responsabilidad de Storage y permanece donde está.
 * La API pública sigue siendo `persist()` (la función decorada).
 */
function _persistBase() {
    _assertStorageReady();

    D.lastSaved = today();
    const serialized = JSON.stringify(D);

    localStorage.setItem(STORAGE_KEY, serialized);

    document.getElementById("sb-saved").textContent = "Guardado en este navegador ✓";

    markUnsaved();

    updateSidebarBadges();
    _lastSavedSnapshot = serialized;

    // Se ejecuta en una microtarea: ante rollback leerá la copia local recuperada.
    if (typeof scheduleLocalFolderSave === 'function') scheduleLocalFolderSave();

}

/**
 * Descarga `D` como archivo JSON (backup manual). Migrada tal cual
 * desde index.html (Sprint 3).
 */
function exportData() {
    _assertStorageReady();

    D.lastSaved = today();

    const blob = new Blob([JSON.stringify(D, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "aercom-data.json";
    a.click();

    URL.revokeObjectURL(url);

    toast("Se solicitó el respaldo JSON. Verificá el archivo en Descargas.");

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
    _assertStorageReady();

    // Conservar la copia anterior hasta que el reemplazo termine correctamente.
    D = JSON.parse(JSON.stringify(DEFAULT));

    return persist();

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

/** CSV/Excel construyen un lote síncrono sobre una copia; solo se aplica al validar todo. */
function _applyTableImport(build) {
    _assertStorageReady();
    const previous = D;
    let candidate, result;
    try {
        D = JSON.parse(JSON.stringify(previous));
        result = build();
        if (JSON.stringify(D) === JSON.stringify(previous)) return result;
        // Revisar solo registros nuevos/modificados; no reparar huérfanos históricos.
        for (const type of ['clientes', 'equipos', 'cotizaciones']) {
            for (const record of D[type]) {
                const old = previous[type].find(item => item.id === record.id);
                if (old && JSON.stringify(old) === JSON.stringify(record)) continue;
                if (type !== 'clientes' && !D.clientes.some(c => c.id === record.clienteId)) {
                    throw new Error(`${type} ${record.id}: cliente inexistente.`);
                }
                if (type === 'cotizaciones' && typeof ESTADOS !== 'undefined' &&
                    ![...ESTADOS, 'Borrador', 'Enviada'].includes(record.estado)) {
                    throw new Error(`Cotización ${record.id}: estado no reconocido.`);
                }
                if (type === 'cotizaciones' && record.equipoId &&
                    !D.equipos.some(e => e.id === record.equipoId && e.clienteId === record.clienteId)) {
                    throw new Error(`Cotización ${record.id}: equipo inexistente o de otro cliente.`);
                }
                if (old && type === 'equipos' && old.clienteId !== record.clienteId &&
                    [...D.cotizaciones, ...(D.pedidos || [])].some(r => r.equipoId === record.id)) {
                    throw new Error(`Equipo ${record.id}: no se puede reasignar con cotizaciones o pedidos asociados.`);
                }
                if (old && type === 'cotizaciones' &&
                    (old.clienteId !== record.clienteId || old.equipoId !== record.equipoId) &&
                    (D.pedidos || []).some(p => p.cotizacionId === record.id)) {
                    throw new Error(`Cotización ${record.id}: no se puede reasignar con pedidos asociados.`);
                }
            }
        }
        candidate = _parseImportedData(JSON.stringify(D));
    } finally { D = previous; }
    if (JSON.stringify(candidate) === JSON.stringify(previous)) return result;
    _applyImportedData(candidate, persist);
    return result;
}

function _importNumber(value, field) {
    if (!['number', 'string'].includes(typeof value) ||
        (typeof value === 'string' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) ||
        !Number.isFinite(Number(value))) {
        throw new Error(`${field}: se esperaba un número finito con punto decimal.`);
    }
    return Number(value);
}

function _importBoolean(value, field) {
    const text = String(value).trim().toLowerCase();
    if (['true', '1', 'si', 'sí'].includes(text)) return true;
    if (['false', '0', 'no'].includes(text)) return false;
    throw new Error(`${field}: se esperaba SI/NO, true/false o 1/0.`);
}
