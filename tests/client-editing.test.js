// Ejecutar: node --test tests/client-editing.test.js
// Sin dependencias ni persistencia externa: el formulario y el guardado son dobles.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
  const client = {
    id: 'C001', nombre: 'Clínica Sol', tipo: 'Clínica', prioridad: 'Crítico',
    ciudad: 'Rosario', estadoCliente: 'Activo', contacto: 'Ana', telefono: '123',
    email: 'ana@example.com', frecuenciaVisita: 'Mensual', presupuesto: 1000,
    ajuste: 'IPC', requiereOC: true, requiereHES: false,
    facturacion: 'Por fecha', facturacionDia: 20,
    tipoAbono: 'Alquiler', codigoServicio: 'SRV1', descripcionServicio: 'Mantenimiento',
    precioAbono: 0, monedaAbono: 'Dólar divisa', cantidadAbono: 2, descuentoAbono: 0,
    vigenciaDesde: '2026-01-01', vigenciaHasta: null, mesesFacturacion: ['Enero', 'Marzo'],
    nroOC: 'OC1', nroPresupuesto: 'P1', otraReferencia: 'R1', textoFactura: 'Texto & á',
    requiereHJS: true, requierePeriodo: true, enviarEmail: false,
    adjPresupuesto: true, adjOC: true, adjHJS: false, adjOtros: 'Anexo',
    incluyeNS: true, incluyePreventivo: false, incluyeCombustible: true,
    incluyePlataforma: false, incluyeBateria: true, incluyeOtro: 'Inspección',
    campoImportado: { conservar: ['valor', 0, false] }
  };
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { value: '', checked: false, style: {},
      focus() {}, classList: { add() {} }, innerHTML: '' });
    return nodes.get(id);
  };
  const values = { 'cli-id-edit': client.id, 'cli-nombre': client.nombre,
    'cli-tipo': client.tipo, 'cli-ciudad': client.ciudad, 'cli-estado': client.estadoCliente,
    'cli-contacto': client.contacto, 'cli-telefono': client.telefono, 'cli-email': client.email,
    'cli-frecuencia': client.frecuenciaVisita, 'cli-presupuesto': String(client.presupuesto),
    'cli-ajuste': client.ajuste, 'cli-facturacion': client.facturacion, 'cli-fact-dia': '20' };
  for (const [id, value] of Object.entries(values)) node(id).value = value;
  node('cli-oc').checked = client.requiereOC;
  node('cli-hes').checked = client.requiereHES;
  const saves = [];
  const context = vm.createContext({
    D: { clientes: [client], equipos: [{ id: 'EQ1', clienteId: 'C001' }],
      cotizaciones: [{ id: 'Q1', clienteId: 'C001' }],
      pedidos: [{ id: 'P1', clienteId: 'C001' }], recordatorios: [{ id: 'R1', clienteId: 'C001' }],
      facturacion_estados: { '2026-10': { C001: 'Cobrado', C002: 'Pendiente' } } },
    document: { getElementById: node },
    persist() { saves.push(JSON.stringify(context.D)); }, closeModal() {}, toast() {}
  });
  for (const file of ['js/utils.js', 'js/modules/clientes.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
  }
  // El render tiene su propia cobertura; aquí se ejercita saveClient sin DOM real.
  context.renderClientes = () => {};
  return { context, client, node, saves };
}

const copy = value => JSON.parse(JSON.stringify(value));

test('Editar nombre conserva prioridad y todos los campos ajenos al formulario', () => {
  const { context: c, client, node, saves } = fixture();
  const expected = { ...copy(client), nombre: 'Nuevo nombre' };
  node('cli-nombre').value = ' Nuevo nombre ';
  c.saveClient('C001', 'C002');
  assert.deepEqual(copy(c.D.clientes[0]), expected);
  assert.equal(saves.length, 1);
  assert.deepEqual(JSON.parse(saves[0]).clientes[0], expected);
});

test('Los campos editables admiten cambios y valores vacíos o falsos', () => {
  const { context: c, node } = fixture();
  node('cli-ciudad').value = ' Córdoba ';
  node('cli-email').value = '';
  node('cli-presupuesto').value = '0';
  node('cli-oc').checked = false;
  node('cli-hes').checked = true;
  c.saveClient('C001', 'C002');
  const saved = c.D.clientes[0];
  assert.equal(saved.ciudad, 'Córdoba');
  assert.equal(saved.email, '');
  assert.equal(saved.presupuesto, 0);
  assert.equal(saved.requiereOC, false);
  assert.equal(saved.requiereHES, true);
  assert.equal(saved.precioAbono, 0);
  assert.equal(saved.enviarEmail, false);
});

