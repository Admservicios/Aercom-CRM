// node --test tests/equipment-quote-editing.test.js — formularios y guardado simulados.
const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const copy=value=>JSON.parse(JSON.stringify(value));
function fixture(){
 const nodes=new Map(),saves=[];
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:'',textContent:'',disabled:false,classList:{add(){}},style:{}});return nodes.get(id);};
 const equipment={id:'E1',clienteId:'C1',tipo:'Motobomba',marca:'Marca',ubicacion:'Nave A',ultimoPreventivo:'2026-01-01',proximoPreventivo:'2027-01-01',ultimoAceite:'2025-01-01',proximoAceite:'2027-01-01',ultimoBateria:'2025-02-01',proximoBateria:'2028-02-01',ultimoRefrigerante:'2025-03-01',horometro:1200,observaciones:'Original',ultimaVisita:'2026-10-01',proximaVisita:'2026-11-01',importeExtra:0,flagExtra:false,campoImportado:{valores:['dato',0,false]},campoNulo:null};
 const quote={id:'Q1',clienteId:'C1',equipoId:'E1',descripcion:'Servicio',monto:100,fechaEnvio:'2026-10-01',fechaFollowup:'2026-10-20',responsable:'Ana',estado:'Aprobada',notas:'Original',nroFactura:'A-0001',fechaFactura:'2026-10-02',moneda:'USD',descuentoExtra:0,flagExtra:false,campoImportado:{valores:['dato',0,false]},campoNulo:null};
 const c=vm.createContext({D:{clientes:[{id:'C1',nombre:'Cliente',frecuenciaVisita:'Mensual'}],equipos:[equipment],cotizaciones:[quote]},ESTADOS:['Solicitud','Aprobada','Facturada'],document:{getElementById:node},persist(){saves.push(JSON.stringify(c.D));},closeModal(){},toast(){}});
 for(const file of ['js/utils.js','js/modules/equipos.js','js/modules/cotizaciones.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
 c.renderEquipos=()=>{};c.renderModule=()=>{};
 const equipmentFields={'e-id':'id','e-cli':'clienteId','e-tipo':'tipo','e-uprev':'ultimoPreventivo','e-nprev':'proximoPreventivo','e-ace':'ultimoAceite','e-nace':'proximoAceite','e-bat':'ultimoBateria','e-nbat':'proximoBateria','e-obs':'observaciones','e-uvisita':'ultimaVisita','e-nvisita':'proximaVisita'};
 const quoteFields={'f-id':'id','f-cli':'clienteId','f-eq':'equipoId','f-desc':'descripcion','f-monto':'monto','f-env':'fechaEnvio','f-fup':'fechaFollowup','f-resp':'responsable','f-est':'estado','f-notas':'notas'};
 for(const[id,key]of Object.entries(equipmentFields))node(id).value=String(equipment[key]??'');
 for(const[id,key]of Object.entries(quoteFields))node(id).value=String(quote[key]??'');
 vm.runInContext("editingQuoteId='Q1'",c);
 return{c,node,equipment,quote,saves};
}
test('Editar observaciones del equipo conserva todos los campos ajenos al formulario',()=>{
 const {c,node,equipment,saves}=fixture(),expected={...copy(equipment),observaciones:'Nueva observación'};node('e-obs').value=' Nueva observación ';c.saveEquip();
 assert.deepEqual(copy(c.D.equipos[0]),expected);assert.deepEqual(JSON.parse(saves[0]).equipos[0],expected);assert.equal(saves.length,1);
});
test('Equipo permite vaciar campos actuales sin alterar horómetro histórico cero',()=>{
 const {c,node,equipment}=fixture();equipment.horometro=0;node('e-obs').value='';node('e-nprev').value='';c.saveEquip();
 assert.equal(c.D.equipos[0].observaciones,'');assert.equal(c.D.equipos[0].proximoPreventivo,'');assert.equal(c.D.equipos[0].horometro,0);assert.equal(c.D.equipos[0].marca,'Marca');assert.equal(c.D.equipos[0].flagExtra,false);
});
test('Próxima batería personalizada se conserva cuando la última fecha no cambia',()=>{
 const {c,node}=fixture();node('e-obs').value='Otra';c.saveEquip();assert.equal(c.D.equipos[0].proximoBateria,'2028-02-01');
});
test('Cambio explícito de última batería recalcula la próxima como en edición inline',()=>{
 const {c,node}=fixture();node('e-bat').value='2026-10-19';c.autoNextBattery();c.saveEquip();assert.equal(c.D.equipos[0].proximoBateria,c.addYears('2026-10-19',2));
});
test('Vaciar última batería limpia la próxima personalizada sin borrar otros campos',()=>{
 const {c,node}=fixture();node('e-bat').value='';c.autoNextBattery();c.saveEquip();assert.equal(c.D.equipos[0].proximoBateria,null);assert.equal(c.D.equipos[0].ubicacion,'Nave A');
});
test('Alta de equipo mantiene campos habituales sin copiar metadatos de otro equipo',()=>{
 const {c,node,saves}=fixture();node('e-id').value='E2';c.autoNextBattery();c.saveEquip();const added=c.D.equipos[1];
 assert.equal(added.id,'E2');assert.equal(added.marca,undefined);assert.equal(added.proximoBateria,c.addYears('2025-02-01',2));assert.equal(added.campoImportado,undefined);assert.equal(saves.length,1);
});
test('Formulario de equipo conserva tipo histórico fuera del catálogo de forma escapada',()=>{
 const {c,equipment,node}=fixture();equipment.tipo='Tablero "especial" & <texto>';const before=JSON.stringify(c.D);c.openEquipModal('E1');
 assert.ok(node('modal-body').innerHTML.includes(`<option value="${c._esc(equipment.tipo)}" selected>${c._esc(equipment.tipo)}</option>`));assert.equal(JSON.stringify(c.D),before);
});
test('Equipo con datos incompletos no modifica ni guarda',()=>{
 const {c,node,saves}=fixture(),before=JSON.stringify(c.D);node('e-cli').value='';c.saveEquip();assert.equal(JSON.stringify(c.D),before);assert.equal(saves.length,0);
});
test('Editar descripción de cotización conserva factura, campos adicionales, cero, false y null',()=>{
 const {c,node,quote,saves}=fixture(),expected={...copy(quote),descripcion:'Nueva descripción'};node('f-desc').value=' Nueva descripción ';c.saveQuote();
 assert.deepEqual(copy(c.D.cotizaciones[0]),expected);assert.deepEqual(JSON.parse(saves[0]).cotizaciones[0],expected);assert.equal(saves.length,1);
});
test('Cotización permite monto cero, notas vacías y cambios de estado explícitos',()=>{
 const {c,node}=fixture();node('f-monto').value='0';node('f-notas').value='';node('f-est').value='Facturada';c.saveQuote();
 assert.equal(c.D.cotizaciones[0].monto,0);assert.equal(c.D.cotizaciones[0].notas,'');assert.equal(c.D.cotizaciones[0].estado,'Facturada');assert.equal(c.D.cotizaciones[0].moneda,'USD');
});
test('Cotización conserva datos de factura nulos al editar campos independientes',()=>{
 const {c,quote}=fixture();quote.nroFactura=null;quote.fechaFactura=null;c.saveQuote();assert.equal(c.D.cotizaciones[0].nroFactura,null);assert.equal(c.D.cotizaciones[0].fechaFactura,null);
});
test('Alta de cotización conserva predeterminados sin heredar datos de otro registro',()=>{
 const {c,node,saves}=fixture();vm.runInContext('editingQuoteId=null',c);node('f-id').value='Q2';c.saveQuote();const added=c.D.cotizaciones[1];
 assert.equal(added.id,'Q2');assert.equal(added.nroFactura,'');assert.equal(added.fechaFactura,'');assert.equal(added.moneda,undefined);assert.equal(added.campoImportado,undefined);assert.equal(saves.length,1);
});
test('Cotización duplicada en alta y descripción vacía se rechazan sin cambios',()=>{
 const {c,node,saves}=fixture(),before=JSON.stringify(c.D);vm.runInContext('editingQuoteId=null',c);c.saveQuote();assert.equal(JSON.stringify(c.D),before);assert.equal(saves.length,0);
 vm.runInContext("editingQuoteId='Q1'",c);node('f-desc').value=' ';c.saveQuote();assert.equal(JSON.stringify(c.D),before);assert.equal(saves.length,0);
});
test('Formulario conserva estado histórico fuera del catálogo y no modifica D al abrir',()=>{
 const {c,quote,node}=fixture();quote.estado='Histórico "especial" & <texto>';const before=JSON.stringify(c.D);c.openQuoteModal('Q1',null);
 assert.ok(node('modal-body').innerHTML.includes(`<option value="${c._esc(quote.estado)}" selected>${c._esc(quote.estado)}</option>`));assert.equal(JSON.stringify(c.D),before);
});

test('Última batería vacía/null/ausente sin edición conserva una próxima fecha importada',()=>{
 for(const last of ['',null,undefined]){
  const {c,equipment,node}=fixture();equipment.ultimoBateria=last;node('e-bat').value='';c.saveEquip();assert.equal(c.D.equipos[0].proximoBateria,'2028-02-01');
 }
});

test('Formulario Equipo muestra próxima batería y retira gas/horómetro sin mutar datos',()=>{
 const {c,node}=fixture(),before=JSON.stringify(c.D);c.openEquipModal('E1');const html=node('modal-body').innerHTML;
 assert.ok(html.includes('>Equipo</label>'));assert.ok(html.includes('Próximo cambio de batería'));assert.ok(html.includes('id="e-nbat"'));
 assert.ok(!html.includes('id="e-ref"'));assert.ok(!html.includes('id="e-hor"'));assert.equal(JSON.stringify(c.D),before);
});
test('Batería suma dos años calendario y permite una próxima fecha explícita',()=>{
 const {c,node}=fixture();node('e-bat').value='2023-03-01';c.autoNextBattery();assert.equal(node('e-nbat').value,'2025-03-01');
 node('e-bat').value='2024-02-29';c.autoNextBattery();assert.equal(node('e-nbat').value,'2026-02-28');
 node('e-nbat').value='2026-03-10';c.saveEquip();assert.equal(c.D.equipos[0].proximoBateria,'2026-03-10');
});
test('Estado y calendario usan la próxima batería y no generan vencimiento oculto por gas retirado',()=>{
 const {c}=fixture();c.D.recordatorios=[];c.D.pedidos=[];c.D.eventos=[];c.clientName=()=> 'Cliente';
 const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');vm.runInContext(html.slice(html.indexOf('function equipStatus(e){'),html.indexOf('function clientName(id){')),c);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js/modules/calendario.js'),'utf8'),c);
 const e=c.D.equipos[0];Object.assign(e,{ultimoPreventivo:'',proximoPreventivo:'',ultimoAceite:'',proximoAceite:'',ultimoBateria:'',proximoBateria:'2099-03-01',ultimoRefrigerante:'2000-01-01',ultimaVisita:'',proximaVisita:''});
 assert.equal(c.equipStatus(e).sinFechas,false);assert.equal(c.equipStatus(e).st,'verde');assert.equal(c.equipStatus(e).nextBateria,'2099-03-01');
 delete e.proximoBateria;e.ultimoBateria='2023-03-01';assert.equal(c.equipStatus(e).nextBateria,'2025-03-01');
 assert.ok(c._calGetEventos()['2025-03-01'].some(event=>event.label.startsWith('Bat.')));
});
