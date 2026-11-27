const {test}=require('node:test'),assert=require('node:assert/strict');
const {bangkokDate,bangkokTime}=require('../assets/timezone.js');
test('display times stay in Bangkok on devices in other time zones, without adding seven hours twice',()=>{
 const prior=process.env.TZ;
 try{for(const tz of ['UTC','America/Los_Angeles','Asia/Tokyo']){
  process.env.TZ=tz;
  for(const value of ['2026-11-27T00:00:00Z','2026-11-27T07:00:00+07:00','2026-11-27 07:00:00','2026-11-27T07:00']){
   assert.equal(bangkokDate(value).toISOString(),'2026-11-27T00:00:00.000Z');assert.match(bangkokTime(value),/07:00/);
  }
  assert.match(bangkokTime('2026-11-26T20:00:00Z'),/27.*03:00/);
 }}finally{if(prior===undefined)delete process.env.TZ;else process.env.TZ=prior;}
 assert.equal(bangkokTime(null),'ไม่ทราบเวลา');assert.equal(bangkokTime('invalid'),'ไม่ทราบเวลา');
});
