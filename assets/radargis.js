'use strict';
let radargisProduct='dbz';
function currentRadarGISProduct(){
  const products=datasets.radargis?.products||[];
  return products.find(p=>p.id===radargisProduct)||products.find(p=>p.id==='dbz')||products[0];
}
function syncRadarGISControls(){
  const products=datasets.radargis?.products||[],current=currentRadarGISProduct();
  if(current)radargisProduct=current.id;
  document.querySelectorAll('[data-radargis-product],#radargis-product').forEach(select=>{
    select.innerHTML=products.map(p=>`<option value="${esc(p.id)}">${esc(p.label)}</option>`).join('')||'<option>ยังไม่มีข้อมูล</option>';
    if(current)select.value=current.id;
  });
  $('radargis-product-row').hidden=radarKind!=='radargis';
}
document.addEventListener('change',event=>{
  if(!event.target.matches('[data-radargis-product],#radargis-product'))return;
  if(!(datasets.radargis?.products||[]).some(p=>p.id===event.target.value))return;
  radargisProduct=event.target.value;syncRadarGISControls();setRainEnabled('radargis',true);
});
function radarGISDescription(product,frame){
  if(!product)return 'ยังไม่มีข้อมูล TMD RadarGIS';
  let text=product.label+' · '+product.unit;
  if(product.forecast)text+=` · คาดการณ์ +${frame.lead_minutes||0} นาที · ฐานข้อมูล ${time(frame.base_time)}`;
  if(product.proxy)text+=' · ประเมินความเสี่ยงจากเรดาร์ ไม่ใช่ตำแหน่งฟ้าผ่าตรวจวัด';
  if(frame.available_frames!=null&&frame.expected_frames!=null)text+=` · ใช้ข้อมูล ${frame.available_frames}/${frame.expected_frames} เฟรม${frame.available_frames<frame.expected_frames?' (ข้อมูลไม่ครบช่วง)':''}`;
  return text;
}
