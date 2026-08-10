/**
 * ============================================================
 * AERCOM CRM v2
 * CSV Import Module
 * Migrado tal cual desde index.html (Sprint 16)
 * ============================================================
 *
 * Responsabilidad: importación masiva desde CSV para Clientes,
 * Equipos y Cotizaciones — modal con tabla de columnas esperadas,
 * selección de archivo, parseo propio (`parseCsv`/`csvSplitLine`,
 * sin librería externa), preview de las primeras filas, detección
 * de conflictos por clave (`findExisting`) con elección entre
 * "Saltar existentes" / "Reemplazar existentes", y confirmación
 * final que persiste los cambios.
 *
 * Dependencias externas (definidas en index.html, sin mover —
 * no son responsabilidad de este módulo):
 *   D, persist(), closeModal(), renderModule(), toast()
 *
 * Integración con Clientes / Equipos / Cotizaciones:
 *   `CSV_SCHEMAS` es el único punto del proyecto que escribe
 *   directamente en `D.clientes`/`D.equipos`/`D.cotizaciones` desde
 *   fuera de sus propios módulos (`js/modules/clientes.js`,
 *   `equipos.js`, `cotizaciones.js`) — cada entrada del schema
 *   (`findExisting`/`toObj`/`save`) conoce la forma exacta de esos
 *   objetos de dominio. Es un acoplamiento preexistente (ya
 *   documentado como patrón: cada dato debería tener un único
 *   responsable según PROJECT.md) — no se corrige ni se reubica en
 *   esta migración, solo se traslada tal cual. Los botones "↑
 *   Importar CSV" que abren este modal viven en las secciones HTML
 *   de Clientes/Equipos/Cotizaciones (`onclick="openCsvModal(...)"`),
 *   sin lógica propia — no se tocan.
 *
 * `closeModal()` y el listener de click en `#modal-overlay` que
 * estaban físicamente al final de esta sección en index.html NO
 * se migran: son infraestructura compartida por todos los módulos,
 * no específica de CSV Import.
 */

// ─── CSV IMPORT ──────────────────────────────────────────────────────────────
let csvModule=null, csvParsed=null, csvConflictMode='saltar';

const CSV_SCHEMAS={
  clientes:{
    label:'Clientes',
    cols:['nombre','tipo','prioridad','frecuenciaVisita','presupuesto','email','telefono','contacto','ciudad','estadoCliente','ajuste','requiereOC','requiereHES','facturacion'],
    descs:['Nombre *','Tipo (Sanatorio/Clínica/Industria/Comercio/Edificio/Otro)','Prioridad (Crítico/Normal)','Frecuencia visita','Presupuesto mensual','Email','Teléfono','Nombre de contacto','Ciudad','Estado (Activo/Inactivo/Suspendido)','Ajuste (IPC/Dólar divisa/Dólar billete/Fijo pesos)','Requiere OC (true/false)','Requiere HES (true/false)','Modalidad (Manual/Automática)'],
    example:['Empresa Ejemplo SA','Industria','Normal','Mensual','250000','ejemplo@empresa.com','0341-000-0000','Ing. García','Rosario','Activo','IPC','false','false','Manual'],
    keyField:'nombre',
    findExisting:row=>D.clientes.find(c=>c.nombre===row.nombre),
    toObj(row,existing){
      const nums=D.clientes.map(c=>parseInt((c.id||'').replace(/\D/g,''))||0);
      const id=existing?existing.id:`C${String((nums.length?Math.max(...nums):0)+1).padStart(3,'0')}`;
      return{id,nombre:row.nombre||'',tipo:row.tipo||'Otro',prioridad:row.prioridad||'Normal',
        frecuenciaVisita:row.frecuenciaVisita||'',presupuesto:Number(row.presupuesto)||0,
        email:row.email||'',telefono:row.telefono||'',contacto:row.contacto||'',
        ciudad:row.ciudad||'',estadoCliente:row.estadoCliente||'Activo',
        ajuste:row.ajuste||'IPC',
        requiereOC:row.requiereOC==='true'||row.requiereOC==='1',
        requiereHES:row.requiereHES==='true'||row.requiereHES==='1',
        facturacion:row.facturacion||'Manual'};
    },
    save(obj,existing){
      if(existing){const i=D.clientes.indexOf(existing);if(i>-1)D.clientes[i]=obj;}
      else D.clientes.push(obj);
    }
  },
  equipos:{
    label:'Equipos',
    cols:['id','clienteId','tipo','ultimoPreventivo','proximoPreventivo','ultimoAceite','ultimoBateria','ultimoRefrigerante','horometro','observaciones'],
    descs:['ID del equipo *','ID del cliente *','Tipo de equipo','Último preventivo (YYYY-MM-DD)','Próximo preventivo (YYYY-MM-DD)','Último refrigerante (YYYY-MM-DD)','Última batería (YYYY-MM-DD)','Último refrigerante gas (YYYY-MM-DD)','Horómetro (número)','Observaciones'],
    example:['GE-010','C001','Grupo Electrógeno','2026-01-15','2027-01-15','2026-07-15','2025-01-15','2025-01-15','1250','Sin observaciones'],
    keyField:'id',
    findExisting:row=>D.equipos.find(e=>e.id===row.id),
    toObj(row,existing){
      return{id:(existing?existing.id:row.id)||'',clienteId:row.clienteId||'',tipo:row.tipo||'',
        ultimoPreventivo:row.ultimoPreventivo||'',proximoPreventivo:row.proximoPreventivo||'',
        ultimoAceite:row.ultimoAceite||'',ultimoBateria:row.ultimoBateria||'',
        ultimoRefrigerante:row.ultimoRefrigerante||'',horometro:Number(row.horometro)||0,
        observaciones:row.observaciones||''};
    },
    save(obj,existing){
      if(existing){const i=D.equipos.indexOf(existing);if(i>-1)D.equipos[i]=obj;}
      else D.equipos.push(obj);
    }
  },
  cotizaciones:{
    label:'Cotizaciones',
    cols:['id','clienteId','equipoId','descripcion','monto','fechaEnvio','fechaFollowup','responsable','estado','notas'],
    descs:['ID cotización *','ID del cliente *','ID del equipo','Descripción','Monto','Fecha envío (YYYY-MM-DD)','Fecha follow-up (YYYY-MM-DD)','Responsable','Estado (Solicitud/Cotizar/Enviar/En seguimiento/Aprobada/Facturada/Ejecutada/Rechazada)','Notas'],
    example:['COT-2026-010','C001','GE-001','Mantenimiento preventivo anual','350000','2026-06-01','2026-06-15','González M.','Solicitud','Incluir cambio de filtros'],
    keyField:'id',
    findExisting:row=>D.cotizaciones.find(c=>c.id===row.id),
    toObj(row,existing){
      return{id:(existing?existing.id:row.id)||'',clienteId:row.clienteId||'',equipoId:row.equipoId||'',
        descripcion:row.descripcion||'',monto:Number(row.monto)||0,
        fechaEnvio:row.fechaEnvio||'',fechaFollowup:row.fechaFollowup||'',
        responsable:row.responsable||'',estado:row.estado||'Solicitud',notas:row.notas||''};
    },
    save(obj,existing){
      if(existing){const i=D.cotizaciones.indexOf(existing);if(i>-1)D.cotizaciones[i]=obj;}
      else D.cotizaciones.push(obj);
    }
  }
};

