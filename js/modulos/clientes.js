/**
 * ============================================================
 * AERCOM CRM v2
 * Clientes Module
 * Migrado tal cual desde index.html (Sprint 5)
 * ============================================================
 *
 * Responsabilidad: alta, baja, modificación, buscador, filtros
 * y ficha del cliente (incluye las 6 pestañas de la ficha:
 * generales, equipos, cotizaciones, facturación, recordatorios
 * y pedidos — documentado como responsabilidad de Clientes en
 * PROJECT.md).
 *
 * Las pestañas de la ficha son vistas de solo lectura sobre datos
 * de otros dominios (equipos, cotizaciones, recordatorios, pedidos);
 * no poseen ni mutan esos datos — solo los filtran por clienteId
 * para mostrarlos. La única mutación cruzada es en saveClient(), al
 * renombrar el ID de un cliente: actualiza las referencias
 * (clienteId) en los demás dominios para mantener integridad
 * referencial, responsabilidad propia de Clientes sobre su ID.
 *
 * Dependencias externas (definidas en index.html / js/utils.js /
 * js/storage.js, sin mover — no son responsabilidad de este módulo):
 *   D, persist(), toast(), closeModal(), confirmDel(), updateSidebarBadges(),
 *   toggleClear(), equipStatus(), clientCritical()*, clientName()*,
 *   eqDateCell(), E_COLOR, curMonth, openEquipModal(), openQuoteModal(),
 *   openPedidoModal(), fmtMoney(), fmtDate(), fmtDateTime(), daysDiff(),
 *   monthLabel(), nowMonthStr(), _esc() (js/utils.js)
 *
 *   (*) clientName()/clientCritical() siguen en index.html porque las usan
 *   también Dashboard y Pipeline — son helpers de dominio compartidos.
 */

/* =========================
   ESTADO DEL MÓDULO
========================= */

let _cliSort = { col: 'nombre', dir: 1 };
let fichaClientId=null;

/* =========================
   LISTADO — orden y filtro
========================= */

function _cliSortedList(base) {
  const col = _cliSort.col, dir = _cliSort.dir;
  return [...(base||D.clientes)].sort((a, b) => {
    let va = a[col] ?? '', vb = b[col] ?? '';
    if (col === 'presupuesto') { va = Number(va)||0; vb = Number(vb)||0; return (va-vb)*dir; }
    return String(va).localeCompare(String(vb), 'es') * dir;
  });
}

function _cliSortIcon(col) {
  if (_cliSort.col !== col) return `<span style="color:var(--t4);margin-left:3px;font-size:9px">⇅</span>`;
  return _cliSort.dir===1
    ? `<span style="color:var(--info);margin-left:3px;font-size:9px">↑</span>`
    : `<span style="color:var(--info);margin-left:3px;font-size:9px">↓</span>`;
}

function cliSortBy(col) {
  if (_cliSort.col===col) _cliSort.dir*=-1; else { _cliSort.col=col; _cliSort.dir=1; }
  renderClientes();
}

