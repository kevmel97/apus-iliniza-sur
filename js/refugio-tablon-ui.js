(function(){
 'use strict';
 const $=id=>document.getElementById(id),panel=$('apus-board-panel');if(!panel)return;
 const form=$('apus-board-form'),list=$('apus-board-list'),message=$('apus-board-message');
 let service=null,uid='',lastUid='',epoch=0,editing=null,tab='all',busy=false,status='connecting',state={connected:false,posts:[],mine:[],now:Date.now()},inert=[];
 const formatter=new Intl.DateTimeFormat('es-EC',{timeZone:'America/Guayaquil',dateStyle:'medium',timeStyle:'short'});
 function note(s){message.textContent=s;}
 function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
 function button(text,fn){const b=el('button',text,'ref-btn');b.type='button';b.disabled=busy||!state.connected||status==='denied';b.addEventListener('click',fn);return b;}
 function close(){panel.hidden=true;for(const [n,v]of inert)n.inert=v;inert=[];$('apus-refugio-overlay').querySelector('[data-ref-zone="fogata"]')?.focus();}
 function open(){if(!panel.hidden)return;panel.hidden=false;window.dispatchEvent(new Event('apus:board-open'));inert=[...panel.parentElement.children].filter(n=>n!==panel).map(n=>[n,n.inert]);for(const[n]of inert)n.inert=true;render();$('apus-board-close').focus();}
 function edit(post){
  editing=post?{...post}:null;form.reset();
  if(post){for(const field of ['mountain','meeting','details','difficulty','whatsapp'])$('apus-board-'+field).value=post[field];const local=new Date(post.startAt-5*3600000).toISOString();$('apus-board-date').value=local.slice(0,10);$('apus-board-time').value=local.slice(11,16);}
  form.hidden=false;list.hidden=true;$('apus-board-editor-title').textContent=post?'EDITAR SALIDA':'PUBLICAR SALIDA';note('');$('apus-board-mountain').focus();
 }
 function endEdit(){form.hidden=true;list.hidden=false;editing=null;render();}
 function error(e){return /permission/i.test(e.code||e.message)?'No se pudo guardar. Comprueba que eres el organizador, que la fecha sea futura y que el tablón esté activado.':e.message||'No se pudo completar. Inténtalo de nuevo.';}
 async function action(fn,success){if(busy||!service)return;const generation=epoch;busy=true;render();note('GUARDANDO…');
  try{await fn();if(generation!==epoch)return;note(success);}
  catch(e){if(generation===epoch)note(error(e));}
  finally{if(generation===epoch){busy=false;render();}}
 }
 function render(){
  if(panel.hidden)return;
  for(const b of panel.querySelectorAll('[data-board-tab]'))b.setAttribute('aria-pressed',String(b.dataset.boardTab===tab));
  $('apus-board-new').disabled=busy||!state.connected||status==='denied';$('apus-board-submit').disabled=busy||!state.connected||status==='denied';
  $('apus-board-cancel').disabled=busy;
  list.replaceChildren();
  if(status==='denied'){list.append(el('p','El tablón está pendiente de activación. Falta publicar sus reglas en Firebase.'));return;}
  if(!state.connected){list.append(el('p','Sin conexión. Conéctate para consultar o publicar salidas.'));return;}
  if(status==='error'){list.append(el('p','No se pudo cargar el tablón. Sal del Refugio y vuelve a entrar para reintentar.'));return;}
  const posts=tab==='mine'?state.mine:state.posts;
  for(const p of posts){
   const card=el('article',undefined,'ref-board-card');card.append(el('h4',p.mountain));
   card.append(el('p','📅 '+formatter.format(p.startAt)+' · hora de Ecuador'));
   card.append(el('p','📍 '+p.meeting));card.append(el('p','Dificultad: '+({baja:'Baja',media:'Media',alta:'Alta',tecnica:'Técnica'}[p.difficulty]||p.difficulty)));
   card.append(el('p',p.details,'ref-board-details'));card.append(el('p','Organiza: '+p.organizer));
   if(p.expiresAt<=state.now)card.append(el('strong','CADUCADA · YA NO APARECE EN EL TABLÓN'));
   else if(p.startAt<=state.now)card.append(el('strong','LA SALIDA YA COMENZÓ'));
   const controls=el('div',undefined,'ref-board-actions');
   if(p.whatsapp&&p.expiresAt>state.now){try{const href=window.ApusBoard.whatsapp(p.whatsapp);if(href){const link=el('a','ABRIR GRUPO DE WHATSAPP','ref-btn');link.href=href;link.target='_blank';link.rel='noopener noreferrer';controls.append(link);}}catch(e){}}
   if(p.owner===uid){controls.append(button('EDITAR',()=>edit(p)),button('ELIMINAR',()=>{if(window.confirm('¿Eliminar tu publicación «'+p.mountain+'»?'))action(()=>service.remove(p.id),'PUBLICACIÓN ELIMINADA');}));}
   else{
    const label=el('label','Motivo del reporte: '),select=el('select');select.setAttribute('aria-label','Motivo para reportar '+p.mountain);
    for(const[value,text]of [['spam','Spam o publicidad'],['contenido','Contenido inapropiado'],['enlace','Enlace incorrecto'],['otro','Otro motivo']]){const o=el('option',text);o.value=value;select.append(o);}label.append(select);
    const details=el('details'),summary=el('summary','REPORTAR Y OCULTAR');details.append(summary,label,button('CONFIRMAR REPORTE',()=>action(()=>service.report(p.id,select.value),'REPORTE GUARDADO. PUBLICACIÓN OCULTA PARA TI.')));controls.append(details);
   }
   card.append(controls);list.append(card);
  }
  if(!posts.length)list.append(el('p',tab==='mine'?'Todavía no has publicado una salida.':'No hay salidas vigentes. Puedes publicar la primera.'));
 }
 function disconnect(){epoch++;service?.stop();service=null;uid='';state={connected:false,posts:[],mine:[],now:Date.now()};busy=false;status='connecting';if(!panel.hidden)close();note('');}
 function connect(options){if(service&&uid===options.uid)return;disconnect();uid=options.uid;if(lastUid!==uid){form.reset();form.hidden=true;list.hidden=false;editing=null;tab='all';}lastUid=uid;const generation=epoch;
  service=window.ApusBoard.create({...options,onChange:s=>{if(generation===epoch){state=s;render();}},onStatus:s=>{if(generation===epoch){status=s;render();}}});
 }
 $('apus-board-close').addEventListener('click',close);$('apus-board-new').addEventListener('click',()=>edit(null));$('apus-board-cancel').addEventListener('click',endEdit);
 for(const b of panel.querySelectorAll('[data-board-tab]'))b.addEventListener('click',()=>{if(busy)return;tab=b.dataset.boardTab;endEdit();note('');});
 form.addEventListener('submit',e=>{e.preventDefault();if(!service||busy)return;let input;try{input={};for(const f of ['mountain','meeting','details','difficulty','whatsapp'])input[f]=$('apus-board-'+f).value;input.startAt=window.ApusBoard.fromEcuador($('apus-board-date').value,$('apus-board-time').value);if(editing)input.revision=editing.updatedAt;window.ApusBoard.clean(input,state.now);}catch(err){note(error(err));return;}
  const client=service,id=editing?.id,generation=epoch;action(async()=>{await client.save(input,id);if(generation===epoch)endEdit();},'SALIDA PUBLICADA');
 });
 panel.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'&&!busy){e.preventDefault();close();}if(e.key==='Tab'){const nodes=[...panel.querySelectorAll('button:not([disabled]),a,input,select,textarea,summary')].filter(n=>n.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
 window.ApusBoardUI={connect,disconnect,open,get isOpen(){return !panel.hidden;}};
})();
