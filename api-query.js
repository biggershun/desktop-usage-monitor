(async()=>{
 const request=async(path,options={})=>{
  const response=await fetch('/api/v1'+path,{...options,signal:AbortSignal.timeout(15000)});
  if(response.status===401)return {expired:true};
  if(!response.ok)throw Error('查询失败 HTTP '+response.status);
  const json=await response.json();if(json.code!==undefined&&json.code!==0)throw Error(json.message||'查询失败');
  return json.data??json;
 };
 let token=localStorage.getItem('auth_token')||localStorage.getItem('access_token')||localStorage.getItem('token');
 async function renew(){
  const rt=localStorage.getItem('refresh_token');if(!rt)return false;
  const data=await request('/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:rt})});
  if(!data.access_token)return false;token=data.access_token;
  localStorage.setItem('auth_token',token);if(data.refresh_token)localStorage.setItem('refresh_token',data.refresh_token);
  if(data.expires_in)localStorage.setItem('token_expires_at',String(Date.now()+data.expires_in*1000));return true;
 }
 const expiry=Number(localStorage.getItem('token_expires_at'));
 if(!token||(expiry&&expiry<Date.now()+60000)){if(!await renew())return {login:true};}
 if(!token)return {login:true};
 const get=path=>request(path,{headers:{Authorization:'Bearer '+token,'X-Timezone':'Asia/Shanghai'}});
 let user=await get('/auth/me');if(user.expired){if(!await renew())return {login:true};user=await get('/auth/me');if(user.expired)return {login:true};}
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const q='start_date='+day+'&end_date='+day+'&timezone=Asia%2FShanghai';
 const results=await Promise.allSettled([get('/usage/stats?'+q),get('/usage?'+q+'&page=1&page_size=6'),get('/usage/dashboard/models?'+q)]);
 const auth=Object.fromEntries(['auth_token','refresh_token','token_expires_at','auth_user'].map(k=>[k,localStorage.getItem(k)]));
 return {user,auth,stats:results[0].value,recent:results[1].value,models:results[2].value,partial:results.some(r=>r.status==='rejected'||r.value?.expired),updated:Date.now()};
})()
