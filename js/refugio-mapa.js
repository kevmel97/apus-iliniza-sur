/* Geometría del campamento ampliado, independiente de la pantalla. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ApusRefugioMap=api;})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const bounds={left:76,right:1844,top:604,bottom:1140};
 const project=p=>({x:p.x,y:p.y}),unproject=project;
 // Solo las bases bloquean los pies; el resto del dibujo permite pasar detrás.
 const obstacles=[
  {kind:'rect',name:'refugio',x1:254,x2:514,y1:634,y2:660},
  {kind:'rect',name:'cabana',x1:1466,x2:1694,y1:630,y2:656},
  {kind:'ellipse',name:'carpa',x:328,y:952,rx:98,ry:15},
  {kind:'ellipse',name:'carpa-pequena',x:399.61,y:971,rx:57,ry:12},
  {kind:'rect',name:'vestuario',x1:1456,x2:1676,y1:932,y2:960},
  {kind:'ellipse',name:'fogata',x:960,y:756,rx:72,ry:32}
 ];
 const zones={cabana:{x:1580,y:690},fogata:{x:960,y:820},carpas:{x:354,y:1010},vestuario:{x:1566,y:1000}};
 // Conserva el protocolo de presencia ya publicado y sus límites de seguridad.
 const toWire=p=>({x:p.x/2,y:p.y/2});
 const fromWire=p=>({x:p.x*2,y:p.y*2});
 function walkable(p){if(p.x<bounds.left||p.x>bounds.right||p.y<bounds.top||p.y>bounds.bottom)return false;return !obstacles.some(o=>o.kind==='rect'?p.x>=o.x1&&p.x<=o.x2&&p.y>=o.y1&&p.y<=o.y2:((p.x-o.x)/o.rx)**2+((p.y-o.y)/o.ry)**2<=1);}
 function clear(a,b){const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/3));for(let i=0;i<=n;i++)if(!walkable({x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n}))return false;return true;}
 const step=16,cols=Math.floor((bounds.right-bounds.left)/step)+1,rows=Math.floor((bounds.bottom-bounds.top)/step)+1;
 const nodes=[];for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const p={x:bounds.left+x*step,y:bounds.top+y*step};nodes.push({...p,ok:walkable(p)});}
 function nearest(p){let best=-1,d=Infinity;for(let i=0;i<nodes.length;i++){const n=nodes[i],v=(n.x-p.x)**2+(n.y-p.y)**2;if(n.ok&&v<d){d=v;best=i}}return best;}
 function safe(p){if(walkable(p))return {x:p.x,y:p.y};const n=nodes[nearest(p)];return {x:n.x,y:n.y};}
 function route(from,to){
  const start=safe(from),end=safe(to);if(clear(start,end))return [end];
  const source=nearest(start),goal=nearest(end),g=new Map([[source,0]]),prev=new Map(),open=[source],closed=new Set();
  while(open.length){let best=0;for(let i=1;i<open.length;i++){const f=id=>g.get(id)+Math.hypot(nodes[id].x-nodes[goal].x,nodes[id].y-nodes[goal].y);if(f(open[i])<f(open[best]))best=i}const id=open.splice(best,1)[0];if(id===goal){
    const result=[end];let at=id;while(at!==source){result.unshift({x:nodes[at].x,y:nodes[at].y});at=prev.get(at)}result.unshift({x:nodes[source].x,y:nodes[source].y});
    if(!clear(start,result[0])||!clear(nodes[goal],end))return [];
    const smooth=[];let anchor=start,k=0;while(k<result.length){let next=k;while(next+1<result.length&&clear(anchor,result[next+1]))next++;smooth.push(result[next]);anchor=result[next];k=next+1}return smooth;
  }closed.add(id);const x=id%cols,y=Math.floor(id/cols);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const xx=x+dx,yy=y+dy;if(xx<0||xx>=cols||yy<0||yy>=rows)continue;const n=yy*cols+xx;if(closed.has(n)||!nodes[n].ok||!clear(nodes[id],nodes[n]))continue;const cost=g.get(id)+Math.hypot(dx,dy)*step;if(cost<(g.get(n)??Infinity)){g.set(n,cost);prev.set(n,id);if(!open.includes(n))open.push(n)}}
  }return [];
 }
 function slide(from,dx,dy){const to={x:from.x+dx,y:from.y+dy};if(clear(from,to))return to;const horizontal={x:from.x+dx,y:from.y};if(clear(from,horizontal))return horizontal;const vertical={x:from.x,y:from.y+dy};return clear(from,vertical)?vertical:from;}
 return {toWire,fromWire,project,unproject,walkable,clear,safe,route,slide,zones,obstacles,bounds};
});
