'use strict';
(()=>{
 const pages={'scan-original':['原作者快照','/scan'],scan:['股票扫描','/scan'],breadth:['市场宽度','/breadth'],groups:['行业轮动','/groups']};
 const el=id=>document.getElementById(id),frame=el('screener-frame');let loaded=false,timer,loadedMode='';
 const parse=()=>{const [page,...rest]=location.hash.slice(1).split('/');return {page,route:rest.length?'/'+rest.join('/'):(pages[page]?.[1]||'/scan')};};
 const frameRoute=()=>{try{return frame.contentWindow.location.hash.slice(1)||'/scan'}catch{return ''}};
 function sync(){
  const {page,route}=parse(),active=Boolean(pages[page]),original=page==='scan-original',base=original?'/screener-original/':'/screener/';
  if(loadedMode!==base){loaded=false;loadedMode=base;}
  el('screener-source-note').textContent=original?'原作者界面与公开发布数据 · 数据日期由作者发布决定；本页不会运行你的扫描任务。':'你的独立扫描器 · 美股、港股、A股 · 原作者评分，独立计算与发布；支持 Robinhood／富途补查。';
  for(const mode of ['own','original']){const node=el('screener-mode-'+mode),selected=(mode==='original')===original;node.setAttribute('aria-pressed',String(selected));node.style.background=selected?'#e0f2ef':'';}
  el('screener-page').hidden=!active;
  if(!active){frame.setAttribute('tabindex','-1');return;}
  el('capital-page').hidden=true;el('btc-page').hidden=true;
  el('refresh-button').hidden=true;el('refresh-status').hidden=true;document.querySelector('.status-line').hidden=true;
  document.querySelectorAll('[data-page]').forEach(a=>{const current=a.dataset.page===page;a.classList.toggle('active',current);if(current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
  el('screener-title').textContent=pages[page][0];document.title='衡远 · '+pages[page][0];document.querySelector('.skip-link').href='#screener-title';
  el('screener-open').href=base+'#'+route;frame.removeAttribute('tabindex');
  if(!loaded){frame.src=base+'#'+route;loaded=true;el('screener-loading').hidden=false;clearTimeout(timer);timer=setTimeout(()=>{el('screener-loading').textContent='加载时间较长，可点击“重新载入”或“全屏打开”。';},20000);}
  else if(frameRoute()!==route)frame.contentWindow.location.hash=route;
 }
 frame.addEventListener('load',()=>{clearTimeout(timer);el('screener-loading').hidden=true;try{frame.contentWindow.addEventListener('hashchange',()=>{const route=frameRoute();const p=loadedMode==='/screener-original/'?'scan-original':route.startsWith('/breadth')?'breadth':route.startsWith('/groups')?'groups':'scan';const hash='#'+p+route;if(location.hash!==hash){window.history.replaceState(null,'',hash);sync();}});}catch{el('screener-loading').hidden=false;el('screener-loading').textContent='无法载入页面，请重新载入。';}});
 el('screener-reload').addEventListener('click',()=>{loaded=false;sync()});
 window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.type!=='hengyuan-screener-route')return;const route=event.data.route;if(typeof route!=='string'||!/^\/(?:scan|breadth|groups|options|$)/.test(route))return;const p=route.startsWith('/breadth')?'breadth':route.startsWith('/groups')?'groups':'scan';if(pages[parse().page]){window.history.replaceState(null,'','#'+p+route);sync();}});
 window.addEventListener('hashchange',sync);window.addEventListener('popstate',sync);sync();
})();
