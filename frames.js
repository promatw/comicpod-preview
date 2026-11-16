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
    q('frameMessage').textContent=items.length?'拖動 ✥ 移位置、右下角 ⤢ 同時調寬與高；其他區域可捲頁。':'目前沒有可見文字，先加入台詞或移動時間軸。';
    const ctx=q('storyCanvas').getContext('2d');
    items.forEach((item,i)=>{
      const outline=document.createElement('div');outline.className='frame-outline';
      const position=()=>{const f=ComicRender.frame(ctx,item);Object.assign(outline.style,{left:f.x/720*100+'%',top:f.y/1280*100+'%',width:f.width/720*100+'%',height:f.height/1280*100+'%'});};position();
      for(const kind of ['move','width']){
        const button=document.createElement('button');button.className='frame-handle '+kind;button.textContent=kind==='move'?'✥':'⤢';button.setAttribute('aria-label',`${kind==='move'?'移動':'調寬高'}文字框${i+1}`);
        button.onpointerdown=e=>{if(drag)return;e.preventDefault();e.stopPropagation();const f=ComicRender.frame(ctx,item),r=q('storyCanvas').getBoundingClientRect();drag={el:button,id:e.pointerId,x:e.clientX,y:e.clientY,scaleX:r.width,scaleY:r.height,base:{x:f.x/720,y:f.y/1280,w:f.width/720,h:f.height/1280},old:item.frame?{...item.frame}:null};button.setPointerCapture(e.pointerId);outline.classList.add('selected');};
        button.onpointermove=e=>{if(!drag||drag.el!==button||drag.id!==e.pointerId)return;e.preventDefault();e.stopPropagation();const dx=(e.clientX-drag.x)/drag.scaleX,dy=(e.clientY-drag.y)/drag.scaleY,old=item.frame;
          item.frame=kind==='move'?{...drag.base,x:Math.max(0,Math.min(1-drag.base.w,drag.base.x+dx)),y:Math.max(0,Math.min(1-drag.base.h,drag.base.y+dy))}:{...drag.base,w:Math.min(1-drag.base.x,drag.base.w+dx),h:Math.min(1-drag.base.y,drag.base.h+dy)};
          // Stop at the closest valid point instead of freezing both resize axes.
          const target={...item.frame};let warning='';
          try{ComicRender.frame(ctx,item);}catch(error){warning=error.message;let lo=0,hi=1;for(let k=0;k<12;k++){const t=(lo+hi)/2;item.frame={x:old?.x??drag.base.x,y:old?.y??drag.base.y,w:old?.w??drag.base.w,h:old?.h??drag.base.h};for(const key of ['x','y','w','h'])item.frame[key]+=(target[key]-item.frame[key])*t;try{ComicRender.frame(ctx,item);lo=t;}catch{hi=t;}}item.frame={};for(const key of ['x','y','w','h']){const a=old?.[key]??drag.base[key];item.frame[key]=a+(target[key]-a)*lo;}}
          if(repaint())position();else{item.frame=old;repaint();position();}
          q('frameMessage').textContent=warning||'放開把手後按完成或取消。';
        };
        const release=e=>{if(!drag||drag.el!==button||drag.id!==e.pointerId)return;if(e.type!=='pointerup'){if(drag.old)item.frame=drag.old;else delete item.frame;repaint();position();}drag=null;outline.classList.remove('selected');if(button.hasPointerCapture(e.pointerId))button.releasePointerCapture(e.pointerId);};
        button.onpointerup=release;button.onpointercancel=release;button.onlostpointercapture=release;outline.append(button);
      }host.append(outline);
    });
  }
  return {begin,finish,isActive:()=>!!state};
})();
