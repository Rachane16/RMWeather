const {test}=require('node:test'),assert=require('node:assert/strict');
const {androidVersion,newerVersion,androidReleaseInfo,createAndroidReleaseReader}=require('../assets/app-update.js');
test('Android release checks distinguish installed versions and do not downgrade',()=>{
 assert.equal(androidVersion('Mozilla/5 RMWeatherAndroid/1.0'),'1.0');
 assert.equal(androidVersion('Mozilla/5 RMWeatherAndroid/1.1.12'),'1.1.12');
 assert.equal(androidVersion('Mozilla desktop'),null);
 assert.equal(newerVersion('1.1.12','1.0.6'),true);
 assert.equal(newerVersion('1.1.12','1.1.12'),false);
 assert.equal(newerVersion('1.1.9','1.1.12'),false);
});

const release=version=>({tag_name:'android-v'+version,assets:[{name:'RMWeather.apk',browser_download_url:`https://github.com/Rachane16/RMWeather/releases/download/android-v${version}/RMWeather.apk`}]});
test('About download metadata pairs the latest version with the exact released APK and rejects unsafe links',()=>{
 const good=release('1.4.36');assert.deepEqual(androidReleaseInfo(good),{version:'1.4.36',url:good.assets[0].browser_download_url});
 for(const bad of [{...good,draft:true},{...good,prerelease:true},{...good,assets:[]},{...good,assets:{}},{...good,tag_name:'other'},null])assert.equal(androidReleaseInfo(bad),null);
 for(const url of ['https://evil.test/RMWeather.apk',good.assets[0].browser_download_url+'.html',release('1.4.34').assets[0].browser_download_url])assert.equal(androidReleaseInfo({...good,assets:[{name:'RMWeather.apk',browser_download_url:url}]}),null);
});
test('About checks can discover a newer APK after reopening, share in-flight checks and retry failures',async()=>{
 let version='1.4.34',calls=0,ok=true;
 const read=createAndroidReleaseReader(async(url,options)=>{calls++;assert.equal(options.cache,'no-cache');return {ok,json:async()=>release(version)};});
 const [a,b]=await Promise.all([read(),read()]);assert.equal(calls,1);assert.equal(a.version,b.version);
 version='1.4.36';assert.equal((await read()).version,'1.4.36');
 ok=false;await assert.rejects(read());ok=true;assert.equal((await read()).version,'1.4.36');
});
