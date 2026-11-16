(function(){
 'use strict';
 const $=id=>document.getElementById(id),panel=$('apus-board-panel');if(!panel)return;
 const form=$('apus-board-form'),list=$('apus-board-list'),message=$('apus-board-message');
 let service=null,uid='',lastUid='',epoch=0,editing=null,tab='all',busy=false,status='connecting',state={connected:false,posts:[],mine:[],now:Date.now()},inert=[];
 let imageData='',imageBusy=false,imageEpoch=0,lastCleanup=0;
 const formatter=new Intl.DateTimeFormat('es-EC',{timeZone:'America/Guayaquil',dateStyle:'medium',timeStyle:'short'});
 function note(s){message.textContent=s;}
 function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
 function button(text,fn){const b=el('button',text,'ref-btn');b.type='button';b.disabled=busy||!state.connected||status==='denied';b.addEventListener('click',fn);return b;}
 function cleanup(){if(!service||!state.connected||Date.now()-lastCleanup<60000)return;lastCleanup=Date.now();const generation=epoch;service.cleanup().catch(()=>{if(generation!==epoch)return;note('No se completó la limpieza de anuncios vencidos. Se reintentará al abrir el tablón.');});}
 function close(){panel.hidden=true;for(const [n,v]of inert)n.inert=v;inert=[];$('apus-refugio-overlay').querySelector('[data-ref-zone="fogata"]')?.focus();}
 function open(){if(!panel.hidden)return;panel.hidden=false;window.dispatchEvent(new Event('apus:board-open'));inert=[...panel.parentElement.children].filter(n=>n!==panel).map(n=>[n,n.inert]);for(const[n]of inert)n.inert=true;render();cleanup();$('apus-board-close').focus();}
 function imagePreview(){const preview=$('apus-board-image-preview');preview.hidden=!imageData;if(imageData)preview.src=imageData;else preview.removeAttribute('src');$('apus-board-remove-image').hidden=!imageData;}
 function addMeeting(point={place:'',time:''}){const host=$('apus-board-meetings');if(host.children.length>=8)return;const row=el('div',undefined,'ref-board-meeting-row'),placeLabel=el('label','LUGAR'),timeLabel=el('label','HORA'),place=el('input'),time=el('input');place.required=true;place.minLength=3;place.maxLength=160;place.placeholder='Lugar de reunión';place.value=point.place;place.dataset.meetingPlace='';time.type='time';time.required=true;time.value=point.time;time.dataset.meetingTime='';placeLabel.append(place);timeLabel.append(time);const remove=el('button','QUITAR','ref-btn');remove.type='button';remove.addEventListener('click',()=>{if(host.children.length>1){row.remove();meetingButtons();}});row.append(placeLabel,timeLabel,remove);host.append(row);meetingButtons();}
 function meetingButtons(){const rows=$('apus-board-meetings').children;for(const row of rows)row.querySelector('button').disabled=rows.length===1||busy;$('apus-board-add-meeting').disabled=rows.length>=8||busy;}
 function readMeetings(){return [...$('apus-board-meetings').children].map(row=>({place:row.querySelector('[data-meeting-place]').value,time:row.querySelector('[data-meeting-time]').value}));}
 async function compressImage(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Selecciona una imagen JPG, PNG o WebP.');
  if(file.size>12*1024*1024)throw Error('Selecciona una imagen de hasta 12 MB.');
  const url=URL.createObjectURL(file),image=new Image();try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('No se pudo leer la imagen.'));image.src=url;});
   if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>40000000)throw Error('La imagen es demasiado grande. Usa una copia más pequeña.');
   for(const edge of [1024,800,640,480]){const scale=Math.min(1,edge/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);for(const quality of [.8,.65,.5,.35]){const data=canvas.toDataURL('image/jpeg',quality);if(window.ApusBoard.validImage(data))return data;}}
   throw Error('No se pudo comprimir esta imagen. Prueba con otra.');
  }finally{URL.revokeObjectURL(url);}
 }
 function edit(post){
  editing=post?{...post}:null;form.reset();imageEpoch++;imageBusy=false;imageData=post?.image||'';imagePreview();$('apus-board-image-status').textContent='La imagen se comprime antes de subirla.';$('apus-board-meetings').replaceChildren();const points=post?.meetings||[{place:post?.meeting||'',time:post?new Date(post.startAt-18000000).toISOString().slice(11,16):''}];for(const point of points)addMeeting({place:point.place,time:point.time||(point.at?new Date(point.at-18000000).toISOString().slice(11,16):'')});
  if(post){for(const field of ['mountain','details','difficulty','whatsapp'])$('apus-board-'+field).value=post[field];const local=new Date(post.startAt-5*3600000).toISOString();$('apus-board-date').value=local.slice(0,10);$('apus-board-time').value=local.slice(11,16);}
  form.hidden=false;list.hidden=true;$('apus-board-editor-title').textContent=post?'EDITAR SALIDA':'PUBLICAR SALIDA';note('');$('apus-board-mountain').focus();
 }
 function endEdit(){imageEpoch++;imageBusy=false;form.hidden=true;list.hidden=false;editing=null;render();}
 function error(e){return /permission/i.test(e.code||e.message)?'No se pudo guardar. Comprueba que eres el organizador, que la fecha sea futura y que el tablón esté activado.':e.message||'No se pudo completar. Inténtalo de nuevo.';}
 async function action(fn,success){if(busy||!service)return;const generation=epoch;busy=true;render();note('GUARDANDO…');
  try{await fn();if(generation!==epoch)return;note(success);}
  catch(e){if(generation===epoch)note(error(e));}
  finally{if(generation===epoch){busy=false;render();}}
 }
 function render(){
  if(panel.hidden)return;
  for(const b of panel.querySelectorAll('[data-board-tab]'))b.setAttribute('aria-pressed',String(b.dataset.boardTab===tab));
  $('apus-board-new').disabled=busy||!state.connected||status==='denied';$('apus-board-submit').disabled=busy||imageBusy||!state.connected||status==='denied';$('apus-board-image').disabled=busy; $('apus-board-remove-image').disabled=busy;meetingButtons();for(const field of form.querySelectorAll('input:not([type=file]),textarea,select'))field.disabled=busy;
  $('apus-board-cancel').disabled=busy;
  list.replaceChildren();
  if(status==='denied'){list.append(el('p','No se pudo autorizar el acceso al tablón. Sal del Refugio y vuelve a entrar para reintentar.'));return;}
  if(!state.connected){list.append(el('p','Sin conexión. Conéctate para consultar o publicar salidas.'));return;}
  if(status==='error'){list.append(el('p','No se pudo cargar el tablón. Sal del Refugio y vuelve a entrar para reintentar.'));return;}
  const posts=tab==='mine'?state.mine:state.posts;
  for(const p of posts){
   const card=el('article',undefined,'ref-board-card');card.append(el('h4',p.mountain));
   card.append(el('p','📅 '+formatter.format(p.startAt)+' · hora de Ecuador'));
   for(const point of p.meetings||[{place:p.meeting,time:formatter.format(p.startAt).split(', ').at(-1)}])card.append(el('p','📍 '+point.place+' · '+(point.time||new Date(point.at-18000000).toISOString().slice(11,16))));
   if(p.image&&window.ApusBoard.validImage(p.image)){const img=el('img',undefined,'ref-board-photo');img.src=p.image;img.alt='Imagen de la salida '+p.mountain;img.loading='lazy';card.append(img);}card.append(el('p','Dificultad: '+({baja:'Baja',media:'Media',alta:'Alta',tecnica:'Técnica'}[p.difficulty]||p.difficulty)));
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
 function disconnect(){epoch++;imageEpoch++;imageBusy=false;lastCleanup=0;service?.stop();service=null;uid='';state={connected:false,posts:[],mine:[],now:Date.now()};busy=false;status='connecting';if(!panel.hidden)close();note('');}
 function connect(options){if(service&&uid===options.uid)return;disconnect();uid=options.uid;if(lastUid!==uid){form.reset();form.hidden=true;list.hidden=false;editing=null;tab='all';}lastUid=uid;const generation=epoch;
  service=window.ApusBoard.create({...options,onChange:s=>{if(generation===epoch){state=s;render();if(!panel.hidden)cleanup();}},onStatus:s=>{if(generation===epoch){status=s;render();}}});
 }
 $('apus-board-add-meeting').addEventListener('click',()=>addMeeting());
 $('apus-board-remove-image').addEventListener('click',()=>{imageEpoch++;imageBusy=false;imageData='';$('apus-board-image').value='';imagePreview();$('apus-board-image-status').textContent='Imagen retirada.';render();});
 $('apus-board-image').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;const generation=++imageEpoch,account=epoch;imageBusy=true;render();$('apus-board-image-status').textContent='COMPRIMIENDO IMAGEN…';try{const data=await compressImage(file);if(generation!==imageEpoch||account!==epoch)return;imageData=data;imagePreview();$('apus-board-image-status').textContent='Imagen lista · '+Math.ceil((data.length-23)*.75/1024)+' KB';}catch(error){if(generation===imageEpoch&&account===epoch)$('apus-board-image-status').textContent=error.message;}finally{if(generation===imageEpoch&&account===epoch){imageBusy=false;render();}}});
 $('apus-board-close').addEventListener('click',close);$('apus-board-new').addEventListener('click',()=>edit(null));$('apus-board-cancel').addEventListener('click',endEdit);
 for(const b of panel.querySelectorAll('[data-board-tab]'))b.addEventListener('click',()=>{if(busy)return;tab=b.dataset.boardTab;endEdit();note('');});
 form.addEventListener('submit',e=>{e.preventDefault();if(!service||busy||imageBusy)return;let input;try{input={};for(const f of ['mountain','details','difficulty','whatsapp'])input[f]=$('apus-board-'+f).value;input.meetings=readMeetings();input.image=imageData;input.startAt=window.ApusBoard.fromEcuador($('apus-board-date').value,$('apus-board-time').value);if(editing)input.revision=editing.updatedAt;window.ApusBoard.clean(input,state.now);}catch(err){note(error(err));return;}
  const client=service,id=editing?.id,generation=epoch;action(async()=>{await client.save(input,id);if(generation===epoch)endEdit();},'SALIDA PUBLICADA');
 });
 panel.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'&&!busy){e.preventDefault();close();}if(e.key==='Tab'){const nodes=[...panel.querySelectorAll('button:not([disabled]),a,input,select,textarea,summary')].filter(n=>n.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
 window.ApusBoardUI={connect,disconnect,open,get isOpen(){return !panel.hidden;}};
})();
