/**
 * ============================================================
 * AERCOM CRM v2
 * Calendario Module
 * Migrado tal cual desde index.html (Sprint 10)
 * ============================================================
 *
 * Responsabilidad: pantalla "Calendario" — vistas mes/semana,
 * navegación entre períodos, agregado de eventos propios
 * (reuniones), y el detalle de día/evento. Agrega en un solo
 * feed (_calGetEventos) los vencimientos de Equipos, los
 * follow-up de Cotizaciones, los Recordatorios, los Pedidos con
 * fecha "a realizar" y los eventos propios (D.eventos) — solo
 * los LEE para pintarlos en la grilla, no muta ninguno de esos
 * dominios (excepto D.eventos, que sí es propio de este módulo).
 *
 * Dependencias externas (definidas en index.html / js/utils.js,
 * sin mover — no son responsabilidad de este módulo):
 *   D, persist(), toast(), closeModal(), clientName(), today(),
 *   daysDiff(), addDays(), toTitleCase(), _esc() (js/utils.js —
 *   PR-014.1, hardening XSS)
 *
 * Decisiones de límite de módulo:
 *   - D.equipos/D.cotizaciones/D.recordatorios/D.pedidos/D.clientes
 *     se leen para armar el feed de eventos y el select de cliente
 *     del modal, pero no son dominio de este módulo.
 *   - El caso 'calendario' dentro del dispatcher renderModule()
 *     sigue en index.html, es compartido por todos los módulos.
 *   - Recordatorios es un módulo aparte (pantalla propia, aún sin
 *     migrar — js/recordatorios.js sigue vacío); acá solo se leen
 *     sus datos para el feed del calendario, no se duplica su UI.
 */

// ─── CALENDARIO ──────────────────────────────────────────────────────────────
let calVista = 'mes';
let calFecha = new Date();

const DIAS_SEMANA = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MESES_CAL   = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function calSetVista(v){
  calVista = v;
  document.getElementById('cal-btn-mes').style.cssText = v==='mes'
    ? 'padding:5px 14px;font-size:12px;font-weight:500;background:var(--t1);color:#fff;border:none;cursor:pointer;font-family:inherit;transition:all 150ms'
    : 'padding:5px 14px;font-size:12px;font-weight:500;background:transparent;color:var(--t2);border:none;cursor:pointer;font-family:inherit;transition:all 150ms';
  document.getElementById('cal-btn-sem').style.cssText = v==='semana'
    ? 'padding:5px 14px;font-size:12px;font-weight:500;background:var(--t1);color:#fff;border:none;cursor:pointer;font-family:inherit;transition:all 150ms'
    : 'padding:5px 14px;font-size:12px;font-weight:500;background:transparent;color:var(--t2);border:none;cursor:pointer;font-family:inherit;transition:all 150ms';
  renderCalendario();
}

function calPrev(){
  if(calVista==='mes'){
    calFecha.setMonth(calFecha.getMonth()-1);
  } else {
    calFecha.setDate(calFecha.getDate()-7);
  }
  renderCalendario();
}
function calNext(){
  if(calVista==='mes'){
    calFecha.setMonth(calFecha.getMonth()+1);
  } else {
    calFecha.setDate(calFecha.getDate()+7);
  }
  renderCalendario();
}
function calGoToday(){
  calFecha = new Date();
  renderCalendario();
}

