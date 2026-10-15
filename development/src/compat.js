// Only JSON-safe configuration is cloned here; no DOM, Map or binary objects.
export const cloneSettings=value=>JSON.parse(JSON.stringify(value));

if(!Array.prototype.flat){
 Object.defineProperty(Array.prototype,'flat',{configurable:true,writable:true,value:function(depth=1){
  const out=[];const walk=(list,n)=>{list.forEach(value=>{if(Array.isArray(value)&&n>0)walk(value,n-1);else out.push(value)})};
  walk(this,depth);return out;
 }});
}
if(!Array.prototype.flatMap){
 Object.defineProperty(Array.prototype,'flatMap',{configurable:true,writable:true,value:function(fn,thisArg){return this.map(fn,thisArg).flat()}});
}
if(!Object.fromEntries){
 Object.fromEntries=entries=>{const out={};for(const [key,value]of entries)Object.defineProperty(out,key,{value,writable:true,enumerable:true,configurable:true});return out};
}
export function deviceId(){
 const bytes=new Uint8Array(16);
 if(typeof window!=='undefined'&&window.crypto&&window.crypto.getRandomValues)window.crypto.getRandomValues(bytes);
 else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);
 // A catalog identifier, not an authentication credential.
 return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