function openCsvModal(mod){
  csvModule=mod; csvParsed=null; csvConflictMode='saltar';
  const s=CSV_SCHEMAS[mod];
  document.querySelector('#modal-overlay .modal').classList.add('modal-lg');
  document.getElementById('modal-title').textContent=`Importar ${s.label} desde CSV`;
  document.getElementById('modal-body').innerHTML=`
    <div style="background:#f8fafc;border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:14px">
      <div style="font-size:12px;font-weight:600;color:var(--t2);margin-bottom:7px;text-transform:uppercase;letter-spacing:.4px">Columnas esperadas · en este orden · separadas por coma</div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="font-size:11px;color:var(--t3);font-weight:600;padding:3px 12px 3px 0;border-bottom:1px solid var(--border);text-align:left">Columna</th>
          <th style="font-size:11px;color:var(--t3);font-weight:600;padding:3px 8px;border-bottom:1px solid var(--border);text-align:left">Descripción</th>
          <th style="font-size:11px;color:var(--t3);font-weight:600;padding:3px 0;border-bottom:1px solid var(--border);text-align:left">Ejemplo</th>
        </tr></thead>
        <tbody>${s.cols.map((col,i)=>
          `<tr><td style="font-size:11.5px;font-family:monospace;color:var(--accent);padding:3px 12px 3px 0;white-space:nowrap;vertical-align:top">${col}</td><td style="font-size:12px;color:var(--t2);padding:3px 8px;vertical-align:top">${s.descs[i]}</td><td style="font-size:11.5px;color:var(--t3);padding:3px 0;font-style:italic;vertical-align:top">${s.example?.[i]||''}</td></tr>`
        ).join('')}</tbody>
      </table>
      <div style="margin-top:8px;font-size:11.5px;color:var(--t3)">Fechas en formato YYYY-MM-DD · Primera fila: encabezados · Codificación UTF-8</div>
    </div>
    <div class="fg">
      <label class="fl">Seleccioná el archivo CSV</label>
      <input type="file" accept=".csv,.txt" class="fc" id="csv-file-input" onchange="csvFileSelected(event)" style="padding:6px 10px">
    </div>
    <div id="csv-preview"></div>
    <div id="csv-conflict"></div>`;
  document.getElementById('modal-foot').innerHTML=`
    <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" id="csv-confirm-btn" onclick="confirmCsvImport()" style="display:none">Importar</button>`;
  document.getElementById('modal-overlay').classList.add('open');
}