function applyCliFilter(){
  const q=(document.getElementById('cli-q')||{value:''}).value.trim().toLowerCase();
  const tipo=(document.getElementById('cli-f-tipo')||{value:''}).value;
  const est=(document.getElementById('cli-f-est')||{value:''}).value;
  let n=0;
  document.querySelectorAll('#cli-tbody tr').forEach(tr=>{
    // Busco el ID del cliente en el data-id del botón de ficha
    const btn=tr.querySelector('button[onclick*="openFicha"]');
    if(!btn){tr.style.display='none';return;}
    const id=btn.dataset.id;
    if(!id){tr.style.display='none';return;}
    const c=D.clientes.find(x=>x.id===id);
    if(!c){tr.style.display='none';return;}
    const tOk=!tipo||(tipo==='Sanatorio/Clínica'?['Sanatorio','Clínica','Sanatorio/Clínica'].includes(c.tipo):c.tipo===tipo);
    const qOk=!q||(c.nombre||'').toLowerCase().includes(q)||(c.email||'').toLowerCase().includes(q)||(c.contacto||'').toLowerCase().includes(q)||(c.ciudad||'').toLowerCase().includes(q)||(c.tipo||'').toLowerCase().includes(q);
    const ok=qOk&&tOk&&(!est||c.estadoCliente===est);
    tr.style.display=ok?'':'none';
    if(ok) n++;
  });
  const el=document.getElementById('cli-count');
  if(el)el.textContent=(q||tipo||est)&&n<D.clientes.length?`Mostrando ${n} de ${D.clientes.length} clientes`:'';
  toggleClear('cli',q||tipo||est);
}
function clearCliFilter(){
  ['cli-q','cli-f-tipo','cli-f-est'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  applyCliFilter();
}

/* =========================
   LISTADO — render
========================= */

function renderClientes(){
  const activos=D.clientes.filter(c=>c.estadoCliente==='Activo').length;
  document.getElementById('clientes-sub').textContent=
    `${D.clientes.length} clientes · ${activos} activos`;

  const tbody = document.getElementById('cli-tbody');
  if (!tbody) return;

  // Actualiza headers sort
  [['nombre','Cliente'],['tipo','Tipo'],['ciudad','Ciudad'],['presupuesto','Presupuesto mens.'],['estadoCliente','Estado']].forEach(([col,lbl])=>{
    const el = document.getElementById('th-cli-'+col);
    if (el) { el.style.cursor='pointer'; el.innerHTML=lbl+_cliSortIcon(col); }
  });

  if (!D.clientes.length) {
    tbody.innerHTML=`<tr><td colspan="8"><div class="empty">No hay clientes registrados</div></td></tr>`;
    updateSidebarBadges(); return;
  }
  const TIPO_B={'Sanatorio':'b-err','Clínica':'b-err','Sanatorio/Clínica':'b-err','Industrial':'b-info','Industria':'b-info','Comercial':'b-purple','Comercio':'b-purple','Edificio':'b-ok','Otro':'b-gray'};
  const EST_B={'Activo':'b-ok','Inactivo':'b-gray','Suspendido':'b-warn'};
  const COLORS=['#1d6fa4','#0a7c5c','#6d40c4','#c4600a','#c73030','#2563bd'];
  function initials(n){return (n||'').split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase()||'?';}
  function avatarColor(id){let h=0;for(const c of(id||''))h=(h*31+c.charCodeAt(0))&0xffff;return COLORS[h%COLORS.length];}

  tbody.innerHTML = _cliSortedList().map(c => {
    const bg = avatarColor(c.id);
    const crit = c.prioridad==='Crítico';
    const equipN = D.equipos.filter(e=>e.clienteId===c.id).length;
    const pedN = (D.pedidos||[]).filter(p=>p.clienteId===c.id&&(p.estado==='Pendiente'||p.estado==='En ejecución')).length;
    // Mostrar ID del cliente en el circulito — más útil que las iniciales
    const avatarLabel = c.id||initials(c.nombre);
    // Ajustar tamaño de fuente según longitud del ID
    const avatarFs = avatarLabel.length>5?'8px':avatarLabel.length>4?'9px':avatarLabel.length>3?'10px':'11px';
    return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;border-radius:8px;background:${bg};display:flex;align-items:center;justify-content:center;font-size:${avatarFs};font-weight:700;color:#fff;flex-shrink:0;letter-spacing:-.3px;font-family:monospace;padding:2px">${avatarLabel}</div>
          <div>
            <div style="font-weight:600;font-size:13.5px">${_esc(c.nombre)}${crit?`<span class="badge b-err" style="font-size:9px;padding:1px 5px;margin-left:6px;vertical-align:middle">CRÍTICO</span>`:''}</div>
            <div style="font-size:11px;color:var(--t3);margin-top:1px">${equipN} equipo${equipN!==1?'s':''}${pedN?` · <span style="color:var(--warn);font-weight:600">${pedN} pedido${pedN!==1?'s':''} activo${pedN!==1?'s':''}</span>`:''}</div>
            ${(c.incluyeNS||c.incluyePreventivo||c.incluyeCombustible||c.incluyePlataforma||c.incluyeBateria||c.incluyeOtro)?`<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:4px">
              ${c.incluyeNS?'<span style="font-size:10px;background:var(--ok-bg);color:var(--ok);padding:1px 5px;border-radius:var(--r-sm);font-weight:600">NS</span>':''}
              ${c.incluyePreventivo?'<span style="font-size:10px;background:var(--ok-bg);color:var(--ok);padding:1px 5px;border-radius:var(--r-sm);font-weight:600">Prev.</span>':''}
              ${c.incluyeCombustible?'<span style="font-size:10px;background:var(--ok-bg);color:var(--ok);padding:1px 5px;border-radius:var(--r-sm);font-weight:600">Comb.</span>':''}
              ${c.incluyePlataforma?'<span style="font-size:10px;background:var(--ok-bg);color:var(--ok);padding:1px 5px;border-radius:var(--r-sm);font-weight:600">Plat.</span>':''}
              ${c.incluyeBateria?'<span style="font-size:10px;background:var(--ok-bg);color:var(--ok);padding:1px 5px;border-radius:var(--r-sm);font-weight:600">Bat.</span>':''}
              ${c.incluyeOtro?`<span style="font-size:10px;background:var(--info-bg);color:var(--info);padding:1px 5px;border-radius:var(--r-sm);font-weight:600" title="${_esc(c.incluyeOtro)}">+ Otro</span>`:''}
            </div>`:''}
          </div>
        </div>
      </td>
      <td><span class="badge ${TIPO_B[c.tipo]||'b-gray'}" style="font-size:11px">${c.tipo||'—'}</span></td>
      <td style="font-size:12.5px">${_esc(c.ciudad)||'—'}</td>
      <td style="font-size:12.5px">${_esc(c.contacto)||'—'}${c.telefono?`<br><span style="color:var(--t2)">${_esc(c.telefono)}</span>`:''}</td>
      <td style="font-size:12.5px">${c.frecuenciaVisita||'—'}</td>
      <td style="font-size:12.5px;font-weight:500">${c.presupuesto?'$ '+Number(c.presupuesto).toLocaleString('es-AR'):'—'}</td>
      <td><span class="badge ${EST_B[c.estadoCliente]||'b-gray'}" style="font-size:11px">${c.estadoCliente||'Activo'}</span></td>
      <td style="white-space:nowrap">
        <div style="display:flex;gap:5px;align-items:center">
          <button class="btn btn-outline btn-sm" data-id="${_esc(c.id)}" onclick="openFicha(this.dataset.id)">Ver ficha</button>
          <button class="btn btn-outline btn-sm" data-id="${_esc(c.id)}" onclick="openClientModal(this.dataset.id)" title="Editar" style="padding:5px 8px">✏</button>
          <button class="btn-del" data-id="${_esc(c.id)}" onclick="delClientConfirm(this.dataset.id)" title="Eliminar">🗑</button>
        </div>
      </td>
    </tr>`;
  }).join('');
  updateSidebarBadges();
}

/* =========================
   MODAL ALTA / EDICIÓN
========================= */

function openClientModal(id){
  const c=id?D.clientes.find(x=>x.id===id):null;
  const tipoOpts=['Sanatorio/Clínica','Industria','Comercio','Edificio','Otro'].map(t=>`<option value="${t}" ${c?.tipo===t?'selected':''}>${t}</option>`).join('');
  const estOpts=['Activo','Inactivo','Suspendido'].map(e=>`<option value="${e}" ${(c?c.estadoCliente===e:e==='Activo')?'selected':''}>${e}</option>`).join('');
  const freqOpts=['Semanal','Quincenal','Mensual','Bimestral','Trimestral','Semestral','Anual'].map(f=>`<option value="${f}" ${c?.frecuenciaVisita===f?'selected':''}>${f}</option>`).join('');
  const nextId=`C${String(D.clientes.length+1).padStart(3,'0')}`;
  document.getElementById('modal-title').textContent=c?'Editar cliente':'Nuevo cliente';
  document.getElementById('modal-body').innerHTML=`
    <div class="form-row" style="align-items:flex-end;gap:12px">
      <div class="fg" style="max-width:160px;flex:0 0 auto">
        <label class="fl">Código ID
          <span style="font-size:10px;font-weight:400;color:var(--t3);margin-left:4px">(único)</span>
        </label>
        <input class="fc" id="cli-id-edit"
          value="${c?c.id:nextId}"
          placeholder="${nextId}"
          style="font-family:monospace;font-size:13px;font-weight:700;letter-spacing:.5px;text-transform:uppercase"
          oninput="this.value=this.value.toUpperCase().replace(/[^A-Z0-9\-_]/g,'')">
        <div style="font-size:10.5px;color:var(--t3);margin-top:3px">Solo letras, números y guiones</div>
      </div>
      <div class="fg">
        <label class="fl">Nombre *</label>
        <input class="fc" id="cli-nombre" value="${c?c.nombre.replace(/"/g,'&quot;'):''}" placeholder="Nombre del cliente">
      </div>
    </div>
    <div class="form-row">
      <div class="fg"><label class="fl">Tipo</label>
        <select class="fc" id="cli-tipo" onchange="onCliTipoChange()">
          <option value="">— Seleccionar —</option>${tipoOpts}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="fg"><label class="fl">Ciudad</label><input class="fc" id="cli-ciudad" value="${_esc(c?.ciudad)}" placeholder="Ej: Rosario"></div>
      <div class="fg"><label class="fl">Estado</label><select class="fc" id="cli-estado">${estOpts}</select></div>
    </div>
    <div class="form-row">
      <div class="fg"><label class="fl">Nombre de contacto</label><input class="fc" id="cli-contacto" value="${_esc(c?.contacto)}" placeholder="Ej: Ing. Fernández"></div>
      <div class="fg"><label class="fl">Teléfono</label><input class="fc" id="cli-telefono" value="${_esc(c?.telefono)}" placeholder="0341-000-0000"></div>
    </div>
    <div class="form-row">
      <div class="fg"><label class="fl">Email</label><input class="fc" id="cli-email" type="email" value="${_esc(c?.email)}" placeholder="contacto@empresa.com"></div>
      <div class="fg"><label class="fl">Frecuencia de visita</label>
        <select class="fc" id="cli-frecuencia"><option value="">— Sin definir —</option>${freqOpts}</select>
      </div>
    </div>
    <div class="fg"><label class="fl">Presupuesto mensual ($)</label><input class="fc" id="cli-presupuesto" type="number" min="0" value="${c?.presupuesto||''}" placeholder="0"></div>
    <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border)">
      <div style="font-size:12px;font-weight:600;color:var(--t2);text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px">Facturación</div>
      <div class="form-row">
        <div class="fg"><label class="fl">Ajuste de precio</label>
          <select class="fc" id="cli-ajuste">
            ${['IPC','Dólar divisa','Dólar billete','Fijo pesos'].map(a=>`<option value="${a}" ${(c?.ajuste||'IPC')===a?'selected':''}>${a}</option>`).join('')}
          </select>
        </div>
        <div class="fg"><label class="fl">Modalidad de facturación</label>
          <select class="fc" id="cli-facturacion" onchange="onFacturacionChange()">
            ${['Manual','Automática','Por fecha'].map(f=>`<option value="${f}" ${(c?.facturacion||'Manual')===f?'selected':''}>${f}</option>`).join('')}
          </select>
          <div id="fact-fecha-cfg" style="margin-top:8px;display:${(c?.facturacion==='Por fecha')?'block':'none'}">
            <label class="fl" style="margin-bottom:4px">Facturar a partir del día</label>
            <div style="display:flex;align-items:center;gap:8px">
              <input class="fc" type="number" id="cli-fact-dia" min="1" max="28" value="${c?.facturacionDia||15}" style="width:80px;text-align:center;font-size:15px;font-weight:600" placeholder="15">
              <span style="font-size:13px;color:var(--t2)">de cada mes</span>
            </div>
            <div style="font-size:11.5px;color:var(--t3);margin-top:4px">Ej: 15 → facturás a partir del día 15 · 20 → a partir del 20</div>
          </div>
        </div>
      </div>
      <div class="form-row">
        <div class="fg" style="display:flex;align-items:center;gap:8px;padding-top:6px">
          <input type="checkbox" id="cli-oc" ${c?.requiereOC?'checked':''} style="width:16px;height:16px;cursor:pointer">
          <label for="cli-oc" style="margin:0;font-size:13px;cursor:pointer;color:var(--t1)">Requiere Orden de Compra (OC)</label>
        </div>
        <div class="fg" style="display:flex;align-items:center;gap:8px;padding-top:6px">
          <input type="checkbox" id="cli-hes" ${c?.requiereHES?'checked':''} style="width:16px;height:16px;cursor:pointer">
          <label for="cli-hes" style="margin:0;font-size:13px;cursor:pointer;color:var(--t1)">Requiere HES</label>
        </div>
      </div>
    </div>
    <div style="margin-top:14px;padding:12px 14px;background:var(--bg-soft);border-radius:var(--r-sm);border:1px solid var(--border)">
      <div style="font-size:12px;color:var(--t3)">💡 Los servicios incluidos en el abono (NS, Preventivo, Combustible, etc.) se configuran en la pestaña <strong>Facturación</strong> de la ficha del cliente.</div>
    </div>`;
  document.getElementById('modal-foot').innerHTML=`
    <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" data-id="${_esc(id||'')}" data-nextid="${_esc(nextId)}" onclick="saveClient(this.dataset.id,this.dataset.nextid)">Guardar</button>`;
  document.getElementById('modal-overlay').classList.add('open');
}

