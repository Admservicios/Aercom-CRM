// Ejecutar: node --test tests/security-rendering.test.js
// Solo módulos nativos de Node; DOM y Drive no se conectan ni persisten datos.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const payload = '<img src=x onerror="globalThis.injected=1"> & á';
const attribute = '\" autofocus onfocus="globalThis.injected=1';

function fixture() {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {
      innerHTML: '', textContent: '', style: {},
      classList: { add() {}, remove() {} }, querySelectorAll: () => []
    });
    return nodes.get(id);
  };
  const client = { id: 'C001', nombre: 'Clínica & "Sol"', tipo: 'Clínica',
    frecuenciaVisita: 'Mensual', estadoCliente: 'Activo' };
  const context = vm.createContext({
    D: { clientes: [client], equipos: [], cotizaciones: [], pedidos: [],
      recordatorios: [], facturacion_estados: {} },
    document: { getElementById: node, querySelectorAll: () => [] },
    curMonth: '2026-10', E_COLOR: {},
    equipStatus: () => ({ st: 'verde', nextAceite: null, nextBateria: null }),
    clientCritical: () => false, clientName: () => client.nombre,
    FileReader: class { readAsText(text) { this.onload({ target: { result: text } }); } },
    toast() {}, updateSidebarBadges() {}
  });
  for (const file of ['js/utils.js', 'js/modal.js', 'js/modules/equipos.js',
    'js/modules/clientes.js', 'js/modules/csv.js', 'js/modules/reportes.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  return { context, node, client };
}

function escaped(context, value) { return context._esc(value); }

test('CSV: preview y conflictos muestran texto, sin mutar los datos', () => {
  const { context: c, node, client } = fixture();
  client.nombre = payload;
  const before = JSON.stringify(c.D);
  vm.runInContext("csvModule='clientes'", c);
  c.csvFileSelected({ target: { files: ['nombre\n' + payload.replace(/"/g, '')] } });
  assert.ok(!node('csv-preview').innerHTML.includes('<img'));
  assert.ok(node('csv-preview').innerHTML.includes('&lt;img'));
  // Un conflicto debe usar exactamente el nombre ya existente.
  client.nombre = '<b>Clínica & Sol</b>';
  c.csvFileSelected({ target: { files: ['nombre\n' + client.nombre] } });
  assert.ok(node('csv-conflict').innerHTML.includes(escaped(c, client.nombre)));
  assert.ok(!node('csv-conflict').innerHTML.includes('<b>'));
  client.nombre = payload;
  assert.equal(JSON.stringify(c.D), before);
});

test('Clientes: ID, tipo, frecuencia y estado se escapan en el listado', () => {
  const { context: c, node, client } = fixture();
  Object.assign(client, { id: payload, tipo: payload, frecuenciaVisita: payload, estadoCliente: payload });
  const before = JSON.stringify(c.D);
  c.renderClientes();
  assert.ok(!node('cli-tbody').innerHTML.includes('<img'));
  assert.ok(node('cli-tbody').innerHTML.includes(escaped(c, payload)));
  assert.equal(JSON.stringify(c.D), before);
});

test('Clientes: atributos y entidades literales no se reinterpretan', () => {
  const { context: c, node, client } = fixture();
  Object.assign(client, { id: attribute, nombre: 'Clínica &quot;Sol&quot; & <Norte>' });
  c.openClientModal(client.id);
  assert.ok(node('modal-body').innerHTML.includes('value="' + escaped(c, attribute) + '"'));
  assert.ok(node('modal-body').innerHTML.includes(escaped(c, client.nombre)));
  assert.ok(!node('modal-body').innerHTML.includes('value="' + attribute + '"'));
});

test('Ficha: datos de facturación y editor conservan texto y markup propio', () => {
  const { context: c, node, client } = fixture();
  Object.assign(client, { tipoAbono: payload, monedaAbono: payload, adjOtros: payload,
    codigoServicio: attribute, textoFactura: '</textarea>' + payload,
    mesesFacturacion: [payload], cantidadAbono: attribute });
  const html = c.fichaFacturacion(client);
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes(escaped(c, payload)));
  assert.ok(html.includes('class="ficha-field"'));
  vm.runInContext("fichaClientId=D.clientes[0].id", c);
  c.fichaFacturacionEditMode();
  assert.ok(!node('ficha-body').innerHTML.includes('</textarea><img'));
  assert.ok(node('ficha-body').innerHTML.includes(escaped(c, client.textoFactura)));
  assert.ok(node('ficha-body').innerHTML.includes(escaped(c, attribute)));
});

test('Equipos: tipo, option de cliente y atributos importados se escapan', () => {
  const { context: c, node, client } = fixture();
  client.id = attribute;
  c.D.equipos.push({ id: 'EQ1', clienteId: client.id, tipo: payload,
    proximoPreventivo: attribute, proximoAceite: attribute, horometro: attribute });
  c.renderEquipos();
  assert.ok(!node('equip-tbody').innerHTML.includes('<img'));
  c.openEquipModal('EQ1');
  assert.ok(node('modal-body').innerHTML.includes('value="' + escaped(c, attribute) + '"'));
  assert.ok(!node('modal-body').innerHTML.includes('value="' + attribute + '"'));
});

test('Reporte: el tipo no cierra script; etiquetas del gráfico conservan el valor', () => {
  const { context: c } = fixture();
  const type = '</ScRiPt><img src=x onerror="globalThis.injected=1"> & á';
  c.D.equipos.push({ id: 'EQ1', clienteId: 'C001', tipo: type, proximoPreventivo: '2000-01-01' });
  let html;
  c.window = { open: () => ({ document: { write(s) { html = s; }, close() {} }, focus() {} }) };
  c.generarReporteVencimientos();
  assert.ok(!html.includes(type));
  assert.ok(html.includes(escaped(c, type)));
  const script = html.match(/<script>\s*([\s\S]*?)<\/script>/i)[1];
  assert.ok(!/<\/script/i.test(script));
  const charts = [];
  vm.runInNewContext(script, {
    document: { getElementById: id => id },
    Chart: function (canvas, config) { charts.push(config); }
  });
  assert.equal(charts.length, 2);
  assert.equal(charts[1].data.labels[0], type);
});

test('Renderizar listados, formularios y reporte no altera el estado', () => {
  const { context: c, client } = fixture();
  c.D.equipos.push({ id: 'EQ1', tipo: 'Grupo Electrógeno', clienteId: client.id,
    ultimoPreventivo: '2026-01-15', proximoPreventivo: '2027-01-15', horometro: 125 });
  c.window = { open: () => ({ document: { write() {}, close() {} }, focus() {} }) };
  const before = JSON.stringify(c.D);
  c.renderClientes();
  c.openClientModal(client.id);
  c.openFicha(client.id);
  c.renderEquipos();
  c.openEquipModal('EQ1');
  c.generarReporteVencimientos();
  assert.equal(JSON.stringify(c.D), before);
});