function csvFileSelected(ev){
  const f=ev.target.files[0]; if(!f) return;
  const rd=new FileReader();
  rd.onload=e=>{
    csvParsed=parseCsv(e.target.result);
    const{rows}=csvParsed;
    const s=CSV_SCHEMAS[csvModule];
    const preview=rows.slice(0,3);
    const thHtml=s.cols.map(c=>`<th style="font-size:11px;padding:5px 8px;background:#f8fafc;white-space:nowrap">${c}</th>`).join('');
    const trHtml=preview.map(row=>`<tr>${s.cols.map(c=>`<td style="font-size:11.5px;padding:4px 8px;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-bottom:1px solid var(--border)">${row[c]||''}</td>`).join('')}</tr>`).join('');
    document.getElementById('csv-preview').innerHTML=rows.length===0
      ?`<div class="alert-box a-err" style="margin-top:10px"><div class="alert-title">El archivo no contiene registros válidos</div></div>`
      :`<div style="margin-top:14px">
          <div style="font-size:12.5px;font-weight:600;color:var(--t2);margin-bottom:6px">Vista previa · ${rows.length} registro${rows.length!==1?'s':''} encontrado${rows.length!==1?'s':''}</div>
          <div style="overflow-x:auto;border:1px solid var(--border);border-radius:6px">
            <table style="width:100%;border-collapse:collapse">
              <thead><tr>${thHtml}</tr></thead>
              <tbody>${trHtml}</tbody>
            </table>
          </div>
        </div>`;
    const conflicts=rows.filter(row=>s.findExisting(row));
    document.getElementById('csv-conflict').innerHTML=conflicts.length
      ?`<div class="alert-box a-warn" style="margin-top:10px">
          <div class="alert-title">⚠ ${conflicts.length} registro${conflicts.length!==1?'s ya existen':' ya existe'}</div>
          <ul class="alert-items">${conflicts.slice(0,5).map(row=>`<li>${row[s.keyField]}</li>`).join('')}${conflicts.length>5?`<li style="color:var(--t3)">...y ${conflicts.length-5} más</li>`:''}</ul>
          <div style="margin-top:10px;display:flex;gap:16px">
            <label style="font-size:12.5px;cursor:pointer;display:flex;align-items:center;gap:6px"><input type="radio" name="csv-cf" value="saltar" checked onchange="csvConflictMode='saltar'"> Saltar existentes</label>
            <label style="font-size:12.5px;cursor:pointer;display:flex;align-items:center;gap:6px"><input type="radio" name="csv-cf" value="reemplazar" onchange="csvConflictMode='reemplazar'"> Reemplazar existentes</label>
          </div>
        </div>`
      :'';
    const btn=document.getElementById('csv-confirm-btn');
    if(btn) btn.style.display=rows.length>0?'':'none';
  };
  rd.readAsText(f,'UTF-8');
}

function parseCsv(text){
  const lines=text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').trim().split('\n');
  if(lines.length<2) return{headers:[],rows:[]};
  const headers=csvSplitLine(lines[0]);
  const rows=lines.slice(1).map(line=>{
    const vals=csvSplitLine(line);
    const row={};
    headers.forEach((h,i)=>{row[h]=(vals[i]||'').trim();});
    return row;
  }).filter(r=>Object.values(r).some(v=>v!==''));
  return{headers,rows};
}

function csvSplitLine(line){
  const cols=[]; let cur='',inQ=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){inQ=!inQ;}
    else if(ch===','&&!inQ){cols.push(cur);cur='';}
    else{cur+=ch;}
  }
  cols.push(cur);
  return cols.map(s=>s.replace(/^"|"$/g,'').trim());
}

function confirmCsvImport(){
  if(!csvParsed||!csvModule) return;
  const s=CSV_SCHEMAS[csvModule];
  const{rows}=csvParsed;
  let added=0,replaced=0,skipped=0;
  rows.forEach(row=>{
    if(!row[s.keyField]) return;
    const existing=s.findExisting(row);
    const obj=s.toObj(row,existing);
    if(existing){
      if(csvConflictMode==='reemplazar'){s.save(obj,existing);replaced++;}
      else skipped++;
    } else{
      s.save(obj,null);added++;
    }
  });
  persist();closeModal();renderModule();
  const parts=[];
  if(added) parts.push(`${added} agregado${added!==1?'s':''}`);
  if(replaced) parts.push(`${replaced} reemplazado${replaced!==1?'s':''}`);
  if(skipped) parts.push(`${skipped} saltado${skipped!==1?'s':''}`);
  toast(`Importación: ${parts.join(', ')||'sin cambios'}`);
}