function onCliTipoChange(){}

function onFacturacionChange(){
  const val = (document.getElementById('cli-facturacion')||{}).value;
  const cfg = document.getElementById('fact-fecha-cfg');
  if(cfg) cfg.style.display = val==='Por fecha' ? 'block' : 'none';
}

function saveClient(id,nextId){
  const existing = id ? D.clientes.find(x=>x.id===id) : null;
  const nombreEl=document.getElementById('cli-nombre');
  const nombre=(nombreEl?.value||'').trim();
  if(!nombre){
    if(nombreEl){nombreEl.style.borderColor='var(--err)';nombreEl.focus();}
    toast('⚠ El nombre del cliente es obligatorio.');
    return;
  }
  if(nombreEl) nombreEl.style.borderColor='';
  // Leer y validar el ID editado
  const idEditEl=document.getElementById('cli-id-edit');
  const nuevoId=(idEditEl?.value||'').trim().toUpperCase()||nextId;
  // Verificar que el ID no esté en uso por OTRO cliente
  const idEnUso=D.clientes.find(x=>x.id===nuevoId && x.id!==id);
  if(idEnUso){
    if(idEditEl){idEditEl.style.borderColor='var(--err)';idEditEl.focus();}
    toast(`⚠ El código "${nuevoId}" ya está en uso por "${idEnUso.nombre}"`);
    return;
  }
  if(idEditEl) idEditEl.style.borderColor='';
  // Si el ID cambió, actualizar referencias en equipos, cotizaciones, etc.
  const idAnterior=id||null;
  const idFinal=nuevoId;
  if(idAnterior && idAnterior!==idFinal){
    D.equipos.forEach(e=>{ if(e.clienteId===idAnterior) e.clienteId=idFinal; });
    D.cotizaciones.forEach(c=>{ if(c.clienteId===idAnterior) c.clienteId=idFinal; });
    (D.pedidos||[]).forEach(p=>{ if(p.clienteId===idAnterior) p.clienteId=idFinal; });
    D.recordatorios.forEach(r=>{ if(r.clienteId===idAnterior) r.clienteId=idFinal; });
    // Actualizar facturación estados
    Object.keys(D.facturacion_estados).forEach(mes=>{
      if(D.facturacion_estados[mes][idAnterior]!==undefined){
        D.facturacion_estados[mes][idFinal]=D.facturacion_estados[mes][idAnterior];
        delete D.facturacion_estados[mes][idAnterior];
      }
    });
  }
  const tipo=document.getElementById('cli-tipo').value;
  const obj={
    id:idFinal, nombre, tipo, prioridad:'Normal',
    ciudad:document.getElementById('cli-ciudad').value.trim(),
    estadoCliente:document.getElementById('cli-estado').value,
    contacto:document.getElementById('cli-contacto').value.trim(),
    telefono:document.getElementById('cli-telefono').value.trim(),
    email:document.getElementById('cli-email').value.trim(),
    frecuenciaVisita:document.getElementById('cli-frecuencia').value,
    presupuesto:Number(document.getElementById('cli-presupuesto').value)||0,
    ajuste:document.getElementById('cli-ajuste').value,
    requiereOC:document.getElementById('cli-oc').checked,
    requiereHES:document.getElementById('cli-hes').checked,
    facturacion:document.getElementById('cli-facturacion').value,
    facturacionDia: document.getElementById('cli-facturacion').value==='Por fecha'
      ? (parseInt((document.getElementById('cli-fact-dia')||{value:'15'}).value)||15)
      : null,
    // Preservar los incluidos en abono que vienen del objeto existente (se editan en ficha)
    incluyeNS:          existing?.incluyeNS||false,
    incluyePreventivo:  existing?.incluyePreventivo||false,
    incluyeCombustible: existing?.incluyeCombustible||false,
    incluyePlataforma:  existing?.incluyePlataforma||false,
    incluyeBateria:     existing?.incluyeBateria||false,
    incluyeOtro:        existing?.incluyeOtro||''
  };
  const i=D.clientes.findIndex(x=>x.id===id);
  if(i>-1) D.clientes[i]=obj; else D.clientes.push(obj);
  persist(); closeModal(); renderClientes();
  toast(`Cliente "${nombre}" guardado`);
}

function delClientConfirm(id){
  const c=D.clientes.find(x=>x.id===id);
  confirmDel(c?_esc(c.nombre):_esc(id),()=>{
    D.clientes=D.clientes.filter(x=>x.id!==id);
    persist(); renderClientes(); toast('Cliente eliminado');
  });
}

/* =========================
   FICHA CLIENTE
========================= */

