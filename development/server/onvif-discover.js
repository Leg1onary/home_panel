// 3.4.6: поиск ONVIF-камер в локальной сети (WS-Discovery). UDP-мультикаст на
// 239.255.255.250:3702, сбор ответов с XAddrs; ошибки (нет мультикаста/прав)
// возвращаются текстом — UI показывает честную подсказку, не падает.
import dgram from 'node:dgram';
const PROBE='<?xml version="1.0" encoding="UTF-8"?>'
 +'<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing">'
 +'<s:Header><a:MessageID>urn:uuid:home-panel-probe</a:MessageID><a:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</a:To>'
 +'<a:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</a:Action></s:Header>'
 +'<s:Body><Probe xmlns="http://schemas.xmlsoap.org/ws/2005/04/discovery">'
 +'<Types xmlns:dn="http://www.onvif.org/ver10/network/wsdl">dn:NetworkVideoTransmitter</Types>'
 +'</Probe></s:Body></s:Envelope>';
// Разбор XAddrs из одного ответа: может быть список через пробел, <XAddrs>https://ip:port/...</XAddrs>.
export function parseDiscoveryAddrs(text){
 const out=[];
 for(const m of String(text).matchAll(/XAddrs[^>]*>([^<]+)</g)){
  for(const token of m[1].split(/\s+/)){
   const u=/^(https?):\/\/([\w.\-]+):(\d+)/.exec(token);
   if(u)out.push({host:u[2],port:Number(u[3]),url:token});
  }
 }
 return out;
}
export async function onvifDiscover({timeoutMs=3000,multicast='239.255.255.250',port=3702}={}){
 return new Promise((resolve,reject)=>{
  const sock=dgram.createSocket('udp4');
  const found=new Map();
  let bound=false;
  const finish=()=>{
   try{sock.close()}catch{}
   resolve([...found.values()].sort((a,b)=>a.host.localeCompare(b.host,undefined,{numeric:true})));
  };
  sock.on('error',error=>{
   try{sock.close()}catch{}
   reject(new Error('Поиск камер недоступен в этой сети: '+(error.code||error.message)));
  });
  sock.on('message',(msg)=>{
   for(const a of parseDiscoveryAddrs(String(msg))){
    if(!found.has(a.host+':'+a.port))found.set(a.host+':'+a.port,a);
   }
  });
  sock.bind({port:0},()=>{
   bound=true;
   try{sock.addMembership(multicast)}catch(error){sock.emit('error',error);return}
   sock.send(Buffer.from(PROBE),port,multicast);
   setTimeout(finish,timeoutMs).unref?.();
  });
 });
}
