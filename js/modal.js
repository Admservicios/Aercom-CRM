/**
 * ============================================================
 * AERCOM CRM v2
 * Modal Manager
 * ============================================================
 */

// Estado de interfaz exclusivamente en memoria; nunca guarda datos del CRM.
let _modalSession=null;
let _modalConfSession=null;
let _modalObserver=null;
const _modalBackground=new Map();

function _modalSnapshot(root){
    return JSON.stringify([...root.querySelectorAll('input,select,textarea')].map(el=>{
        if(el.type==='checkbox'||el.type==='radio')return [el.id,el.checked];
        if(el.type==='file')return [el.id,[...el.files].map(f=>[f.name,f.size,f.lastModified])];
        if(el.multiple)return [el.id,[...el.selectedOptions].map(o=>o.value)];
        return [el.id,el.value];
    }));
}

function _modalFocusable(root){
    return [...root.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')]
        .filter(el=>el.tabIndex>=0&&!el.matches(':disabled')&&el.getClientRects().length&&!el.closest('[inert]'));
}

function _focusModal(root){
    const fields=_modalFocusable(root);
    (fields.find(el=>['INPUT','SELECT','TEXTAREA'].includes(el.tagName))||fields[0]||root.querySelector('.modal')).focus();
}

function _labelModalFields(root){
    root.querySelectorAll('label').forEach(label=>{
        if(label.htmlFor||label.querySelector('input,select,textarea'))return;
        const fields=label.parentElement.querySelectorAll('input,select,textarea');
        if(fields.length===1&&fields[0].id)label.htmlFor=fields[0].id;
    });
}

function _blockModalBackground(block){
    if(block){
        for(const id of ['main','sidebar','mobile-menu-toggle','ficha-overlay']){
            const el=document.getElementById(id);
            if(el&&!_modalBackground.has(el)){_modalBackground.set(el,el.inert);el.inert=true;}
        }
    }else{
        _modalBackground.forEach((inert,el)=>{el.inert=inert;});
        _modalBackground.clear();
    }
}

function _syncModalState(records=[]){
    const overlay=document.getElementById('modal-overlay');
    const conf=document.getElementById('conf-overlay');
    const body=document.getElementById('modal-body');
    const open=overlay.classList.contains('open'),confirmOpen=conf.classList.contains('open');
    const changed=records.some(r=>r.type==='childList'&&r.target===body);
    let returnFocus=null,needsFocus=false;
    if(open&&(!_modalSession||changed)){
        _labelModalFields(body);
        _modalSession={returnFocus:_modalSession?.returnFocus||document.activeElement,baseline:_modalSnapshot(body)};
        needsFocus=true;
    }else if(!open&&_modalSession){
        returnFocus=_modalSession.returnFocus;
        _modalSession=null;
    }
    if(confirmOpen&&!_modalConfSession){
        _modalConfSession={returnFocus:document.activeElement};needsFocus=true;
    }else if(!confirmOpen&&_modalConfSession){
        returnFocus=returnFocus||_modalConfSession.returnFocus;
        _modalConfSession=null;
    }
    _blockModalBackground(open||confirmOpen);
    overlay.inert=confirmOpen;
    const top=confirmOpen?conf:open?overlay:null;
    if(returnFocus?.isConnected&&!returnFocus.closest('[inert]')&&(!top||top.contains(returnFocus)))returnFocus.focus();
    if(top&&(needsFocus||!top.contains(document.activeElement)))_focusModal(top);
    else if(!top&&returnFocus&&!returnFocus.isConnected){
        // Un guardado puede reemplazar la fila que abrió el formulario.
        document.querySelector('#main .module.active .srch-input')?.focus();
    }
}

function requestCloseModal(){
    const overlay=document.getElementById('modal-overlay');
    if(!overlay.classList.contains('open'))return true;
    if(_modalSession&&_modalSnapshot(document.getElementById('modal-body'))!==_modalSession.baseline&&
       !window.confirm('Tenés cambios sin guardar en este formulario. ¿Querés descartarlos y cerrar?'))return false;
    closeModal();
    return true;
}

function initializeModals(){
    if(_modalObserver)return;
    const overlay=document.getElementById('modal-overlay'),conf=document.getElementById('conf-overlay');
    _modalObserver=new MutationObserver(_syncModalState);
    for(const root of [overlay,conf])_modalObserver.observe(root,{attributes:true,attributeFilter:['class']});
    _modalObserver.observe(document.getElementById('modal-body'),{childList:true,subtree:true});
    window.matchMedia('(max-width:800px)').addEventListener('change',()=>{
        if(!_modalSession&&!_modalConfSession)return;
        // setMobileMenu() actualiza estos valores al cambiar de ancho.
        for(const id of ['main','sidebar']){
            const el=document.getElementById(id);
            _modalBackground.set(el,el.inert);
            el.inert=true;
        }
    });
    document.addEventListener('focusin',e=>{
        const top=conf.classList.contains('open')?conf:overlay.classList.contains('open')?overlay:null;
        if(top&&!top.contains(e.target))_focusModal(top);
    });
    document.addEventListener('keydown',e=>{
        const top=conf.classList.contains('open')?conf:overlay.classList.contains('open')?overlay:null;
        if(!top)return;
        if(e.key==='Escape'){
            e.preventDefault();e.stopImmediatePropagation();
            if(top===conf)closeConf();else requestCloseModal();
        }else if(e.key==='Tab'){
            const fields=_modalFocusable(top),first=fields[0],last=fields.at(-1);
            if(!first){e.preventDefault();top.querySelector('.modal').focus();}
            else if(!fields.includes(document.activeElement)||e.shiftKey&&document.activeElement===first||!e.shiftKey&&document.activeElement===last){
                e.preventDefault();(e.shiftKey?last:first).focus();
            }
        }else if(e.key.toLowerCase()==='n'||(e.ctrlKey||e.metaKey)&&['z','y','s'].includes(e.key.toLowerCase())){
            // Conservar edición nativa; impedir acciones globales detrás del diálogo.
            const editing=['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||e.target.isContentEditable;
            if(!editing||(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s')e.preventDefault();
            e.stopImmediatePropagation();
        }
    },true);
    _syncModalState();
    debugLog('Sistema de modales iniciado');
}

/**
 * Abrir modal
 */
function openModal(id) {

    const modal = document.getElementById(id);

    if (!modal) return;

    modal.classList.remove("hidden");

}

/**
 * Cerrar modal
 *
 * NOTA: renombrada de `closeModal` a `_closeModalById` (PR-007.2).
 * `index.html` ya declara su propio `closeModal()` (sin argumento)
 * para el modal real de la app (#modal-overlay). Al compartir
 * nombre y scope global, la declaración de este archivo — cargado
 * después via <script src> — pisaba a la de index.html, dejando
 * `closeModal()` inservible en todos los módulos (mismo patrón que
 * ya se resolvió en js/storage.js con `_persistBase()`). Ningún
 * llamado real en el proyecto invoca esta función con un `id`
 * (búsqueda confirmó cero usos de `closeModal(id)`/`openModal(id)`
 * con argumento), así que el renombre no cambia comportamiento
 * observable — solo libera el nombre global `closeModal` para la
 * única implementación que la app realmente usa.
 */
function _closeModalById(id) {

    const modal = document.getElementById(id);

    if (!modal) return;

    modal.classList.add("hidden");

}