function openFicha(id){
  fichaClientId=id;
  const c=D.clientes.find(x=>x.id===id);
  if(!c) return;

  const equipos    = D.equipos.filter(e=>e.clienteId===id);
  const equipN     = equipos.length;
  const equipVenc  = equipos.filter(e=>equipStatus(e).st==='rojo').length;
  const equipProx  = equipos.filter(e=>equipStatus(e).st==='amarillo').length;
  const cotAll     = D.cotizaciones.filter(q=>q.clienteId===id);
  const cotN       = cotAll.length;
  const cotActN    = cotAll.filter(q=>!['Facturada','Ejecutada','Rechazada'].includes(q.estado)).length;
  const cotAFact   = cotAll.filter(q=>q.estado==='A facturar').length;
  const remN       = D.recordatorios.filter(r=>r.clienteId===id).length;
  const pedAll     = (D.pedidos||[]).filter(p=>p.clienteId===id);
  const pedN       = pedAll.length;
  const pedActN    = pedAll.filter(p=>p.estado==='Pendiente'||p.estado==='En ejecución').length;

  // Tipo badge colors
  const TIPO_CLR   = {'Sanatorio/Clínica':'#c73030','Sanatorio':'#c73030','Clínica':'#c73030','Industria':'#1d6fa4','Industrial':'#1d6fa4','Comercio':'#6d40c4','Comercial':'#6d40c4','Edificio':'#0a7c5c','Otro':'#706f6b'};
  const tipoColor  = TIPO_CLR[c.tipo]||'#706f6b';
  const estBadge   = {'Activo':'b-ok','Inactivo':'b-gray','Suspendido':'b-warn'}[c.estadoCliente]||'b-gray';

  // Estado general del cliente basado en equipos
  const estadoGeneral = equipVenc>0 ? {dot:'#c73030',txt:'Requiere atención'} :
                        equipProx>0 ? {dot:'#f59e0b',txt:'Próximos vencimientos'} :
                        {dot:'#0a7c5c',txt:'Al día'};

  document.getElementById('ficha-title').innerHTML=`
    <div style="width:100%">
      <!-- Banda de color por tipo -->
      <div style="height:3px;background:${tipoColor};border-radius:0;margin:-28px -36px 20px;width:calc(100% + 72px)"></div>
      <!-- Nombre y tipo -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
        <div style="flex:1;min-width:0">
          <div style="font-size:22px;font-weight:700;color:var(--t1);line-height:1.2;margin-bottom:10px">${_esc(c.nombre)}</div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:${tipoColor};font-weight:600;background:${tipoColor}18;padding:2px 8px;border-radius:var(--r-sm)">
              ${c.tipo||'Sin tipo'}
            </span>
            ${c.ciudad?`<span style="font-size:12px;color:var(--t3)">📍 ${_esc(c.ciudad)}</span>`:''}
            <span class="badge ${estBadge}" style="font-size:11px">${c.estadoCliente||'Activo'}</span>
          </div>
        </div>
        <!-- Estado general -->
        <div style="flex-shrink:0;text-align:right">
          <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end">
            <div style="width:8px;height:8px;border-radius:50%;background:${estadoGeneral.dot}"></div>
            <span style="font-size:12px;font-weight:600;color:${estadoGeneral.dot}">${estadoGeneral.txt}</span>
          </div>
          ${c.frecuenciaVisita?`<div style="font-size:11px;color:var(--t3);margin-top:4px">Visita ${c.frecuenciaVisita.toLowerCase()}</div>`:''}
        </div>
      </div>
    </div>`;

  document.getElementById('ficha-crit').innerHTML='';

  // Stats row — más visual y con contexto
  document.getElementById('ficha-subtitle').innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:1px;background:var(--border);border-top:1px solid var(--border);border-bottom:1px solid var(--border);margin:18px -36px 0">
      <div style="background:var(--card);padding:22px 24px;text-align:center">
        <div style="font-size:30px;font-weight:700;line-height:1;letter-spacing:-1px;${equipVenc?'color:var(--err)':equipProx?'color:#b45309':'color:var(--t1)'}">${equipN}</div>
        <div style="font-size:11px;color:var(--t3);margin-top:7px;text-transform:uppercase;letter-spacing:.5px;font-weight:600">Equipos</div>
        ${equipVenc?`<div style="font-size:10px;color:var(--err);margin-top:2px;font-weight:600">${equipVenc} vencido${equipVenc!==1?'s':''}</div>`:equipProx?`<div style="font-size:10px;color:#b45309;margin-top:2px">${equipProx} próximo${equipProx!==1?'s':''}</div>`:'<div style="font-size:10px;color:var(--ok);margin-top:2px">Al día ✓</div>'}
      </div>
      <div style="background:var(--card);padding:22px 24px;text-align:center">
        <div style="font-size:30px;font-weight:700;line-height:1;letter-spacing:-1px;${cotActN?'color:var(--info)':'color:var(--t1)'}">${cotN}</div>
        <div style="font-size:11px;color:var(--t3);margin-top:7px;text-transform:uppercase;letter-spacing:.5px;font-weight:600">Cotizaciones</div>
        ${cotActN?`<div style="font-size:10px;color:var(--info);margin-top:2px">${cotActN} activa${cotActN!==1?'s':''}</div>`:'<div style="font-size:10px;color:var(--t4);margin-top:2px">Sin activas</div>'}
      </div>
      <div style="background:var(--card);padding:22px 24px;text-align:center">
        <div style="font-size:30px;font-weight:700;line-height:1;letter-spacing:-1px;${cotAFact?'color:#d9730d':'color:var(--t1)'}">${cotAFact}</div>
        <div style="font-size:11px;color:var(--t3);margin-top:7px;text-transform:uppercase;letter-spacing:.5px;font-weight:600">A facturar</div>
        ${cotAFact?`<div style="font-size:10px;color:#d9730d;margin-top:2px;font-weight:600">Pendiente</div>`:'<div style="font-size:10px;color:var(--t4);margin-top:2px">Sin pendiente</div>'}
      </div>
      <div style="background:var(--card);padding:22px 24px;text-align:center">
        <div style="font-size:30px;font-weight:700;line-height:1;letter-spacing:-1px;${pedActN?'color:var(--warn)':'color:var(--t1)'}">${pedN}</div>
        <div style="font-size:11px;color:var(--t3);margin-top:7px;text-transform:uppercase;letter-spacing:.5px;font-weight:600">Pedidos</div>
        ${pedActN?`<div style="font-size:10px;color:var(--warn);margin-top:2px">${pedActN} activo${pedActN!==1?'s':''}</div>`:'<div style="font-size:10px;color:var(--t4);margin-top:2px">Sin activos</div>'}
      </div>
      <div style="background:var(--card);padding:22px 24px;text-align:center">
        <div style="font-size:30px;font-weight:700;line-height:1;letter-spacing:-1px;color:var(--t1)">${c.presupuesto?'$'+Math.round(Number(c.presupuesto)/1000)+'k':'—'}</div>
        <div style="font-size:11px;color:var(--t3);margin-top:7px;text-transform:uppercase;letter-spacing:.5px;font-weight:600">Presupuesto</div>
        <div style="font-size:10px;color:var(--t4);margin-top:2px">${c.ajuste||'IPC'}</div>
      </div>
    </div>`;

  const TABS=[
    {id:'general',  lbl:'Datos generales'},
    {id:'equipos',  lbl:`Equipos${equipVenc?` ⚠`:''}${equipN?' ('+equipN+')':''}`},
    {id:'cotizaciones', lbl:`Cotizaciones${cotN?' ('+cotN+')':''}`},
    {id:'facturacion',  lbl:'Facturación'},
    {id:'recordatorios',lbl:`Recordatorios${remN?' ('+remN+')':''}`},
    {id:'pedidos',      lbl:`Pedidos${pedN?' ('+pedN+')':''}`},
  ];
  document.getElementById('ficha-tabs').innerHTML=TABS.map((t,i)=>
    `<button class="ficha-tab${i===0?' active':''}" id="ftab-${t.id}" onclick="fichaTab('${t.id}')">${t.lbl}</button>`
  ).join('');
  fichaRenderTab('general');
  document.getElementById('ficha-overlay').classList.add('open');
}

function closeFicha(){
  document.getElementById('ficha-overlay').classList.remove('open');
  fichaClientId=null;
}

function fichaTab(tab){
  document.querySelectorAll('.ficha-tab').forEach(b=>b.classList.remove('active'));
  const btn=document.getElementById('ftab-'+tab);
  if(btn) btn.classList.add('active');
  fichaRenderTab(tab);
}

function fichaRenderTab(tab){
  const c=D.clientes.find(x=>x.id===fichaClientId);
  if(!c) return;
  const body=document.getElementById('ficha-body');
  if(tab==='general')       body.innerHTML=fichaGeneral(c);
  else if(tab==='equipos')  body.innerHTML=fichaEquipos(c);
  else if(tab==='cotizaciones') body.innerHTML=fichaCotizaciones(c);
  else if(tab==='facturacion')  body.innerHTML=fichaFacturacion(c);
  else if(tab==='recordatorios') body.innerHTML=fichaRecordatorios(c);
  else if(tab==='pedidos')       body.innerHTML=fichaPedidos(c);
}

function _ff(label,val){
  return `<div class="ficha-field"><div class="ficha-label">${label}</div><div class="ficha-val">${val||'<span style="color:var(--t3)">—</span>'}</div></div>`;
}

function fichaGeneral(c){
  const TIPO_B={'Sanatorio':'b-err','Clínica':'b-err','Sanatorio/Clínica':'b-err','Industrial':'b-info','Industria':'b-info','Comercial':'b-purple','Comercio':'b-purple','Edificio':'b-ok','Otro':'b-gray'};
  const EST_B={'Activo':'b-ok','Inactivo':'b-gray','Suspendido':'b-warn'};

  // Próximo vencimiento más urgente
  const misEquipos = D.equipos.filter(e=>e.clienteId===c.id);
  const vencimientos = misEquipos.map(e=>{
    const {st,nextAceite,nextBateria} = equipStatus(e);
    const dates = [e.proximoPreventivo,nextAceite,nextBateria].filter(Boolean);
    const minD  = dates.length ? Math.min(...dates.map(d=>daysDiff(d))) : 9999;
    return {id:e.id, minD, st};
  }).sort((a,b)=>a.minD-b.minD);
  const urgente = vencimientos[0];
  const alertaEquipo = urgente && urgente.minD < 30
    ? `<div style="background:${urgente.minD<0?'var(--err-bg)':'var(--warn-bg)'};border:1px solid ${urgente.minD<0?'var(--err)':'#f59e0b'};border-radius:var(--r-sm);padding:10px 14px;margin-bottom:16px;display:flex;align-items:center;gap:8px">
        <span style="font-size:15px">${urgente.minD<0?'⚠':'⏰'}</span>
        <div>
          <div style="font-size:12.5px;font-weight:600;color:${urgente.minD<0?'var(--err)':'#b45309'}">
            ${urgente.minD<0?`Equipo ${urgente.id} vencido hace ${Math.abs(urgente.minD)} días`:`Equipo ${urgente.id} vence en ${urgente.minD} días`}
          </div>
          <div style="font-size:11.5px;color:var(--t2);margin-top:1px">Requiere programar mantenimiento</div>
        </div>
      </div>`
    : '';

  // Sección abono
  const abonoItems=[
    {key:'incluyeNS',          lbl:'NS',                  icon:'📋'},
    {key:'incluyePreventivo',  lbl:'Preventivo anual',    icon:'🔧'},
    {key:'incluyeCombustible', lbl:'Carga de combustible', icon:'⛽'},
    {key:'incluyePlataforma',  lbl:'Plataforma digital',   icon:'💻'},
    {key:'incluyeBateria',     lbl:'Cambio de batería',    icon:'🔋'},
  ];
  const abonoActivos = abonoItems.filter(i=>c[i.key]);
  const abonoOtro = c.incluyeOtro||'';
  const abonoSection = (abonoActivos.length||abonoOtro) ? `
    <div style="margin-top:24px;padding-top:20px;border-top:1px solid var(--border)">
      <div style="font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.6px;margin-bottom:14px">Incluido en el abono</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${abonoActivos.map(i=>`
          <div style="display:inline-flex;align-items:center;gap:6px;background:var(--ok-bg);color:var(--ok);padding:6px 12px;border-radius:var(--r-sm);font-size:12.5px;font-weight:600;border:1px solid #b8e5da">
            <span>${i.icon}</span><span>${i.lbl}</span>
          </div>`).join('')}
        ${abonoOtro?`
          <div style="display:inline-flex;align-items:center;gap:6px;background:var(--info-bg);color:var(--info);padding:6px 12px;border-radius:var(--r-sm);font-size:12.5px;font-weight:600;border:1px solid #b8d4f5">
            <span>⚙️</span><span>${_esc(abonoOtro)}</span>
          </div>`:''}
      </div>
    </div>` : `
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid var(--border)">
      <div style="font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px">Incluido en el abono</div>
      <div style="font-size:13px;color:var(--t4);font-style:italic">No hay servicios configurados — editá el cliente para cargarlos</div>
    </div>`;

  return `
    ${alertaEquipo}
    <div class="ficha-row">
      ${_ff('Tipo', c.tipo?`<span class="badge ${TIPO_B[c.tipo]||'b-gray'}">${c.tipo}</span>`:'')}
      ${_ff('Estado', `<span class="badge ${EST_B[c.estadoCliente]||'b-gray'}">${c.estadoCliente||'Activo'}</span>`)}
    </div>
    <div class="ficha-row">
      ${_ff('Ciudad', _esc(c.ciudad))}
      <div></div>
    </div>
    <div class="ficha-row">
      ${_ff('Nombre de contacto', _esc(c.contacto))}
      ${_ff('Teléfono', _esc(c.telefono))}
    </div>
    <div class="ficha-row">
      ${_ff('Email', c.email?`<a href="mailto:${_esc(c.email)}" style="color:var(--accent)">${_esc(c.email)}</a>`:'')}
      ${_ff('Frecuencia de visita', c.frecuenciaVisita)}
    </div>
    <div class="ficha-row">
      ${_ff('Presupuesto mensual', c.presupuesto?'$ '+Number(c.presupuesto).toLocaleString('es-AR'):'')}
      <div></div>
    </div>
    ${abonoSection}`;
}

function fichaEquipos(c){
  const list=D.equipos.filter(e=>e.clienteId===c.id);
  if(!list.length) return `<div class="empty">Sin equipos asignados a este cliente</div>`;
  // Acciones rápidas encima de la tabla
  const addBtn=`<div style="display:flex;justify-content:flex-end;margin-bottom:14px">
    <button class="btn btn-primary btn-sm" onclick="closeModal();openEquipModal(null)">+ Nuevo equipo</button>
  </div>`;
  return addBtn+`<div class="tbl-wrap" style="border:1px solid var(--border);border-radius:var(--r-md);overflow:hidden"><table style="font-size:13.5px">
    <thead><tr>
      <th style="min-width:140px;padding:12px 16px">ID / Equipo</th>
      <th style="min-width:130px;padding:12px 16px">Tipo</th>
      <th style="min-width:130px;padding:12px 16px">Preventivo</th>
      <th style="min-width:120px;padding:12px 16px">Batería</th>
      <th style="min-width:120px;padding:12px 16px">Refrigerante</th>
      <th style="min-width:120px;padding:12px 16px">Visita</th>
      <th style="min-width:90px;padding:12px 16px">Estado</th>
    </tr></thead>
    <tbody>${list.map(e=>{
      const {st,nextAceite,nextBateria,nextVisita}=equipStatus(e);
      const rc=st==='rojo'?'row-err':st==='amarillo'?'row-warn':'';
      const dot=st==='rojo'?'dot-err':st==='amarillo'?'dot-warn':'dot-ok';
      const badg=st==='rojo'?'b-err':st==='amarillo'?'b-warn':'b-ok';
      const lbl=st==='rojo'?'Vencido':st==='amarillo'?'Próximo':'Al día';
      return `<tr class="${rc}">
        <td style="padding:14px 16px"><strong style="font-size:13.5px">${_esc(e.id)}</strong>${e.marca?`<div style="font-size:11px;color:var(--t3);margin-top:2px">${_esc(e.marca)}</div>`:''}</td>
        <td style="padding:14px 16px"><span class="badge b-gray" style="font-size:12px;white-space:nowrap">${e.tipo}</span></td>
        ${eqDateCell(e.id,'ultimoPreventivo',e.ultimoPreventivo,e.proximoPreventivo)}
        ${eqDateCell(e.id,'ultimoBateria',e.ultimoBateria,nextBateria)}
        ${eqDateCell(e.id,'ultimoAceite',e.ultimoAceite,nextAceite)}
        ${eqDateCell(e.id,'ultimaVisita',e.ultimaVisita,nextVisita)}
        <td><span class="dot ${dot}"></span><span class="badge ${badg}">${lbl}</span></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function fichaCotizaciones(c){
  const list=D.cotizaciones.filter(q=>q.clienteId===c.id);
  if(!list.length) return `<div class="empty">Sin cotizaciones para este cliente</div>`;
  return `<div class="tbl-wrap"><table>
    <thead><tr><th>ID</th><th>Descripción</th><th>Monto</th><th>Estado</th><th>Follow-up</th><th>Responsable</th></tr></thead>
    <tbody>${list.map(q=>{
      const clr=E_COLOR[q.estado]||'#6b7280';
      const diff=q.fechaFollowup?daysDiff(q.fechaFollowup):9999;
      const overdue=diff<0&&!['Facturada','Ejecutada','Rechazada'].includes(q.estado);
      return `<tr>
        <td style="white-space:nowrap"><strong>${_esc(q.id)}</strong></td>
        <td style="font-size:12px;max-width:200px">${_esc(q.descripcion)}</td>
        <td style="font-size:12.5px;font-weight:600;color:var(--accent);white-space:nowrap">${fmtMoney(q.monto)}</td>
        <td><span class="badge" style="background:${clr}22;color:${clr};font-size:11px">${q.estado}</span></td>
        <td style="font-size:12px;${overdue?'color:var(--err);font-weight:600':''};white-space:nowrap">${q.fechaFollowup?fmtDate(q.fechaFollowup):'—'}${overdue?' ⚠':''}</td>
        <td style="font-size:12px;color:var(--t2)">${_esc(q.responsable)||'—'}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function fichaFacturacion(c){
  const mStr=curMonth||nowMonthStr();
  const estados=D.facturacion_estados[mStr]||{};
  const EST_B={'Pendiente':'b-warn','Facturado':'b-info','Cobrado':'b-ok'};
  const st=estados[c.id]||'Pendiente';
  const moneda=c.monedaAbono||(c.ajuste==='Dólar billete'?'Dólar billete':c.ajuste==='Dólar divisa'?'Dólar divisa':'Pesos');
  const meses=(c.mesesFacturacion||[]).join(', ')||'Todos los meses';
  const adjList=[c.adjPresupuesto&&'Presupuesto',c.adjOC&&'Orden de Compra',c.adjHJS&&'Hoja de Servicio',c.adjOtros&&('Otros: '+c.adjOtros)].filter(Boolean);
  const reqList=[c.requiereHJS&&'Hoja de Servicio',(c.requierePeriodo)&&'Período de Fechas',c.enviarEmail&&'Enviar por Email'].filter(Boolean);
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <div style="font-size:13px;color:var(--t2)">Estado del mes <strong style="color:var(--t1)">${monthLabel(mStr)}</strong>: <span class="badge ${EST_B[st]||'b-gray'}">${st}</span></div>
      <button class="btn btn-outline btn-sm" onclick="fichaFacturacionEditMode()">Editar configuración</button>
    </div>
    <div class="fact-sec-title" style="padding-top:0">Abono y servicio</div>
    <div class="ficha-row">
      ${_ff('Tipo',c.tipoAbono||'Abono')}
      ${_ff('Código de servicio',_esc(c.codigoServicio))}
    </div>
    <div class="ficha-row">
      ${_ff('Descripción',_esc(c.descripcionServicio||c.facturacion))}
      ${_ff('Precio',c.precioAbono?'$ '+Number(c.precioAbono).toLocaleString('es-AR'):'')}
    </div>
    <div class="ficha-row">
      ${_ff('Moneda',moneda)}
      ${_ff('Cantidad',c.cantidadAbono!=null?String(c.cantidadAbono):'1')}
    </div>
    <div class="ficha-row">
      ${_ff('% Descuento',(c.descuentoAbono||0)+'%')}
      <div></div>
    </div>
    <div class="ficha-row">
      ${_ff('Vigencia desde',fmtDate(c.vigenciaDesde))}
      ${_ff('Vigencia hasta',fmtDate(c.vigenciaHasta))}
    </div>
    <div class="fact-sec-title">Modalidad y meses de facturación</div>
    <div class="ficha-field"><div class="ficha-label">Modalidad</div><div class="ficha-val">${
      c.facturacion==='Por fecha'&&c.facturacionDia
        ? `<span style="font-weight:600;color:var(--info)">📅 Por fecha — a partir del día <strong>${c.facturacionDia}</strong></span>`
        : c.facturacion==='Automática'
        ? '<span style="font-weight:600;color:var(--ok)">⚡ Automática</span>'
        : '<span style="color:var(--t2)">Manual</span>'
    }</div></div>
    <div class="ficha-field"><div class="ficha-label">Meses</div><div class="ficha-val">${meses}</div></div>
    <div class="fact-sec-title">Datos adicionales</div>
    <div class="ficha-row">
      ${_ff('N° O.C. / Referencia',_esc(c.nroOC))}
      ${_ff('N° Presupuesto',_esc(c.nroPresupuesto))}
    </div>
    <div class="ficha-row">
      ${_ff('Otra referencia',_esc(c.otraReferencia))}
      <div></div>
    </div>
    ${c.textoFactura?`<div class="ficha-field"><div class="ficha-label">Texto adicional en factura</div><div class="ficha-val" style="white-space:pre-line;font-size:13px">${_esc(c.textoFactura)}</div></div>`:''}
    <div class="fact-sec-title">Requisitos y adjuntos</div>
    <div class="ficha-chk-cols">
      <div class="ficha-field">
        <div class="ficha-label">Requisitos previos</div>
        <div class="ficha-val" style="display:flex;flex-wrap:wrap;gap:5px;margin-top:4px">
          ${reqList.length?reqList.map(r=>`<span class="badge b-purple">${r}</span>`).join(''):'<span style="color:var(--t3)">—</span>'}
        </div>
      </div>
      <div class="ficha-field">
        <div class="ficha-label">Archivos a adjuntar</div>
        <div class="ficha-val" style="display:flex;flex-wrap:wrap;gap:5px;margin-top:4px">
          ${adjList.length?adjList.map(a=>`<span class="badge b-gray">${a}</span>`).join(''):'<span style="color:var(--t3)">—</span>'}
        </div>
      </div>
    </div>`;
}

function fichaFacturacionEditMode(){
  const c=D.clientes.find(x=>x.id===fichaClientId);
  if(!c) return;
  const moneda=c.monedaAbono||(c.ajuste==='Dólar billete'?'Dólar billete':c.ajuste==='Dólar divisa'?'Dólar divisa':'Pesos');
  const meses=c.mesesFacturacion||[];
  const MESES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const sel=(v,opt)=>v===opt?'selected':'';
  document.getElementById('ficha-body').innerHTML=`
    <div class="fact-sec-title" style="padding-top:0">Configuración del abono</div>
    <div class="form-row">
      <div class="fg">
        <label class="fl">Tipo</label>
        <div style="display:flex;gap:16px;margin-top:6px">
          <label style="display:flex;align-items:center;gap:5px;font-size:13px;cursor:pointer"><input type="radio" name="ff-tipoAbono" value="Abono" ${(c.tipoAbono||'Abono')==='Abono'?'checked':''}>Abono</label>
          <label style="display:flex;align-items:center;gap:5px;font-size:13px;cursor:pointer"><input type="radio" name="ff-tipoAbono" value="Alquiler" ${c.tipoAbono==='Alquiler'?'checked':''}>Alquiler</label>
        </div>
      </div>
      <div class="fg"><label class="fl">Código de servicio</label><input class="fc" id="ff-codSrv" value="${(c.codigoServicio||'').replace(/"/g,'&quot;')}"></div>
    </div>
    <div class="form-row">
      <div class="fg"><label class="fl">Descripción</label><input class="fc" id="ff-descSrv" value="${(c.descripcionServicio||c.facturacion||'').replace(/"/g,'&quot;')}"></div>
      <div class="fg"><label class="fl">Precio</label><input class="fc" id="ff-precio" type="number" step="0.01" min="0" value="${c.precioAbono||''}"></div>
    </div>
    <div class="form-row">
      <div class="fg"><label class="fl">Moneda</label>
        <select class="fc" id="ff-moneda">
          <option ${sel(moneda,'Pesos')}>Pesos</option>
          <option ${sel(moneda,'Dólar U.S.A.')}>Dólar U.S.A.</option>
          <option ${sel(moneda,'Dólar divisa')}>Dólar divisa</option>
          <option ${sel(moneda,'Dólar billete')}>Dólar billete</option>
          <option ${sel(moneda,'Euro')}>Euro</option>
        </select>
      </div>
      <div class="fg"><label class="fl">Cantidad</label><input class="fc" id="ff-cant" type="number" min="1" value="${c.cantidadAbono!=null?c.cantidadAbono:1}"></div>
    </div>
    <div class="form-row">
      <div class="fg"><label class="fl">% Descuento</label><input class="fc" id="ff-descPct" type="number" min="0" max="100" value="${c.descuentoAbono||0}"></div>
      <div class="fg"></div>
    </div>
    <div class="form-row">
      <div class="fg"><label class="fl">Vigencia desde</label><input class="fc" id="ff-vigDesde" type="date" value="${c.vigenciaDesde||''}"></div>
      <div class="fg"><label class="fl">Vigencia hasta</label><input class="fc" id="ff-vigHasta" type="date" value="${c.vigenciaHasta||''}"></div>
    </div>
    <div class="fact-sec-title">Meses de facturación</div>
    <div style="font-size:12px;color:var(--t3);margin-bottom:10px">Si ninguno está marcado, se factura todos los meses</div>
    <div class="month-grid">
      ${MESES.map(m=>`<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer"><input type="checkbox" id="ff-mes-${m}" ${meses.includes(m)?'checked':''}>${m}</label>`).join('')}
    </div>
    <div class="fact-sec-title">Datos adicionales</div>
    <div class="form-row">
      <div class="fg"><label class="fl">N° O.C. (o de Referencia)</label><input class="fc" id="ff-nroOC" value="${(c.nroOC||'').replace(/"/g,'&quot;')}"></div>
      <div class="fg"><label class="fl">N° Presupuesto</label><input class="fc" id="ff-nroPres" value="${(c.nroPresupuesto||'').replace(/"/g,'&quot;')}"></div>
    </div>
    <div class="form-row">
      <div class="fg"><label class="fl">Otra referencia</label><input class="fc" id="ff-otraRef" value="${(c.otraReferencia||'').replace(/"/g,'&quot;')}"></div>
      <div class="fg"></div>
    </div>
    <div class="fg"><label class="fl">Texto adicional en factura</label><textarea class="fc" id="ff-textoFact" rows="3" style="font-family:inherit;font-size:13px" placeholder="MANTENIMIENTO [FRECUENCIA] PROGRAMADO&#10;[EQUIPO]&#10;PERÍODO &lt;mmmm&gt; &lt;aaaa&gt;">${(c.textoFactura||'').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea></div>
    <div class="fact-sec-title">Requisitos y adjuntos</div>
    <div class="ficha-chk-cols">
      <div>
        <div style="font-size:11px;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Requisitos previos</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <label style="display:flex;align-items:flex-start;gap:7px;font-size:13px;cursor:pointer"><input type="checkbox" id="ff-reqHJS" ${c.requiereHJS||c.requiereHES?'checked':''} style="margin-top:2px">Requiere Hoja de Servicio previo a facturación</label>
          <label style="display:flex;align-items:flex-start;gap:7px;font-size:13px;cursor:pointer"><input type="checkbox" id="ff-reqPeriodo" ${c.requierePeriodo?'checked':''} style="margin-top:2px">Requiere cargar Período de Fechas previo a facturación</label>
          <label style="display:flex;align-items:center;gap:7px;font-size:13px;cursor:pointer"><input type="checkbox" id="ff-envEmail" ${c.enviarEmail?'checked':''}>Enviar Factura por Email</label>
        </div>
      </div>
      <div>
        <div style="font-size:11px;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Archivos a adjuntar para la facturación</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <label style="display:flex;align-items:center;gap:7px;font-size:13px;cursor:pointer"><input type="checkbox" id="ff-adjPres" ${c.adjPresupuesto?'checked':''}>Presupuesto</label>
          <label style="display:flex;align-items:center;gap:7px;font-size:13px;cursor:pointer"><input type="checkbox" id="ff-adjOC" ${c.adjOC?'checked':''}>Orden de Compra</label>
          <label style="display:flex;align-items:center;gap:7px;font-size:13px;cursor:pointer"><input type="checkbox" id="ff-adjHJS" ${c.adjHJS?'checked':''}>Hoja de Servicio</label>
          <div style="display:flex;align-items:center;gap:7px"><span style="font-size:13px;white-space:nowrap;color:var(--t1)">Otros:</span><input class="fc" id="ff-adjOtros" style="margin:0;flex:1" value="${(c.adjOtros||'').replace(/"/g,'&quot;')}"></div>
        </div>
      </div>
    </div>
    <div class="fact-sec-title" style="margin-top:24px">¿Qué incluye el abono?</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 24px;margin-bottom:20px">
      <label style="display:flex;align-items:center;gap:9px;padding:10px 12px;border:1px solid var(--border);border-radius:var(--r-sm);cursor:pointer">
        <input type="checkbox" id="ff-inc-ns" ${c.incluyeNS?'checked':''} style="width:15px;height:15px;accent-color:#1d6fa4;flex-shrink:0">
        <div><div style="font-size:13px;font-weight:600;color:var(--t1)">NS (Nota de Servicio)</div><div style="font-size:11px;color:var(--t3)">Requiere NS para facturar</div></div>
      </label>
      <label style="display:flex;align-items:center;gap:9px;padding:10px 12px;border:1px solid var(--border);border-radius:var(--r-sm);cursor:pointer">
        <input type="checkbox" id="ff-inc-prev" ${c.incluyePreventivo?'checked':''} style="width:15px;height:15px;accent-color:#1d6fa4;flex-shrink:0">
        <div><div style="font-size:13px;font-weight:600;color:var(--t1)">Preventivo anual</div><div style="font-size:11px;color:var(--t3)">Incluido en el abono</div></div>
      </label>
      <label style="display:flex;align-items:center;gap:9px;padding:10px 12px;border:1px solid var(--border);border-radius:var(--r-sm);cursor:pointer">
        <input type="checkbox" id="ff-inc-comb" ${c.incluyeCombustible?'checked':''} style="width:15px;height:15px;accent-color:#1d6fa4;flex-shrink:0">
        <div><div style="font-size:13px;font-weight:600;color:var(--t1)">Carga de combustible</div><div style="font-size:11px;color:var(--t3)">Incluida en el abono</div></div>
      </label>
      <label style="display:flex;align-items:center;gap:9px;padding:10px 12px;border:1px solid var(--border);border-radius:var(--r-sm);cursor:pointer">
        <input type="checkbox" id="ff-inc-plat" ${c.incluyePlataforma?'checked':''} style="width:15px;height:15px;accent-color:#1d6fa4;flex-shrink:0">
        <div><div style="font-size:13px;font-weight:600;color:var(--t1)">Plataforma digital</div><div style="font-size:11px;color:var(--t3)">Acceso incluido</div></div>
      </label>
      <label style="display:flex;align-items:center;gap:9px;padding:10px 12px;border:1px solid var(--border);border-radius:var(--r-sm);cursor:pointer">
        <input type="checkbox" id="ff-inc-bat" ${c.incluyeBateria?'checked':''} style="width:15px;height:15px;accent-color:#1d6fa4;flex-shrink:0">
        <div><div style="font-size:13px;font-weight:600;color:var(--t1)">Cambio de batería</div><div style="font-size:11px;color:var(--t3)">Incluido en el abono</div></div>
      </label>
      <div style="padding:10px 12px;border:1px solid var(--border);border-radius:var(--r-sm)">
        <div style="font-size:12px;font-weight:600;color:var(--t2);margin-bottom:6px">Otro componente u operación</div>
        <input class="fc" id="ff-inc-otro" value="${_esc(c.incluyeOtro||'')}" placeholder="Ej: Banco resistivo, Inspección termográfica..." style="font-size:12.5px;padding:6px 10px">
      </div>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:24px;padding-top:16px;border-top:0.5px solid var(--border)">
      <button class="btn btn-outline" onclick="fichaTab('facturacion')">Cancelar</button>
      <button class="btn btn-primary" onclick="saveFichaFacturacion()">Guardar configuración</button>
    </div>`;
}

function saveFichaFacturacion(){
  const idx=D.clientes.findIndex(x=>x.id===fichaClientId);
  if(idx<0) return;
  const MESES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const moneda=document.getElementById('ff-moneda').value;
  const nroOC=(document.getElementById('ff-nroOC').value||'').trim();
  const reqHJS=document.getElementById('ff-reqHJS').checked;
  let ajuste=D.clientes[idx].ajuste||'IPC';
  if(moneda==='Dólar U.S.A.'||moneda==='Dólar divisa') ajuste='Dólar divisa';
  else if(moneda==='Dólar billete') ajuste='Dólar billete';
  else if(moneda==='Pesos') ajuste='IPC';
  const descSrv=(document.getElementById('ff-descSrv').value||'').trim();
  Object.assign(D.clientes[idx],{
    tipoAbono:(document.querySelector('input[name="ff-tipoAbono"]:checked')||{value:'Abono'}).value,
    codigoServicio:(document.getElementById('ff-codSrv').value||'').trim(),
    descripcionServicio:descSrv,
    precioAbono:document.getElementById('ff-precio').value?Number(document.getElementById('ff-precio').value):null,
    monedaAbono:moneda,
    cantidadAbono:Number(document.getElementById('ff-cant').value)||1,
    descuentoAbono:Number(document.getElementById('ff-descPct').value)||0,
    vigenciaDesde:document.getElementById('ff-vigDesde').value||null,
    vigenciaHasta:document.getElementById('ff-vigHasta').value||null,
    mesesFacturacion:MESES.filter(m=>document.getElementById('ff-mes-'+m)&&document.getElementById('ff-mes-'+m).checked),
    nroOC,
    nroPresupuesto:(document.getElementById('ff-nroPres').value||'').trim(),
    otraReferencia:(document.getElementById('ff-otraRef').value||'').trim(),
    textoFactura:(document.getElementById('ff-textoFact').value||'').trim(),
    requiereHJS:reqHJS,
    requiereHES:reqHJS,
    requierePeriodo:document.getElementById('ff-reqPeriodo').checked,
    enviarEmail:document.getElementById('ff-envEmail').checked,
    adjPresupuesto:document.getElementById('ff-adjPres').checked,
    adjOC:document.getElementById('ff-adjOC').checked,
    adjHJS:document.getElementById('ff-adjHJS').checked,
    adjOtros:(document.getElementById('ff-adjOtros').value||'').trim(),
    ajuste,
    requiereOC:nroOC.length>0,
    facturacion:descSrv||D.clientes[idx].facturacion,
    facturacionDia: D.clientes[idx].facturacionDia||null,
    // Incluidos en abono (editados desde esta pantalla)
    incluyeNS:          (document.getElementById('ff-inc-ns')  ||{checked:false}).checked,
    incluyePreventivo:  (document.getElementById('ff-inc-prev')||{checked:false}).checked,
    incluyeCombustible: (document.getElementById('ff-inc-comb')||{checked:false}).checked,
    incluyePlataforma:  (document.getElementById('ff-inc-plat')||{checked:false}).checked,
    incluyeBateria:     (document.getElementById('ff-inc-bat') ||{checked:false}).checked,
    incluyeOtro:        ((document.getElementById('ff-inc-otro')||{value:''}).value||'').trim(),
  });
  persist();
  fichaTab('facturacion');
}

function fichaRecordatorios(c){
  const list=D.recordatorios.filter(r=>r.clienteId===c.id)
    .sort((a,b)=>(a.fechaHora||'').localeCompare(b.fechaHora||''));
  if(!list.length) return `<div class="empty">Sin recordatorios vinculados a este cliente</div>`;
  const PRIO_B={'Alta':'b-alta','Media':'b-media','Baja':'b-baja'};
  return `<div class="tbl-wrap"><table>
    <thead><tr><th>Título</th><th>Fecha y hora</th><th>Prioridad</th><th>Estado</th><th>Notas</th></tr></thead>
    <tbody>${list.map(r=>{
      const done=r.estado==='Hecho';
      const diff=r.fechaHora?daysDiff(r.fechaHora.split('T')[0]):9999;
      const rowCls=done?'rem-done':diff<0?'rem-venc':diff===0?'rem-hoy':'';
      return `<tr class="${rowCls}">
        <td><span class="rem-titulo">${_esc(r.titulo)}</span></td>
        <td style="font-size:12px;white-space:nowrap">${fmtDateTime(r.fechaHora)}</td>
        <td><span class="badge ${PRIO_B[r.prioridad]||'b-gray'}">${r.prioridad}</span></td>
        <td><span class="badge ${done?'b-ok':'b-warn'}">${r.estado}</span></td>
        <td style="font-size:12px;color:var(--t2)">${_esc(r.notas)||'—'}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function fichaPedidos(c){
  const list=(D.pedidos||[]).filter(p=>p.clienteId===c.id);
  const BADG={'Pendiente':'b-warn','En ejecución':'b-info','Realizado':'b-ok'};
  return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
    <span style="font-size:13px;color:var(--t2)">${list.length} pedido${list.length!==1?'s':''}</span>
    <button class="btn btn-primary btn-sm" data-cliid="${_esc(c.id)}" onclick="closeFicha();openPedidoModal(null,null,this.dataset.cliid)">+ Generar pedido</button>
  </div>
  ${list.length?`<div class="tbl-wrap"><table>
    <thead><tr><th>N° Pedido</th><th>Fecha solicitud</th><th>Equipo</th><th>Detalle</th><th>Técnico</th><th>Estado</th></tr></thead>
    <tbody>${list.map(p=>`<tr>
      <td style="font-size:12px;font-weight:600;cursor:pointer;color:var(--info)" data-pedid="${_esc(p.id)}" onclick="closeFicha();openPedidoModal(this.dataset.pedid,null,null)">${_esc(p.id)}</td>
      <td style="font-size:12px">${fmtDate(p.fechaSolicitud)||'—'}</td>
      <td style="font-size:12px">${_esc(p.equipoId)||'—'}</td>
      <td style="font-size:12px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${_esc(p.detalle)}">${p.detalle?_esc(p.detalle.slice(0,50))+(p.detalle.length>50?'…':''):'—'}</td>
      <td style="font-size:12px">${_esc(p.tecnico)||'—'}</td>
      <td><span class="badge ${BADG[p.estado]||'b-gray'}">${p.estado}</span></td>
    </tr>`).join('')}</tbody>
  </table></div>`:`<div class="empty">Sin pedidos para este cliente</div>`}`;
}
