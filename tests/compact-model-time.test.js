const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('compact model timestamp follows the selected frame, including Bangkok date changes and empty data',()=>{
 const code=fs.readFileSync(require.resolve('../assets/development.js'),'utf8'),nodes={};
 const stamp=Date.parse('2026-11-26T20:00:00Z')/1000;
 const node=id=>nodes[id]??={style:{},closest(){return node('row');},removeAttribute(k){delete this[k==='datetime'?'dateTime':k];}};
 const context={window:{},state:{modelRain:true,modelWind:false,clppRadar:false},source:'model',indices:{model:0},data:{model:{name:'Test',frames:[{start:stamp-10800,time:stamp},{start:stamp,time:stamp+10800}],license:'CC BY 4.0',grid:{step:1.2}}},Date,$:node,date:t=>new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(t*1000))};
 vm.createContext(context);vm.runInContext(code.slice(code.indexOf(' function renderClock(){'),code.indexOf(' function stop(){')),context);
 context.renderClock();assert.equal(node('development-mini-time').dateTime,'2026-11-26T20:00:00.000Z');assert.match(node('development-mini-time').textContent,/27/);assert.match(node('development-mini-time').textContent,/03:00/);
 context.indices.model=1;context.renderClock();assert.match(node('development-mini-time').textContent,/06:00/);
 context.state.modelRain=false;context.renderClock();assert.equal(node('development-mini-time').textContent,'—');assert.equal(node('development-mini-time').dateTime,undefined);
});