function _calGetEventos(){
  const events = {};
  const today = new Date(); today.setHours(0,0,0,0);

  function addEvent(dateStr, ev){
    if(!dateStr) return;
    const d = dateStr.split('T')[0];
    if(!events[d]) events[d] = [];
    events[d].push(ev);
  }

  // Equipos — preventivo, refrigerante, batería, visita
  D.equipos.forEach(e=>{
    const cn = clientName(e.clienteId);
    const label = `${e.id} · ${cn.split(' ')[0]}`;
    const checks = [
      { date: e.proximoPreventivo, tipo: 'Prev.' },
      { date: e.proximoBateria || (e.ultimoBateria ? addDays(e.ultimoBateria,730) : null), tipo: 'Bat.' },
      { date: e.proximoAceite   || (e.ultimoAceite  ? addDays(e.ultimoAceite,730)  : null), tipo: 'Ref.' },
      { date: e.proximaVisita   || (()=>{
          if(!e.ultimaVisita) return null;
          const cli=D.clientes.find(c=>c.id===e.clienteId);
          const FD={'Semanal':7,'Quincenal':15,'Mensual':30,'Bimestral':60,'Trimestral':90,'Semestral':180,'Anual':365};
          const d=FD[cli?.frecuenciaVisita||''];
          return d?addDays(e.ultimaVisita,d):null;
        })(), tipo: 'Visita' }
    ];
    checks.forEach(({date,tipo})=>{
      if(!date) return;
      const diff = daysDiff(date);
      const cls  = diff < 0 ? 'ev-equip-venc' : 'ev-equip-prox';
      addEvent(date, {cls, label:`${tipo} · ${label}`, title:`${tipo}: ${e.id}`, detail:`Cliente: ${cn}`, tipo:'equipo'});
    });
  });

  // Follow-ups de cotizaciones
  D.cotizaciones.forEach(c=>{
    if(!c.fechaFollowup) return;
    if(['Facturada','Ejecutada','Rechazada'].includes(c.estado)) return;
    addEvent(c.fechaFollowup, {
      cls:'ev-followup',
      label:`${c.id} · ${toTitleCase(clientName(c.clienteId)).split(' ')[0]}`,
      title:`Follow-up: ${c.id}`,
      detail:`${clientName(c.clienteId)} — ${c.estado}`,
      tipo:'followup', ref: c.id
    });
  });

  // Recordatorios
  D.recordatorios.forEach(r=>{
    if(r.estado==='Hecho') return;
    const d = r.fechaHora ? r.fechaHora.split('T')[0] : null;
    if(!d) return;
    addEvent(d, {
      cls:'ev-recordatorio',
      label: r.titulo,
      title: r.titulo,
      detail: r.clienteId ? clientName(r.clienteId) : '',
      tipo:'recordatorio', ref: r.id
    });
  });

  // Pedidos
  (D.pedidos||[]).forEach(p=>{
    if(p.estado==='Realizado') return;
    if(!p.fechaARealizar) return;
    addEvent(p.fechaARealizar, {
      cls:'ev-pedido',
      label:`${p.id} · ${toTitleCase(clientName(p.clienteId)).split(' ')[0]}`,
      title:`Pedido: ${p.id}`,
      detail:`${clientName(p.clienteId)}${p.detalle?' — '+p.detalle.slice(0,40):''}`,
      tipo:'pedido', ref: p.id
    });
  });

  // Reuniones/eventos propios
  (D.eventos||[]).forEach(ev=>{
    addEvent(ev.fecha, {
      cls:'ev-reunion',
      label: ev.titulo,
      title: ev.titulo,
      detail: ev.descripcion||'',
      tipo:'reunion', ref: ev.id
    });
  });

  return events;
}

