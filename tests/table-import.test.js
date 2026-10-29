// node --test tests/table-import.test.js — FileReader/SheetJS simulados; sin cuentas reales.
const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const copy=data=>JSON.parse(JSON.stringify(data));
function fixture(){
 const nodes=new Map(),messages=[];
 const control={writes:0,render:false,quota:false,readers:[],defer:false};
 const memory=new Map();
 const c=vm.createContext({console:{error(){}},ESTADOS:['Solicitud','Aprobada','A facturar','Facturada','Ejecutada','Rechazada'],
  _history:[],_future:[],_inPersist:false,MAX_HIST:30,
  document:{getElementById(id){if(!nodes.has(id))nodes.set(id,{style:{},innerHTML:'',textContent:''});return nodes.get(id);}},
  localStorage:{getItem:key=>memory.get(key)??null,setItem(key,value){if(control.quota)throw Error('Cuota');control.writes++;memory.set(key,value);},removeItem:key=>memory.delete(key)},
  renderModule(){if(control.render)throw Error('Render');},updateSidebarBadges(){},updateExcelCounts(){},
  markUnsaved(){},_updateUndoBtn(){},closeModal(){},confirm:()=>true,toast:message=>messages.push(message),
  FileReader:class{
   readAsText(file){if(control.defer)control.readers.push({reader:this,file});else if(file.error)this.onerror();else this.onload({target:{result:file.text}});}
   readAsBinaryString(file){if(control.defer)control.readers.push({reader:this,file});else if(file.error)this.onerror();else this.onload({target:{result:file}});}
  },
  XLSX:{read:file=>({SheetNames:['Datos'],Sheets:{Datos:file},Workbook:{WBProps:{date1904:file.date1904}}}),utils:{sheet_to_json:sheet=>copy(sheet.rows)}}
 });
 for(const file of ['js/utils.js','js/storage.js','js/modules/csv.js','js/modules/excel.js'])vm.runInContext(read(file),c);
 c.D=c._normalizeData({clientes:[{id:'C1',nombre:'Uno',requiereOC:true,precioAbono:0,cantidadAbono:0,adjOC:false,extra:{guardar:true}},{id:'C2',nombre:'Dos'}],equipos:[{id:'E1',clienteId:'C1',tipo:'Motobomba',horometro:12,proximoAceite:'2027-01-01',extra:'equipo'}],cotizaciones:[{id:'Q1',clienteId:'C1',equipoId:'E1',estado:'Aprobada',nroFactura:'F1',monto:12,extra:'cotización'}],pedidos:[],eventos:[],recordatorios:[],facturacion_estados:{},lastSaved:'2026-10-16'});
 memory.set('aercom-data',JSON.stringify(c.D));c._initialSnapshot=JSON.stringify(c.D);c._origPersist=c._persistBase;
 vm.runInContext(read('index.html').match(/function persist\(\)\{[\s\S]*?\n\}/)[0],c);
 const csv=(type,text,mode='reemplazar')=>{vm.runInContext(`csvModule=${JSON.stringify(type)};csvConflictMode=${JSON.stringify(mode)}`,c);c.csvFileSelected({target:{files:[{text}]}});vm.runInContext(`csvConflictMode=${JSON.stringify(mode)}`,c);c.confirmCsvImport();};
 const xls=(type,rows,extra={})=>{const target={value:'archivo',files:[{rows,...extra}]};c.xlsImport({target},type);return target;};
 const snapshot=()=>JSON.stringify([c.D,memory.get('aercom-data'),c._history,c._future,control.writes]);
 return{c,csv,xls,control,messages,nodes,memory,snapshot};
}

