/* Offline PCM: same oscillator, loop, volume and envelope as video.py. */
window.ComicAudio=(()=>{
  let element=null,raf=0,cachedKey='',url='';
  function stop(){cancelAnimationFrame(raf);if(element){element.pause();element=null;}}
  function make(project){
    const settings=project.bgm,total=ComicRender.total(project)/1000,key=JSON.stringify([total,settings]);
    if(key===cachedKey)return url;
    stop();if(url)URL.revokeObjectURL(url);
    const rate=44100,count=Math.round(total*rate),data=new ArrayBuffer(44+count*2),v=new DataView(data);
    const ascii=(at,s)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i));};
    ascii(0,'RIFF');v.setUint32(4,36+count*2,true);ascii(8,'WAVE');ascii(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);ascii(36,'data');v.setUint32(40,count*2,true);
    const notes=settings.kind==='gentle'?[261.63,329.63,392,329.63,293.66,349.23,440,349.23]:[392,493.88,587.33,493.88,440,523.25,659.25,523.25];
    const fadein=settings.fadeInMs/1000,fadeout=settings.fadeOutMs/1000,volume=settings.volume/100*.65;
    if(settings.kind!=='none')for(let i=0;i<count;i++){
      const t=i/rate,part=t%1.25;
      let envelope=Math.min(1,part/.06)*Math.exp(-5*Math.max(0,part-.06))*Math.min(1,Math.max(0,(1.23-part)/.08));
      envelope*=fadein?Math.min(1,t/fadein):1;envelope*=fadeout?Math.min(1,Math.max(0,(total-t)/fadeout)):1;
      const phase=Math.sin(2*Math.PI*notes[Math.floor(t/1.25)%8]*part),osc=settings.kind==='gentle'?phase:2/Math.PI*Math.asin(phase);
      v.setInt16(44+i*2,Math.trunc(osc*.085*volume*envelope*32767),true);
    }
    url=URL.createObjectURL(new Blob([data],{type:'audio/wav'}));cachedKey=key;return url;
  }
  async function play(project,from,onTime,onEnd=()=>{}){
    stop();const sound=new Audio(make(project));element=sound;
    try{await sound.play();if(element!==sound){sound.pause();return;}sound.currentTime=from/1000;
      const tick=()=>{if(element!==sound)return;if(sound.ended){stop();onEnd();return;}onTime(sound.currentTime*1000);raf=requestAnimationFrame(tick);};tick();
    }catch(error){if(element!==sound)return;stop();throw Error('聲音未能播放，請再按試聽。'+error.message);}
  }
  window.addEventListener('beforeunload',stop);
  return {make,play,stop};
})();
