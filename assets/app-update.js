'use strict';

function androidVersion(agent){const m=/RMWeatherAndroid\/(\d+(?:\.\d+){1,2})/.exec(agent);return m?m[1]:null;}
function newerVersion(next,current){const a=next.split('.').map(Number),b=current.split('.').map(Number);for(let i=0;i<3;i++){if((a[i]||0)!==(b[i]||0))return (a[i]||0)>(b[i]||0);}return false;}
async function checkAndroidUpdate(){
 const installed=androidVersion(navigator.userAgent);if(!installed)return;
 try{
  const response=await fetch('https://api.github.com/repos/Rachane16/RMWeather/releases/latest',{headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(10000)});
  if(!response.ok)return;const release=await response.json(),version=/^android-v(\d+\.\d+\.\d+)$/.exec(release.tag_name)?.[1];
  if(!version||!newerVersion(version,'1.0.999999')||!newerVersion(version,installed)||release.draft||release.prerelease)return;
  const asset=release.assets?.find(a=>a.name==='RMWeather.apk'),url=asset?.browser_download_url;
  if(!url||!url.startsWith('https://github.com/Rachane16/RMWeather/releases/download/android-v'+version+'/'))return;
  const key='rmweather-update-dismissed-'+version;
  try{if(Date.now()-Number(sessionStorage.getItem(key)||0)<6*3600000)return;}catch{}
  if(document.querySelector('#app-update-dialog'))return;
  const dialog=document.createElement('dialog');dialog.id='app-update-dialog';dialog.className='app-update-dialog';
  const title=document.createElement('h2');title.textContent='RMWeather '+version+' พร้อมอัปเดต';
  const text=document.createElement('p');text.textContent='ดาวน์โหลดแล้วกดยืนยันติดตั้งทับแอปเดิมได้ โดยไม่ต้องถอนการติดตั้ง Android อาจให้อนุญาตติดตั้งจากเบราว์เซอร์ครั้งแรก';
  const download=document.createElement('a');download.href=url;download.textContent='ดาวน์โหลดอัปเดต';download.className='popup-button';
  const later=document.createElement('button');later.textContent='ไว้ภายหลัง';later.className='popup-button';
  const dismiss=()=>{try{sessionStorage.setItem(key,String(Date.now()));}catch{}dialog.close();dialog.remove();};
  later.addEventListener('click',dismiss);dialog.addEventListener('cancel',e=>{e.preventDefault();dismiss();});download.addEventListener('click',dismiss);
  dialog.append(title,text,download,later);document.body.append(dialog);dialog.showModal();
 }catch{/* Keep the weather map available when release checks are offline or rate limited. */}
}
if(typeof document!=='undefined'){setTimeout(checkAndroidUpdate,15000);setInterval(()=>{if(!document.hidden)checkAndroidUpdate();},6*3600000);}
if(typeof module!=='undefined')module.exports={androidVersion,newerVersion};
