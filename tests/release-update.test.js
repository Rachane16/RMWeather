const {test}=require('node:test'),assert=require('node:assert/strict');
const {androidVersion,newerVersion}=require('../assets/app-update.js');
test('Android release checks distinguish installed versions and do not downgrade',()=>{
 assert.equal(androidVersion('Mozilla/5 RMWeatherAndroid/1.0'),'1.0');
 assert.equal(androidVersion('Mozilla/5 RMWeatherAndroid/1.1.12'),'1.1.12');
 assert.equal(androidVersion('Mozilla desktop'),null);
 assert.equal(newerVersion('1.1.12','1.0.6'),true);
 assert.equal(newerVersion('1.1.12','1.1.12'),false);
 assert.equal(newerVersion('1.1.9','1.1.12'),false);
});