function renderCalendario(){
  const grid = document.getElementById('cal-grid');
  if(!grid) return;

  const events = _calGetEventos();
  const todayStr = new Date().toISOString().split('T')[0];

  // Rango del período visible (mes actual, o semana lun-dom actual)
  let desde, hasta;
  if(calVista==='mes'){
    desde = new Date(calFecha.getFullYear(), calFecha.getMonth(), 1).toISOString().split('T')[0];
    hasta = new Date(calFecha.getFullYear(), calFecha.getMonth()+1, 0).toISOString().split('T')[0];
  } else {
    const dow = calFecha.getDay();
    const lun = new Date(calFecha); lun.setDate(calFecha.getDate() - dow + (dow===0?-6:1));
    const dom = new Date(lun); dom.setDate(lun.getDate()+6);
    desde = lun.toISOString().split('T')[0];
    hasta = dom.toISOString().split('T')[0];
  }
  // Total eventos del período visible
  const totalEv = Object.keys(events).filter(d=>d>=desde&&d<=hasta).reduce((s,d)=>s+events[d].length,0);
  const sub = document.getElementById('cal-sub');
  if(sub) sub.textContent = `${totalEv} evento${totalEv!==1?'s':''} este período`;

  if(calVista==='mes'){
    _renderCalMes(grid, events, todayStr);
  } else {
    _renderCalSemana(grid, events, todayStr);
  }

  const t = calVista==='mes'
    ? `${MESES_CAL[calFecha.getMonth()]} ${calFecha.getFullYear()}`
    : _semanaLabel();
  document.getElementById('cal-title').textContent = t;
}

function _semanaLabel(){
  const d = new Date(calFecha);
  const dow = d.getDay();
  const lun = new Date(d); lun.setDate(d.getDate() - dow + (dow===0?-6:1));
  const dom = new Date(lun); dom.setDate(lun.getDate()+6);
  const fmtShort = dd => `${dd.getDate()} ${MESES_CAL[dd.getMonth()].slice(0,3)}`;
  return `${fmtShort(lun)} — ${fmtShort(dom)} ${dom.getFullYear()}`;
}

function _renderCalMes(grid, events, todayStr){
  const año  = calFecha.getFullYear();
  const mes  = calFecha.getMonth();
  const pDay = new Date(año, mes, 1).getDay(); // 0=Dom
  const dias = new Date(año, mes+1, 0).getDate();

  let html = '<div class="cal-grid-mes">';
  DIAS_SEMANA.forEach(d => {
    html += `<div class="cal-day-header">${d}</div>`;
  });

  const offset = pDay; // días vacíos al inicio
  const prevDias = new Date(año, mes, 0).getDate();

  for(let i=0; i<42; i++){
    let dayNum, isCurrentMonth=true, dateStr='';
    if(i < offset){
      dayNum = prevDias - offset + i + 1;
      isCurrentMonth = false;
      const d = new Date(año, mes-1, dayNum);
      dateStr = d.toISOString().split('T')[0];
    } else if(i - offset < dias){
      dayNum = i - offset + 1;
      const d = new Date(año, mes, dayNum);
      dateStr = d.toISOString().split('T')[0];
    } else {
      dayNum = i - offset - dias + 1;
      isCurrentMonth = false;
      const d = new Date(año, mes+1, dayNum);
      dateStr = d.toISOString().split('T')[0];
    }

    const isToday = dateStr === todayStr;
    const dayEvents = events[dateStr]||[];
    const MAX_SHOW = 3;
    const shown = dayEvents.slice(0,MAX_SHOW);
    const extra = dayEvents.length - MAX_SHOW;

    let evHtml = shown.map(ev=>
      `<div class="cal-event ${ev.cls}" data-date="${dateStr}" data-title="${_esc(ev.title)}" data-cls="${_esc(ev.cls)}" data-detail="${_esc(ev.detail)}" data-ref="${_esc(ev.ref||'')}" onclick="event.stopPropagation();calShowEventDetail(this.dataset.date,this.dataset.title,this.dataset.cls,this.dataset.detail,this.dataset.ref)" title="${_esc(ev.title)}">${_esc(ev.label)}</div>`
    ).join('');
    if(extra>0) evHtml += `<div class="cal-more" onclick="event.stopPropagation();calShowDay('${dateStr}')">+${extra} más</div>`;

    html += `<div class="cal-day${isToday?' cal-today':''}${!isCurrentMonth?' cal-other-month':''}" onclick="openCalEventModal('${dateStr}')">
      <div class="cal-day-num">${dayNum}</div>
      ${evHtml}
    </div>`;
  }
  html += '</div>';
  grid.innerHTML = html;
}

