/* Gestos y frases efímeras del Refugio. No se guardan conversaciones. */
(function(root){
 'use strict';
 const actions=[['wave','👋','SALUDAR'],['dance','🎵','BAILAR'],['hug','🤗','ABRAZO'],['jump','⬆','SALTAR'],['fight','🥊','PELEEMOS']];
 function clean(value){return String(value||'').replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,' ').replace(/\s+/g,' ').trim().slice(0,120);}
 function pose(record,now){const g=record?.gesture,age=g?now-g.at:99999;if(age<0||age>=3600||!actions.some(a=>a[0]===g.value))return {dy:0,opts:{}};const phase=age/1000;return {dy:g.value==='jump'?-Math.abs(Math.sin(phase*Math.PI*2))*35:g.value==='dance'?Math.sin(phase*9)*5:0,opts:{socialPose:g.value,socialPhase:phase}};}
 function lines(ctx,text,width){const out=[];let line='';for(const char of Array.from(text)){if(line&&ctx.measureText(line+char).width>width){out.push(line);line='';}line+=char;}if(line)out.push(line);return out;}
 function create({root:refuge,send,now=Date.now,freeze}){
  const bar=document.createElement('section');bar.className='ref-social';bar.hidden=true;bar.setAttribute('aria-label','Gestos y mensajes del Refugio');
  bar.innerHTML='<div class="ref-social-main"><button type="button" class="ref-btn" id="ref-social-toggle" aria-expanded="false">👋 GESTOS</button><form id="ref-social-form"><input id="ref-social-message" type="text" maxlength="120" autocomplete="off" placeholder="Escribe una frase…" aria-label="Mensaje para todos en el Refugio"><button class="ref-btn ref-btn-orange" type="submit">ENVIAR</button></form></div><div id="ref-social-gestures" hidden></div><p id="ref-social-feedback" role="status" aria-live="polite"></p>';
  refuge.insertBefore(bar,refuge.querySelector('.ref-foot'));
  const field=bar.querySelector('input'),form=bar.querySelector('form'),tray=bar.querySelector('#ref-social-gestures'),toggle=bar.querySelector('#ref-social-toggle'),feedback=bar.querySelector('#ref-social-feedback');
  const own={};let allowed=false,online=false,busy=false,generation=0,last={chat:-Infinity,gesture:-Infinity},feedbackUntil=0;
  function announce(text){feedback.textContent=text;feedbackUntil=Date.now()+4500;}
  async function publish(kind,value){
   if(!allowed||busy)return;if(!online){announce('Conéctate para que los demás te vean.');return;}
   value=kind==='chat'?clean(value):value;if(!value){announce('Escribe una frase antes de enviar.');return;}
   const cooldown=kind==='chat'?3000:1000;if(now()-last[kind]<cooldown){announce('Espera un momento antes de repetir.');return;}
   busy=true;const token=generation;freeze();
   try{const event=await send(kind,value);if(token!==generation||!allowed)return;own[kind]=event;last[kind]=now();if(kind==='chat'){field.value='';field.blur();announce('Mensaje visible durante 8 segundos.');}else{tray.hidden=true;toggle.setAttribute('aria-expanded','false');announce(actions.find(a=>a[0]===value)[2]);}}
   catch(e){if(token===generation)announce(/permission|denied/i.test(e.code||e.message||'')?'Los gestos y el chat aún no tienen permiso de conexión.':e.message||'No se pudo enviar. Inténtalo otra vez.');}
   finally{if(token===generation)busy=false;}
  }
  for(const [value,icon,label]of actions){const b=document.createElement('button');b.type='button';b.className='ref-btn';b.textContent=icon+' '+label;b.onclick=()=>publish('gesture',value);tray.append(b);}
  toggle.onclick=()=>{tray.hidden=!tray.hidden;toggle.setAttribute('aria-expanded',String(!tray.hidden));freeze();};
  form.onsubmit=e=>{e.preventDefault();publish('chat',field.value);};field.addEventListener('focus',freeze);
  bar.addEventListener('pointerdown',e=>e.stopPropagation());bar.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){field.blur();tray.hidden=true;toggle.setAttribute('aria-expanded','false');}});
  function clear(){generation++;busy=false;allowed=false;bar.hidden=true;tray.hidden=true;toggle.setAttribute('aria-expanded','false');delete own.chat;delete own.gesture;field.value='';field.blur();feedback.textContent='';}
  return {own,clear,get typing(){return document.activeElement===field;},pose:record=>pose(record,now()),
   sync(ready,connected){online=connected;if(!ready){if(allowed)clear();return;}allowed=true;bar.hidden=false;form.querySelector('button').disabled=busy||!online;toggle.disabled=busy;field.disabled=!online;if(feedbackUntil&&Date.now()>feedbackUntil){feedback.textContent='';feedbackUntil=0;}},
   bubble(ctx,record,point,camera,view){
    const clock=now(),chat=record?.chat,g=record?.gesture;
    let value=chat&&clock-chat.at>=0&&clock-chat.at<8000?chat.value:'';
    if(!value&&g&&clock-g.at>=0&&clock-g.at<3600){const a=actions.find(a=>a[0]===g.value);if(a)value=a[1]+' '+a[2];}
    if(!value||point.x<camera.x-30||point.x>camera.x+view.width+30||point.y<camera.y||point.y>camera.y+view.height+60)return;
    ctx.save();ctx.font='14px monospace';ctx.textAlign='left';ctx.textBaseline='top';
    const max=Math.min(260,view.width-28),rows=lines(ctx,value,max-20),width=Math.min(max,Math.max(75,...rows.map(l=>ctx.measureText(l).width+20))),height=rows.length*19+16;
    const x=Math.max(camera.x+8,Math.min(point.x-width/2,camera.x+view.width-width-8));let y=point.y-87-height;
    if(y<camera.y+8)y=point.y+42;y=Math.max(camera.y+8,Math.min(y,camera.y+view.height-height-8));
    ctx.fillStyle='#fff6dc';ctx.strokeStyle='#18344b';ctx.lineWidth=3;ctx.fillRect(x,y,width,height);ctx.strokeRect(x,y,width,height);
    const tail=Math.max(x+10,Math.min(point.x,x+width-10));ctx.beginPath();ctx.moveTo(tail-6,y+height);ctx.lineTo(tail,y+height+9);ctx.lineTo(tail+6,y+height);ctx.fill();ctx.stroke();
    ctx.fillStyle='#163149';rows.forEach((l,i)=>ctx.fillText(l,x+10,y+8+i*19));ctx.restore();
   }
  };
 }
 const api={create,clean,pose,lines};if(typeof module==='object'&&module.exports)module.exports=api;else root.ApusRefugioSocial=api;
})(typeof window!=='undefined'?window:globalThis);
