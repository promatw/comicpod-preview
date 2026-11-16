/* Explicit panel-local times; preview before any project mutation. */
window.ComicText=(()=>{
  function parse(text,project,defaultPanel=0,defaultRole='A'){
    const roles={...project.roles},rows=[];
    text.replace(/^\uFEFF/,'').split(/\r?\n/).forEach((raw,index)=>{
      if(!raw.trim())return;
      const definition=raw.trim().match(/^\(人物([ABC]):([^)]*)\)$/);
      if(definition){const name=definition[2].trim();rows.push({number:index+1,raw,definition:definition[1],name,error:Array.from(name).length>4?'人物名最多四字':''});if(Array.from(name).length<=4)roles[definition[1]]=name;return;}
      let rest=raw.trim(),panel=defaultPanel,role=defaultRole,startMs=null,endMs=null;
      const prefix=rest.match(/^([1-9]\d*)\s+/);if(prefix){panel=Number(prefix[1])-1;rest=rest.slice(prefix[0].length);}
      const time=rest.match(/^\[(\d+:\d{2}(?:\.\d{1,3})?|\d+(?:\.\d+)?)\s*-\s*(\d+:\d{2}(?:\.\d{1,3})?|\d+(?:\.\d+)?)\]\s*/);
      const seconds=value=>{const a=value.split(':').map(Number);return a.length===2?(a[1]<60?a[0]*60+a[1]:NaN):a[0];};
      if(time){startMs=Math.round(seconds(time[1])*1000);endMs=Math.round(seconds(time[2])*1000);rest=rest.slice(time[0].length);}
      const actor=rest.match(/^\((?:人物)?([ABC]|敘事)\)\s*/);if(actor){role=actor[1];rest=rest.slice(actor[0].length);}
      let error='';
      if(panel<0||panel>3)error='格次只能1～4';else if(!rest)error='沒有文字';else if(/[\[\]()]/.test(rest)&&!time&&!actor)error='標記格式無法辨識，請依範例';
      if(role!=='敘事'&&!roles[role])error='人物尚未命名';
      rows.push({number:index+1,raw,panel,role,text:rest,startMs,endMs,position:role==='B'?'right':'left',suggested:startMs===null,error});
    });
    for(let panel=0;panel<4;panel++){
      const plain=rows.filter(r=>!r.definition&&r.panel===panel&&r.suggested&&r.role!=='敘事');
      plain.forEach((r,i)=>{r.startMs=Math.floor(project.panels[panel].durationMs*i/plain.length);r.endMs=Math.floor(project.panels[panel].durationMs*(i+1)/plain.length);});
    }
    rows.filter(r=>!r.definition&&!r.error).forEach(r=>{
      if(r.role==='敘事'&&r.suggested){r.startMs=0;r.endMs=project.panels[r.panel].durationMs;}
      if(!Number.isFinite(r.startMs)||!Number.isFinite(r.endMs)||r.startMs<0||r.endMs<=r.startMs||r.endMs>project.panels[r.panel].durationMs)r.error='起訖須在該格內，結束大於開始';
      if(r.text.length>500)r.error='單句超過500字，請分句';
    });
    const content=rows.filter(r=>!r.definition&&!r.error);
    content.forEach((r,i)=>{if(content.some((other,j)=>j!==i&&other.panel===r.panel&&((r.role==='敘事'&&other.role==='敘事')||(other.role!=='敘事'&&r.role!=='敘事'&&other.position===r.position&&r.startMs<other.endMs&&r.endMs>other.startMs))))r.error='同格敘事重複或同位置時間重疊，請先修改TXT';});
    return {roles,rows};
  }
  function install(getProject,getSelected,applied){
    const host=document.createElement('fieldset');host.innerHTML=`<legend>匯入普通 TXT</legend><p>UTF-8，一行一句；時間一律為格內秒數。無時間會先列建議時間供確認。</p><label>無標記文字放在哪格<select id="txtPanel"></select></label><label>無標記文字的人物<select id="txtRole"><option>A</option><option>B</option><option>C</option><option>敘事</option></select></label><input id="txtFile" type="file"><details><summary>看範例</summary><pre>(人物A:阿洛)
(人物B:小莓)
1 [00:00.00-00:06.00] (人物A) 今天一起去買零食吧。
1 [00:02.00-00:04.00] (敘事) 剛剛，他們走進便利商店。
2 (人物B) 我找到想吃的那包了。</pre><p>也可以完全不加標記，每行一句，使用上方選格與人物。</p></details><div id="txtPreview" class="txt-preview"></div><p id="txtStatus" role="status"></p><div class="actions"><button id="txtApply" disabled>確認新增這些句子</button><button id="txtUndo" disabled>還原上一次匯入</button></div>`;
    const fold=document.createElement('details');fold.id='txtDetails';fold.className='story-option';const summary=document.createElement('summary');summary.textContent='匯入 TXT／看範例';fold.append(summary,host);document.querySelector('.story-controls').append(fold);
    const q=id=>document.getElementById(id);let text='',parsed=null,before=null;
    function preview(){
      parsed=parse(text,getProject(),Number(q('txtPanel').value),q('txtRole').value);
      q('txtPreview').innerHTML='<table><thead><tr><th>行</th><th>格／人物</th><th>格內秒數</th><th>文字／錯誤</th></tr></thead><tbody>'+parsed.rows.map(r=>`<tr class="${r.error?'bad':''}"><td>${r.number}</td><td>${r.definition?'人物'+r.definition:(r.panel+1)+'／'+r.role}</td><td>${r.definition?'—':(r.startMs/1000)+'–'+(r.endMs/1000)+(r.suggested?'（建議）':'')}</td><td>${escapeHTML(r.error||r.text||r.name)}</td></tr>`).join('')+'</tbody></table>';
      q('txtApply').disabled=!parsed.rows.some(r=>!r.definition)||parsed.rows.some(r=>r.error);q('txtStatus').textContent=q('txtApply').disabled?'請修正列出的錯誤後重新選檔；尚未改動草稿。':'確認格次、人物與格內時間後再新增；既有內容保留。';
    }
    q('txtFile').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>1024*1024)throw Error('TXT請小於1MB');text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());preview();}catch(error){q('txtStatus').textContent='讀取失敗：請用UTF-8純文字。'+error.message;q('txtApply').disabled=true;}};
    q('txtPanel').onchange=q('txtRole').onchange=()=>{if(text)preview();};
    q('txtApply').onclick=()=>{
      if(!ComicStory.prepareSave())return;const project=getProject();parsed=parse(text,project,Number(q('txtPanel').value),q('txtRole').value);
      if(parsed.rows.some(r=>r.error)){preview();return;}
      const next=structuredClone(project);next.roles=parsed.roles;
      try{for(const r of parsed.rows.filter(r=>!r.definition)){
        const p=next.panels[r.panel];
        if(r.role==='敘事'){if(p.narration.enabled&&p.narration.text)throw Error(`第${r.panel+1}格已有敘事，請先在畫面編輯或關閉；沒有覆寫。`);p.narration={enabled:true,tag:'',text:r.text,startMs:r.startMs,endMs:r.endMs};ComicRender.frame(document.createElement('canvas').getContext('2d'),p.narration);}
        else{if(p.dialogue.some(x=>x.position===r.position&&x.startMs<r.endMs&&x.endMs>r.startMs))throw Error(`第${r.panel+1}格與既有台詞重疊，請修改TXT或既有句子。`);const line={lineId:crypto.randomUUID(),role:r.role,text:r.text,startMs:r.startMs,endMs:r.endMs,position:r.position};ComicRender.frame(document.createElement('canvas').getContext('2d'),line);p.dialogue.push(line);}
      }}catch(error){q('txtStatus').textContent=error.message;return;}
      const snapshot=structuredClone(project);applied(next);before=snapshot;q('txtUndo').disabled=false;q('txtApply').disabled=true;q('txtStatus').textContent='已新增，可在豆二調整，亦可還原這次匯入。';
    };
    q('txtUndo').onclick=()=>{if(!before)return;if(!confirm('還原到上次匯入前？匯入後的其他編輯也會回復。'))return;applied(before);before=null;q('txtUndo').disabled=true;q('txtStatus').textContent='已還原匯入前內容。';};
    function syncPanels(){const selected=q('txtPanel').value;q('txtPanel').innerHTML=getProject().panels.map((p,i)=>`<option value="${i}">第${i+1}格（${p.durationMs/1000}秒）</option>`).join('');q('txtPanel').value=selected||getSelected();if(text&&parsed)preview();}
    return {syncPanels,refresh(){q('txtPanel').innerHTML=getProject().panels.map((p,i)=>`<option value="${i}">第${i+1}格（${p.durationMs/1000}秒）</option>`).join('');q('txtPanel').value=getSelected();text='';parsed=null;before=null;q('txtPreview').replaceChildren();q('txtStatus').textContent='';q('txtApply').disabled=q('txtUndo').disabled=true;}};
  }
  return {parse,install};
})();