function _renderCalSemana(grid, events, todayStr){
  const d = new Date(calFecha);
  const dow = d.getDay();
  const lun = new Date(d); lun.setDate(d.getDate() - dow + (dow===0?-6:1));

  const dias = [];
  for(let i=0;i<7;i++){
    const dd = new Date(lun); dd.setDate(lun.getDate()+i);
    dias.push(dd);
  }

  let html = '<div class="cal-grid-sem">';

  // Header vacío para la columna de etiqueta
  html += '<div class="cal-day-header" style="background:var(--bg-soft)"></div>';
  dias.forEach(dd=>{
    const ds = dd.toISOString().split('T')[0];
    const isToday = ds===todayStr;
    html += `<div class="cal-sem-header">
      <div class="cal-sem-header-day">${DIAS_SEMANA[dd.getDay()]}</div>
      <div class="cal-sem-header-num${isToday?' today':''}">${dd.getDate()}</div>
    </div>`;
  });

  // Fila "Todo el día"
  html += '<div class="cal-sem-label">Todo<br>el día</div>';
  dias.forEach(dd=>{
    const ds = dd.toISOString().split('T')[0];
    const isToday = ds===todayStr;
    const dayEvents = events[ds]||[];
    let evHtml = dayEvents.map(ev=>
      `<div class="cal-event ${ev.cls}" data-date="${ds}" data-title="${_esc(ev.title)}" data-cls="${_esc(ev.cls)}" data-detail="${_esc(ev.detail)}" data-ref="${_esc(ev.ref||'')}" onclick="event.stopPropagation();calShowEventDetail(this.dataset.date,this.dataset.title,this.dataset.cls,this.dataset.detail,this.dataset.ref)" title="${_esc(ev.title)}" style="margin-bottom:3px">${_esc(ev.label)}</div>`
    ).join('');
    html += `<div class="cal-sem-allday${isToday?' today-col':''}" onclick="openCalEventModal('${ds}')">${evHtml}</div>`;
  });

  html += '</div>';
  grid.innerHTML = html;
}

function calShowDay(dateStr){
  const events = _calGetEventos();
  const evs = events[dateStr]||[];
  const [y,m,d] = dateStr.split('-');
  document.getElementById('modal-title').textContent = `${parseInt(d)} de ${MESES_CAL[parseInt(m)-1]} ${y}`;
  document.getElementById('modal-body').innerHTML = evs.length
    ? evs.map(ev=>`
        <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:0.5px solid var(--border)">
          <div style="width:10px;height:10px;border-radius:3px;flex-shrink:0;margin-top:3px" class="${ev.cls}" style="background:currentColor"></div>
          <div>
            <div style="font-weight:600;font-size:13.5px">${_esc(ev.title)}</div>
            ${ev.detail?`<div style="font-size:12px;color:var(--t2);margin-top:2px">${_esc(ev.detail)}</div>`:''}
          </div>
        </div>`).join('')
    : '<div class="empty">Sin eventos este día</div>';
  document.getElementById('modal-foot').innerHTML = `
    <button class="btn btn-outline" onclick="closeModal()">Cerrar</button>
    <button class="btn btn-primary" onclick="closeModal();openCalEventModal('${dateStr}')">+ Agregar evento</button>`;
  document.getElementById('modal-overlay').classList.add('open');
}

