'use strict';

// Roadmap only: opening this catalogue never enables a map layer or calls a feed.
const developmentDialog=document.getElementById('development-dialog');
const developmentOpen=document.getElementById('development-open');
developmentOpen.addEventListener('click',()=>developmentDialog.showModal());
document.getElementById('development-close').addEventListener('click',()=>developmentDialog.close());
developmentDialog.addEventListener('keydown',event=>{
  // Let the native dialog handle Escape without closing map controls underneath.
  if(event.key==='Escape')event.stopPropagation();
});
developmentDialog.addEventListener('close',()=>developmentOpen.setAttribute('aria-expanded','false'));
developmentOpen.addEventListener('click',()=>developmentOpen.setAttribute('aria-expanded','true'));
