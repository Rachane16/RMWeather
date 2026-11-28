'use strict';

function androidVersion(agent){const m=/RMWeatherAndroid\/(\d+(?:\.\d+){1,2})/.exec(agent);return m?m[1]:null;}
function newerVersion(next,current){const a=next.split('.').map(Number),b=current.split('.').map(Number);for(let i=0;i<3;i++){if((a[i]||0)!==(b[i]||0))return (a[i]||0)>(b[i]||0);}return false;}
function androidReleaseInfo(release){
 const version=/^android-v(\d+\.\d+\.\d+)$/.exec(release?.tag_name)?.[1];
 if(!version||release.draft||release.prerelease)return null;
 const url=Array.isArray(release.assets)?release.assets.find(a=>a.name==='RMWeather.apk')?.browser_download_url:null;
 return url===`https://github.com/Rachane16/RMWeather/releases/download/android-v${version}/RMWeather.apk`?{version,url}:null;
}
function createAndroidReleaseReader(fetchRelease){
 let pending;
 return ()=>{
  if(!pending)pending=(async()=>{
   const response=await fetchRelease('https://api.github.com/repos/Rachane16/RMWeather/releases/latest',{headers:{Accept:'application/vnd.github+json'},cache:'no-cache',signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error('Release unavailable');
   const info=androidReleaseInfo(await response.json());if(!info)throw Error('Signed APK unavailable');return info;
  })().finally(()=>{pending=null;});
  return pending;
 };
}
const latestAndroidRelease=createAndroidReleaseReader((...args)=>fetch(...args));
async function refreshAPKDownload(){
 const link=document.getElementById('apk-download-link'),title=document.getElementById('apk-download-title'),status=document.getElementById('apk-download-status');
 if(!link||!title||!status)return;
 status.textContent='กำลังตรวจสอบเวอร์ชันล่าสุด…';
 try{
  const {version,url}=await latestAndroidRelease();link.href=url;title.textContent='RMWeather APK รุ่น '+version;
  status.textContent='ไฟล์ติดตั้ง Android · ดาวน์โหลดเพื่อติดตั้งหรืออัปเดตทับแอปเดิม';
 }catch{
  link.href='https://github.com/Rachane16/RMWeather/releases/latest/download/RMWeather.apk';title.textContent='RMWeather APK รุ่นล่าสุด';
  status.textContent='ยังตรวจเลขรุ่นไม่ได้ · ลิงก์นี้เปิดไฟล์ APK ล่าสุด';
 }
}
async function checkAndroidUpdate(){
 const installed=androidVersion(navigator.userAgent);if(!installed)return;
 try{
  const {version,url}=await latestAndroidRelease();
  if(!newerVersion(version,'1.0.999999')||!newerVersion(version,installed))return;
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
if(typeof document!=='undefined'){document.getElementById('sources-open')?.addEventListener('click',refreshAPKDownload);setTimeout(checkAndroidUpdate,15000);setInterval(()=>{if(!document.hidden)checkAndroidUpdate();},6*3600000);}
if(typeof module!=='undefined')module.exports={androidVersion,newerVersion,androidReleaseInfo,createAndroidReleaseReader};
