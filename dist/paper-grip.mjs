import {PAPER} from './paper-format.mjs';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const neutral=()=>({transform:'',shadeX:0,shadeY:0});
const round=value=>Math.round(value*1000)/1000;

// Append to ghostPose's transform while keeping its grabbed-pixel origin.
// All response is visual: no translation, scale, layout or stored coordinates.
export function paperGripPose(grab,options={}) {
  if(!options||typeof options!=='object')return neutral();
  const {width=PAPER.width,height=PAPER.height,tilt=0,reduced=false}=options;
  if(reduced||!grab||![grab.x,grab.y,width,height,tilt].every(Number.isFinite)||width<=0||height<=0)return neutral();
  const x=clamp(grab.x/width*2-1,-1,1),y=clamp(grab.y/height*2-1,-1,1);
  const flex=clamp(tilt,-3,3);
  // The opposite edge falls away from a corner grip. Velocity bends the sheet
  // slightly even at its center, without giving folders a paper-like response.
  const pitch=round(clamp(y*2.4+flex*.12,-3,3));
  const roll=round(clamp(-x*3+flex*.2,-4,4));
  return {
    transform:pitch||roll?`perspective(1000px) rotateX(${pitch}deg) rotateY(${roll}deg)`:'',
    shadeX:round(clamp(x-flex*.05,-1,1)),
    shadeY:round(clamp(y+flex*.03,-1,1)),
  };
}
