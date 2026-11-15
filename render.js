/* One deterministic renderer for preview and encoded frames. Times are milliseconds. */
window.ComicRender = (() => {
  const W=720,H=1280;
  const color={A:'#1475d4',B:'#c74262',C:'#b96d17'};
  function total(project){return (project.intro.enabled?project.intro.durationMs:0)+project.panels.reduce((n,p)=>n+p.durationMs,0)+(project.outro.enabled?project.outro.durationMs:0);}
  function scene(project,time){
    let at=Math.max(0,Math.min(time,total(project)-1));
    if(project.intro.enabled){if(at<project.intro.durationMs)return {kind:'intro',local:at};at-=project.intro.durationMs;}
    for(const panel of project.panels){if(at<panel.durationMs)return {kind:'panel',panel,local:at};at-=panel.durationMs;}
    return {kind:'outro',local:at};
  }
  function active(panel,ms){return panel.dialogue.filter(line=>ms>=line.startMs&&ms<line.endMs);}
  function key(project,ms){const s=scene(project,ms);return s.kind==='panel'?s.panel.panelId+':'+active(s.panel,s.local).map(x=>x.lineId).join(','):s.kind;}
  async function load(project){
    const images={};await document.fonts.ready;
    await Promise.all(project.panels.map(async panel=>{const image=new Image();image.src=ComicAssets.url(panel.asset);await image.decode();images[panel.asset]=image;}));
    return images;
  }
  function box(ctx,x,y,w,h,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,18);ctx.fill();}
  function wrap(ctx,text,width){
    const lines=[];let line='';
    for(const ch of Array.from(text)){if(ch==='\n'){lines.push(line);line='';continue;}if(line&&ctx.measureText(line+ch).width>width){lines.push(line);line=ch;}else line+=ch;}
    if(line)lines.push(line);return lines;
  }
  function panelLayout(panel,image){
    // Full bleed is independent of captions. Cropping never changes the asset.
    const scale=(panel.fit==='contain'?Math.min:Math.max)(W/image.width,H/image.height),width=image.width*scale,height=image.height*scale;
    const x=panel.crop?.x??.5,y=panel.crop?.y??.5;
    return {viewport:{x:0,y:0,width:W,height:H},picture:{x:(W-width)*(panel.fit==='contain'?.5:x),y:(H-height)*(panel.fit==='contain'?.5:y),width,height}};
  }
  function frame(ctx,item,name=''){
    const horizontal=!item.position||item.position==='bottom';
    const width=(item.frame?.w??(horizontal?634/720:126/720))*W;
    if(width+.01<(horizontal?180:126)||width>W+.01)throw new Error('文字框太窄，請加寬；字體不會縮小');
    ctx.font=`bold ${item.position==='bottom'?34:32}px "Microsoft JhengHei",sans-serif`;
    const textLines=horizontal?wrap(ctx,item.text,width-40):[];
    const rows=Math.ceil(Array.from(item.text).length/2);
    const height=horizontal?80+textLines.length*42:112+rows*43;
    const x=(item.frame?.x??(item.position==='right'?551/720:43/720))*W;
    const y=(item.frame?.y??(horizontal?(item.position?800:1012)/H:154/H))*H;
    if(![x,y,width,height].every(Number.isFinite)||x<0||y<0||x+width>W+.01||y+height>H+.01)throw new Error('文字框超出畫面，請移回或加寬；文字沒有截斷');
    return {x,y,width,height,textLines,rows};
  }
  function draw(canvas,project,ms,images){
    canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');
    ctx.font='32px "Microsoft JhengHei",sans-serif';ctx.fillStyle='#071322';ctx.fillRect(0,0,W,H);
    const state=scene(project,ms);
    if(state.kind==='panel'){
      const panel=state.panel,image=images[panel.asset];
      if(!image)throw new Error('圖片尚未載入');
      const layout=panelLayout(panel,image),v=layout.viewport,p=layout.picture;
      ctx.save();ctx.beginPath();ctx.rect(v.x,v.y,v.width,v.height);ctx.clip();
      ctx.drawImage(image,p.x,p.y,p.width,p.height);ctx.restore();
      const visible=active(panel,state.local);
      if(new Set(visible.map(line=>line.position)).size!==visible.length)throw new Error('同一位置有重疊字幕，請調整時間或位置');
      for(const line of visible){
        const name=project.roles[line.role]||line.role;
        if(Array.from(name).length>4)throw new Error('人物名最多四字，請縮短後再套用');
        const f=frame(ctx,line,name);
        if(line.position==='bottom'){
          box(ctx,f.x,f.y,f.width,f.height,'rgba(12,29,46,.87)');box(ctx,f.x+10,f.y+8,112,35,color[line.role]||color.C);
          ctx.fillStyle='#fff';ctx.textAlign='left';ctx.font='bold 24px "Microsoft JhengHei",sans-serif';ctx.fillText(name,f.x+18,f.y+34);
          ctx.font='bold 34px "Microsoft JhengHei",sans-serif';f.textLines.forEach((t,i)=>ctx.fillText(t,f.x+20,f.y+76+i*42));
        }else{
          const chars=Array.from(line.text),x=f.x;
          if(chars.length>30)throw new Error('本輪直式台詞最多30字，請分成兩句；文字沒有截斷');
          const rows=Math.ceil(chars.length/2);
          // First-stop candidate: two fixed columns, read top-down/right-left.
          // Font size stays constant. Human reading acceptance is still required.
          box(ctx,x,f.y,f.width,f.height,'rgba(10,30,49,.86)');box(ctx,x+(f.width-112)/2,f.y+11,112,45,color[line.role]||color.C);
          ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='bold 24px "Microsoft JhengHei",sans-serif';ctx.fillText(name,x+f.width/2,f.y+43);
          ctx.font='bold 36px "Microsoft JhengHei",sans-serif';chars.forEach((ch,i)=>ctx.fillText(ch,x+f.width*(i<rows? .7:.3),f.y+99+(i%rows)*43));
        }
      }
      if(panel.narration.enabled&&panel.narration.text){
        const f=frame(ctx,panel.narration);
        box(ctx,f.x,f.y,f.width,f.height,'rgba(25,35,44,.88)');ctx.fillStyle='#d4efff';ctx.textAlign='left';ctx.font='bold 24px "Microsoft JhengHei",sans-serif';ctx.fillText(panel.narration.tag,f.x+20,f.y+34);
        ctx.fillStyle='#fff';ctx.font='bold 32px "Microsoft JhengHei",sans-serif';f.textLines.forEach((t,i)=>ctx.fillText(t,f.x+20,f.y+78+i*42));
      }
    }else{
      const words=state.kind==='intro'?project.intro.text:project.outro.text;
      ctx.fillStyle='#dcefff';ctx.fillRect(0,0,W,H);ctx.textAlign='center';ctx.font='bold 48px "Microsoft JhengHei",sans-serif';
      const lines=wrap(ctx,words,610);ctx.fillStyle='#12415e';lines.forEach((text,i)=>ctx.fillText(text,W/2,520+i*76));
      ctx.font='28px "Microsoft JhengHei",sans-serif';ctx.fillStyle='#1475d4';ctx.fillText('ComicPod · 豆莢浪漫',W/2,1100);
    }
    ctx.textAlign='right';ctx.font='20px "Microsoft JhengHei",sans-serif';ctx.fillStyle=state.kind==='panel'?'#fff':'#1475d4';ctx.fillText('ComicPod',W-28,H-25);
  }
  return {total,scene,key,load,draw,panelLayout,frame};
})();
