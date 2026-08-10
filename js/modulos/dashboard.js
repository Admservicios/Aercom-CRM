/**
 * ============================================================
 * AERCOM CRM v2
 * Dashboard Module
 * Migrado tal cual desde index.html (Sprint 4)
 * ============================================================
 *
 * Responsabilidad: KPIs, lista de alertas urgentes y gráficos
 * de la pantalla Dashboard.
 *
 * Dependencias externas (definidas en index.html / js/utils.js,
 * sin mover — no son responsabilidad de este módulo):
 *   D, curMonth, ESTADOS, equipStatus(), clientCritical(), clientName(),
 *   updateSidebarBadges(), closeModal(), Chart (CDN),
 *   fmtMoney(), daysDiff(), nowMonthStr(), _esc() (js/utils.js —
 *   PR-014.1, hardening XSS)
 *
 * `renderDashboard()` se invoca de forma síncrona durante el arranque
 * de index.html, por lo que este script debe cargar antes que el
 * script principal (igual que js/utils.js y js/storage.js).
 */

/* =========================
   ESTADO DEL MÓDULO
========================= */

let _charts = {};
let _dashAlertItems = [];

/* =========================
   ALERTAS — helpers de render
========================= */

function _dashItemHtml(it){
  const BS={
    'EQ.VENC':'background:var(--err-bg);color:var(--err)',
    'FOLLOW-UP':'background:var(--warn-bg);color:var(--warn)',
    'RECORDATORIO':'background:var(--info-bg);color:var(--info)',
    'EQ.PROX':'background:var(--warn-bg);color:var(--warn)',
    'S/FECHA':'background:var(--card-alt);color:var(--t3);border:1px solid var(--border)',
    'PS.VENC':'background:var(--info-bg);color:var(--info)',
    'A.FACT':'background:var(--purple-bg);color:var(--purple)',
    'BATERÍA':'background:var(--warn-bg);color:var(--warn)',
    'REFRIG.':'background:var(--info-bg);color:var(--info)'
  };
  const dot=it.color==='err'?'var(--err)':it.color==='afact'?'var(--purple)':it.color==='gris'?'var(--t4)':'var(--warn)';
  const d=it.days;
  const dHtml=d===null
    ?`<span class="dash-urgent-days" style="color:var(--purple);background:var(--purple-bg)">${fmtMoney(it.monto||0)}</span>`
    :d>=9000
    ?`<span class="dash-urgent-days" style="color:var(--t3);background:var(--bg-soft)">Sin fecha</span>`
    :d<0
    ?`<span class="dash-urgent-days red">${d} d.</span>`
    :d===0
    ?`<span class="dash-urgent-days orange">hoy</span>`
    :`<span class="dash-urgent-days" style="color:var(--warn);background:transparent">${d} d.</span>`;
  const critBdg=it.crit?`<span class="badge b-err" style="font-size:10px;padding:1px 4px;margin-left:4px;vertical-align:middle">CRÍTICO</span>`:'';
  return `<div class="dash-urgent-item">
    <div class="dash-urgent-dot" style="background:${dot}"></div>
    <span class="dash-urgent-badge" style="${BS[it.type]||''}">${it.type}</span>
    <div class="dash-urgent-body">
      <div class="dash-urgent-title">${_esc(it.main)}${critBdg}</div>
      ${it.client?`<div class="dash-urgent-sub">${_esc(it.client)}</div>`:''}
    </div>
    ${dHtml}
  </div>`;
}

function showDashAlerts(){
  if(!_dashAlertItems.length) return;
  document.getElementById('modal-title').textContent='Todas las alertas';
  document.getElementById('modal-body').innerHTML=`<div class="dash-urgent" style="border:none;border-radius:0">${_dashAlertItems.map(_dashItemHtml).join('')}</div>`;
  document.getElementById('modal-foot').innerHTML=`<button class="btn btn-outline" onclick="closeModal()">Cerrar</button>`;
  document.getElementById('modal-overlay').classList.add('open');
}

/* =========================
   KPIs + LISTA DE ALERTAS
========================= */