test('CSV conserva campos ausentes, facturación y valores falsos al reemplazar',()=>{
 const f=fixture(),before=copy(f.c.D.clientes[0]);f.csv('clientes','nombre,email\nUno,nuevo@example.com');
 assert.deepEqual(copy(f.c.D.clientes[0]),{...before,email:'nuevo@example.com'});assert.equal(f.control.writes,1);assert.equal(f.c._history.length,1);
});
test('CSV de equipos/cotizaciones conserva campos fuera de la plantilla',()=>{
 const f=fixture();f.csv('equipos','id,horometro\nE1,0');f.csv('cotizaciones','id,monto\nQ1,0');
 assert.equal(f.c.D.equipos[0].horometro,0);assert.equal(f.c.D.equipos[0].proximoAceite,'2027-01-01');
 assert.equal(f.c.D.cotizaciones[0].monto,0);assert.equal(f.c.D.cotizaciones[0].nroFactura,'F1');assert.equal(f.c.D.cotizaciones[0].equipoId,'E1');
});
test('CSV distingue columna ausente de vacía y admite booleanos explícitos',()=>{
 const f=fixture();f.csv('clientes','nombre,email,requiereOC\nUno,,NO');assert.equal(f.c.D.clientes[0].email,'');assert.equal(f.c.D.clientes[0].requiereOC,false);
});
test('CSV saltar existentes sin cambios no guarda ni crea historial',()=>{
 const f=fixture(),before=f.snapshot();f.csv('clientes','nombre,email\nUno,nuevo@example.com','saltar');assert.equal(f.snapshot(),before);
});
test('CSV admite BOM, CRLF, comas, comillas dobles y campos multilínea',()=>{
 const f=fixture();f.csv('clientes','\uFEFFnombre,contacto\r\n"Empresa, SA","Ana ""Sol""\r\nÁrea técnica"\r\n');
 assert.equal(f.c.D.clientes.at(-1).nombre,'Empresa, SA');assert.equal(f.c.D.clientes.at(-1).contacto,'Ana "Sol"\nÁrea técnica');
});
for(const [label,type,text] of [
 ['comillas abiertas','clientes','nombre\n"Uno'],['columnas incompletas','clientes','nombre,email\nUno'],
 ['encabezado repetido','clientes','nombre,nombre\nUno,Dos'],['encabezado reservado','clientes','nombre,__proto__\nUno,x'],
 ['columna desconocida','clientes','nombre,emali\nUno,x'],['clave ausente','clientes','email\na@b.com'],
 ['clave duplicada','clientes','nombre\nTres\nTres'],['clave vacía','clientes','nombre,email\n,x'],
 ['número inválido','clientes','nombre,presupuesto\nUno,abc'],['booleano inválido','clientes','nombre,requiereOC\nUno,quizá'],
 ['fecha imposible','equipos','id,ultimoPreventivo\nE1,2026-02-30'],['cliente inexistente','equipos','id,clienteId\nE2,AUSENTE'],
 ['equipo de otro cliente','cotizaciones','id,clienteId,equipoId\nQ2,C2,E1'],['estado desconocido','cotizaciones','id,clienteId,estado\nQ2,C1,Inventado'],
 ['ID reservado','equipos','id,clienteId\n__proto__,C1'],['error en segunda fila','equipos','id,clienteId\nE2,C1\nE3,AUSENTE']
])test(`CSV rechaza ${label} sin mutación ni persistencia`,()=>{const f=fixture(),before=f.snapshot();f.csv(type,text);assert.equal(f.snapshot(),before);assert.match(f.messages.at(-1),/rechazado/);});

