/* Device-only persistence. No accounts, backend calls or cross-device sync. */
window.ComicBrowser=(()=>{
  const urls=new Map();let opened=null;
  const copy=value=>structuredClone(value);
  const refs=project=>[...new Set(project.panels.flatMap(p=>[p.asset,p.source]).filter(Boolean))];
  function database(){
    if(!opened)opened=new Promise((resolve,reject)=>{
      const request=indexedDB.open('comicpod-preview-device-v1',1);
      request.onupgradeneeded=()=>{request.result.createObjectStore('drafts',{keyPath:'id'});request.result.createObjectStore('assets',{keyPath:'id'});};
      request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db);};
      request.onerror=()=>reject(Error('這個瀏覽器無法儲存草稿。請檢查儲存空間與無痕模式；尚未保存。'));
      request.onblocked=()=>reject(Error('另一個分頁正在更新儲存資料，請關閉舊分頁後重試。'));
    });return opened;
  }
  async function transact(names,mode,work){
    const db=await database();return new Promise((resolve,reject)=>{
      const tx=db.transaction(names,mode);let result,error;
      tx.oncomplete=()=>resolve(copy(result));tx.onabort=tx.onerror=()=>reject(error||Error('儲存失敗，請確認空間後按保存重試；舊稿仍保留。'));
      const fail=message=>{error=Error(message);tx.abort();};
      try{work(tx,value=>result=value,fail);}catch(e){error=e.name==='QuotaExceededError'?Error('這台裝置的儲存空間不足，尚未保存；舊草稿保留。請釋放空間後重試。'):e;tx.abort();}
    });
  }
  async function hydrate(value){
    for(const id of refs(value.project))if(!urls.has(id)){
      const entry=await transact(['assets'],'readonly',(tx,done)=>{const r=tx.objectStore('assets').get(id);r.onsuccess=()=>done(r.result);});
      if(!entry)throw Error('草稿缺少圖片，請保留目前頁面並重新選圖；沒有改寫原稿。');
      urls.set(id,URL.createObjectURL(entry.blob));
    }return value;
  }
  async function retain(blob){
    const id=crypto.randomUUID();await transact(['assets'],'readwrite',(tx,done)=>{tx.objectStore('assets').put({id,blob});done(id);});urls.set(id,URL.createObjectURL(blob));return id;
  }
  async function upload(body){
    const bytes=Uint8Array.from(atob(body.data),c=>c.charCodeAt(0));if(bytes.length>30*1024*1024)throw Error('單張圖片請小於30MB。');
    const blob=new Blob([bytes]),url=URL.createObjectURL(blob),image=new Image();image.src=url;
    try{await image.decode();if(image.naturalWidth*image.naturalHeight>30000000)throw Error('圖片尺寸過大，請先縮小。');
      const original=await retain(blob);if(!body.grid)return [{asset:original,source:original,sourceRect:null}];
      const result=[];
      for(const [row,col] of [[0,0],[0,1],[1,0],[1,1]]){const x=Math.floor(col*image.naturalWidth/2),y=Math.floor(row*image.naturalHeight/2),w=Math.floor((col+1)*image.naturalWidth/2)-x,h=Math.floor((row+1)*image.naturalHeight/2)-y;
        const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(image,x,y,w,h,0,0,w,h);const cropped=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(!cropped)throw Error('無法切格');result.push({asset:await retain(cropped),source:original,sourceRect:[x,y,x+w,y+h]});}
      return result;
    }catch(error){throw Error('圖片處理失敗：'+error.message);}finally{URL.revokeObjectURL(url);}
  }
  async function api(path,body){
    if(path==='/api/session'){await database();return {version:'V0.5-phone.2',userId:'this-device',users:[{id:'this-device',name:'這台裝置'}],dataDir:'此裝置・此瀏覽器，圖片不上傳；清除網站資料或無痕模式可能使草稿消失'};}
    if(path==='/api/upload')return upload(body);
    if(path==='/api/drafts')return transact(['drafts'],'readonly',(tx,done)=>{const r=tx.objectStore('drafts').getAll();r.onsuccess=()=>done(r.result.sort((a,b)=>b.updated-a.updated).map(x=>({id:x.id,title:x.project.title,revision:x.revision})));});
    if(path.startsWith('/api/draft/')){const value=await transact(['drafts'],'readonly',(tx,done)=>{const r=tx.objectStore('drafts').get(path.split('/').pop());r.onsuccess=()=>done(r.result);});if(!value)throw Error('找不到這台裝置的草稿。');return hydrate(value);}
    if(path==='/api/save'){
      const value=copy(body);value.id=value.id||crypto.randomUUID();
      return transact(['drafts','assets'],'readwrite',(tx,done,fail)=>{
        const drafts=tx.objectStore('drafts'),old=drafts.get(value.id);old.onsuccess=()=>{
          if((old.result?.revision??0)!==value.revision){fail('另一個分頁已保存新修訂，這裡的內容仍保留。請重新開啟草稿或另存新稿。');return;}
          let remaining=refs(value.project).length;
          const commit=()=>{value.revision++;value.updated=Date.now();drafts.put(value);done(value);};
          if(!remaining){commit();return;}
          for(const id of refs(value.project)){const r=tx.objectStore('assets').get(id);r.onsuccess=()=>{if(!r.result){fail('圖片未保存，草稿尚未寫入。');return;}if(!--remaining)commit();};}
        };
      });
    }
    throw Error('目前網頁不提供這個功能。');
  }
  window.ComicAssets={url:id=>{if(!urls.has(id))throw Error('圖片未載入，請重新開啟草稿。');return urls.get(id);}};
  return {api};
})();
