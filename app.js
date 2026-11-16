'use strict';
const TEXT = {
  local:'V0.5-phone.1 · 手機操作預覽', headline:'四張圖，一段你寫的故事。',
  intro:'從上圖、調整順序開始，到豆二寫台詞，馬上看滿版圖文試播。',
  new:'＋ 建立草稿', import:'匯入作品包', mine:'我的草稿', bean1:'豆一・漫畫素材',
  save:'保存草稿', export:'匯出可編輯作品包', title:'作品名稱', four:'上傳四張圖片', grid:'上傳一張 2×2 合圖',
  order:'合圖依左上、右上、左下、右下切格。調整順序會連同時長、台詞及敘事一起移動。',
  boundary:'草稿保存在此裝置的瀏覽器，圖片沒有上傳；清除網站資料或無痕模式可能失去草稿。本輪提供圖文與配樂試播，尚未提供MP4下載。',
  stop:'保存並停止本機服務', saved:'已保存於此裝置的瀏覽器，可關閉後續做。', dirty:'正在編輯，會自動保存；圖片沒有上傳。',
  choose_identity:'請先選擇本機身分。', name_required:'請輸入身分名稱。', bad_image:'圖片無法讀取，原草稿已保留。',
  image_format:'支援 PNG、JPEG、WebP 圖片。', image_too_large:'圖片尺寸過大，請先縮小至三千萬像素以內。',
  invalid_package:'作品包格式不完整或無法讀取，原草稿已保留。', corrupt_asset:'作品包素材雜湊不符，已停止匯入。',
  unsupported_version:'這份作品包使用尚未支援的版本，請保留原檔。', package_limit:'作品包過大或內容數量不符。',
  revision_conflict:'另一個分頁已保存新修訂。此分頁內容保留，請先「另存新草稿」或回我的草稿載入新版。',
  storage_error:'本機儲存失敗。請檢查資料夾權限與磁碟空間，再按保存重試。',
  draft_not_found:'找不到這個身分的草稿，請回我的草稿查看。', missing_asset:'草稿缺少素材，請重新選取圖片後再保存。',
  invalid_duration:'每格時長須在 1～30 秒。', invalid_project:'作品資料不完整。',
  invalid_frame:'文字框設定無效，請重新調整。', invalid_crop:'裁切位置須在 0～100% 之間。', role_name_too_long:'人物名最多四字，請縮短後再套用。',
  invalid_dialogue_time:'台詞時間超出畫格：請回豆一延長時長，或在豆二修正起訖。台詞沒有刪除。',
  invalid_request:'請檢查輸入內容後重試。', request_too_large:'檔案過大，請縮小後重試。',
  invalid_pipeline:'管線測試包的時間、文字或配樂設定不完整，請重新載入指定測試包。',
  export_in_progress:'影片仍在輸出，請先取消或等待完成，再停止服務。',
  pending:'處理中，請稍候…', defaultTitle:'未命名漫畫', stopped:'服務已停止。下次請按「啟動ComicPod.cmd」。',
  disconnected:'無法連到本機服務，編輯內容仍留在目前畫面。啟動服務並選回身分後，可重新保存。'
};
const $ = selector => document.querySelector(selector);
const t = (key, params={}) => {
  const value = TEXT[key] || TEXT.invalid_request;
  return value.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ''));
};
document.querySelectorAll('[data-t]').forEach(el => el.textContent=t(el.dataset.t));
let session, draft=null, dirty=false, busy=false, replacing=null, pendingImages=null, changeSerial=0, autoTimer=0;
const note=(text, error=false)=>{ $('#status').textContent=text;$('#status').classList.toggle('error',error); };
const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(path,body){return ComicBrowser.api(path,body);}
function changed(){dirty=true;changeSerial++;if(window.ComicFinish)ComicFinish.stale();note(t('dirty'));queueAutoSave();}
function queueAutoSave(){clearTimeout(autoTimer);autoTimer=setTimeout(async()=>{if(!draft||!dirty||ComicFrames.isActive())return;if(busy){queueAutoSave();return;}if(ComicStory.hasPending()&&!window.ComicBrowser)return;busy=true;try{await save({quiet:true});}catch(error){note(error.message,true);}finally{busy=false;}},900);}
function canLeave(){return !dirty || confirm('尚有未保存內容，確定離開目前草稿？');}
function show(view){$('#home').hidden=view==='editor';if(window.ComicB)window.ComicB.stop();if(window.ComicFinish){ComicFinish.stop();$('#finish').hidden=true;}if(window.ComicStory)window.ComicStory.stop();$('#pipeline')&&($('#pipeline').hidden=true);for(const id of ['identities','drafts','editor'])$('#'+id).hidden=id!==view;}
async function loadSession(){session=await api('/api/session');const user=session.users.find(u=>u.id===session.userId);$('#identity').textContent=user?''+user.name:'選擇本機身分';$('#location').textContent=(session.version||'舊版服務，請改用V0.3啟動入口')+' · 資料位置 '+session.dataDir;return user;}
async function identities(){
  await loadSession();show('identities');
  $('#identities').innerHTML='<h2>本機身分</h2><p>同一台電腦的測試身分，方便區分自己的草稿。</p>'+session.users.map(u=>`<div class="row"><b>${escapeHTML(u.name)}</b><button data-user="${u.id}">使用這個身分</button></div>`).join('')+'<label>新身分名稱<input id="userName" maxlength="40"></label><button id="createUser" class="primary">建立本機身分</button>';
  const enter=async value=>{await api('/api/user',value);await loadSession();draft=null;dirty=false;if(pendingImages){const selected=pendingImages;pendingImages=null;await newImages(selected.files,selected.grid);}else await listDrafts();};
  $('#createUser').onclick=()=>run(()=>enter({name:$('#userName').value}));
  document.querySelectorAll('[data-user]').forEach(button=>button.onclick=()=>run(()=>enter({id:button.dataset.user})));
}
function blank(){return {title:t('defaultTitle'),originalLanguage:'zh-TW',textEdition:{language:'zh-TW',revision:1},roles:{A:'人物A',B:'人物B',C:''},panels:Array.from({length:4},()=>({panelId:crypto.randomUUID(),asset:null,source:null,sourceRect:null,durationMs:4000,fit:'contain',crop:{x:.5,y:.5},dialogue:[],narration:{enabled:false,tag:'',text:''}})),bgm:{kind:'none',volume:0,fadeInMs:0,fadeOutMs:0},intro:{enabled:false,durationMs:2000,text:''},outro:{enabled:false,durationMs:2000,text:''},parent:null,lineageKind:null};}
async function listDrafts(){if(!session.userId)return identities();show('drafts');const items=await api('/api/drafts');$('#drafts').innerHTML='<h2>我的草稿・此裝置</h2>'+(items.length?items.map(d=>`<div class="row"><b>${escapeHTML(d.title)}</b><small>修訂 ${d.revision}</small><button data-open="${d.id}">繼續做</button></div>`).join(''):'<p>還沒有草稿，按上方「建立草稿」開始。</p>');document.querySelectorAll('[data-open]').forEach(button=>button.onclick=()=>run(async()=>{draft=await api('/api/draft/'+button.dataset.open);dirty=false;render();note(t('saved'));}));}
function render(){show('editor');$('#title').value=draft.project.title;$('#export').disabled=!draft.id;$('#draftMeta').textContent=draft.id?`草稿 ${draft.id} · 修訂 ${draft.revision}`:'新草稿，正在保存';$('#panels').innerHTML=draft.project.panels.map((p,i)=>`<article class="panel" data-panel="${p.panelId}"><h3>第 ${i+1} 格</h3>${p.asset?`<img class="${p.fit}" src="${ComicAssets.url(p.asset)}" alt="第${i+1}格漫畫">`:'<p>等待圖片</p>'}<div class="actions"><button data-move="${i}" data-by="-1" ${i===0?'disabled':''}>←</button><button data-move="${i}" data-by="1" ${i===3?'disabled':''}>→</button><button data-replace="${i}">替換</button></div><label>停留秒數<input data-duration="${i}" type="number" min="1" max="30" step="0.1" value="${p.durationMs/1000}"></label><label>圖片呈現<select data-fit="${i}"><option value="contain" ${p.fit==='contain'?'selected':''}>完整顯示｜保留整張，不同比例補邊</option><option value="cover" ${p.fit==='cover'?'selected':''}>鋪滿畫面｜填滿直式，超出的部分裁切</option></select></label><label ${p.fit==='contain'?'hidden':''}>裁切左右<input data-crop="${i}" data-axis="x" type="range" min="0" max="100" value="${(p.crop?.x??.5)*100}"></label><label ${p.fit==='contain'?'hidden':''}>裁切上下<input data-crop="${i}" data-axis="y" type="range" min="0" max="100" value="${(p.crop?.y??.5)*100}"></label><button data-center="${i}">裁切回中央</button></article>`).join('');
  document.querySelectorAll('[data-move]').forEach(button=>button.onclick=()=>{const from=+button.dataset.move,to=from+(+button.dataset.by);const panels=draft.project.panels;[panels[from],panels[to]]=[panels[to],panels[from]];render();changed();});
  document.querySelectorAll('[data-replace]').forEach(button=>button.onclick=()=>{replacing=+button.dataset.replace;$('#replace').click();});
  document.querySelectorAll('[data-duration]').forEach(input=>input.oninput=()=>{draft.project.panels[+input.dataset.duration].durationMs=Math.round(Number(input.value)*1000);if(window.ComicStory)ComicStory.refreshDurations();changed();});
  document.querySelectorAll('[data-fit]').forEach(input=>input.onchange=()=>{draft.project.panels[+input.dataset.fit].fit=input.value;render();changed();});
  const cropImage=i=>{const p=draft.project.panels[i],img=document.querySelectorAll('.panel')[i].querySelector('img');if(img)img.style.objectPosition=`${(p.crop?.x??.5)*100}% ${(p.crop?.y??.5)*100}%`;};
  draft.project.panels.forEach((_,i)=>cropImage(i));
  document.querySelectorAll('[data-crop]').forEach(input=>input.oninput=()=>{const i=+input.dataset.crop,p=draft.project.panels[i];p.crop={x:.5,y:.5,...p.crop,[input.dataset.axis]:Number(input.value)/100};p.fit='cover';cropImage(i);changed();});
  document.querySelectorAll('[data-center]').forEach(button=>button.onclick=()=>{draft.project.panels[+button.dataset.center].crop={x:.5,y:.5};render();changed();});
  if(window.ComicFinish)ComicFinish.attach(draft);
  if(window.ComicStory)window.ComicStory.attach(draft);
  if(window.ComicB)window.ComicB.attach(draft).catch(error=>note(error.message,true));
}
async function save({quiet=false}={}){
  if(!draft)return;
  if(!session.userId)throw new Error(t('choose_identity'));
  if(!quiet&&!ComicStory.prepareSave())throw new Error('編輯欄位尚未套用，請先修正或按「取消這次編輯」。');
  const target=draft,serial=changeSerial,snapshot=structuredClone(draft);
  snapshot.pendingEdit=quiet?ComicStory.captureEdit():null;
  const result=await api('/api/save',snapshot);
  if(draft!==target)return;
  draft.id=result.id;draft.revision=result.revision;
  if(serial===changeSerial){draft.pendingEdit=result.pendingEdit||null;dirty=false;note(snapshot.pendingEdit?'草稿與正在編輯的文字已保存；按「套用」更新試播。':t('saved'));}
  else{note('前一修訂已保存，正在保存最新修改…');queueAutoSave();}
  $('#export').disabled=false;$('#draftMeta').textContent=`草稿修訂 ${draft.revision} · ${snapshot.pendingEdit?'含未套用編輯':'已保存'}`;
}
async function upload(file,grid){const bytes=new Uint8Array(await file.arrayBuffer());let data='';for(let i=0;i<bytes.length;i+=8192)data+=String.fromCharCode(...bytes.subarray(i,i+8192));return api('/api/upload',{data:btoa(data),grid,name:file.name});}
async function images(files,grid=false,replace=false){if(!draft)throw new Error('請先建立或打開草稿。');if(!replace&&!grid&&files.length!==4)throw new Error('請一次選擇四張圖片。');let items=[];for(const file of files)items.push(...await upload(file,grid));if(replace)Object.assign(draft.project.panels[replacing],items[0]);else items.forEach((item,i)=>Object.assign(draft.project.panels[i],item));render();changed();}
async function newImages(files,grid){
  if(!grid&&files.length!==4)throw new Error('請一次選擇四張圖片。');
  const previous=draft,wasDirty=dirty;
  draft={id:null,revision:0,project:blank()};
  try{await images(files,grid);$('#editor').scrollIntoView({behavior:'smooth'});}catch(error){draft=previous;dirty=wasDirty;if(draft)render();throw error;}
}
for(const [button,input,grid] of [['startGrid','homeGrid',true],['startFour','homeFour',false]]){
  $('#'+button).onclick=()=>{if(busy)return;if(window.ComicStory&&!window.ComicStory.prepareSave())return;if(canLeave())$('#'+input).click();};
  $('#'+input).onchange=e=>{const files=[...e.target.files];e.target.value='';if(!files.length)return;run(async()=>{if(!grid&&files.length!==4)throw new Error('請一次選擇四張圖片。');if(!session.userId){pendingImages={files,grid};await identities();note('圖片已選好，建立或選擇本機身分後就會帶入。');}else await newImages(files,grid);});};
}
async function run(fn){if(busy)return;busy=true;note(t('pending'));try{await fn();}catch(error){note(error.message,true);if(error.code==='revision_conflict'){const button=document.createElement('button');button.textContent='另存新草稿';button.onclick=()=>run(async()=>{draft.id=null;draft.revision=0;await save();});$('#status').append(' ',button);}}finally{busy=false;}}
$('#new').onclick=()=>{if(!canLeave())return;pendingImages=null;if(!session.userId)return identities();draft={id:null,revision:0,project:blank()};dirty=true;render();note(t('dirty'));};
$('#mine').onclick=()=>{if(canLeave())run(listDrafts);};
$('#title').oninput=()=>{draft.project.title=$('#title').value;changed();};$('#save').onclick=()=>run(save);
for(const [id,grid,replace] of [['four',false,false],['grid',true,false],['replace',false,true]])$('#'+id).onchange=e=>{const files=[...e.target.files];e.target.value='';if(files.length)run(()=>images(files,grid,replace));};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
run(async()=>{await loadSession();await(session.userId?listDrafts():identities());note('ComicPod 已就緒。從首頁選一張合圖或四張圖開始。');});

// Keep the bottom beans above the visual viewport keyboard, without blocking scroll.
function viewportBeans(){const v=window.visualViewport;document.documentElement.style.setProperty('--keyboard-offset',Math.max(0,v?innerHeight-v.height-v.offsetTop:0)+'px');}
if(window.visualViewport){visualViewport.addEventListener('resize',viewportBeans);visualViewport.addEventListener('scroll',viewportBeans);}window.addEventListener('resize',viewportBeans);viewportBeans();

$('.brand').onclick=e=>{e.preventDefault();if(canLeave())run(listDrafts);};
