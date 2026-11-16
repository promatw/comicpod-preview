/* Approved ADC recordings. Decode once; render volume/loop/fades offline. */
window.ComicAudio=(()=>{
  const tracks={G01:'窗邊的午後',G02:'慢慢靠近',P01:'口袋裡的小默契',P02:'轉角遇見你'};
  const decoded=new Map();let context=null,source=null,raf=0,generation=0,cacheKey='',cached=null;
  const id=kind=>kind==='gentle'?'G01':kind==='playful'?'P01':kind;
  function stop(){generation++;cancelAnimationFrame(raf);if(source){source.onended=null;try{source.stop();}catch{}source=null;}}
  async function load(kind){
    kind=id(kind);if(!tracks[kind])throw Error('找不到這首配樂，請重新選擇。');
    if(!decoded.has(kind))decoded.set(kind,(async()=>{const r=await fetch('music/'+kind+'.mp3');if(!r.ok)throw Error('配樂載入失敗，請檢查連線後重試。');return new OfflineAudioContext(2,1,32000).decodeAudioData(await r.arrayBuffer());})().catch(error=>{decoded.delete(kind);throw error;}));
    return decoded.get(kind);
  }
  async function make(project){
    const seconds=ComicRender.total(project)/1000,settings=project.bgm,key=JSON.stringify([seconds,settings]);
    if(key===cacheKey&&cached)return cached;
    if(!Number.isFinite(seconds)||seconds<=0||seconds>150)throw Error('作品長度須在150秒內。');
    const offline=new OfflineAudioContext(2,Math.ceil(seconds*32000),32000);
    if(settings.kind!=='none'){
      const buffer=await load(settings.kind),s=offline.createBufferSource(),gain=offline.createGain();s.buffer=buffer;s.loop=true;s.connect(gain);gain.connect(offline.destination);
      const volume=Math.max(0,Math.min(100,settings.volume))/100,fi=Math.min(seconds,settings.fadeInMs/1000),fo=Math.min(seconds,settings.fadeOutMs/1000);
      const count=Math.max(2,Math.ceil(seconds*100)+1),curve=new Float32Array(count);
      for(let i=0;i<count;i++){const t=i/(count-1)*seconds;curve[i]=volume*(fi?Math.min(1,t/fi):1)*(fo?Math.min(1,(seconds-t)/fo):1);}
      gain.gain.setValueCurveAtTime(curve,0,seconds);s.start(0);s.stop(seconds);
    }
    const buffer=await offline.startRendering();cacheKey=key;cached=buffer;return buffer;
  }
  async function play(project,from,onTime,onEnd=()=>{}){
    stop();const token=generation;
    try{
      context=context||new (window.AudioContext||window.webkitAudioContext)();await context.resume();
      const buffer=await make(project);if(token!==generation)return;
      const node=context.createBufferSource();node.buffer=buffer;node.connect(context.destination);source=node;
      const offset=Math.max(0,Math.min(from/1000,buffer.duration-.001)),began=context.currentTime;
      node.onended=()=>{if(token!==generation)return;source=null;cancelAnimationFrame(raf);onEnd();};node.start(0,offset);
      const tick=()=>{if(token!==generation||source!==node)return;onTime(Math.min(buffer.duration,offset+context.currentTime-began)*1000);raf=requestAnimationFrame(tick);};tick();
    }catch(error){if(token!==generation)return;stop();throw Error('配樂未能播放：'+error.message);}
  }
  window.addEventListener('beforeunload',stop);
  return {make,play,stop,tracks,normalize:id};
})();
