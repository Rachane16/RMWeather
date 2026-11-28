const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../assets/development.js'),'utf8');
const body=source.match(/launcher\.addEventListener\('click',\(\)=>\{([\s\S]*?)\n \}\);/)[1];
function harness(phone,active=false,model='gfs_global'){
 const calls=[],state={modelRain:active},panel={hidden:true};
 const context={mobile:()=>phone,state,panel,$:()=>({value:model}),selectModel(id,on=true){calls.push([id,on]);state.modelRain=on;},open(on){panel.hidden=!on;},window:{workspaceUI:{setOpen(){}}}};
 vm.createContext(context);return {calls,state,panel,click:()=>vm.runInContext('(()=>{'+body+'})()',context)};
}
test('desktop model launcher enables ECMWF on first open and closing its menu preserves the map',()=>{
 const h=harness(false);h.click();assert.deepEqual(h.calls,[['ecmwf_ifs',true]]);assert.equal(h.state.modelRain,true);assert.equal(h.panel.hidden,false);
 h.click();assert.equal(h.panel.hidden,true);assert.equal(h.state.modelRain,true);assert.equal(h.calls.length,1);
});
test('desktop opening an active model menu preserves the model selected by the user',()=>{
 const h=harness(false,true);h.click();assert.deepEqual(h.calls,[]);assert.equal(h.panel.hidden,false);
});
test('phone model launcher keeps the existing ECMWF activation and tap-again disable behaviour',()=>{
 const h=harness(true,false,'ecmwf_ifs');h.click();assert.deepEqual(h.calls,[['ecmwf_ifs',true]]);
 h.click();assert.deepEqual(h.calls.at(-1),['ecmwf_ifs',false]);assert.equal(h.state.modelRain,false);
});
