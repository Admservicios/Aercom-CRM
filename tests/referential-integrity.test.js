// node --test tests/referential-integrity.test.js — sin dependencias ni datos reales.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const routes = [
  ['delClientConfirm', 'clientes', 'C1'], ['delFactConfirm', 'clientes', 'C1'],
  ['deleteEquip', 'equipos', 'E1'], ['delEquipConfirm', 'equipos', 'E1'],
  ['deleteQuote', 'cotizaciones', 'Q1'], ['delQuoteConfirm', 'cotizaciones', 'Q1']
];
const links = {
  clientes: [['equipos', 'clienteId'], ['cotizaciones', 'clienteId'],
    ['pedidos', 'clienteId'], ['recordatorios', 'clienteId'], ['eventos', 'clienteId'],
    ['facturacion_estados', null]],
  equipos: [['cotizaciones', 'equipoId'], ['pedidos', 'equipoId']],
  cotizaciones: [['pedidos', 'cotizacionId']]
};
function fixture() {
  let saves = 0;
  const confirmations = [], messages = [], renders = [];
  const c = vm.createContext({
    D: { clientes: [{ id: 'C1', nombre: 'Cliente' }], equipos: [{ id: 'E1' }],
      cotizaciones: [{ id: 'Q1' }], pedidos: [], recordatorios: [], eventos: [],
      facturacion_estados: {} },
    persist() { saves++; }, closeModal() {},
    confirmDel(label, callback) { confirmations.push(callback); },
    toast(message) { messages.push(message); }, clientName() { return 'Cliente'; }
  });
  for (const file of ['js/utils.js', ...['clientes', 'equipos', 'cotizaciones', 'facturacion']
    .map(name => `js/modules/${name}.js`)]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), c);
  }
  for (const name of ['renderClientes', 'renderEquipos', 'renderModule', 'renderPipeline', 'renderFacturacion']) {
    c[name] = () => renders.push(name);
  }
  function link(collection, key, id) {
    if (!key) c.D.facturacion_estados['2026-10'] = { [id]: 'Pendiente' };
    else c.D[collection].push({ id: 'linked', [key]: id, estado: 'Finalizado' });
  }
  return { c, confirmations, messages, renders, link, saves: () => saves };
}

for (const [fn, collection, id] of routes) {
  for (const [related, key] of links[collection]) {
    test(`${fn}: bloquea ${related} sin guardar ni modificar datos`, () => {
      const f = fixture();
      f.link(related, key, id);
      const before = JSON.stringify(f.c.D);
      f.c[fn](id);
      assert.equal(JSON.stringify(f.c.D), before);
      assert.equal(f.confirmations.length, 0);
      assert.equal(f.saves(), 0);
      assert.match(f.messages[0], /No se puede eliminar/);
    });
  }
  test(`${fn}: sin dependencias elimina solo el registro confirmado`, () => {
    const f = fixture();
    f.c.D[collection].push({ id: 'otro' });
    const expected = JSON.parse(JSON.stringify(f.c.D));
    expected[collection] = [{ id: 'otro' }];
    f.c[fn](id);
    assert.equal(f.saves(), 0);
    assert.equal(f.confirmations.length, 1);
    f.confirmations[0]();
    assert.equal(JSON.stringify(f.c.D), JSON.stringify(expected));
    assert.equal(f.saves(), 1);
    assert.equal(f.renders.length, 1);
  });
  test(`${fn}: revalida referencias agregadas mientras se confirma`, () => {
    const f = fixture();
    f.c[fn](id);
    f.link(...links[collection][0], id);
    const before = JSON.stringify(f.c.D);
    f.confirmations[0]();
    assert.equal(JSON.stringify(f.c.D), before);
    assert.equal(f.saves(), 0);
    assert.equal(f.renders.length, 0);
  });
  test(`${fn}: ignora un registro ausente incluso al confirmar`, () => {
    const f = fixture();
    f.c[fn]('ausente');
    assert.equal(f.confirmations.length, 0);
    f.c[fn](id);
    f.c.D[collection] = [];
    f.confirmations[0]();
    assert.equal(f.saves(), 0);
    assert.equal(f.messages.length, 0);
  });
}

test('El bloqueo informa todas las relaciones e incluye meses excluidos', () => {
  const f = fixture();
  f.link('eventos', 'clienteId', 'C1');
  f.c.D.facturacion_estados = { '2026-09': { C1: 'Excluido' }, '2026-10': { C1: 'Cobrado' } };
  f.c.delClientConfirm('C1');
  assert.match(f.messages[0], /1 eventos de calendario/);
  assert.match(f.messages[0], /2 meses de facturación/);
});

test('Relaciones de otro registro y colecciones opcionales ausentes permiten borrar', () => {
  const f = fixture();
  delete f.c.D.pedidos;
  delete f.c.D.eventos;
  delete f.c.D.facturacion_estados;
  f.link('equipos', 'clienteId', 'C2');
  f.c.delClientConfirm('C1');
  f.confirmations[0]();
  assert.equal(f.c.D.clientes.length, 0);
  assert.equal(f.saves(), 1);
});
