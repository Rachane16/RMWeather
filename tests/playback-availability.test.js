const {test}=require('node:test'),assert=require('node:assert/strict');
const {playbackAvailability:visible}=require('../assets/workspace-ui.js');
test('default radar stays on the map without a clock until explicitly selected',()=>{
 assert.deepEqual(visible({radarEnabled:true}),{radar:false,model:false});
 assert.equal(visible({radarSelected:true,radarEnabled:true}).radar,true);
 assert.equal(visible({radarSelected:true,radarEnabled:false}).radar,false);
 assert.equal(visible({model:true}).model,true);assert.equal(visible({clpp:true}).radar,true);
});
test('the forecast table hides both clocks and restores only active sources after closing',()=>{
 assert.deepEqual(visible({radarSelected:true,radarEnabled:true,model:true,advance:true}),{radar:false,model:false});
 assert.deepEqual(visible({model:true,advance:false}),{radar:false,model:true});
});
