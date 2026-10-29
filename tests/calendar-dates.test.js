// Cada proceso usa una zona horaria real, sin dependencias adicionales.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const worker = String.raw`
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const NativeDate=Date;
let clock=process.env.TEST_CLOCK;
class ClockDate extends NativeDate {
 constructor(...args){super(...(args.length?args:[clock]));}
 static now(){return new NativeDate(clock).getTime();}
}
const nodes=new Map();
const c=vm.createContext({Date:ClockDate,D:{clientes:[],equipos:[],cotizaciones:[],pedidos:[],recordatorios:[],eventos:[{id:'EV1',titulo:'Inicio',fecha:'2026-03-01'},{id:'EV2',titulo:'Fin',fecha:'2026-03-31'}]},document:{getElementById(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:''});return nodes.get(id);}}});
for(const file of ['js/utils.js','js/modules/calendario.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);
const expected=process.env.TEST_DAY;
assert.equal(c.today(),expected);assert.equal(c.nowMonthStr(),expected.slice(0,7));
assert.equal(c.daysDiff(expected),0);assert.equal(c.daysDiff(c.addDays(expected,1)),1);assert.equal(c.daysDiff(c.addDays(expected,-1)),-1);
assert.equal(c.daysDiff(''),9999);assert.ok(Number.isNaN(c.daysDiff('invalido')));
for(const [input,days,output] of [['2024-02-28',1,'2024-02-29'],['2025-02-28',1,'2025-03-01'],['2026-12-31',1,'2027-01-01'],['2026-03-09',-1,'2026-03-08'],['2026-03-08',1,'2026-03-09'],['2026-11-01',1,'2026-11-02'],['2026-10-25',1,'2026-10-26'],['2026-03-29',1,'2026-03-30']])assert.equal(c.addDays(input,days),output);
for(const [input,output] of [['2023-03-01','2025-03-01'],['2024-02-29','2026-02-28'],['2026-10-29','2028-10-29']])assert.equal(c.addYears(input,2),output);
// Distancia exacta de días de calendario en torno a ambos cambios DST.
for(const [year,month,day] of [[2026,2,8],[2026,10,1],[2026,2,29],[2026,9,25]]){
 clock=new NativeDate(year,month,day,12).toISOString();
 const local=c.today();assert.equal(c.daysDiff(local),0);assert.equal(c.daysDiff(c.addDays(local,1)),1);assert.equal(c.daysDiff(c.addDays(local,-1)),-1);
}
// Mes con eventos en los límites y semana a última hora, sensibles al offset.
vm.runInContext('calFecha=new Date(2026,2,15,23,30);calVista="mes"',c);c.renderCalendario();
assert.equal(nodes.get('cal-sub').textContent,'2 eventos este período');
let html=nodes.get('cal-grid').innerHTML;
assert.match(html,/openCalEventModal\('2026-03-01'\)[\s\S]*?cal-day-num">1<\/div>/);
assert.match(html,/data-date="2026-03-01"[^>]*data-title="Inicio"/);
vm.runInContext('calFecha=new Date(2026,2,1,23,30);calVista="semana"',c);c.renderCalendario();
assert.equal(nodes.get('cal-sub').textContent,'1 evento este período');
html=nodes.get('cal-grid').innerHTML;assert.match(html,/openCalEventModal\('2026-02-23'\)/);assert.match(html,/openCalEventModal\('2026-03-01'\)/);assert.match(html,/data-date="2026-03-01"/);
`;
for(const [zone,clock,day] of [
 ['UTC','2026-01-01T01:30:00Z','2026-01-01'],
 ['America/Argentina/Buenos_Aires','2026-01-01T01:30:00Z','2025-12-31'],
 ['America/New_York','2026-01-01T01:30:00Z','2025-12-31'],
 ['Europe/Berlin','2025-12-31T23:30:00Z','2026-01-01'],
 ['Pacific/Kiritimati','2026-01-01T23:30:00Z','2026-01-02']
])test(`Fechas, DST y calendario mes/semana en ${zone}`,()=>{
 assert.doesNotThrow(()=>execFileSync(process.execPath,['-e',worker],{
  cwd:require('node:path').join(__dirname,'..'),env:{...process.env,TZ:zone,TEST_CLOCK:clock,TEST_DAY:day},stdio:'pipe'
 }));
});
