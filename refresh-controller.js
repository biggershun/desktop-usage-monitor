'use strict';
// A per-account operation must always release the UI, including hung queries and navigation.
function createRefreshController({execute,navigate,onData,onLoading,onTimeout,timeoutMs=35000}){
 let current=null,serial=0;
 async function run(){
  if(current){onLoading(true);return current;}
  const id=++serial;onLoading(true);let timer;
  const task=(async()=>{
   try{
    const result=await Promise.race([(async()=>{for(let hops=0;hops<3;hops++){const d=await execute();if(d.navigate){await navigate(d.navigate);continue;}return d;}throw Error('页面跳转过多，请打开账户检查');})(),new Promise((_,reject)=>{timer=setTimeout(()=>{onTimeout?.();reject(Error('刷新超时，请重试或打开账户'));},timeoutMs);})]);
    if(id===serial)onData(result);
   }catch(e){if(id===serial)onData({error:e.message});}
   finally{clearTimeout(timer);if(id===serial){current=null;onLoading(false);}}
  })();current=task;return task;
 }
 return {run,get busy(){return current!==null;}};
}
module.exports={createRefreshController};
