// Единый lucide-набор для preact-виджетов (3.3.11): createIcons у каждого виджета
// сканирует ВЕСЬ документ, поэтому каждый должен знать имена всех остальных —
// иначе в консоль сыплются «icon name was not found» о чужой разметке.
import {ArrowRight,ArrowUpRight,Armchair,Archive,Bath,BedDouble,Blocks,ChevronRight,CircleCheck,
 CloudDrizzle,CloudFog,CloudHail,CloudLightning,CloudRain,CloudSnow,CloudSun,Cloudy,DoorOpen,
 Droplets,Download,Heater,Info,Lightbulb,LoaderCircle,MoveUpRight,Moon,Pause,Play,Power,Radio,
 RotateCcw,Shield,SkipBack,SkipForward,Sofa,Sun,Thermometer,Trees,TriangleAlert,Video,WifiOff,
 Wind,X,Zap} from 'lucide';
import {createIcons} from 'lucide';
export const ICONS={ArrowRight,ArrowUpRight,Armchair,Archive,Bath,BedDouble,Blocks,ChevronRight,
 CircleCheck,CloudDrizzle,CloudFog,CloudHail,CloudLightning,CloudRain,CloudSnow,CloudSun,Cloudy,
 DoorOpen,Droplets,Download,Heater,Info,Lightbulb,LoaderCircle,MoveUpRight,Moon,Pause,Play,Power,
 Radio,RotateCcw,Shield,SkipBack,SkipForward,Sofa,Sun,Thermometer,Trees,TriangleAlert,Video,
 WifiOff,Wind,X,Zap};
// Легаси-алиас: digest.js честно использует старое имя 'alert-triangle' (контракт-тест),
// в новой lucide иконка называется TriangleAlert.
ICONS.AlertTriangle=TriangleAlert;
// digest.js использует имя 'door' (дверь открыта ночью); в наборе только DoorOpen.
ICONS.Door=DoorOpen;
// Единая отрисовка: красит все ожидающие <i data-lucide> и снимает атрибут, чтобы
// повторный вызов не пересоздавал svg между mousedown и mouseup (см. app.js icons()).
export function paintAll(){
 createIcons({icons:ICONS,attrs:{'stroke-width':1.6}});
 document.querySelectorAll('svg[data-lucide]').forEach(s=>s.removeAttribute('data-lucide'));
}
