/* Bean-two first stop: ordinary editing, using the exact video renderer. */
window.ComicStory=(()=>{
  const ui=document.getElementById('story');
  const q=id=>document.getElementById(id);
  let current,selected=0,step=1,images={},generation=0,ready=false;
  let ms=0,playing=false,raf=0,editId=null,linePending=false,rolesPending=false,narrationPending=false;
  ui.innerHTML=`<div class="story-layout"><div class="story-controls">
    <label>選擇畫格<select id="storyPanel"></select></label>
    <details id="roleDetails" class="story-option"><summary>人物名稱</summary><fieldset><legend>人物名稱（最多四字）</legend><div class="role-grid">
    <label>人物 A<input id="roleA"></label><label>人物 B<input id="roleB"></label><label>人物 C<input id="roleC"></label></div>
    <button id="applyRoles">套用人物名稱</button><p id="roleError" class="form-error" role="alert"></p></fieldset></details>
    <div id="lineList"></div><fieldset id="lineEditor"><legend id="lineLegend">新增一句台詞</legend>
    <div class="field-grid"><label>這句放在哪格<select id="linePanel"></select></label><label>人物<select id="lineRole"><option value="A">人物 A</option><option value="B">人物 B</option><option value="C">人物 C</option></select></label>
    <label>固定位置<select id="linePosition"><option value="left">左直式</option><option value="right">右直式</option><option value="bottom">底部橫式</option></select></label></div>
    <label>台詞<textarea id="lineText" rows="3" placeholder="在這裡寫一句台詞"></textarea></label>
    <div class="field-grid"><label>格內開始（秒）<input id="lineStart" type="number" min="0" step="0.1" value="0"></label><label>格內結束（秒）<input id="lineEnd" type="number" min="0.1" step="0.1" value="4"></label></div>
    <div class="actions"><button id="applyLine" class="primary">加入並看這句</button><button id="cancelLine">取消這次編輯</button></div><p id="lineError" class="form-error" role="alert"></p>
    </fieldset><details id="narrationDetails" class="story-option"><summary>這格的敘事</summary><fieldset><legend>這格的敘事</legend><label class="check"><input id="narrationOn" type="checkbox">顯示敘事</label>
    <label>情境標籤<input id="narrationTag" maxlength="18" placeholder="例如：片刻後"></label><label>敘事文字<textarea id="narrationText" rows="3"></textarea></label>
    <div class="field-grid"><label>敘事開始（格內秒）<input id="narrationStart" type="number" min="0" step="0.1"></label><label>敘事結束（格內秒）<input id="narrationEnd" type="number" min="0.1" step="0.1"></label></div><button id="applyNarration">套用敘事</button><p id="narrationError" class="form-error" role="alert"></p></fieldset></details>
  </div><div class="story-preview"><div class="preview-heading"><b>第 <span id="previewPanel">1</span> 格・圖文試播</b><button id="writeLine">寫台詞 ↓</button></div><div id="frameStage"><canvas id="storyCanvas" width="720" height="1280" aria-label="滿版圖文試播"></canvas><div id="frameHandles" hidden></div></div><div class="actions"><button id="adjustFrames">調整文字框</button><button id="finishFrames" hidden>完成調整</button><button id="cancelFrames" hidden>取消調整</button></div><p id="frameMessage" role="status"></p>
    <div class="actions"><button id="storyPlay" class="primary" disabled>▶ 試播本格</button><button id="storyPause">暫停</button><button id="storyHead">從頭看本格</button><button id="backToLines">回到台詞 ↓</button></div>
    <label>格內時間軸<input id="storySeek" type="range" min="0" max="4" step="0.01" value="0"></label><p id="storyTime">0.00 / 4.00 秒</p>
    <p id="previewError" class="form-error" role="alert"></p><p class="muted">圖文試播使用最新內容；豆三選的配樂會一起播放。調整右下角可改框寬與框高，直式由右至左換欄，字體不縮小。</p>
  </div></div>`;
  const panel=()=>current.project.panels[selected];
  const offset=()=> (current.project.intro.enabled?current.project.intro.durationMs:0)+current.project.panels.slice(0,selected).reduce((n,p)=>n+p.durationMs,0);
  function stop(){playing=false;cancelAnimationFrame(raf);if(window.ComicAudio)ComicAudio.stop();}
  function paint(at){
    if(!ready)return false;
    ms=Math.max(0,Math.min(at,panel().durationMs-1));
    try{ComicRender.draw(q('storyCanvas'),current.project,offset()+ms,images);q('previewError').textContent='';}
    catch(error){stop();q('previewError').textContent=error.message;return false;}
    ui.querySelectorAll('[data-line-id]').forEach(row=>row.classList.toggle('is-current',panel().dialogue.some(line=>line.lineId===row.dataset.lineId&&ms>=line.startMs&&ms<line.endMs)));q('storySeek').value=ms/1000;q('storyTime').textContent=`${(ms/1000).toFixed(2)} / ${(panel().durationMs/1000).toFixed(2)} 秒`;return true;
  }
  function resetLine(){editId=null;linePending=false;q('lineLegend').textContent='新增一句台詞';q('applyLine').textContent='加入並看這句';q('lineText').value='';q('linePanel').value=selected;q('lineStart').value=0;q('lineEnd').value=panel().durationMs/1000;q('lineError').textContent='';}
  function lines(){
    q('lineList').innerHTML=panel().dialogue.length?panel().dialogue.map(line=>`<div class="line-row" data-line-id="${line.lineId}"><p><b>${escapeHTML(current.project.roles[line.role]||line.role)}</b>　${(line.startMs/1000).toFixed(2)}–${(line.endMs/1000).toFixed(2)} 秒<br>${escapeHTML(line.text)}</p><div class="actions"><button data-edit-line="${line.lineId}">編輯</button><button data-preview-line="${line.lineId}">看這句</button><button data-remove-line="${line.lineId}">刪除此句</button></div></div>`).join(''):'<p class="muted">還沒有台詞，手打一句後按「加入並看這句」。</p>';
    ui.querySelectorAll('[data-edit-line]').forEach(button=>button.onclick=()=>{
      if(!prepareSave())return;
      const line=panel().dialogue.find(x=>x.lineId===button.dataset.editLine);editId=line.lineId;
      q('lineRole').value=line.role;q('linePosition').value=line.position;q('lineText').value=line.text;q('lineStart').value=line.startMs/1000;q('lineEnd').value=line.endMs/1000;
      q('lineLegend').textContent='編輯這句台詞';q('applyLine').textContent='套用並看這句';q('lineEditor').scrollIntoView({behavior:'smooth',block:'start'});q('lineText').focus({preventScroll:true});
    });
    ui.querySelectorAll('[data-preview-line]').forEach(button=>button.onclick=()=>{if(!prepareSave())return;stop();const line=panel().dialogue.find(x=>x.lineId===button.dataset.previewLine);paint(line.startMs);playPanel();q('frameStage').scrollIntoView({behavior:'smooth',block:'start'});});
    ui.querySelectorAll('[data-remove-line]').forEach(button=>button.onclick=()=>{if(!prepareSave())return;stop();panel().dialogue=panel().dialogue.filter(x=>x.lineId!==button.dataset.removeLine);resetLine();lines();changed();paint(ms);});
  }
  function fields(){
    stop();resetLine();q('storyPanel').value=selected;q('previewPanel').textContent=selected+1;
    q('storySeek').max=panel().durationMs/1000;
    const n=panel().narration;q('narrationStart').value=(n.startMs??0)/1000;q('narrationEnd').value=(n.endMs??panel().durationMs)/1000;q('narrationOn').checked=n.enabled;q('narrationTag').value=n.tag||'';q('narrationText').value=n.text||'';narrationPending=false;q('narrationError').textContent='';lines();paint(0);
  }
  function applyRoles(){
    const value=Object.fromEntries(['A','B','C'].map(role=>[role,q('role'+role).value.trim()]));
    if(Object.values(value).some(name=>Array.from(name).length>4)){q('roleError').textContent='人物名最多四字，請縮短後再套用。字體不會自動縮小。';return false;}
    current.project.roles=value;rolesPending=false;q('roleError').textContent='';changed();lines();paint(ms);return true;
  }
  function applyLine({keep=false}={}){
    if(rolesPending&&!applyRoles())return false;
    const text=q('lineText').value.trim(),startMs=Math.round(Number(q('lineStart').value)*1000),endMs=Math.round(Number(q('lineEnd').value)*1000),role=q('lineRole').value,position=q('linePosition').value;
    const fail=message=>{q('lineError').textContent=message;return false;};
    if(!text)return fail('請先寫一句台詞。');
    if(!current.project.roles[role])return fail('請先填寫並套用這個人物的名稱。');
    const destination=Number(q('linePanel').value),target=current.project.panels[destination];
    if(!q('lineStart').value||!q('lineEnd').value||!Number.isFinite(startMs)||!Number.isFinite(endMs)||startMs<0||endMs<=startMs||endMs>target.durationMs)return fail('請使用格內時間：0 ≤ 開始 < 結束 ≤ 目的格時長。');
    if(target.dialogue.some(x=>x.lineId!==editId&&x.position===position&&startMs<x.endMs&&endMs>x.startMs))return fail('目的格的同一位置已有重疊台詞，請調整時間或位置。');
    const oldLine=panel().dialogue.find(x=>x.lineId===editId);
    const line={...oldLine,lineId:editId||crypto.randomUUID(),role,text,startMs,endMs,position};
    if(oldLine&&oldLine.position!==position)delete line.frame;
    try{ComicRender.frame(q('storyCanvas').getContext('2d'),line);}catch(error){return fail(error.message);}
    const previous=current.project.panels.map(p=>p.dialogue),before=selected;
    current.project.panels.forEach(p=>p.dialogue=p.dialogue.filter(x=>x.lineId!==line.lineId));target.dialogue=[...target.dialogue,line];selected=destination;
    stop();if(ready&&!paint(startMs)){current.project.panels.forEach((p,i)=>p.dialogue=previous[i]);selected=before;return fail('文字框放不下，請調整框或分句。');}
    q('storyPanel').value=selected;current.project.editorUI={step:2,panelId:panel().panelId};q('storySeek').max=panel().durationMs/1000;
    if(!keep)resetLine();else{editId=line.lineId;linePending=false;}lines();changed();return true;
  }
  function applyNarration(){
    const previous=panel().narration;
    const startMs=Math.round(Number(q('narrationStart').value)*1000),endMs=Math.round(Number(q('narrationEnd').value)*1000);
    if(!q('narrationStart').value||!q('narrationEnd').value||!Number.isFinite(startMs)||!Number.isFinite(endMs)||startMs<0||startMs>=endMs||endMs>panel().durationMs){q('narrationError').textContent='敘事時間須在這格內，結束大於開始。';return false;}
    panel().narration={...previous,startMs,endMs,enabled:q('narrationOn').checked,tag:q('narrationTag').value.trim(),text:q('narrationText').value.trim()};
    try{if(panel().narration.enabled)ComicRender.frame(q('storyCanvas').getContext('2d'),panel().narration);}catch(error){panel().narration=previous;q('narrationError').textContent=error.message;return false;}
    stop();if(ready&&!paint(ms)){panel().narration=previous;q('narrationError').textContent='敘事放不下，請縮短後重新套用；原內容保留。';return false;}
    narrationPending=false;q('narrationError').textContent='';changed();return true;
  }
  function prepareSave(){
    if(window.ComicFrames)ComicFrames.finish();
    if(!current||!current.project)return true;
    if(rolesPending&&!applyRoles())return false;
    if(linePending&&!applyLine())return false;
    if(narrationPending&&!applyNarration())return false;
    return true;
  }
  function go(next){
    if(!current)return;
    if(!prepareSave())return;
    if(next===2&&current.project.panels.some(p=>!p.asset)){note('請先在豆一上傳完整四張圖。',true);return;}
    refreshDurations();stop();step=next;current.project.editorUI={step,panelId:panel().panelId};
    q('materials').hidden=step!==1;ui.hidden=step!==2;
    q('stepTitle').textContent=['','豆一・漫畫素材','豆二・故事腳本','豆三・背景配樂','豆四・影片'][step];
    if(window.ComicFinish)ComicFinish.show(step);
    for(const i of [1,2,3,4]){if(i===step)q('bean'+i).setAttribute('aria-current','step');else q('bean'+i).removeAttribute('aria-current');}
    if(step===2){paint(ms);ui.scrollIntoView({behavior:'smooth',block:'start'});}
  }
  function attach(value){
    stop();current=value;ready=false;images={};linePending=rolesPending=narrationPending=false;
    const id=value.project.editorUI?.panelId;
    selected=Math.max(0,value.project.panels.findIndex(p=>p.panelId===id));
    q('storyPanel').innerHTML=value.project.panels.map((p,i)=>`<option value="${i}">第 ${i+1} 格（${p.durationMs/1000} 秒）</option>`).join('');
    refreshDurations();
    for(const role of ['A','B','C'])q('role'+role).value=value.project.roles[role]||'';
    q('roleError').textContent='';q('previewError').textContent='';fields();if(typeof textImporter!=='undefined')textImporter.refresh();go(value.project.editorUI?.step||1);
    restoreEdit(value.pendingEdit);
    q('storyPlay').disabled=true;
    const token=++generation;
    if(value.project.panels.every(p=>p.asset))ComicRender.load(value.project).then(loaded=>{if(token!==generation)return;images=loaded;ready=true;q('storyPlay').disabled=false;paint(0);}).catch(error=>{if(token===generation)q('previewError').textContent='圖片載入失敗，請回豆一重新選圖。'+error.message;});
  }
  q('storyPanel').onchange=()=>{const next=+q('storyPanel').value;if(!prepareSave()){q('storyPanel').value=selected;return;}selected=next;current.project.editorUI={step:2,panelId:panel().panelId};fields();changed();};
  for(const role of ['A','B','C'])q('role'+role).oninput=()=>{stop();rolesPending=true;changed();};
  let liveTimer=0;
  for(const id of ['lineText','linePanel','lineRole','linePosition','lineStart','lineEnd'])q(id).oninput=()=>{stop();linePending=true;changed();clearTimeout(liveTimer);if(editId)liveTimer=setTimeout(()=>{if(linePending)applyLine({keep:true});},350);};
  for(const id of ['narrationOn','narrationTag','narrationText','narrationStart','narrationEnd'])q(id).oninput=()=>{stop();narrationPending=true;changed();};
  q('applyRoles').onclick=applyRoles;q('applyLine').onclick=()=>{if(applyLine())q('frameStage').scrollIntoView({behavior:'smooth',block:'start'});};q('applyNarration').onclick=applyNarration;q('cancelLine').onclick=()=>{resetLine();changed();paint(ms);};
  function playPanel(){
    if(!prepareSave()||!ready||playing)return;
    if(ms>=panel().durationMs-1)ms=0;
    playing=true;
    ComicAudio.play(current.project,offset()+ms,t=>{if(!playing)return;const at=t-offset();if(at>=panel().durationMs){stop();paint(panel().durationMs-1);}else if(!paint(at))stop();},()=>{playing=false;}).catch(error=>{playing=false;note(error.message,true);});
  };
  q('storyPlay').onclick=playPanel;
  q('storyPause').onclick=stop;q('storyHead').onclick=()=>{if(prepareSave()){stop();paint(0);}};
  q('storySeek').oninput=()=>{const at=Number(q('storySeek').value)*1000;if(prepareSave()){stop();paint(at);}};
  q('bean3').onclick=()=>go(3);q('bean4').onclick=()=>go(4);
  q('bean1').onclick=()=>go(1);q('bean2').onclick=()=>go(2);q('toStory').onclick=()=>go(2);
  q('adjustFrames').onclick=()=>{if(!prepareSave()||!ready)return;stop();ComicFrames.begin([...panel().dialogue.filter(x=>ms>=x.startMs&&ms<x.endMs),...(ComicRender.narrationActive(panel(),ms)?[panel().narration]:[])],()=>paint(ms));};
  q('finishFrames').onclick=()=>ComicFrames.finish();q('cancelFrames').onclick=()=>ComicFrames.finish(true);
  function refreshDurations(){
    textImporter.syncPanels();
    const options=current.project.panels.map((p,i)=>`<option value="${i}">第 ${i+1} 格（${p.durationMs/1000} 秒）</option>`).join('');
    q('storyPanel').innerHTML=options;q('linePanel').innerHTML=options;q('storyPanel').value=selected;q('linePanel').value=selected;q('storySeek').max=panel().durationMs/1000;
    if(!linePending&&!editId)q('lineEnd').value=panel().durationMs/1000;
    if(!narrationPending){q('narrationStart').value=(panel().narration.startMs??0)/1000;q('narrationEnd').value=(panel().narration.endMs??panel().durationMs)/1000;}
    const invalid=panel().dialogue.some(x=>x.endMs>panel().durationMs)||(panel().narration.enabled&&(panel().narration.endMs??0)>panel().durationMs);
    q('lineError').textContent=invalid?'已有台詞或敘事超出新格長，請延長格長或修改時間；內容沒有截斷。':'';
  }
  const textImporter=ComicText.install(()=>current.project,()=>selected,project=>{current.project=project;dirty=true;render();changed();});
  const editFields=['linePanel','lineRole','linePosition','lineText','lineStart','lineEnd','roleA','roleB','roleC','narrationOn','narrationTag','narrationText','narrationStart','narrationEnd'];
  function hasPending(){return linePending||rolesPending||narrationPending;}
  function captureEdit(){return hasPending()?{panelId:panel().panelId,editId,linePending,rolesPending,narrationPending,values:Object.fromEntries(editFields.map(id=>[id,q(id).type==='checkbox'?q(id).checked:q(id).value]))}:null;}
  function restoreEdit(buffer){if(!buffer||buffer.panelId!==panel().panelId)return;for(const [id,value] of Object.entries(buffer.values||{})){if(!editFields.includes(id))continue;if(q(id).type==='checkbox')q(id).checked=!!value;else q(id).value=value;}editId=buffer.editId;linePending=!!buffer.linePending;rolesPending=!!buffer.rolesPending;narrationPending=!!buffer.narrationPending;if(rolesPending)q('roleDetails').open=true;if(narrationPending)q('narrationDetails').open=true;}
  q('writeLine').onclick=q('backToLines').onclick=()=>{q('lineEditor').scrollIntoView({behavior:'smooth',block:'start'});};
  return {attach,stop,prepareSave,go,refreshDurations,hasPending,captureEdit,previewText:value=>textImporter.previewText(value)};
})();