function calShowEventDetail(dateStr, title, cls, detail, ref){
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
      <div class="cal-modal-dot ${cls}"></div>
      <span style="font-size:12px;color:var(--t2)">${dateStr.split('-').reverse().join('/')}</span>
    </div>
    ${detail?`<p style="font-size:13.5px;color:var(--t1);line-height:1.6">${_esc(detail)}</p>`:''}`;
  const esReunion = cls==='ev-reunion' && ref;
  document.getElementById('modal-foot').innerHTML = esReunion
    ? `<button class="btn btn-outline" onclick="closeModal()">Cerrar</button>
       <button class="btn btn-danger" data-ref="${_esc(ref)}" onclick="delCalEvento(this.dataset.ref)">Eliminar</button>
       <button class="btn btn-primary" data-date="${_esc(dateStr)}" data-ref="${_esc(ref)}" onclick="openCalEventModal(this.dataset.date,this.dataset.ref)">Editar</button>`
    : `<button class="btn btn-outline" onclick="closeModal()">Cerrar</button>`;
  document.getElementById('modal-overlay').classList.add('open');
}

function openCalEventModal(fechaPrefill, eventoId){
  if(!D.eventos) D.eventos = [];
  const ev = eventoId ? D.eventos.find(e=>e.id===eventoId) : null;
  const cliOpts = '<option value="">— Sin cliente —</option>' +
    D.clientes.map(c=>`<option value="${c.id}" ${ev&&ev.clienteId===c.id?'selected':''}>${_esc(c.nombre)}</option>`).join('');
  document.getElementById('modal-title').textContent = ev ? 'Editar reunión / evento' : 'Nueva reunión / evento';
  document.getElementById('modal-body').innerHTML = `
    <div class="fg"><label class="fl">Título *</label>
      <input class="fc" id="cal-ev-titulo" placeholder="Ej: Reunión con Molinos Agro, Capacitación técnica..." value="${ev?_esc(ev.titulo):''}"></div>
    <div class="form-row">
      <div class="fg"><label class="fl">Fecha *</label>
        <input class="fc" type="date" id="cal-ev-fecha" value="${ev?ev.fecha:(fechaPrefill||today())}"></div>
      <div class="fg"><label class="fl">Hora</label>
        <input class="fc" type="time" id="cal-ev-hora" value="${ev&&ev.hora?ev.hora:'09:00'}"></div>
    </div>
    <div class="fg"><label class="fl">Cliente (opcional)</label>
      <select class="fc" id="cal-ev-cli">${cliOpts}</select></div>
    <div class="fg"><label class="fl">Descripción</label>
      <textarea class="fc" id="cal-ev-desc" rows="2" placeholder="Notas del evento...">${ev?_esc(ev.descripcion):''}</textarea></div>`;
  document.getElementById('modal-foot').innerHTML = `
    <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" data-id="${ev?_esc(ev.id):''}" onclick="saveCalEvento(this.dataset.id)">Guardar evento</button>`;
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(()=>document.getElementById('cal-ev-titulo')?.focus(), 80);
}

function saveCalEvento(eventoId){
  const titulo = (document.getElementById('cal-ev-titulo')?.value||'').trim();
  const fecha  = document.getElementById('cal-ev-fecha')?.value||'';
  if(!titulo||!fecha){ toast('⚠ Completá título y fecha'); return; }
  if(!D.eventos) D.eventos=[];
  const datos = {
    titulo,
    fecha,
    hora:  document.getElementById('cal-ev-hora')?.value||'',
    clienteId: document.getElementById('cal-ev-cli')?.value||'',
    descripcion: document.getElementById('cal-ev-desc')?.value.trim()||''
  };
  if(eventoId){
    const ev = D.eventos.find(e=>e.id===eventoId);
    if(ev) Object.assign(ev, datos);
  } else {
    D.eventos.push({ id:`EV-${Date.now()}`, ...datos });
  }
  persist();
  closeModal();
  renderCalendario();
  toast(eventoId ? `✓ Evento "${titulo}" actualizado` : `✓ Evento "${titulo}" agregado`);
}

function delCalEvento(eventoId){
  const ev=(D.eventos||[]).find(e=>e.id===eventoId);
  confirmDel(ev?_esc(ev.titulo):_esc(eventoId),()=>{
    D.eventos=D.eventos.filter(e=>e.id!==eventoId);
    persist();
    closeModal();
    renderCalendario();
    toast('Evento eliminado');
  });
}