test('Alta conserva los valores predeterminados y no copia datos de otro cliente', () => {
  const { context: c, node, saves } = fixture();
  node('cli-id-edit').value = 'c002';
  node('cli-nombre').value = 'Nuevo';
  node('cli-facturacion').value = 'Manual';
  c.saveClient('', 'C002');
  assert.equal(c.D.clientes.length, 2);
  const added = c.D.clientes[1];
  assert.equal(added.id, 'C002');
  assert.equal(added.prioridad, 'Normal');
  assert.equal(added.incluyeNS, false);
  assert.equal(added.incluyeOtro, '');
  assert.equal(added.facturacionDia, null);
  assert.equal(added.codigoServicio, undefined);
  assert.equal(added.campoImportado, undefined);
  assert.equal(saves.length, 1);
});

test('Renombrar ID conserva los campos y actualiza las referencias existentes', () => {
  const { context: c, client, node } = fixture();
  const expected = { ...copy(client), id: 'C010' };
  node('cli-id-edit').value = 'c010';
  c.saveClient('C001', 'C002');
  assert.equal(c.D.clientes.length, 1);
  assert.deepEqual(copy(c.D.clientes[0]), expected);
  for (const key of ['equipos', 'cotizaciones', 'pedidos', 'recordatorios']) {
    assert.equal(c.D[key][0].clienteId, 'C010');
  }
  assert.deepEqual(copy(c.D.facturacion_estados['2026-10']), { C010: 'Cobrado', C002: 'Pendiente' });
});

test('Un ID duplicado se rechaza sin cambiar ni guardar datos', () => {
  const { context: c, node, saves } = fixture();
  c.D.clientes.push({ id: 'C002', nombre: 'Otro' });
  const before = JSON.stringify(c.D);
  node('cli-id-edit').value = 'c002';
  c.saveClient('C001', 'C003');
  assert.equal(JSON.stringify(c.D), before);
  assert.equal(saves.length, 0);
});

test('Un nombre vacío se rechaza antes de modificar las referencias', () => {
  const { context: c, node, saves } = fixture();
  const before = JSON.stringify(c.D);
  node('cli-nombre').value = '   ';
  node('cli-id-edit').value = 'C010';
  c.saveClient('C001', 'C002');
  assert.equal(JSON.stringify(c.D), before);
  assert.equal(saves.length, 0);
});

test('Una descripción personalizada conserva su valor y día al editar otros datos', () => {
  const { context: c, client, node } = fixture();
  client.facturacion = 'Abono & "especial" <mensual>';
  node('cli-facturacion').value = client.facturacion;
  c.saveClient('C001', 'C002');
  assert.equal(c.D.clientes[0].facturacion, client.facturacion);
  assert.equal(c.D.clientes[0].facturacionDia, 20);
  assert.equal(c.D.clientes[0].descripcionServicio, 'Mantenimiento');
});

test('Cambiar explícitamente la modalidad actualiza o limpia el día correspondiente', () => {
  const { context: c, node } = fixture();
  node('cli-facturacion').value = 'Automática';
  c.saveClient('C001', 'C002');
  assert.equal(c.D.clientes[0].facturacion, 'Automática');
  assert.equal(c.D.clientes[0].facturacionDia, null);
  node('cli-facturacion').value = 'Por fecha';
  node('cli-fact-dia').value = '25';
  c.saveClient('C001', 'C002');
  assert.equal(c.D.clientes[0].facturacionDia, 25);
  assert.equal(c.D.clientes[0].prioridad, 'Crítico');
});

test('El formulario incluye valores previos fuera del catálogo como opciones escapadas', () => {
  const { context: c, client, node } = fixture();
  for (const field of ['tipo', 'estadoCliente', 'frecuenciaVisita', 'ajuste', 'facturacion']) {
    client[field] = field + ' & "<img src=x onerror=alert(1)>"';
  }
  const before = JSON.stringify(c.D);
  c.openClientModal('C001');
  const html = node('modal-body').innerHTML;
  for (const field of ['tipo', 'estadoCliente', 'frecuenciaVisita', 'ajuste', 'facturacion']) {
    const value = c._esc(client[field]);
    assert.ok(html.includes(`<option value="${value}" selected>${value}</option>`));
  }
  assert.ok(!html.includes('<img'));
  assert.equal(JSON.stringify(c.D), before);
});