function renderDashboard(){
  const now=new Date();

  const equipVenc=D.equipos.filter(e=>{ const s=equipStatus(e); return s.st==='rojo'&&!s.sinFechas; });
  const equipProx=D.equipos.filter(e=>{ const s=equipStatus(e); return s.st==='amarillo'&&!s.sinFechas; });
  const equipSinFecha=D.equipos.filter(e=>equipStatus(e).sinFechas);
  const cotActivas=D.cotizaciones.filter(c=>!['Facturada','Ejecutada','Rechazada'].includes(c.estado));
  const cotFollowVenc=cotActivas.filter(c=>c.fechaFollowup&&daysDiff(c.fechaFollowup)<0);
  const mStr=curMonth||nowMonthStr();
  const facEst=D.facturacion_estados[mStr]||{};
  const facturadoN=D.clientes.filter(c=>{const s=facEst[c.id]||'Pendiente';return s==='Facturado'||s==='Cobrado';}).length;
  const visibleN=D.clientes.filter(c=>(facEst[c.id]||'Pendiente')!=='Excluido').length;
  const remAlerta=D.recordatorios.filter(r=>r.estado==='Pendiente'&&r.fechaHora&&daysDiff(r.fechaHora.split('T')[0])<=0);
  const pedActivos=(D.pedidos||[]).filter(p=>p.estado==='Pendiente'||p.estado==='En ejecución');
  const pedVenc=pedActivos.filter(p=>p.fechaARealizar&&daysDiff(p.fechaARealizar)<0);
  const cotAFacturar=D.cotizaciones.filter(c=>c.estado==='A facturar');
  const montoAFacturar=cotAFacturar.reduce((s,c)=>s+(c.monto||0),0);

  const h=now.getHours();
  const sal=h<13?'Buenos días':h<20?'Buenas tardes':'Buenas noches';
  const greetEl=document.getElementById('dash-greeting');
  if(greetEl) greetEl.textContent=`${sal}, Matías 👋`;
  // Bloque 1 — fecha + resumen
  document.getElementById('dash-date').textContent=
    now.toLocaleDateString('es-AR',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  const totalUrgent=equipVenc.length+cotFollowVenc.length+remAlerta.length+pedVenc.length+cotAFacturar.length;
  document.getElementById('dash-summary').textContent=
    totalUrgent>0
      ?`Tenés ${totalUrgent} alerta${totalUrgent>1?'s':''} que requieren atención`
      :'Sin alertas urgentes — todo en orden';

  // Lista priorizada (orden: crit+venc > crit+followup > recordatorios > venc > followup > crit+prox)
  const items=[];
  equipVenc.filter(e=>clientCritical(e.clienteId)).forEach(e=>{
    items.push({type:'EQ.VENC',color:'err',main:e.id,client:clientName(e.clienteId),crit:true,days:daysDiff(e.proximoPreventivo)});
  });
  cotFollowVenc.filter(c=>clientCritical(c.clienteId)).forEach(c=>{
    items.push({type:'FOLLOW-UP',color:'warn',main:c.id,client:clientName(c.clienteId),crit:true,days:daysDiff(c.fechaFollowup)});
  });
  remAlerta.forEach(r=>{
    const d=daysDiff(r.fechaHora.split('T')[0]);
    items.push({type:'RECORDATORIO',color:d<0?'err':'warn',main:r.titulo,client:r.clienteId?clientName(r.clienteId):'',crit:false,days:d});
  });
  equipVenc.filter(e=>!clientCritical(e.clienteId)).forEach(e=>{
    items.push({type:'EQ.VENC',color:'err',main:e.id,client:clientName(e.clienteId),crit:false,days:daysDiff(e.proximoPreventivo)});
  });

  // Baterías vencidas
  D.equipos.forEach(e=>{
    const {nextBateria}=equipStatus(e);
    if(!nextBateria) return;
    const d=daysDiff(nextBateria);
    if(d<0){
      items.push({type:'BATERÍA',color:'err',main:e.id,client:clientName(e.clienteId),crit:false,days:d});
    }
  });

  // Refrigerante vencido (usando ultimoAceite + 730)
  D.equipos.forEach(e=>{
    const {nextAceite}=equipStatus(e);
    if(!nextAceite) return;
    const d=daysDiff(nextAceite);
    if(d<0){
      items.push({type:'REFRIG.',color:'warn',main:e.id,client:clientName(e.clienteId),crit:false,days:d});
    }
  });

  cotFollowVenc.filter(c=>!clientCritical(c.clienteId)).forEach(c=>{
    items.push({type:'FOLLOW-UP',color:'warn',main:c.id,client:clientName(c.clienteId),crit:false,days:daysDiff(c.fechaFollowup)});
  });
  equipSinFecha.forEach(e=>{
    items.push({type:'S/FECHA',color:'gris',main:e.id,client:clientName(e.clienteId),crit:false,days:9999});
  });
  equipProx.filter(e=>clientCritical(e.clienteId)).forEach(e=>{
    items.push({type:'EQ.PROX',color:'warn',main:e.id,client:clientName(e.clienteId),crit:true,days:daysDiff(e.proximoPreventivo)});
  });
  pedVenc.forEach(p=>{
    items.push({type:'PS.VENC',color:'err',main:p.id,client:clientName(p.clienteId),crit:false,days:daysDiff(p.fechaARealizar)});
  });
  cotAFacturar.forEach(c=>{
    items.push({type:'A.FACT',color:'afact',main:c.id,client:clientName(c.clienteId),crit:false,days:null,monto:c.monto||0});
  });
  _dashAlertItems=items;

  // Bloque 2 + 3
  const urgentes=items.slice(0,6);
  const extraN=Math.max(0,items.length-6);
  let urgentHtml='';
  if(!items.length){
    urgentHtml=`<div style="padding:20px 14px;text-align:center;color:var(--t3);font-size:13px;font-style:italic">✓ Sin alertas activas — todo en orden</div>`;
  } else {
    urgentHtml=urgentes.map(_dashItemHtml).join('');
    if(extraN){
      urgentHtml+=`<div style="padding:9px 14px;border-top:0.5px solid var(--border)">
        <button onclick="showDashAlerts()" style="background:none;border:none;color:var(--info);font-size:12px;font-weight:500;cursor:pointer;padding:0;font-family:inherit">+ ${extraN} alerta${extraN>1?'s':''} más</button>
      </div>`;
    }
  }
  document.getElementById('dash-main').innerHTML=`
    <div class="dash-metrics">
      <div class="stat-card c-err">
        <span class="stat-icon">🔴</span>
        <div class="stat-val" style="color:var(--err)">${equipVenc.length}</div>
        <div class="stat-lbl">Equipos vencidos</div>
      </div>
      <div class="stat-card c-warn">
        <span class="stat-icon">🟡</span>
        <div class="stat-val" style="color:var(--warn)">${cotFollowVenc.length}</div>
        <div class="stat-lbl">Follow-ups vencidos</div>
      </div>
      <div class="stat-card c-info">
        <span class="stat-icon">📋</span>
        <div class="stat-val" style="color:var(--info)">${cotActivas.length}</div>
        <div class="stat-lbl">Cotizaciones activas</div>
      </div>
      <div class="stat-card c-info">
        <span class="stat-icon">🔧</span>
        <div class="stat-val" style="color:var(--info)">${pedActivos.length}</div>
        <div class="stat-lbl">Pedidos pendientes</div>
      </div>
      <div class="stat-card c-ok">
        <span class="stat-icon">✅</span>
        <div class="stat-val" style="color:var(--ok)">${facturadoN}/${visibleN}</div>
        <div class="stat-lbl">Facturado este mes</div>
      </div>
    </div>
    ${montoAFacturar>0?`<div style="text-align:right;font-size:13.5px;color:#d9730d;font-weight:700;margin-top:12px;padding:0 2px">💰 A facturar: ${fmtMoney(montoAFacturar)}</div>`:''}
    <div style="margin-top:28px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
        <div style="height:1px;background:var(--border);flex:1"></div>
        <span style="font-size:11px;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:.6px;white-space:nowrap">Lo urgente hoy</span>
        <div style="height:1px;background:var(--border);flex:1"></div>
      </div>
      <div class="dash-urgent">${urgentHtml}</div>
    </div>`;

  renderDashboardCharts();
  updateSidebarBadges();
}

/* =========================
   GRÁFICOS
========================= */

function renderDashboardCharts(){
  Object.values(_charts).forEach(c=>{try{c.destroy();}catch{}});
  _charts={};

  const isDark=document.body.classList.contains('dark-theme');
  const tColor=isDark?'#94a3b8':'#64748b';
  const gColor=isDark?'rgba(51, 65, 85, 0.4)':'rgba(226, 232, 240, 0.8)';

  function mkCanvas(id){return `<canvas id="${id}"></canvas>`;}
  function mkEmpty(){return `<div class="chart-empty">Sin datos aún</div>`;}

  // ── Gráfico 1: Cotizaciones por estado (dona) ──────────────────────────────
  const COT_CLR={'Solicitud':'#6b7280','Cotizar':'#06b6d4','Enviar':'#3b82f6',
    'En seguimiento':'#f59e0b','Aprobada':'#22c55e','A facturar':'#d9730d',
    'Facturada':'#8b5cf6','Ejecutada':'#10b981','Rechazada':'#ef4444'};
  const cotCnt={};
  ESTADOS.forEach(e=>cotCnt[e]=0);
  D.cotizaciones.forEach(c=>{if(cotCnt[c.estado]!==undefined)cotCnt[c.estado]++;});
  const cotLbls=ESTADOS.filter(e=>cotCnt[e]>0);
  const cotData=cotLbls.map(e=>cotCnt[e]);
  const cotClrs=cotLbls.map(e=>COT_CLR[e]);

  const leg1=document.getElementById('chart1-legend');
  const w1=document.getElementById('chart-cotz-wrap');
  if(cotLbls.length){
    leg1.innerHTML=cotLbls.map((e,i)=>`<div class="chart-leg-item"><div class="chart-leg-dot" style="background:${cotClrs[i]}"></div>${e}&thinsp;<strong>${cotData[i]}</strong></div>`).join('');
    w1.innerHTML=mkCanvas('chart-cotz');
    _charts.cotz=new Chart(document.getElementById('chart-cotz'),{
      type:'doughnut',
      data:{labels:cotLbls,datasets:[{data:cotData,backgroundColor:cotClrs,borderWidth:0,hoverOffset:5}]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` ${c.label}: ${c.raw}`}}},
        cutout:'62%'}
    });
  } else { leg1.innerHTML=''; w1.innerHTML=mkEmpty(); }

  // ── Gráfico 2: Equipos por tipo (barras) ───────────────────────────────────
  // Conteo dinámico: cuenta todos los tipos que existan en los datos
  const tipoCntDyn={};
  D.equipos.forEach(e=>{
    const t=e.tipo||'Sin tipo';
    tipoCntDyn[t]=(tipoCntDyn[t]||0)+1;
  });
  const TIPO_ORDER=['Grupo Electrógeno','Electrocompresor','Motocompresor','Motobomba','Secadora de Aire','Tablero Electrico','Sin tipo'];
  const TCLRS_MAP={'Grupo Electrógeno':'#3b82f6','Electrocompresor':'#10b981','Motocompresor':'#f59e0b','Motobomba':'#8b5cf6','Secadora de Aire':'#06b6d4','Tablero Electrico':'#e11d48','Sin tipo':'#94a3b8'};
  // Ordenar: primero los del orden definido, luego cualquier tipo no esperado
  const tiposOrdenados=[...TIPO_ORDER,...Object.keys(tipoCntDyn).filter(t=>!TIPO_ORDER.includes(t))];
  const tLbls=tiposOrdenados.filter(t=>tipoCntDyn[t]>0);
  const tData=tLbls.map(t=>tipoCntDyn[t]);
  const FALLBACK_COLORS=['#64748b','#a855f7','#ec4899','#f97316'];
  const tClrs=tLbls.map((t,i)=>TCLRS_MAP[t]||(FALLBACK_COLORS[i%FALLBACK_COLORS.length]));

  const w2=document.getElementById('chart-equip-wrap');
  if(tLbls.length){
    w2.innerHTML=mkCanvas('chart-equip');
    _charts.equip=new Chart(document.getElementById('chart-equip'),{
      type:'bar',
      data:{labels:tLbls,datasets:[{data:tData,backgroundColor:tClrs,borderRadius:5,borderWidth:0}]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` ${c.raw}`}}},
        scales:{
          x:{ticks:{color:tColor,font:{size:11}},grid:{display:false},border:{color:gColor}},
          y:{ticks:{color:tColor,precision:0,stepSize:1,font:{size:11}},grid:{color:gColor},border:{display:false}}
        }}
    });
  } else { w2.innerHTML=mkEmpty(); }

  // ── Gráfico 3: Facturación del mes (dona) ──────────────────────────────────
  const mStr=curMonth||nowMonthStr();
  const facEst=D.facturacion_estados[mStr]||{};
  let cobr=0,factN=0,pend=0,excl=0;
  D.clientes.forEach(c=>{
    const st=facEst[c.id]||'Pendiente';
    if(st==='Cobrado')cobr++;
    else if(st==='Facturado')factN++;
    else if(st==='Excluido')excl++;
    else pend++; // Pendiente (y cualquier otro estado)
  });

  const leg3=document.getElementById('chart3-legend');
  const w3=document.getElementById('chart-fact-wrap');
  if(cobr+factN+pend+excl>0){
    leg3.innerHTML=[
      `<div class="chart-leg-item"><div class="chart-leg-dot" style="background:#10b981"></div>Cobrado&thinsp;<strong>${cobr}</strong></div>`,
      `<div class="chart-leg-item"><div class="chart-leg-dot" style="background:#3b82f6"></div>Facturado&thinsp;<strong>${factN}</strong></div>`,
      `<div class="chart-leg-item"><div class="chart-leg-dot" style="background:#f59e0b"></div>Pendiente&thinsp;<strong>${pend}</strong></div>`,
      excl?`<div class="chart-leg-item"><div class="chart-leg-dot" style="background:#94a3b8"></div>Excluido&thinsp;<strong>${excl}</strong></div>`:''
    ].filter(Boolean).join('');
    w3.innerHTML=mkCanvas('chart-fact');
    _charts.fact=new Chart(document.getElementById('chart-fact'),{
      type:'doughnut',
      data:{labels:['Cobrado','Facturado','Pendiente','Excluido'].slice(0,excl?4:3),
        datasets:[{data:[cobr,factN,pend,...(excl?[excl]:[])],backgroundColor:['#10b981','#3b82f6','#f59e0b','#94a3b8'].slice(0,excl?4:3),borderWidth:0,hoverOffset:5}]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` ${c.label}: ${c.raw}`}}},
        cutout:'62%'}
    });
  } else { leg3.innerHTML=''; w3.innerHTML=mkEmpty(); }
}
