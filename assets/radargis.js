'use strict';
let radargisProduct='dbz';
function radarGISTimeline(product,products){
  if(!product)return [];
  const observed=product.frames.map(frame=>({...frame,forecast:Boolean(product.forecast)}));
  if(product.forecast||!['dbz','rainrate','lightning'].includes(product.id))return observed;
  const latest=observed.at(-1)?.frame_time;
  const future=products.find(p=>p.id===product.id+'-nowcast')?.frames||[];
  return [...observed,...future.filter(f=>Date.parse(f.base_time)===Date.parse(latest)&&f.lead_minutes>0&&f.lead_minutes<=180).map(f=>({...f,forecast:true}))].sort((a,b)=>Date.parse(a.frame_time)-Date.parse(b.frame_time));
}
function radarGISDefaultIndex(frames){
  const last=frames.findLastIndex(frame=>!frame.forecast);
  return last<0?0:last;
}
function radarGISLatency(product,frame,now=Date.now()){
  const stamp=frame.forecast?frame.base_time:product?.frames.at(-1)?.frame_time;
  const minutes=Math.floor((now-Date.parse(stamp))/60000);
  if(!Number.isFinite(minutes))return 'ไม่ทราบความล่าช้าของข้อมูล';
  if(minutes<0)return `เวลาฐานอยู่ในอนาคต ${-minutes} นาที · ตรวจสอบต้นทาง`;
  return `${product?.id?.startsWith('accum-')?'สิ้นสุดช่วงสะสม':'ฐานตรวจวัดล่าสุด'} ${time(stamp)} · ล่าช้า ${minutes} นาที`;
}
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
if(typeof document!=='undefined')document.addEventListener('change',event=>{
  if(!event.target.matches('[data-radargis-product],#radargis-product'))return;
  if(!(datasets.radargis?.products||[]).some(p=>p.id===event.target.value))return;
  radargisProduct=event.target.value;syncRadarGISControls();setRainEnabled('radargis',true);
});
function radarGISDescription(product,frame){
  if(!product)return 'ยังไม่มีข้อมูล TMD RadarGIS';
  let text=(frame.forecast&&!product.forecast?'Nowcast':product.label)+' · '+product.unit;
  if(frame.forecast||product.forecast)text+=` · คาดการณ์ +${frame.lead_minutes||0} นาที · ฐานข้อมูล ${time(frame.base_time)}`;
  text+=' · '+radarGISLatency(product,frame);
  if(product.proxy)text+=' · ประเมินความเสี่ยงจากเรดาร์ ไม่ใช่ตำแหน่งฟ้าผ่าตรวจวัด';
  if(frame.available_frames!=null&&frame.expected_frames!=null)text+=` · ใช้ข้อมูล ${frame.available_frames}/${frame.expected_frames} เฟรม${frame.available_frames<frame.expected_frames?' (ข้อมูลไม่ครบช่วง)':''}`;
  return text;
}
if(typeof module!=='undefined')module.exports={radarGISTimeline,radarGISDefaultIndex};
