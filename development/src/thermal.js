// 3.3.2: тепловизор комнат в 3D-доме — лёгкий emissive-tint пола по температуре.
// Тёплые (>22°) — золотистый, холодные (<17°) — синеватый, нормальные и без
// данных — нейтрально (без изменения материалов). Переключателя нет по дизайну.
export function tempTint(value){
 if(!Number.isFinite(value))return null;
 if(value>22)return {kind:'warm',color:'#c98a3e',intensity:.2};
 if(value<17)return {kind:'cold',color:'#4f7fb5',intensity:.2};
 return null;
}
