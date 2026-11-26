const {test}=require('node:test'),assert=require('node:assert/strict');
const {radarGISTimeline,radarGISDefaultIndex}=require('../assets/radargis.js');
const stamp='2026-11-26T07:45:00Z';
const observation={id:'dbz',frames:[{frame_time:'2026-11-26T07:30:00Z'},{frame_time:stamp}]};
const forecast={id:'dbz-nowcast',forecast:true,frames:[{frame_time:'2026-11-26T08:00:00Z',base_time:stamp,lead_minutes:15},{frame_time:'2026-11-26T10:45:00Z',base_time:stamp,lead_minutes:180}]};
test('one timeline covers past observations and three-hour nowcast but defaults to the last observation',()=>{
 const frames=radarGISTimeline(observation,[observation,forecast]);assert.equal(frames.length,4);assert.equal(radarGISDefaultIndex(frames),1);assert.equal(frames[3].forecast,true);assert.equal(frames[3].lead_minutes,180);
 assert.equal(radarGISDefaultIndex(radarGISTimeline(forecast,[forecast])),0);
});
test('forecasts from a different issue or beyond three hours cannot join observed frames',()=>{
 const other={...forecast,frames:[{...forecast.frames[0],base_time:'2026-11-26T06:45:00Z'},{...forecast.frames[1],lead_minutes:195}]};
 assert.equal(radarGISTimeline(observation,[other]).length,2);
});