test('Excel conserva campos adicionales, cero y false al actualizar clientes',()=>{
 const f=fixture();f.xls('clientes',[{ID:'C1',Nombre:'Uno',Email:'nuevo@example.com','Requiere OC':'NO','Incluye NS':'','Presupuesto Mensual':0}]);
 const c=f.c.D.clientes[0];assert.equal(c.precioAbono,0);assert.equal(c.cantidadAbono,0);assert.equal(c.adjOC,false);assert.deepEqual(copy(c.extra),{guardar:true});assert.equal(c.requiereOC,false);assert.equal(c.presupuesto,0);
});
test('Excel vacío conserva booleanos; equipos preserva tipo y acepta horómetro cero',()=>{
 const f=fixture();f.xls('clientes',[{ID:'C1',Nombre:'Uno','Requiere OC':''}]);assert.equal(f.c.D.clientes[0].requiereOC,true);
 f.xls('equipos',[{ID:'E1','Cliente ID':'C1',Horometro:0,Tipo:''}]);assert.equal(f.c.D.equipos[0].horometro,0);assert.equal(f.c.D.equipos[0].tipo,'Motobomba');assert.equal(f.c.D.equipos[0].extra,'equipo');
});
test('Excel cotización parcial conserva equipo, factura, estado y demás valores',()=>{
 const f=fixture(),before=copy(f.c.D.cotizaciones[0]);f.xls('cotizaciones',[{ID:'Q1','Cliente (nombre)':'Uno',Monto:0}]);assert.deepEqual(copy(f.c.D.cotizaciones[0]),{...before,monto:0,descripcion:'',fechaEnvio:'',fechaFollowup:'',responsable:'',notas:''});
});
for(const [label,type,rows,extra] of [
 ['fecha inválida','equipos',[{ID:'E1','Cliente ID':'C1','Ultimo Preventivo':'31/02/2026'}]],
 ['número inválido','clientes',[{Nombre:'Tres','Presupuesto Mensual':'$ 5'}]],
 ['booleano inválido','clientes',[{Nombre:'Tres','Requiere OC':'quizá'}]],
 ['ID inexistente con nombre válido','equipos',[{ID:'E2','Cliente ID':'NO','Cliente (nombre)':'Uno'}]],
 ['nombre parcial','equipos',[{ID:'E2','Cliente (nombre)':'Un'}]],
 ['ID/nombre contradictorios','equipos',[{ID:'E2','Cliente ID':'C1','Cliente (nombre)':'Dos'}]],
 ['ID equipo ausente','equipos',[{'Cliente ID':'C1'}]],
 ['ID cotización ausente','cotizaciones',[{'Cliente (nombre)':'Uno'}]],
 ['ID repetido','equipos',[{ID:'E2','Cliente ID':'C1'},{ID:'E2','Cliente ID':'C1'}]],
 ['dos filas para el mismo cliente','clientes',[{ID:'C1',Nombre:'Uno'},{Nombre:'Uno'}]],
 ['columnas desconocidas','clientes',[{Nombre:'Tres',Emali:'x'}]],
 ['fila final inválida','equipos',[{ID:'E2','Cliente ID':'C1'},{ID:'E3','Cliente ID':'NO'}]],
 ['libro de fechas 1904','clientes',[{Nombre:'Tres'}],{date1904:true}]
])test(`Excel rechaza ${label} sin aplicar parcialmente`,()=>{const f=fixture(),before=f.snapshot();f.xls(type,rows,extra);assert.equal(f.snapshot(),before);assert.match(f.messages.at(-1),/Error al importar/);});
for(const source of ['csv','xls'])for(const failure of ['quota','render'])test(`${source}: fallo ${failure} recupera datos, almacenamiento e historial`,()=>{
 const f=fixture(),before=f.snapshot();f.control[failure]=true;
 if(source==='csv')f.csv('clientes','nombre,email\nUno,nuevo@example.com');else f.xls('clientes',[{ID:'C1',Nombre:'Uno',Email:'nuevo@example.com'}]);
 assert.equal(f.snapshot(),before);assert.match(f.messages.at(-1),/rechazado|Error al importar/);
});
test('No se reasigna equipo con cotizaciones ni cotización con pedidos',()=>{
 const f=fixture(),before=f.snapshot();f.csv('equipos','id,clienteId\nE1,C2');assert.equal(f.snapshot(),before);
 f.c.D.pedidos=[{id:'P1',clienteId:'C1',cotizacionId:'Q1',equipoId:'E1'}];const withPedido=f.snapshot();
 f.csv('cotizaciones','id,clienteId,equipoId\nQ1,C2,');assert.equal(f.snapshot(),withPedido);
});
test('Nombres duplicados requieren ID explícito para Excel y bloquean CSV por nombre',()=>{
 const f=fixture();f.c.D.clientes.push({...copy(f.c.D.clientes[0]),id:'C3'});const before=f.snapshot();
 f.csv('clientes','nombre,email\nUno,x');assert.equal(f.snapshot(),before);
 f.xls('equipos',[{ID:'E2','Cliente (nombre)':'Uno'}]);assert.equal(f.snapshot(),before);
 f.xls('equipos',[{ID:'E2','Cliente ID':'C3'}]);assert.equal(f.c.D.equipos.at(-1).clienteId,'C3');
});
test('Lectura CSV antigua no reemplaza el último archivo seleccionado',()=>{
 const f=fixture();f.control.defer=true;vm.runInContext("csvModule='clientes'",f.c);
 f.c.csvFileSelected({target:{files:[{text:'nombre\nAntiguo'}]}});f.c.csvFileSelected({target:{files:[{text:'nombre\nReciente'}]}});
 f.control.readers[1].reader.onload({target:{result:f.control.readers[1].file.text}});f.control.readers[0].reader.onload({target:{result:f.control.readers[0].file.text}});f.c.confirmCsvImport();assert.equal(f.c.D.clientes.at(-1).nombre,'Reciente');
});
test('Lectura Excel antigua y errores de lectura no alteran el lote actual',()=>{
 const f=fixture();f.control.defer=true;f.xls('clientes',[{Nombre:'Antiguo'}]);f.xls('clientes',[{Nombre:'Reciente'}]);
 const[a,b]=f.control.readers;b.reader.onload({target:{result:b.file}});a.reader.onload({target:{result:a.file}});assert.equal(f.c.D.clientes.at(-1).nombre,'Reciente');
 f.control.defer=false;const before=f.snapshot();f.xls('clientes',[],{error:true});assert.equal(f.snapshot(),before);
});
test('Fechas Excel: serial 1900, bisiestos, fechas locales válidas y rechazo de serial 60',()=>{
 const f=fixture();for(const [input,expected] of [[1,'1900-01-01'],[59,'1900-02-28'],[61,'1900-03-01'],[25569,'1970-01-01'],['29/02/2024','2024-02-29'],['2026-01-15','2026-01-15']])assert.equal(f.c._xlsDate(input),expected);
 for(const input of [60,'29/02/2025','01/13/2026','texto'])assert.throws(()=>f.c._xlsDate(input),/Fecha Excel inválida/);
});
test('Plantillas y reportes tienen un encabezado por valor en los tres dominios',async()=>{
 const f=fixture(),sheets=[];f.c.clientName=id=>f.c.D.clientes.find(c=>c.id===id)?.nombre||'';
 Object.assign(f.c.XLSX.utils,{book_new:()=>({}),aoa_to_sheet:data=>({data}),book_append_sheet(wb,ws){sheets.push(ws.data);}});
 f.c.XLSX.writeFile=()=>{};
 for(const type of ['clientes','equipos','cotizaciones']){
  sheets.length=0;f.c.xlsDownloadPlantilla(type);const template=sheets[0];
  for(const row of template.slice(1))assert.equal(row.length,template[0].length);
  sheets.length=0;await f.c.xlsExport(type);const report=sheets[0];
  for(const row of report.slice(1))assert.equal(row.length,report[0].length);
  if(type==='cotizaciones'){assert.equal(report[0][1],'Cliente ID');assert.equal(report[1][1],'C1');}
 }
});

