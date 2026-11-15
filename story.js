/* Bean-two first stop: ordinary editing, using the exact video renderer. */
window.ComicStory=(()=>{
  const ui=document.getElementById('story');
  const q=id=>document.getElementById(id);
  let current,selected=0,step=1,images={},generation=0,ready=false;
  let ms=0,playing=false,raf=0,editId=null,linePending=false,rolesPending=false,narrationPending=false;
  ui.innerHTML=`<div class="story-layout"><div class="story-controls">
    <label>選擇畫格<select id="storyPanel"></select></label>
    <fieldset><legend>人物名稱（最多四字）</legend><div class="role-grid">
    <label>人物 A<input id="roleA"></label><label>人物 B<input id="roleB"></label><label>人物 C<input id="roleC"></label></div>
    <button id="applyRoles">套用人物名稱</button><p id="roleError" class="form-error" role="alert"></p></fieldset>
    <fieldset><legend id="lineLegend">新增一句台詞</legend>
    <div class="field-grid"><label>人物<select id="lineRole"><option value="A">人物 A</option><option value="B">人物 B</option><option value="C">人物 C</option></select></label>
    <label>固定位置<select id="linePosition"><option value="left">左直式</option><option value="right">右直式</option><option value="bottom">底部橫式</option></select></label></div>
    <label>台詞<textarea id="lineText" rows="3" placeholder="在這裡寫一句台詞"></textarea></label>
    <div class="field-grid"><label>格內開始（秒）<input id="lineStart" type="number" min="0" step="0.1" value="0"></label><label>格內結束（秒）<input id="lineEnd" type="number" min="0.1" step="0.1" value="4"></label></div>
    <div class="actions"><button id="applyLine" class="primary">加入並看這句</button><button id="cancelLine">取消這次編輯</button></div><p id="lineError" class="form-error" role="alert"></p>
    </fieldset><div id="lineList"></div>
    <fieldset><legend>這格的敘事</legend><label class="check"><input id="narrationOn" type="checkbox">整格顯示敘事</label>
    <label>情境標籤<input id="narrationTag" maxlength="18" placeholder="例如：片刻後"></label><label>敘事文字<textarea id="narrationText" rows="3"></textarea></label>
    <button id="applyNarration">套用敘事</button><p id="narrationError" class="form-error" role="alert"></p></fieldset>
  </div><div class="story-preview"><div id="frameStage"><canvas id="storyCanvas" width="720" height="1280" aria-label="滿版圖文試播"></canvas><div id="frameHandles" hidden></div></div><div class="actions"><button id="adjustFrames">調整文字框</button><button id="finishFrames" hidden>完成調整</button><button id="cancelFrames" hidden>取消調整</button></div><p id="frameMessage" role="status"></p>
    <div class="actions"><button id="storyPlay" class="primary" disabled>▶ 試播本格</button><button id="storyPause">暫停</button><button id="storyHead">從頭看本格</button></div>
    <label>格內時間軸<input id="storySeek" type="range" min="0" max="4" step="0.01" value="0"></label><p id="storyTime">0.00 / 4.00 秒</p>
    <p id="previewError" class="form-error" role="alert"></p><p class="muted">本停點只試播圖文，不含角色配音或 BGM。圖片填滿，可由調框模式的把手調整；直式固定兩欄、字體不縮小。20／30字搭配敘事的閱讀效果待 UXC2／HM 確認。</p>
  </div></div>`;
  const panel=()=>current.project.panels[selected];
  const offset=()=> (current.project.intro.enabled?current.project.intro.durationMs:0)+current.project.panels.slice(0,selected).reduce((n,p)=>n+p.durationMs,0);
  function stop(){playing=false;cancelAnimationFrame(raf);}
  function paint(at){
    if(!ready)return false;
    ms=Math.max(0,Math.min(at,panel().durationMs-1));
    try{ComicRender.draw(q('storyCanvas'),current.project,offset()+ms,images);q('previewError').textContent='';}
    catch(error){stop();q('previewError').textContent=error.message;return false;}
    q('storySeek').value=ms/1000;q('storyTime').textContent=`${(ms/1000).toFixed(2)} / ${(panel().durationMs/1000).toFixed(2)} 秒`;return true;
  }
  function resetLine(){editId=null;linePending=false;q('lineLegend').textContent='新增一句台詞';q('applyLine').textContent='加入並看這句';q('lineText').value='';q('lineStart').value=0;q('lineEnd').value=panel().durationMs/1000;q('lineError').textContent='';}
  function lines(){
    q('lineList').innerHTML=panel().dialogue.length?panel().dialogue.map(line=>`<div class="line-row"><p><b>${escapeHTML(current.project.roles[line.role]||line.role)}</b>　${(line.startMs/1000).toFixed(2)}–${(line.endMs/1000).toFixed(2)} 秒<br>${escapeHTML(line.text)}</p><div class="actions"><button data-edit-line="${line.lineId}">編輯</button><button data-preview-line="${line.lineId}">看這句</button><button data-remove-line="${line.lineId}">刪除此句</button></div></div>`).join(''):'<p class="muted">還沒有台詞，手打一句後按「加入並看這句」。</p>';
    ui.querySelectorAll('[data-edit-line]').forEach(button=>button.onclick=()=>{
      if(!prepareSave())return;
      const line=panel().dialogue.find(x=>x.lineId===button.dataset.editLine);editId=line.lineId;
      q('lineRole').value=line.role;q('linePosition').value=line.position;q('lineText').value=line.text;q('lineStart').value=line.startMs/1000;q('lineEnd').value=line.endMs/1000;
      q('lineLegend').textContent='編輯這句台詞';q('applyLine').textContent='套用並看這句';q('lineText').focus();
    });
    ui.querySelectorAll('[data-preview-line]').forEach(button=>button.onclick=()=>{if(!prepareSave())return;stop();paint(panel().dialogue.find(x=>x.lineId===button.dataset.previewLine).startMs);});
    ui.querySelectorAll('[data-remove-line]').forEach(button=>button.onclick=()=>{if(!prepareSave())return;stop();panel().dialogue=panel().dialogue.filter(x=>x.lineId!==button.dataset.removeLine);resetLine();lines();changed();paint(ms);});
  }
  function fields(){
    stop();resetLine();q('storyPanel').value=selected;
    q('storySeek').max=panel().durationMs/1000;
    const n=panel().narration;q('narrationOn').checked=n.enabled;q('narrationTag').value=n.tag||'';q('narrationText').value=n.text||'';narrationPending=false;q('narrationError').textContent='';lines();paint(0);
  }
  function applyRoles(){
    const value=Object.fromEntries(['A','B','C'].map(role=>[role,q('role'+role).value.trim()]));
    if(Object.values(value).some(name=>Array.from(name).length>4)){q('roleError').textContent='人物名最多四字，請縮短後再套用。字體不會自動縮小。';return false;}
    current.project.roles=value;rolesPending=false;q('roleError').textContent='';changed();lines();paint(ms);return true;
  }
  function applyLine(){
    if(rolesPending&&!applyRoles())return false;
    const text=q('lineText').value.trim(),startMs=Math.round(Number(q('lineStart').value)*1000),endMs=Math.round(Number(q('lineEnd').value)*1000),role=q('lineRole').value,position=q('linePosition').value;
    const fail=message=>{q('lineError').textContent=message;return false;};
    if(!text)return fail('請先寫一句台詞。');
    if(!current.project.roles[role])return fail('請先填寫並套用這個人物的名稱。');
    if(!q('lineStart').value||!q('lineEnd').value||!Number.isFinite(startMs)||!Number.isFinite(endMs)||startMs<0||endMs<=startMs||endMs>panel().durationMs)return fail('請使用格內時間：0 ≤ 開始 < 結束 ≤ 這格時長。');
    if(position!=='bottom'&&Array.from(text).length>30)return fail('本輪直式台詞最多30字，請分成兩句；沒有截斷你的文字。');
    if(panel().dialogue.some(x=>x.lineId!==editId&&x.position===position&&startMs<x.endMs&&endMs>x.startMs))return fail('這個位置已有同時出現的台詞，請調整起訖或換另一個固定位置。');
    const oldLine=panel().dialogue.find(x=>x.lineId===editId);
    const line={...oldLine,lineId:editId||crypto.randomUUID(),role,text,startMs,endMs,position};
    if(oldLine&&oldLine.position!==position)delete line.frame;
    const previous=panel().dialogue;
    panel().dialogue=previous.some(x=>x.lineId===line.lineId)?previous.map(x=>x.lineId===line.lineId?line:x):[...previous,line];
    stop();if(ready&&!paint(startMs)){panel().dialogue=previous;return fail('台詞無法放入固定區域，請看試播旁的提示並調整。');}
    resetLine();lines();changed();return true;
  }
  function applyNarration(){
    const previous=panel().narration;
    panel().narration={...previous,enabled:q('narrationOn').checked,tag:q('narrationTag').value.trim(),text:q('narrationText').value.trim()};
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
    stop();step=next;current.project.editorUI={step,panelId:panel().panelId};
    q('materials').hidden=step!==1;ui.hidden=step!==2;
    q('stepTitle').textContent=step===1?'豆一・漫畫素材':'豆二・故事腳本';
    for(const i of [1,2]){if(i===step)q('bean'+i).setAttribute('aria-current','step');else q('bean'+i).removeAttribute('aria-current');}
    if(step===2){paint(ms);ui.scrollIntoView({behavior:'smooth',block:'start'});}
  }
  function attach(value){
    stop();current=value;ready=false;images={};linePending=rolesPending=narrationPending=false;
    const id=value.project.editorUI?.panelId;
    selected=Math.max(0,value.project.panels.findIndex(p=>p.panelId===id));
    q('storyPanel').innerHTML=value.project.panels.map((p,i)=>`<option value="${i}">第 ${i+1} 格（${p.durationMs/1000} 秒）</option>`).join('');
    for(const role of ['A','B','C'])q('role'+role).value=value.project.roles[role]||'';
    q('roleError').textContent='';q('previewError').textContent='';fields();go(value.project.editorUI?.step===2?2:1);
    q('storyPlay').disabled=true;
    const token=++generation;
    if(value.project.panels.every(p=>p.asset))ComicRender.load(value.project).then(loaded=>{if(token!==generation)return;images=loaded;ready=true;q('storyPlay').disabled=false;paint(0);}).catch(error=>{if(token===generation)q('previewError').textContent='圖片載入失敗，請回豆一重新選圖。'+error.message;});
  }
  q('storyPanel').onchange=()=>{const next=+q('storyPanel').value;if(!prepareSave()){q('storyPanel').value=selected;return;}selected=next;current.project.editorUI={step:2,panelId:panel().panelId};fields();changed();};
  for(const role of ['A','B','C'])q('role'+role).oninput=()=>{stop();rolesPending=true;changed();};
  for(const id of ['lineText','lineRole','linePosition','lineStart','lineEnd'])q(id).oninput=()=>{stop();linePending=true;changed();};
  for(const id of ['narrationOn','narrationTag','narrationText'])q(id).oninput=()=>{stop();narrationPending=true;changed();};
  q('applyRoles').onclick=applyRoles;q('applyLine').onclick=applyLine;q('applyNarration').onclick=applyNarration;q('cancelLine').onclick=()=>{resetLine();paint(ms);};
  q('storyPlay').onclick=()=>{
    if(!prepareSave()||!ready||playing)return;
    if(ms>=panel().durationMs-1)ms=0;
    const base=performance.now()-ms;playing=true;
    const tick=now=>{if(!playing)return;const at=now-base;if(!paint(at))return;if(at>=panel().durationMs-1){stop();return;}raf=requestAnimationFrame(tick);};
    raf=requestAnimationFrame(tick);
  };
  q('storyPause').onclick=stop;q('storyHead').onclick=()=>{if(prepareSave()){stop();paint(0);}};
  q('storySeek').oninput=()=>{const at=Number(q('storySeek').value)*1000;if(prepareSave()){stop();paint(at);}};
  q('bean1').onclick=()=>go(1);q('bean2').onclick=()=>go(2);q('toStory').onclick=()=>go(2);
  q('adjustFrames').onclick=()=>{if(!prepareSave()||!ready)return;stop();ComicFrames.begin([...panel().dialogue.filter(x=>ms>=x.startMs&&ms<x.endMs),...(panel().narration.enabled&&panel().narration.text?[panel().narration]:[])],()=>paint(ms));};
  q('finishFrames').onclick=()=>ComicFrames.finish();q('cancelFrames').onclick=()=>ComicFrames.finish(true);
  return {attach,stop,prepareSave};
})();
