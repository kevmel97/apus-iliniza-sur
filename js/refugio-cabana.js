/* Cargar las llamadas únicamente al entrar a la cabaña. */
(function(){
 let promise=null,options=null,cancelled=false;
 const load=()=>promise||(promise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='js/refugio-reuniones.js?v=32.0.16';
  script.onload=resolve;script.onerror=()=>{promise=null;script.remove();reject(Error('No se pudo abrir la cabaña. Conéctate y vuelve a intentarlo.'));};document.head.append(script);
 }));
 window.ApusCabanaUI={
  async open(value){options=value;cancelled=false;try{await load();if(!cancelled)window.ApusMeeting.open(options);}catch(e){if(!cancelled)alert(e.message);}},
  disconnect(){cancelled=true;window.ApusMeeting?.disconnect();},
  get isOpen(){return window.ApusMeeting?.isOpen||false;},
  get inCall(){return window.ApusMeeting?.inCall||false;}
 };
})();