test('Seleccionar otro CSV restablece Saltar existentes en estado y radios',()=>{
 const f=fixture();vm.runInContext("csvModule='clientes';csvConflictMode='reemplazar'",f.c);
 f.c.csvFileSelected({target:{files:[{text:'nombre,email\nUno,no-guardar@example.com'}]}});
 const before=f.snapshot();f.c.confirmCsvImport();assert.equal(f.snapshot(),before);assert.match(f.messages.at(-1),/saltado/);
});

test('Excel equipos nuevo: acepta Equipo, fechas actuales y calcula batería a dos años',()=>{
 const f=fixture();f.xls('equipos',[{Equipo:'E2','Cliente ID':'C1','Ultima Bateria':'2023-03-01','Ultimo Cambio Refrigerante':'2026-01-10','Proximo Refrigerante':'2028-01-10','Ultima Visita':'2026-10-01','Proxima Visita':'2026-11-01'}]);
 const e=f.c.D.equipos.find(e=>e.id==='E2');assert.ok(e);assert.equal(e.proximoBateria,'2025-03-01');assert.equal(e.ultimoAceite,'2026-01-10');assert.equal(e.proximoAceite,'2028-01-10');assert.equal(e.ultimaVisita,'2026-10-01');assert.equal(e.proximaVisita,'2026-11-01');assert.equal(e.horometro,undefined);assert.equal(e.ultimoRefrigerante,undefined);
});
test('Excel batería bisiesta, fecha explícita y conservación/recalculo de personalizadas',()=>{
 const f=fixture(),e=f.c.D.equipos[0];e.ultimoBateria='2024-02-29';e.proximoBateria='2029-06-01';e.ultimoRefrigerante='2020-01-01';
 f.xls('equipos',[{Equipo:'E1','Cliente ID':'C1',Observaciones:'Otra'}]);assert.equal(f.c.D.equipos[0].proximoBateria,'2029-06-01');assert.equal(f.c.D.equipos[0].horometro,12);assert.equal(f.c.D.equipos[0].ultimoRefrigerante,'2020-01-01');
 f.xls('equipos',[{Equipo:'E1','Cliente ID':'C1','Ultima Bateria':'2028-02-29'}]);assert.equal(f.c.D.equipos[0].proximoBateria,'2030-02-28');
 f.xls('equipos',[{Equipo:'E1','Cliente ID':'C1','Ultima Bateria':'2029-03-01','Proximo Cambio Bateria':'2032-04-10'}]);assert.equal(f.c.D.equipos[0].proximoBateria,'2032-04-10');
});
test('Excel nuevo inválido o alias contradictorios rechazan el lote completo',()=>{
 for(const invalid of [{'Proximo Cambio Bateria':'2027-02-30'},{ID:'OTRO'},{'Ultimo Aceite':'2025-01-01','Ultimo Cambio Refrigerante':'2026-01-01'}]){
  const f=fixture(),before=f.snapshot();f.xls('equipos',[{Equipo:'E2','Cliente ID':'C1'},{Equipo:'E1','Cliente ID':'C1',...invalid}]);assert.equal(f.snapshot(),before);assert.match(f.messages.at(-1),/Error/);
 }
});
test('Excel antiguo conserva interpretación: Aceite es refrigerante actual y Refrigerante es gas histórico',()=>{
 const f=fixture();f.xls('equipos',[{ID:'E1','Cliente ID':'C1','Ultimo Aceite':'2025-02-01','Ultimo Refrigerante':'2024-03-01',Horometro:0}]);
 assert.equal(f.c.D.equipos[0].ultimoAceite,'2025-02-01');assert.equal(f.c.D.equipos[0].ultimoRefrigerante,'2024-03-01');assert.equal(f.c.D.equipos[0].horometro,0);
 const before=f.snapshot();f.xls('equipos',[{ID:'E1','Cliente ID':'C1','Ultimo Refrigerante':0}]);assert.equal(f.snapshot(),before);assert.match(f.messages.at(-1),/Fecha Excel inválida/);
});
test('Plantilla y reporte XLSX reales alinean encabezados/valores y se reimportan sin perder históricos',()=>{
 const real=require('../js/vendor/xlsx.full.min-0.20.3.js'),f=fixture(),equipment=f.c.D.equipos[0],books=[];
 Object.assign(equipment,{ultimoAceite:'2026-01-01',ultimoBateria:'2024-02-29',proximoBateria:'2028-03-10',ultimoRefrigerante:'2020-06-01',ultimaVisita:'2026-10-01',proximaVisita:'2026-11-01',observaciones:'Última columna'});
 f.c.XLSX={...real,writeFile(wb,name){books.push({wb,name});}};f.c.clientName=id=>f.c.D.clientes.find(c=>c.id===id)?.nombre||'';
 f.c.xlsDownloadPlantilla('equipos');f.c.xlsExport('equipos');assert.equal(books.length,2);
 for(const {wb} of books){
  const roundtrip=real.read(real.write(wb,{bookType:'xlsx',type:'buffer'}),{type:'buffer'}),ws=roundtrip.Sheets[roundtrip.SheetNames[0]];
  const grid=real.utils.sheet_to_json(ws,{header:1,defval:''}),header=grid[0];assert.equal(header[0],'Equipo');assert.ok(!header.includes('Horometro'));assert.ok(!header.includes('Ultimo Refrigerante'));
  assert.equal(grid[1].length,header.length);assert.equal(grid[1][header.indexOf('Proximo Cambio Bateria')],'2028-03-10');assert.equal(grid[1][header.indexOf('Ultimo Cambio Refrigerante')],'2026-01-01');assert.equal(grid[1][header.indexOf('Observaciones')],'Última columna');
  const records=real.utils.sheet_to_json(ws,{defval:''});f.c.XLSX={read:file=>({SheetNames:['Datos'],Sheets:{Datos:file}}),utils:{sheet_to_json:sheet=>copy(sheet.rows)}};f.xls('equipos',records);
  assert.equal(f.c.D.equipos[0].horometro,12);assert.equal(f.c.D.equipos[0].ultimoRefrigerante,'2020-06-01');assert.equal(f.c.D.equipos[0].proximoBateria,'2028-03-10');
 }
});
test('CSV batería recalcula al cambiar/limpiar última fecha y conserva próxima si no se edita',()=>{
 const f=fixture();Object.assign(f.c.D.equipos[0],{ultimoBateria:'2025-01-01',proximoBateria:'2029-01-01'});
 f.csv('equipos','id,observaciones\nE1,Nota');assert.equal(f.c.D.equipos[0].proximoBateria,'2029-01-01');
 f.csv('equipos','id,ultimoBateria\nE1,2028-02-29');assert.equal(f.c.D.equipos[0].proximoBateria,'2030-02-28');
 f.csv('equipos','id,ultimoBateria\nE1,');assert.equal(f.c.D.equipos[0].proximoBateria,null);
});
