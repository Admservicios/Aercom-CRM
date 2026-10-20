const {test} = require('node:test');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const path = require('node:path');

// Procesos separados para comprobar fechas locales y cambios de horario reales.
const worker = String.raw`
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D={eventos:[{id:'EV1',fecha:'2026-02-28',titulo:'No modificar'}]};
const original=JSON.stringify(D);
const c=vm.createContext({D});
vm.runInContext(fs.readFileSync('js/modules/calendario.js','utf8'),c);
vm.runInContext('let renders=0;renderCalendario=()=>{renders++;}',c);
function go(start,direction,expected,view='mes'){
  vm.runInContext('calFecha=new Date('+start.join(',')+',12,30);calVista='+JSON.stringify(view),c);
  const before=vm.runInContext('renders',c);
  c[direction]();
  assert.equal(vm.runInContext('[calFecha.getFullYear(),calFecha.getMonth(),calFecha.getDate()].join(",")',c),expected.join(','),start+' '+direction+' '+view);
  assert.equal(vm.runInContext('calFecha.getHours()',c),12);
  assert.equal(vm.runInContext('calFecha.getMinutes()',c),30);
  assert.equal(vm.runInContext('renders',c),before+1);
}
const suite=process.env.CAL_SUITE;
if(suite==='month'){
  go([2026,0,31],'calNext',[2026,1,28]);
  go([2026,0,30],'calNext',[2026,1,28]);
  go([2026,0,29],'calNext',[2026,1,28]);
  go([2024,0,31],'calNext',[2024,1,29]);
  go([2026,2,31],'calPrev',[2026,1,28]);
  go([2024,2,31],'calPrev',[2024,1,29]);
  go([2026,2,31],'calNext',[2026,3,30]);
  go([2026,4,31],'calPrev',[2026,3,30]);
  go([2026,11,31],'calNext',[2027,0,31]);
  go([2026,0,31],'calPrev',[2025,11,31]);
  go([2026,0,15],'calNext',[2026,1,15]);
  go([2026,2,15],'calPrev',[2026,1,15]);
  go([2026,0,1],'calNext',[2026,1,1]);
  // Un año completo en cada dirección, sin omitir ni repetir meses.
  for(const direction of ['calNext','calPrev']){
    vm.runInContext('calFecha=new Date(2026,0,31,12,30);calVista="mes"',c);
    for(let step=1;step<=12;step++){
      c[direction]();
      const month=direction==='calNext'?step:-step;
      const expected=new Date(2026,month,1,12);
      assert.equal(vm.runInContext('calFecha.getFullYear()*12+calFecha.getMonth()',c),expected.getFullYear()*12+expected.getMonth());
    }
  }
}else{
  for(const [start,direction,expected] of [
    [[2026,0,31],'calNext',[2026,1,7]],
    [[2026,2,1],'calPrev',[2026,1,22]],
    [[2026,11,31],'calNext',[2027,0,7]],
    [[2026,0,1],'calPrev',[2025,11,25]],
    [[2026,2,7],'calNext',[2026,2,14]],
    [[2026,9,31],'calNext',[2026,10,7]]
  ])go(start,direction,expected,'semana');
  // Cambiar de vista después de acortar el día mantiene una fecha válida.
  go([2026,0,31],'calNext',[2026,1,28]);
  vm.runInContext('calVista="semana"',c);c.calNext();
  assert.equal(vm.runInContext('[calFecha.getFullYear(),calFecha.getMonth(),calFecha.getDate()].join(",")',c),'2026,2,7');
}
assert.equal(JSON.stringify(D),original);
`;
for (const zone of ['UTC', 'America/Argentina/Buenos_Aires', 'America/New_York', 'Europe/Berlin']) {
  for (const [suite, label] of [['month', 'meses consecutivos, fin de mes y años bisiestos'], ['week', 'semanas y cambio de vista']]) {
    test(`Calendario: ${label} en ${zone}`, () => {
      execFileSync(process.execPath, ['-e', worker], {
        cwd: path.join(__dirname, '..'), env: {...process.env, TZ: zone, CAL_SUITE: suite}, stdio: 'pipe'
      });
    });
  }
}
