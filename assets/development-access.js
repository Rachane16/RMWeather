'use strict';
// Anonymous forecast reads; administrative uploads remain server-protected.
(()=>{
 const gateway='https://rmweather-development-access.rachane-16.chatgpt.site/public/data/';
 const jsonFile=/^(?:manifest|health|ecmwf_ifs|google_weathernext3_ensemble_mean|best_match|ecmwf_aifs025_single|icon_global|gfs_global|ukmo_global_deterministic_10km|meteofrance_arpege_world|jma_gsm|cma_grapes_global)\.json$/;
 async function request(file){
  if(!jsonFile.test(file))throw Error('ชื่อชุดข้อมูลไม่ถูกต้อง');
  const response=await fetch(gateway+file,{credentials:'omit',redirect:'error',signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw Error('ชุดข้อมูลยังไม่พร้อม กรุณาลองใหม่');
  return response;
 }
 window.developmentAccess=Object.freeze({
  async json(file){return (await request(file)).json();}
 });
})();
