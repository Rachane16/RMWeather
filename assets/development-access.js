'use strict';

// Authentication is enforced by the server. No password, verifier, API token or
// private snapshot is included in the public client. Sessions live in this tab.
(()=>{
 const gateway='https://rmweather-development-access.rachane-16.chatgpt.site';
 const dialog=document.getElementById('development-login-dialog'),form=document.getElementById('development-login-form');
 const message=document.getElementById('development-login-error'),submit=document.getElementById('development-login-submit');
 let token='',expires=0,pending=null,resolveLogin=null,expiryTimer=null,generation=0;
 const images=new Map();
 function locked(){
  token='';expires=0;++generation;clearTimeout(expiryTimer);
  for(const item of images.values())item.then(url=>URL.revokeObjectURL(url)).catch(()=>{});images.clear();
  window.dispatchEvent(new Event('development-locked'));
 }
 function finish(value){resolveLogin?.(value);pending=null;resolveLogin=null;}
 dialog.addEventListener('close',()=>{form.reset();finish(false);});
 document.getElementById('development-login-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('keydown',e=>{if(e.key==='Escape')e.stopPropagation();});
 form.addEventListener('submit',async event=>{
  event.preventDefault();submit.disabled=true;message.textContent='กำลังตรวจสอบบัญชี…';
  const username=document.getElementById('development-username').value,password=document.getElementById('development-password').value;
  try{
   const response=await fetch(gateway+'/auth/login',{method:'POST',credentials:'omit',redirect:'error',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password}),signal:AbortSignal.timeout(20000)});
   if(!response.ok){message.textContent=response.status===429?'ลองเข้าสู่ระบบหลายครั้ง กรุณารอ 15 นาที':response.status===401?'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง':'เซิร์ฟเวอร์ล็อกอินยังไม่พร้อม กรุณาลองใหม่';return;}
   const result=await response.json();
   if(typeof result.token!=='string'||!Number.isFinite(result.expires)||result.expires<=Date.now())throw Error('Invalid session');
   token=result.token;expires=result.expires;++generation;clearTimeout(expiryTimer);expiryTimer=setTimeout(locked,Math.max(0,expires-Date.now()));
   message.textContent='';finish(true);dialog.close();window.dispatchEvent(new Event('development-unlocked'));
  }catch{message.textContent='เชื่อมต่อเซิร์ฟเวอร์ล็อกอินไม่ได้ กรุณาลองใหม่';}
  finally{document.getElementById('development-password').value='';submit.disabled=false;}
 });
 async function request(path){
  if(!token||expires<=Date.now()){locked();throw Error('กรุณาเข้าสู่ระบบโหมดกำลังพัฒนา');}
  const current=token;
  const response=await fetch(gateway+path,{credentials:'omit',redirect:'error',cache:'no-store',headers:{Authorization:'Bearer '+current},signal:AbortSignal.timeout(25000)});
  if(token!==current)throw Error('เซสชันถูกปิดแล้ว');
  if(response.status===401){locked();throw Error('หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่');}
  if(!response.ok)throw Error('ข้อมูลทดลองยังไม่พร้อม กรุณาลองใหม่');
  return response;
 }
 window.developmentAccess=Object.freeze({
  ensure(){
   if(token&&expires>Date.now())return Promise.resolve(true);
   if(pending)return pending;
   pending=new Promise(resolve=>resolveLogin=resolve);message.textContent='';form.reset();dialog.showModal();document.getElementById('development-username').focus();return pending;
  },
  async json(file){const current=generation,result=await (await request('/data/'+file)).json();if(current!==generation)throw Error('เซสชันถูกปิดแล้ว');return result;},
  image(file){
   if(!/^frames\/clpp-[a-f0-9]{20}\.png$/.test(file))return Promise.reject(Error('ชื่อภาพไม่ถูกต้อง'));
   if(!images.has(file)){
    const current=generation,promise=request('/data/'+file).then(r=>r.blob()).then(blob=>{const url=URL.createObjectURL(blob);if(!token||current!==generation){URL.revokeObjectURL(url);throw Error('Session closed');}return url;});
    images.set(file,promise);promise.catch(()=>{if(images.get(file)===promise)images.delete(file);});
   }
   return images.get(file);
  },
  async logout(){
   const previous=token;locked();
   if(previous)try{await fetch(gateway+'/auth/logout',{method:'POST',credentials:'omit',redirect:'error',cache:'no-store',headers:{Authorization:'Bearer '+previous},signal:AbortSignal.timeout(10000)});}catch{}
  }
 });
})();
