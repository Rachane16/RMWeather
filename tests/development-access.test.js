const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const code=fs.readFileSync(require.resolve('../assets/development-access.js'),'utf8');
function fixture(){
 const handlers={},events=[],requests=[],elements=new Map();
 function el(id){if(!elements.has(id))elements.set(id,{value:'',textContent:'',disabled:false,handlers:{},addEventListener(k,f){this.handlers[k]=f;},focus(){},reset(){},showModal(){this.open=true;},close(){this.open=false;this.handlers.close?.();}});return elements.get(id);}
 const context={document:{getElementById:el},window:{dispatchEvent:e=>events.push(e.type)},Event:class{constructor(type){this.type=type;}},AbortSignal,Date,Map,Promise,URL:{createObjectURL:()=> 'blob:unit',revokeObjectURL(){}},setTimeout:()=>1,clearTimeout(){}};
 context.fetch=async(url,options)=>{requests.push({url,options});if(url.endsWith('/auth/login'))return {ok:true,json:async()=>({token:'unit-session-token',expires:Date.now()+60000})};return {ok:true,status:200,json:async()=>({private:true})};};
 vm.createContext(context);vm.runInContext(code,context);
 return {context,el,events,requests,api:context.window.developmentAccess};
}
async function login(f){const ready=f.api.ensure();f.el('development-username').value='unit-user';f.el('development-password').value='unit-pass';await f.el('development-login-form').handlers.submit({preventDefault(){}});assert.equal(await ready,true);}
test('locked client does not send a private-data request and a real login adds the session header',async()=>{
 const f=fixture();await assert.rejects(f.api.json('clpp.json'));assert.equal(f.requests.length,0);
 await login(f);await f.api.json('clpp.json');assert.equal(f.requests.at(-1).options.headers.Authorization,'Bearer unit-session-token');
 assert.equal(f.el('development-password').value,'');await f.api.logout();assert.ok(f.events.includes('development-locked'));await assert.rejects(f.api.json('clpp.json'));
});
test('an in-flight private response cannot reappear after logout',async()=>{
 const f=fixture();await login(f);let resolve;
 f.context.fetch=url=>url.endsWith('/auth/logout')?Promise.resolve({ok:true}):new Promise(done=>resolve=done);
 const data=f.api.json('clpp.json');await f.api.logout();
 resolve({ok:true,status:200,json:async()=>({private:true})});
 await assert.rejects(data);
 assert.ok(f.events.includes('development-locked'));
});
