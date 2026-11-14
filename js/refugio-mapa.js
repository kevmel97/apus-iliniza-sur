/* Geometría compartida; proyección adaptable sin mover la cámara. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ApusRefugioMap=api;})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const bounds={left:38,right:922,top:302,bottom:570};
 const ax=[0,177,480,780,960],px=[0,138,280,440,560];
 const ay=[0,270,302,322,378,440,493,515,570,600],py=[0,294,326,346,452,504,550,580,690,720];
 function map(v,a,b){let i=0;while(i<a.length-2&&v>a[i+1])i++;return b[i]+(v-a[i])*(b[i+1]-b[i])/(a[i+1]-a[i]);}
 function project(p,portrait){return portrait?{x:map(p.x,ax,px),y:map(p.y,ay,py)}:{x:p.x,y:p.y};}
 function unproject(p,portrait){return portrait?{x:map(p.x,px,ax),y:map(p.y,py,ay)}:{x:p.x,y:p.y};}
 // Huellas sólidas, ampliadas para que los pies no atraviesen los objetos.
 const obstacles=[
  {kind:'rect',name:'refugio',x1:55,x2:329,y1:270,y2:335},
  {kind:'rect',name:'cabana',x1:675,x2:905,y1:270,y2:335},
  {kind:'rect',name:'carpas',x1:62,x2:294,y1:351,y2:511},
  {kind:'rect',name:'vestuario',x1:666,x2:900,y1:365,y2:497},
  {kind:'ellipse',name:'fogata',x:480,y:378,rx:88,ry:47}
 ];
 const zones={cabana:{x:788,y:350},fogata:{x:480,y:445},carpas:{x:177,y:535},vestuario:{x:780,y:535}};
 function walkable(p){if(p.x<bounds.left||p.x>bounds.right||p.y<bounds.top||p.y>bounds.bottom)return false;return !obstacles.some(o=>o.kind==='rect'?p.x>=o.x1&&p.x<=o.x2&&p.y>=o.y1&&p.y<=o.y2:((p.x-o.x)/o.rx)**2+((p.y-o.y)/o.ry)**2<=1);}
 function clear(a,b){const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/3));for(let i=0;i<=n;i++)if(!walkable({x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n}))return false;return true;}
 const step=8,cols=Math.floor((bounds.right-bounds.left)/step)+1,rows=Math.floor((bounds.bottom-bounds.top)/step)+1;
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
 return {project,unproject,walkable,clear,safe,route,slide,zones,obstacles,bounds};
});
