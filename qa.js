/* Explicit, optional acceptance helpers. Never alters an existing draft. */
(()=>{
  if(!window.ComicBrowser)return;
  const fold=document.createElement('details');fold.id='qaTools';fold.className='story-option';
  fold.innerHTML=`<summary>驗收工具（非創作必經步驟）</summary><p>只建立新的驗收樣稿，不改既有作品。四圖由本頁產生，不含任何人的作品。正常創作仍從首頁上圖。</p><button id="qaCreate">建立四格驗收草稿</button><label>限定驗收 TXT（可以修改）<textarea id="qaText" rows="6"></textarea></label><button id="qaPreview">預覽這段 TXT</button><p id="qaStatus" role="status"></p>`;
  document.querySelector('footer').prepend(fold);
  const q=id=>document.getElementById(id);
  q('qaText').value='(人物A:雷蒙特)\n(人物B:瑞波)\n2 [0-4] (人物B) 所以，它自己會變？\n3 [0-4] (人物A) 是的，依照你的習慣調整。\n4 [0-4] (人物B) 那我想試試看！';
  async function picture(index){
    const canvas=document.createElement('canvas');canvas.width=720;canvas.height=1280;const c=canvas.getContext('2d');
    const colors=['#1d5270','#405f3b','#704d68','#785331'];c.fillStyle=colors[index];c.fillRect(0,0,720,1280);
    c.fillStyle='#ffffff18';for(let i=0;i<5;i++){c.beginPath();c.arc(90+i*140,500+(i%2)*160,85,0,Math.PI*2);c.fill();}
    c.fillStyle='#ffffff';c.textAlign='center';c.font='bold 100px sans-serif';c.fillText(String(index+1),360,680);
    c.font='bold 40px sans-serif';c.fillText('驗收圖 '+(index+1),360,260);c.font='28px sans-serif';c.fillText('幾何樣稿・非作品素材',360,1120);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('測試圖產生失敗，尚未建立草稿。');
    return new File([blob],'acceptance-panel-'+(index+1)+'.png',{type:'image/png'});
  }
  q('qaCreate').onclick=()=>{
    if(busy||!canLeave())return;
    run(async()=>{
      const files=await Promise.all([0,1,2,3].map(picture));await newImages(files,false);
      draft.project.title='驗收樣稿・'+new Date().toLocaleString('zh-TW');draft.project.qa={source:'generated-canvas',version:1};
      document.getElementById('title').value=draft.project.title;changed();
      q('qaStatus').textContent='已建立獨立新稿。請自行設第1格6秒，再進豆二手打台詞。';
    });
  };
  q('qaPreview').onclick=()=>{
    if(busy)return;
    if(!draft){q('qaStatus').textContent='請先建立或開啟草稿。';return;}
    if(!ComicStory.prepareSave())return;
    ComicStory.go(2);ComicStory.previewText(q('qaText').value);
    q('qaStatus').textContent='已送至豆二原有解析預覽；請核對後自行按確認新增。這不代表已測檔案選取或解碼。';
  };
})();
