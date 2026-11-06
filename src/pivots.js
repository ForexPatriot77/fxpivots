// All candle timestamps are epoch milliseconds. Input bars MUST be 15-minute UTC aligned.
export const CUTS = [
  {id:'12',name:'12–12 ET',hour:0,color:'#e7b867'},
  {id:'7',name:'7–7 ET',hour:7,color:'#4da8ed'},
  {id:'1',name:'1–1 ET',hour:13,color:'#b69bff'}
];
const nyFmt = new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function nyParts(ms){const x=Object.fromEntries(nyFmt.formatToParts(ms).filter(p=>p.type!=='literal').map(p=>[p.type,+p.value]));return x;}
export function nyLabel(ms){return new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',dateStyle:'medium',timeStyle:'short'}).format(ms)+' ET';}
// Find the most recent New York cutoff at or before 'now'. Using Intl handles DST transitions.
export function cutoffBefore(now,hour){
  const end=Math.floor(now/900000)*900000;
  for(let t=end;t>=end-72*3600000;t-=900000){const p=nyParts(t);if(p.hour===hour&&p.minute===0)return t;}
  throw Error('Could not resolve Eastern session boundary');
}
export function calculate(H,L,C){
 const PP=(H+L+C)/3,R1=2*PP-L,S1=2*PP-H,R2=PP+(H-L),S2=PP-(H-L);
 return {R2,M4:(R1+R2)/2,R1,M3:(PP+R1)/2,PP,M2:(S1+PP)/2,S1,M1:(S1+S2)/2,S2};
}
// Only use completed candles. A gap in the source is not silently filled with invented prices.
export function sessions(bars,now=Date.now()){
 const completed=bars.filter(b=>b.time+900000<=now).sort((a,b)=>a.time-b.time);
 return CUTS.map(cut=>{
   const end=cutoffBefore(now,cut.hour);
   let start=cutoffBefore(end-900000,cut.hour);
   // Bain Monday exception: midnight ET pivots include Friday + Sunday evening,
   // not just Sunday evening. The Friday-to-Monday reference spans 72 clock hours.
   if(cut.hour===0){
     const day=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short'}).format(end);
     if(day==='Mon'){
       const weekday=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short'});
       let cursor=end-900000;
       while(weekday.format(cursor)!=='Fri')cursor-=24*3600000;
       start=cutoffBefore(cursor,0);
     }
   }
   const data=completed.filter(b=>b.time>=start&&b.time<end);
   const gaps=[];for(let t=start;t<end;t+=900000){if(!data.some(b=>b.time===t))gaps.push(t);}
   // Weekend gaps are expected, but any absent market-hours candle means the reference is incomplete.
   const weekday=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short'});
   const unexpected=gaps.filter(t=>{const day=weekday.format(t),p=nyParts(t);return !(day==='Sat'||(day==='Sun'&&p.hour<17)||(day==='Fri'&&p.hour>=17));});
   if(!data.length)return {...cut,start,end,error:'No candles in the completed reference window'};
   if(unexpected.length)return {...cut,start,end,error:`${unexpected.length} missing market-hours 15-minute candles; pivots withheld`};
   const H=Math.max(...data.map(b=>b.high)),L=Math.min(...data.map(b=>b.low));
   const O=data[0].open,C=data[data.length-1].close;
   return {...cut,start,end,O,H,L,C,levels:calculate(H,L,C),forecast:C<O?'M1–M3':C>O?'M2–M4':'Neutral (O = C)',count:data.length};
 });
}
export function aggregate(bars,minutes){
 if(minutes===15)return bars;
 const span=minutes*60000,groups=new Map();
 for(const b of bars){const key=Math.floor(b.time/span)*span;if(!groups.has(key))groups.set(key,{time:key,open:b.open,high:b.high,low:b.low,close:b.close,volume:0});
 const v=groups.get(key);v.high=Math.max(v.high,b.high);v.low=Math.min(v.low,b.low);v.close=b.close;v.volume+=b.volume||0;}
 return [...groups.values()].sort((a,b)=>a.time-b.time);
}
export function parseTwelve(payload){
 if(payload.status==='error'||!Array.isArray(payload.values))throw Error(payload.message||'Twelve Data did not return candles. Check symbol, plan and API key.');
 const out=payload.values.map(v=>{const dt=v.datetime.replace(' ','T');const ms=Date.parse(dt.endsWith('Z')?dt:dt+'Z');return {time:ms,open:+v.open,high:+v.high,low:+v.low,close:+v.close,volume:+(v.volume||0)};});
 if(out.some(v=>!Number.isFinite(v.time)||![v.open,v.high,v.low,v.close].every(Number.isFinite)))throw Error('Invalid candle data returned');
 return [...new Map(out.map(b=>[b.time,b])).values()].sort((a,b)=>a.time-b.time);
}
