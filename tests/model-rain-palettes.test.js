const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const palettes=require('../assets/model-rain-palettes.js'),config=require('../data/config/model-rain-palettes.json');

test('all model rain rates use the same inclusive TMD thresholds, without dBZ conversion',()=>{
 const p=palettes.createRegistry(config);
 assert.equal(p.id,'tmd-rate-v1');
 assert.deepEqual(p.colour(5),[0,255,0,205]);
 assert.equal(p.colour(5.001)[0],255);assert.equal(p.colour(5.001)[1],255);
 assert.deepEqual(p.colour(25),[255,106,0,205]);
 assert.deepEqual(p.colour(25.001),[255,0,0,205]);
 assert.deepEqual(p.colour(50),[224,0,60,205]);
 assert.deepEqual(p.colour(50.001),[255,0,245,205]);
 for(const value of [null,undefined,NaN,Infinity,-1,0,.099])assert.deepEqual(p.colour(value),[0,0,0,0]);
 for(const value of [.1,.3,1,8,20,30,60,1000])assert.ok(p.colour(value)[3]>0);
 assert.deepEqual(p.legend('ECMWF').secondary,['0.1–5','>5–25','>25–50','>50']);
 for(const model of ['ECMWF','WeatherNext 3','GFS','ICON','UKMO','AIFS','JMA','ARPEGE','CMA','Best Match']){
  const key=p.legend(model);assert.equal(key.unit,'mm/h');assert.deepEqual(key.stops,p.legend('ECMWF').stops);
 }
});

test('a three-hour accumulation uses equivalent thresholds, never daily TMD totals or dBZ',()=>{
 const p=palettes.createRegistry(config);
 for(const rate of [.1,1,5,10,25,50,200])assert.deepEqual(p.colour(rate*3,'accum_3h'),p.colour(rate));
 const key=p.legend('IFS','accum_3h');assert.equal(key.unit,'mm/3h');
 assert.deepEqual(key.secondary,['0.3–15','>15–75','>75–150','>150']);
 assert.throws(()=>p.colour(40,'dbz'));assert.throws(()=>p.legend('IFS','daily_accumulation'));
});

test('one configuration field restores the original palette and thresholds exactly, with no grid changes',()=>{
 const snapshot=JSON.stringify(config),p=palettes.createRegistry({...config,active_profile:'windy-reference-v1'});
 const old=value=>{
  if(value==null||!Number.isFinite(value)||value<=0)return [0,0,0,0];
  const stops=[[0,39,17,158],[.6,0,148,143],[3,102,208,81],[12,244,184,18],[50,204,74,83],[200,155,15,109]];
  let hi=stops.findIndex(s=>s[0]>=value);if(hi<0)hi=stops.length-1;
  const low=stops[Math.max(0,hi-1)],high=stops[hi],w=hi===0?0:Math.min(1,(value-low[0])/(high[0]-low[0]));
  return [1,2,3].map(k=>Math.round(low[k]+(high[k]-low[k])*w)).concat(Math.round(45+160*Math.min(1,value/.6)));
 };
 for(const value of [null,0,.01,.1,.2,.6,1,3,7,12,25,50,100,200,800])assert.deepEqual(p.colour(value),old(value));
 assert.deepEqual(p.legend('IFS').ticks,['0','0.6','3','12','50','200']);
 assert.equal(JSON.stringify(config),snapshot);assert.equal(p.profiles['windy-reference-v1'].archived,true);
 assert.ok(Object.isFrozen(p.profiles['windy-reference-v1'].stops));
});

test('browser palette loading shares one request, rejects invalid configuration and can retry',async()=>{
 let calls=0,bad=true;
 const context={URL,AbortSignal,document:{baseURI:'https://example.test/RMWeather/'},fetch:async(url,options)=>{
  calls++;assert.equal(url.href,'https://example.test/RMWeather/data/config/model-rain-palettes.json');assert.equal(options.credentials,'omit');
  return {ok:true,json:async()=>bad?{schema_version:999}:config};
 }};
 vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../assets/model-rain-palettes.js'),'utf8')+'\nthis.palettes=ModelRainPalettes;',context);
 await assert.rejects(context.palettes.ready());bad=false;
 const [a,b]=await Promise.all([context.palettes.ready(),context.palettes.ready()]);assert.equal(a,b);assert.equal(calls,2);
 assert.equal(context.palettes.id(),'tmd-rate-v1');assert.equal(context.palettes.legend('IFS').unit,'mm/h');
 assert.throws(()=>palettes.createRegistry({...config,active_profile:'missing'}));
});
