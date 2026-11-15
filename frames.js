/* Local frame adjustment. Only handles capture touch; the rest scrolls normally. */
window.ComicFrames=(()=>{
  let state=null,drag=null;
  const q=id=>document.getElementById(id);
  function finish(cancel=false){
    if(!state)return;
    if(drag){if(drag.el.hasPointerCapture(drag.id))drag.el.releasePointerCapture(drag.id);drag=null;}
    if(cancel)state.items.forEach((item,i)=>{if(state.before[i])item.frame=state.before[i];else delete item.frame;});
    else changed();
    const repaint=state.repaint;state=null;q('frameHandles').hidden=true;q('finishFrames').hidden=q('cancelFrames').hidden=true;q('adjustFrames').hidden=false;q('frameMessage').textContent='';repaint();
  }
  function begin(items,repaint){
    state={items,repaint,before:items.map(x=>x.frame?{...x.frame}:null)};
    const host=q('frameHandles');host.replaceChildren();host.hidden=false;q('finishFrames').hidden=q('cancelFrames').hidden=false;q('adjustFrames').hidden=true;
    q('frameMessage').textContent=items.length?'拖動 ✥ 移位置、↔ 調框寬；其他區域可捲頁。':'目前沒有可見文字，先加入台詞或移動時間軸。';
    const ctx=q('storyCanvas').getContext('2d');
    items.forEach((item,i)=>{
      const outline=document.createElement('div');outline.className='frame-outline';
      const position=()=>{const f=ComicRender.frame(ctx,item);Object.assign(outline.style,{left:f.x/720*100+'%',top:f.y/1280*100+'%',width:f.width/720*100+'%',height:f.height/1280*100+'%'});};position();
      for(const kind of ['move','width']){
        const button=document.createElement('button');button.className='frame-handle '+kind;button.textContent=kind==='move'?'✥':'↔';button.setAttribute('aria-label',`${kind==='move'?'移動':'調寬'}文字框${i+1}`);
        button.onpointerdown=e=>{if(drag)return;e.preventDefault();const f=ComicRender.frame(ctx,item);drag={el:button,id:e.pointerId,x:e.clientX,y:e.clientY,base:{x:f.x/720,y:f.y/1280,w:f.width/720},old:item.frame?{...item.frame}:null};button.setPointerCapture(e.pointerId);};
        button.onpointermove=e=>{if(!drag||drag.el!==button||drag.id!==e.pointerId)return;e.preventDefault();const r=q('storyCanvas').getBoundingClientRect(),dx=(e.clientX-drag.x)/r.width,dy=(e.clientY-drag.y)/r.height,old=item.frame;
          item.frame=kind==='move'?{...drag.base,x:Math.max(0,Math.min(1-drag.base.w,drag.base.x+dx)),y:Math.max(0,drag.base.y+dy)}:{...drag.base,w:Math.min(1-drag.base.x,drag.base.w+dx)};
          try{ComicRender.frame(ctx,item);if(!repaint())throw Error(q('previewError').textContent);position();q('frameMessage').textContent='放開把手後按完成或取消。';}catch(error){item.frame=old;repaint();q('frameMessage').textContent=error.message;}
        };
        const release=e=>{if(!drag||drag.el!==button||drag.id!==e.pointerId)return;if(e.type!=='pointerup'){if(drag.old)item.frame=drag.old;else delete item.frame;repaint();position();}drag=null;if(button.hasPointerCapture(e.pointerId))button.releasePointerCapture(e.pointerId);};
        button.onpointerup=release;button.onpointercancel=release;button.onlostpointercapture=release;outline.append(button);
      }host.append(outline);
    });
  }
  return {begin,finish};
})();
