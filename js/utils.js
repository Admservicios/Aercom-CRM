/**
 * ============================================================
 * AERCOM CRM v2
 * Utils
 * Versión: 2.1.0
 * ============================================================
 */

/* =========================
   FECHAS
========================= */

function today() {
    return new Date().toISOString().split("T")[0];
}

function nowMonthStr() {
    const d = new Date();

    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function daysDiff(dateString) {

    if (!dateString) return 9999;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const date = new Date(dateString);
    date.setHours(0, 0, 0, 0);

    return Math.round((date - now) / 86400000);

}

function addDays(dateString, days) {

    const d = new Date(dateString);

    d.setDate(d.getDate() + days);

    return d.toISOString().split("T")[0];

}

function addMonths(monthString, months) {

    let [year, month] = monthString.split("-").map(Number);

    month += months;

    while (month > 12) {
        month -= 12;
        year++;
    }

    while (month < 1) {
        month += 12;
        year--;
    }

    return `${year}-${String(month).padStart(2, "0")}`;

}

function fmtDate(dateString) {

    if (!dateString) return "—";

    const [y, m, d] = dateString.split("-");

    return `${d}/${m}/${y}`;

}

function fmtDateTime(dateTime) {

    if (!dateTime) return "—";

    const [date, time] = dateTime.split("T");

    return fmtDate(date) + (time ? ` ${time.substring(0,5)}` : "");

}

function monthLabel(monthString) {

    const MONTHS = [
        "Enero",
        "Febrero",
        "Marzo",
        "Abril",
        "Mayo",
        "Junio",
        "Julio",
        "Agosto",
        "Septiembre",
        "Octubre",
        "Noviembre",
        "Diciembre"
    ];

    const [y, m] = monthString.split("-");

    return `${MONTHS[parseInt(m) - 1]} ${y}`;

}

/* =========================
   FORMATO
========================= */

function fmtMoney(value) {

    if (value === null || value === undefined || value === "") return "—";

    return "$ " + Number(value).toLocaleString("es-AR");

}

/* =========================
   TEXTO
========================= */

function toTitleCase(str) {

    if (!str) return "";

    const SKIP = ["DE", "DEL", "LA", "LAS", "LOS", "Y", "SA", "SRL", "SAS", "S.A.", "S.R.L.", "ARG"];

    return str.toLowerCase().split(" ").map((w, i) => {

        const up = w.toUpperCase();

        if (i > 0 && SKIP.includes(up)) return w.toLowerCase();

        return w.charAt(0).toUpperCase() + w.slice(1);

    }).join(" ");

}

function _esc(s) {

    if (s == null) return "";

    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

}

/* Borrados compartidos: conservar referencias e historial; nunca eliminar en cascada.
 * Lee D y usa toast(), sin modificar datos. Revalidar dentro de confirmDel(). */
function canDeleteRecord(collection, id) {
    if (!(D[collection] || []).some(record => record.id === id)) return false;
    const links = collection === 'clientes'
        ? [['equipos', 'clienteId', 'equipos'], ['cotizaciones', 'clienteId', 'cotizaciones'],
           ['pedidos', 'clienteId', 'pedidos'], ['recordatorios', 'clienteId', 'recordatorios'],
           ['eventos', 'clienteId', 'eventos de calendario']]
        : collection === 'equipos'
            ? [['cotizaciones', 'equipoId', 'cotizaciones'], ['pedidos', 'equipoId', 'pedidos']]
            : collection === 'cotizaciones' ? [['pedidos', 'cotizacionId', 'pedidos']] : [];
    const dependencies = links.flatMap(([key, field, label]) => {
        const count = (D[key] || []).filter(record => record[field] === id).length;
        return count ? [`${count} ${label}`] : [];
    });
    if (collection === 'clientes') {
        const months = Object.values(D.facturacion_estados || {})
            .filter(states => Object.prototype.hasOwnProperty.call(states, id)).length;
        if (months) dependencies.push(`${months} meses de facturación`);
    }
    if (!dependencies.length) return true;
    toast(`⚠ No se puede eliminar: tiene ${dependencies.join(', ')} asociados. Se conserva el historial.`);
    return false;
}
