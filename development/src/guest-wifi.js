// 3.8.0 «QR гостевого Wi-Fi»: стандартный payload WIFI: для камер телефона.
// Экранируем спецсимволы формата: \ ; , : " — по правилам WIFI:-строки.
export function wifiEscape(s){
 return String(s??'').replace(/[\\;,:"]/g,c=>'\\\\'+c);
}
export function wifiQrPayload(ssid,pass,hidden=false){
 const s=wifiEscape(String(ssid??'').trim()),p=wifiEscape(String(pass??''));
 if(!s||!p)return '';
 return `WIFI:T:${hidden?'WPA':'WPA'};S:${s};P:${p};;`;
}