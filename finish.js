/* Ordinary bean-three/four workflow; the encoder uses a saved immutable revision. */
window.ComicFinish=(()=>{
  const ui=document.createElement('section');ui.id='finish';ui.hidden=true;document.querySelector('#draftMeta').before(ui);
  ui.innerHTML=`<section id="musicStep"><h3>選背景配樂</h3><label>配樂<select id="musicKind"><option value="none">none｜無配樂</option><option value="gentle">gentle｜溫柔</option><option value="playful">playful｜俏皮</option></select></label><label>音量 %<input id="musicVolume" type="number" min="0" max="100"></label><div class="field-grid"><label>淡入秒數<input id="musicFadeIn" type="number" min="0" max="10" step="0.1"></label><label>淡出秒數<input id="musicFadeOut" type="number" min="0" max="10" step="0.1"></label></div><div class="actions"><button id="musicPlay">▶ 試聽整首配樂</button><button id="musicStop">停止</button><button id="toFilm" class="primary">去豆四預覽 →</button></div><p id="musicStatus" role="status"></p><p>內建循環配樂覆蓋完整片長；切回 none 立即停止舊聲音。沒有角色配音。</p></section>
  <section id="filmStep"><fieldset><legend>片頭與片尾</legend><label class="check"><input id="introOn" type="checkbox">加片頭</label><label>片頭文字<input id="introText"></label><label>片頭秒數<input id="introSeconds" type="number" min="1" max="15" step="0.1"></label><label class="check"><input id="outroOn" type="checkbox">加片尾</label><label>片尾文字<input id="outroText"></label><label>片尾秒數<input id="outroSeconds" type="number" min="1" max="15" step="0.1"></label></fieldset><canvas id="filmCanvas" width="720" height="1280"></canvas><div class="actions"><button id="filmPlay" class="primary">▶ 播放最新內容</button><button id="filmPause">暫停</button><button id="filmHead">從頭</button></div><label>全片時間<input id="filmSeek" type="range" min="0" step="0.01" value="0"></label><p id="filmTime"></p><div id="encodeControls"><button id="filmExport" class="primary">輸出並下載 MP4</button><button id="filmCancel" disabled>取消輸出</button><a id="filmDownload" class="button" hidden>下載 MP4</a></div><p id="phoneFilmNote" hidden>手機 Pages 可預覽圖文與配樂，不提供 MP4 編碼。請在本機版開啟並輸出。</p><p id="filmStatus" role="status"></p></section>`;
  const q=id=>document.getElementById(id);let current,images=null,generation=0,at=0,job=null,poll=0,jobRevision=null;
  const phone=()=>!!window.ComicAssets;
  function stop(){ComicAudio.stop();}
  function paint(ms){
    if(!images||!current)return false;
    at=Math.max(0,Math.min(ms,ComicRender.total(current.project)-1));
    try{ComicRender.draw(q('filmCanvas'),current.project,at,images);}catch(error){stop();q('filmStatus').textContent=error.message;return false;}
    q('filmSeek').max=ComicRender.total(current.project)/1000;q('filmSeek').value=at/1000;q('filmTime').textContent=`${(at/1000).toFixed(2)} / ${(ComicRender.total(current.project)/1000).toFixed(2)} 秒`;return true;
  }
  function apply(){
    stop();const volume=Number(q('musicVolume').value),fi=Number(q('musicFadeIn').value),fo=Number(q('musicFadeOut').value);
    if(![volume,fi,fo].every(Number.isFinite)||volume<0||volume>100||fi<0||fi>10||fo<0||fo>10){q('musicStatus').textContent='音量0～100，淡入淡出0～10秒。';return false;}
    current.project.bgm={kind:q('musicKind').value,volume,fadeInMs:Math.round(fi*1000),fadeOutMs:Math.round(fo*1000)};
    for(const name of ['intro','outro']){const seconds=Number(q(name+'Seconds').value);if(!Number.isFinite(seconds)||seconds<1||seconds>15){q('filmStatus').textContent='片頭／片尾須1～15秒。';return false;}current.project[name]={enabled:q(name+'On').checked,text:q(name+'Text').value,durationMs:Math.round(seconds*1000)};}
    if(ComicRender.total(current.project)>150000){q('filmStatus').textContent='本機影片目前上限150秒，請縮短。';return false;}
    q('musicStatus').textContent=current.project.bgm.kind==='none'?'無配樂，舊聲音已停止。':'已套用配樂設定，按試聽確認。';changed();paint(at);stale();return true;
  }
  function stale(){if(jobRevision!=null&&(dirty||current.revision!==jobRevision)){q('filmDownload').hidden=true;q('filmStatus').textContent='草稿已更新，請重新輸出；舊影片不會冒充最新版。';}}
  function attach(value){
    stop();current=value;images=null;at=0;const token=++generation;
    const b=value.project.bgm;q('musicKind').value=b.kind;q('musicVolume').value=b.volume;q('musicFadeIn').value=b.fadeInMs/1000;q('musicFadeOut').value=b.fadeOutMs/1000;
    for(const name of ['intro','outro']){const part=value.project[name];q(name+'On').checked=part.enabled;q(name+'Text').value=part.text;q(name+'Seconds').value=part.durationMs/1000;}
    q('encodeControls').hidden=phone();q('phoneFilmNote').hidden=!phone();stale();
    if(value.project.panels.every(p=>p.asset))ComicRender.load(value.project).then(loaded=>{if(token!==generation)return;images=loaded;paint(0);}).catch(error=>{q('filmStatus').textContent=error.message;});
  }
  function show(step){ui.hidden=step<3;q('musicStep').hidden=step!==3;q('filmStep').hidden=step!==4;if(step>=3)stop();if(step===4)paint(at);}
  async function play(){if(!ComicStory.prepareSave()||!images)return;stop();if(at>=ComicRender.total(current.project)-1)at=0;try{await ComicAudio.play(current.project,at,t=>{if(!paint(t))stop();});}catch(error){q('filmStatus').textContent=error.message;}}
  for(const id of ['musicKind','musicVolume','musicFadeIn','musicFadeOut','introOn','introText','introSeconds','outroOn','outroText','outroSeconds'])q(id).onchange=()=>{if(id==='musicKind'&&current.project.bgm.kind==='none'&&q('musicKind').value!=='none'&&Number(q('musicVolume').value)===0)q('musicVolume').value=35;apply();};
  q('musicPlay').onclick=async()=>{if(!apply())return;try{await ComicAudio.play(current.project,0,t=>q('musicStatus').textContent='試聽 '+(t/1000).toFixed(1)+' 秒',()=>q('musicStatus').textContent='試聽結束。');}catch(error){q('musicStatus').textContent=error.message;}};
  q('musicStop').onclick=stop;q('toFilm').onclick=()=>ComicStory.go(4);q('filmPlay').onclick=play;q('filmPause').onclick=stop;q('filmHead').onclick=()=>{stop();paint(0);};q('filmSeek').oninput=()=>{stop();paint(Number(q('filmSeek').value)*1000);};
  window.addEventListener('beforeunload',stop);
  return {attach,show,stop,apply,stale};
})();
