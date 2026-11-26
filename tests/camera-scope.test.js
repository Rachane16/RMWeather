const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../assets/app.js'),'utf8');
test('Songkhla Windy cameras join CCTV and disappear only from the duplicate nationwide map group',()=>{
 const groups={},details=[];
 const one={camera_slug:'one',camera_name_th:'One',location:'7,100',status:'online'},south={webcam_id:1,name:'Songkhla',latitude:7,longitude:100,region_code:'TH.68'},north={webcam_id:2,name:'North',latitude:18,longitude:99,region_code:'TH.02'};
 const ctx={datasets:{cameras:[one],windycams:[south,north]},enabled:{cameras:true,windycams:true},stale:()=>false,map:{setPoints:(id,features,on,click)=>groups[id]={features,on,click}},showDetail:(...a)=>details.push(a)};
 vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('function cameraType('),source.indexOf('function filteredCameras(')),ctx);
 ctx.renderMarkers();assert.equal(groups.cameras.features.length,2);assert.equal(groups.windycams.features.length,1);
 groups.cameras.click(1);assert.equal(details[0][0],'windycams');assert.equal(details[0][1].webcam_id,1);
 ctx.enabled.cameras=false;ctx.renderMarkers();assert.equal(groups.windycams.features.length,2);
});
