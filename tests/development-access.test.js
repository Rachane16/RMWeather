const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const code=fs.readFileSync(require.resolve('../assets/development-access.js'),'utf8');
function fixture(){
 const requests=[],context={window:{},AbortSignal,Error};
 context.fetch=async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({schema_version:3})};};
 vm.createContext(context);vm.runInContext(code,context);
 return {context,requests,api:context.window.developmentAccess};
}
test('published model data load without login, cookies or authorization headers',async()=>{
 const f=fixture();assert.equal((await f.api.json('ecmwf_ifs.json')).schema_version,3);
 assert.ok(f.requests[0].url.endsWith('/public/data/ecmwf_ifs.json'));
 assert.equal(f.requests[0].options.credentials,'omit');assert.equal(f.requests[0].options.headers,undefined);
});
test('client only requests the published product list and immutable CLPP images',async()=>{
 const f=fixture();for(const name of ['../sessions/a','stations.json','ecmwf_ifs025.json','https://other.test/a.json'])await assert.rejects(f.api.json(name));
 assert.equal(f.requests.length,0);
 const file='frames/clpp-'+('a'.repeat(20))+'.png';assert.ok((await f.api.image(file)).endsWith('/public/data/'+file));
 await assert.rejects(f.api.image('../private.png'));
});
test('a failed public read produces an explicit unavailable error',async()=>{
 const f=fixture();f.context.fetch=async()=>({ok:false,status:503});
 await assert.rejects(f.api.json('clpp.json'),/ชุดข้อมูลยังไม่พร้อม/);
});
