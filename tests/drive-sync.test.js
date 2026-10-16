// HTTP, revisiones, almacenamiento y DOM simulados; sin acceso a cuentas reales.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const copy = value => JSON.parse(JSON.stringify(value));
const data = name => ({ clientes: [{ id: 'C1', nombre: name }], equipos: [], cotizaciones: [], lastSaved: '2026-10-16' });

function fixture(options = {}) {
  const local = options.local || data('Base');
  const server = options.server || { data: data('Base'), files: [{ id: 'file' }], revision: 1 };
  const memory = options.memory || new Map([['aercom-data', JSON.stringify(local)]]);
  const calls = [];
  const messages = [];
  const status = { pending: false, saved: 0, prompts: 0, active: 0, maxActive: 0 };
  const label = { textContent: '' };
  const control = { noEtag: false, recoveryFailure: false, beforePatch: null, holdMedia: null, holdPatch: null };
  const response = (code, body, tag) => ({ ok: code >= 200 && code < 300, status: code,
    json: async () => body, text: async () => typeof body === 'string' ? body : JSON.stringify(body),
    headers: { get: () => tag || null } });
  const c = vm.createContext({ D: copy(local), crypto: webcrypto, TextEncoder,
    window: {}, console: { error() {} },
    document: { getElementById: id => id === 'sb-saved' ? label : null },
    localStorage: { getItem: key => memory.get(key) ?? null,
      setItem(key, value) {
        if (control.recoveryFailure && key === 'aercom-drive-recovery') throw new Error('Sin espacio');
        memory.set(key, value);
      }, removeItem: key => memory.delete(key) },
    markSaved() { status.saved++; status.pending = false; }, markUnsaved() { status.pending = true; },
    renderModule() {}, updateSidebarBadges() {}, toast: text => messages.push(text),
    setTimeout: () => 1, clearTimeout() {},
    fetch: async (url, request = {}) => {
      calls.push({ url, ...request });
      if (request.method === 'PATCH') {
        status.active++; status.maxActive = Math.max(status.maxActive, status.active);
        try {
          if (control.holdPatch) await control.holdPatch();
          if (control.beforePatch) { control.beforePatch(); control.beforePatch = null; }
          if (request.headers['If-Match'] !== `"r${server.revision}"`) return response(412, {});
          server.data = JSON.parse(request.body); server.revision++;
          return response(204, null);
        } finally { status.active--; }
      }
      if (request.method === 'POST') {
        assert.match(url, /uploadType=multipart/);
        const content = request.body.split('Content-Type: application/json\r\n\r\n')[1].split('\r\n--')[0];
        server.data = JSON.parse(content); server.files = [{ id: 'created' }]; server.revision++;
        if (control.loseCreationResponse) throw new Error('Respuesta perdida tras crear');
        return response(201, { id: 'created' });
      }
      if (url.includes('?alt=media')) {
        const body = copy(server.data);
        const tag = control.noEtag ? null : `"r${server.revision}"`;
        if (control.holdMedia) await control.holdMedia();
        return response(200, body, tag);
      }
      return response(200, { files: copy(server.files) });
    }
  });
  for (const file of ['js/utils.js', 'js/storage.js', 'js/modules/drive.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), c);
  }
  c._gdriveRenderConflict = () => { status.prompts++; };
  vm.runInContext("_gdriveReady=true; _gdriveToken='test'; _folderRootId='root'", c);
  const base = async value => {
    c.signature = await c._gdriveSignature(value);
    vm.runInContext("_gdriveBase={folderId:'root',fileId:'file',signature}", c);
    memory.set('aercom-drive-sync-base', JSON.stringify(vm.runInContext('_gdriveBase', c)));
  };
  const writes = () => calls.filter(call => ['POST', 'PATCH', 'DELETE'].includes(call.method));
  return { c, server, memory, calls, messages, status, label, control, base, writes };
}

test('Copias iguales con distinta fecha/orden de propiedades no generan escritura remota', async () => {
  const f = fixture();
  f.server.data = { cotizaciones: [], equipos: [], clientes: [{ nombre: 'Base', id: 'C1' }], lastSaved: '2099-01-01' };
  assert.equal(await f.c._gdriveSaveData(), true);
  assert.equal(f.writes().length, 0);
  assert.ok(f.memory.has('aercom-drive-sync-base'));
});

test('Sin base conocida, copias distintas del mismo día se conservan y requieren elección', async () => {
  const f = fixture({ local: data('Local') });
  assert.equal(await f.c._gdriveSaveData(), false);
  assert.equal(f.c.D.clientes[0].nombre, 'Local');
  assert.equal(f.server.data.clientes[0].nombre, 'Base');
  assert.equal(f.writes().length, 0);
  const archive = JSON.parse(f.memory.get('aercom-drive-recovery'));
  assert.equal(archive[0].local.clientes[0].nombre, 'Local');
  assert.equal(archive[0].drive.clientes[0].nombre, 'Base');
  assert.equal(f.status.prompts, 1);
  assert.equal(f.status.pending, true);
});

test('Una fecha remota más reciente no decide un conflicto sin base', async () => {
  const f = fixture({ local: data('Local') });
  f.server.data.lastSaved = '2099-01-01';
  await f.c._gdriveLoadData();
  assert.equal(f.c.D.clientes[0].nombre, 'Local');
  assert.equal(f.status.prompts, 1);
});

test('Solo cambió la copia local: PATCH con If-Match de la revisión leída', async () => {
  const f = fixture({ local: data('Local') });
  await f.base(data('Base'));
  assert.equal(await f.c._gdriveSaveData(), true);
  assert.equal(f.server.data.clientes[0].nombre, 'Local');
  assert.equal(f.writes()[0].headers['If-Match'], '"r1"');
});

test('Solo cambió Drive: se actualiza la copia local sin subir datos', async () => {
  const f = fixture(); await f.base(data('Base'));
  f.server.data = data('Remoto');
  assert.equal(await f.c._gdriveLoadData(), true);
  assert.equal(f.c.D.clientes[0].nombre, 'Remoto');
  assert.equal(f.writes().length, 0);
});

test('Ambos cambiaron respecto de la base: no prevalece ninguno automáticamente', async () => {
  const f = fixture({ local: data('Local') }); await f.base(data('Base'));
  f.server.data = data('Remoto');
  await f.c._gdriveSaveData();
  assert.equal(f.writes().length, 0);
  assert.equal(f.status.prompts, 1);
});

test('Backups duplicados se detectan sin descargar uno arbitrario ni eliminar archivos', async () => {
  const f = fixture(); f.server.files.push({ id: 'other' });
  assert.equal(await f.c._gdriveSaveData(), false);
  assert.equal(f.calls.length, 1);
  assert.equal(f.writes().length, 0);
});

test('Carpetas duplicadas también detienen la preparación', async () => {
  const f = fixture(); f.server.files.push({ id: 'other' });
  await assert.rejects(f.c._gdriveGetOrCreateFolder('Aercom Gestion', null), /varios/);
  assert.equal(f.writes().length, 0);
});

test('Sin backup previo, se crea un único archivo con contenido completo', async () => {
  const f = fixture(); f.server.files = [];
  assert.equal(await f.c._gdriveSaveData(), true);
  assert.equal(f.writes().length, 1);
  assert.match(f.writes()[0].url, /multipart/);
  assert.equal(f.server.data.clientes[0].nombre, 'Base');
});

test('Reconexión automática concilia el backup existente antes de guardar', async () => {
  const f = fixture(); let callback;
  f.c._loadGIS = async () => {};
  f.c._gdriveEnsureFolders = async () => vm.runInContext("_folderRootId='root'", f.c);
  f.c.google = { accounts: { oauth2: { initTokenClient(options) {
    callback = options.callback; return { requestAccessToken() {} };
  } } } };
  await f.c._tryAutoConnectDrive(); await callback({ access_token: 'test' });
  assert.equal(vm.runInContext('_gdriveDataFileId', f.c), 'file');
  assert.equal(f.writes().length, 0);
});

test('Las subidas solicitadas durante otra se serializan y conservan la edición más nueva', async () => {
  const f = fixture({ local: data('Primera') }); await f.base(data('Base'));
  let release;
  f.control.holdPatch = () => new Promise(resolve => { release = resolve; });
  const first = f.c._gdriveSaveData();
  while (!release) await new Promise(resolve => setImmediate(resolve));
  f.c.D.clientes[0].nombre = 'Segunda';
  const second = f.c._gdriveSaveData();
  f.control.holdPatch = null; release();
  await Promise.all([first, second]);
  assert.equal(f.server.data.clientes[0].nombre, 'Segunda');
  assert.equal(f.status.maxActive, 1);
  assert.equal(f.writes().length, 2);
});

test('Si Drive cambia entre lectura y PATCH, 412 abre conflicto sin sobrescribirlo', async () => {
  const f = fixture({ local: data('Local') }); await f.base(data('Base'));
  f.control.beforePatch = () => { f.server.data = data('Cambio concurrente'); f.server.revision++; };
  assert.equal(await f.c._gdriveSaveData(), false);
  assert.equal(f.server.data.clientes[0].nombre, 'Cambio concurrente');
  assert.equal(f.c.D.clientes[0].nombre, 'Local');
  assert.equal(f.status.prompts, 1);
});

test('Sin ETag no se intenta una sobrescritura desprotegida', async () => {
  const f = fixture({ local: data('Local') }); await f.base(data('Base'));
  f.control.noEtag = true;
  assert.equal(await f.c._gdriveSaveData(), false);
  assert.equal(f.writes().length, 0);
  assert.match(f.messages.at(-1), /revisión verificable/);
});

for (const choice of ['local', 'drive']) {
  test(`Elegir ${choice} conserva ambas copias antes de aplicar la decisión`, async () => {
    const f = fixture({ local: data('Local') });
    await f.c._gdriveSaveData();
    assert.equal(await f.c._gdriveResolveConflict(choice), true);
    const expected = choice === 'local' ? 'Local' : 'Base';
    assert.equal(f.c.D.clientes[0].nombre, expected);
    assert.equal(f.server.data.clientes[0].nombre, expected);
    const archive = JSON.parse(f.memory.get('aercom-drive-recovery'));
    assert.equal(archive[0].local.clientes[0].nombre, 'Local');
    assert.equal(archive[0].drive.clientes[0].nombre, 'Base');
    assert.equal(vm.runInContext('_gdriveConflict', f.c), null);
  });
}

test('Si cambia el remoto mientras se decide, se pide una nueva elección', async () => {
  const f = fixture({ local: data('Local') }); await f.c._gdriveSaveData();
  f.server.data = data('Más nuevo'); f.server.revision++;
  assert.equal(await f.c._gdriveResolveConflict('local'), false);
  assert.equal(f.writes().length, 0);
  assert.equal(f.status.prompts, 2);
  assert.equal(f.server.data.clientes[0].nombre, 'Más nuevo');
});

test('La decisión respalda también las ediciones locales hechas después de abrir el aviso', async () => {
  const f = fixture({ local: data('Local') }); await f.c._gdriveSaveData();
  f.c.D.clientes[0].nombre = 'Local posterior';
  await f.c._gdriveResolveConflict('drive');
  const archive = JSON.parse(f.memory.get('aercom-drive-recovery'));
  assert.ok(archive.some(entry => entry.local.clientes[0].nombre === 'Local posterior'));
});

test('Sin espacio para conservar ambas copias, ninguna decisión reemplaza datos', async () => {
  const f = fixture({ local: data('Local') }); f.control.recoveryFailure = true;
  await f.c._gdriveSaveData();
  assert.ok(vm.runInContext('_gdriveConflict.backupError', f.c));
  assert.equal(await f.c._gdriveResolveConflict('drive'), false);
  assert.equal(f.c.D.clientes[0].nombre, 'Local');
  assert.equal(f.writes().length, 0);
});

test('Desconectar invalida una descarga pendiente y no aplica su respuesta tardía', async () => {
  const f = fixture(); await f.base(data('Base')); f.server.data = data('Remoto');
  let release;
  f.control.holdMedia = () => new Promise(resolve => { release = resolve; });
  const loading = f.c._gdriveLoadData();
  while (!release) await new Promise(resolve => setImmediate(resolve));
  f.c.gdriveDisconnect(); release();
  assert.equal(await loading, false);
  assert.equal(f.c.D.clientes[0].nombre, 'Base');
  assert.equal(f.status.saved, 0);
});

test('La base persistida permite reconocer una edición local después de recargar', async () => {
  const f = fixture(); await f.c._gdriveSaveData();
  const reloaded = fixture({ local: data('Offline'), server: f.server, memory: f.memory });
  assert.equal(await reloaded.c._gdriveSaveData(), true);
  assert.equal(f.server.data.clientes[0].nombre, 'Offline');
});

test('Una pestaña antigua no adopta como propia la base escrita después por otra', async () => {
  const first = fixture(); await first.c._gdriveSaveData();
  const oldTab = fixture({ server: first.server, memory: first.memory });
  first.c.D.clientes[0].nombre = 'Cambio desde otra pestaña';
  await first.c._gdriveSaveData();
  await oldTab.c._gdriveSaveData();
  assert.equal(oldTab.c.D.clientes[0].nombre, 'Cambio desde otra pestaña');
  assert.equal(oldTab.writes().length, 0);
});

test('Un backup conocido que desapareció no se recrea automáticamente', async () => {
  const f = fixture(); await f.base(data('Base')); f.server.files = [];
  assert.equal(await f.c._gdriveSaveData(), false);
  assert.equal(f.writes().length, 0);
});

test('La base de otra carpeta/cuenta no autoriza una sobrescritura', async () => {
  const f = fixture({ local: data('Local') }); await f.base(data('Base'));
  vm.runInContext("_gdriveBase.folderId='otra-cuenta'", f.c);
  await f.c._gdriveSaveData();
  assert.equal(f.status.prompts, 1);
  assert.equal(f.writes().length, 0);
});

test('Una edición durante la descarga no se pierde al recibir la copia remota', async () => {
  const f = fixture(); await f.base(data('Base')); f.server.data = data('Remoto');
  let release;
  f.control.holdMedia = () => new Promise(resolve => { release = resolve; });
  const loading = f.c._gdriveLoadData();
  while (!release) await new Promise(resolve => setImmediate(resolve));
  f.c.D.clientes[0].nombre = 'Edición durante descarga';
  f.control.holdMedia = null; release();
  await loading;
  assert.equal(f.c.D.clientes[0].nombre, 'Edición durante descarga');
  assert.equal(f.server.data.clientes[0].nombre, 'Remoto');
  assert.equal(f.status.prompts, 1);
});

test('Una creación confirmada en servidor pero con respuesta perdida no genera un duplicado al intentar de nuevo', async () => {
  const f = fixture(); f.server.files = []; f.control.loseCreationResponse = true;
  assert.equal(await f.c._gdriveSaveData(), false);
  f.control.loseCreationResponse = false;
  assert.equal(await f.c._gdriveSaveData(), true);
  assert.equal(f.writes().length, 1);
});

test('La elección local también respeta un cambio concurrente y mantiene el conflicto', async () => {
  const f = fixture({ local: data('Local') }); await f.c._gdriveSaveData();
  f.control.beforePatch = () => { f.server.data = data('Otro dispositivo'); f.server.revision++; };
  assert.equal(await f.c._gdriveResolveConflict('local'), false);
  assert.equal(f.server.data.clientes[0].nombre, 'Otro dispositivo');
  assert.equal(f.c.D.clientes[0].nombre, 'Local');
  assert.ok(vm.runInContext('_gdriveConflict', f.c));
});
