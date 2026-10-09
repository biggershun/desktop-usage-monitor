(async()=>{
 const clone=document.cloneNode(true);clone.querySelectorAll('script,style').forEach(el=>el.remove());
 const text=clone.body.textContent.replace(/\s+/g,' ');
 const match=text.match(/(\d+(?:\.\d+)?)\s*(TB|GB|MB|KB|B)\s*\/\s*(\d+(?:\.\d+)?)\s*(TB|GB|MB|KB|B)/i);
 if(match){
  const gb=(n,u)=>Number(n)*({TB:1024,GB:1,MB:1/1024,KB:1/1048576,B:1/1073741824}[u.toUpperCase()]);
  const used=gb(match[1],match[2]),total=gb(match[3],match[4]);
  const field=label=>text.match(new RegExp(label+'\\s*[:：]?\\s*([0-9./-]+)'))?.[1]||null;
  const traffic=label=>{const m=text.match(new RegExp(label+'\\s*([0-9.]+)\\s*(TB|GB|MB|KB|B)','i'));return m?m[1]+' '+m[2]:null;};
  return {used,total,remaining:Math.max(0,total-used),upload:traffic('上传'),download:traffic('下载'),reset:field('下次重置日'),expiry:field('到期日'),plan:'FlowerCloud 套餐',updated:Date.now()};
 }
 const link=[...document.querySelectorAll('a[href]')].find(a=>a.getAttribute('href').includes('action=productdetails'));
 if(link){const target=new URL(link.getAttribute('href'),location.origin);if(target.origin!==location.origin)throw Error('套餐地址异常');if(target.href!==location.href)return {navigate:target.href};}
 if(document.querySelector('input[type=password]'))return {login:true};
 if(/challenge|just a moment|验证您|验证你/i.test(document.title))throw Error('请打开账户窗口完成网站验证');
 throw Error('未找到套餐流量，请打开账户查看套餐页面');
})()
