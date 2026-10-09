'use strict';
const WIDTH=296, COLLAPSED_HEIGHT=62;
function clampAnchor(b,a){return {x:Math.max(a.x,Math.min(b.x,a.x+a.width-WIDTH)),y:Math.max(a.y,Math.min(b.y,a.y+a.height-COLLAPSED_HEIGHT)),width:WIDTH,height:COLLAPSED_HEIGHT};}
function snapAnchor(b,a){b=clampAnchor(b,a);if(Math.abs(b.x-a.x)<=24)b.x=a.x+4;else if(Math.abs(b.x+WIDTH-a.x-a.width)<=24)b.x=a.x+a.width-WIDTH-4;if(Math.abs(b.y-a.y)<=24)b.y=a.y+4;else if(Math.abs(b.y+COLLAPSED_HEIGHT-a.y-a.height)<=24)b.y=a.y+a.height-COLLAPSED_HEIGHT-4;return b;}
function layout(b,a,expanded,preferred){b=clampAnchor(b,a);if(!expanded)return {bounds:b,anchor:b,expanded:false,direction:'down',side:'free'};const above=b.y-a.y,below=a.y+a.height-b.y-COLLAPSED_HEIGHT;const direction=preferred||(below>=358||below>=above?'down':'up');const height=Math.min(420,COLLAPSED_HEIGHT+(direction==='up'?above:below));return {anchor:b,expanded:true,direction,side:Math.abs(b.x-a.x)<=12?'left':Math.abs(b.x+WIDTH-a.x-a.width)<=12?'right':'free',bounds:{x:b.x,y:direction==='up'?b.y+COLLAPSED_HEIGHT-height:b.y,width:WIDTH,height}};}
module.exports={WIDTH,COLLAPSED_HEIGHT,clampAnchor,snapAnchor,layout};
