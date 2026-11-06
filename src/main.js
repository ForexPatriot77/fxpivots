import {Vela} from '@luxalgo/vela';
import {CUTS,sessions,aggregate,parseTwelve,nyLabel} from './pivots.js';
import './style.css';
const SYMBOLS=['AUD/USD','NZD/USD','EUR/USD','USD/CAD','GBP/USD','USD/JPY','EUR/JPY','GBP/JPY'];
const LEVELS=['R2','M4','R1','M3','PP','M2','S1','M1','S2'];
const state={symbol:'AUD/USD',timeframe:15,bars:[],results:[],chart:null,drawings:[],enabled:{'12':true,'7':false,'1':false},refreshTimer:null,fetching:false,lastUpdate:null};
const $=id=>document.getElementById(id);
document.querySelector('#app').innerHTML=`
<header class="top"><div class="brand"><span class="mark">⌁</span><div><strong>FXPIVOTS</strong><small>BAIN TRADING WORKSTATION</small></div></div><div class="topright"><span id="connection" class="status">● Waiting for data</span><a href="https://github.com/LuxAlgo/Vela" target="_blank" rel="noopener">Powered by Vela™</a></div></header>
<main><section class="controls"><label>FOREX PAIR<select id="symbol">${SYMBOLS.map(s=>`<option>${s}</option>`).join('')}</select></label><label>TIMEFRAME<select id="timeframe"><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option><option value="240">4 hours</option></select></label><label>REFRESH<select id="refresh"><option value="900000">Every 15 min</option><option value="300000">Every 5 min</option><option value="0">Manual only</option></select></label><button id="reload" class="primary">↻ Refresh data</button><span class="updated" id="updated">No market data loaded</span></section>
<section class="setup"><div><strong>Twelve Data API key</strong><p>Used only in your browser session. On GitHub Pages, this is a personal-use convenience, <em>not</em> secure credential storage.</p></div><input id="key" type="password" autocomplete="off" placeholder="Paste Twelve Data key"/><button id="load" class="primary">Load live data</button><a href="https://twelvedata.com/account/api-keys" target="_blank" rel="noopener">Get key ↗</a></section>
<section class="workspace"><div class="chartpanel"><div class="panelhead"><div><strong id="charttitle">AUD/USD</strong><span class="sub">Vela™ native candlestick chart · Twelve Data candles</span></div><div class="chips">${CUTS.map(c=>`<label class="chip" style="--accent:${c.color}"><input type="checkbox" data-cut="${c.id}" ${state.enabled[c.id]?'checked':''}/>${c.name}</label>`).join('')}</div></div><div id="chart" class="chart"><div class="placeholder">Enter your Twelve Data key and select <strong>Load live data</strong>.<br/>No simulated prices are shown.</div></div><div class="notice" id="notice">15-minute candles form the basis for every Bain session, regardless of the chart display timeframe.</div></div>
<aside class="sidebar"><div class="sidehead"><strong>SESSION PIVOTS</strong><span>Completed reference windows</span></div><div id="sessions"><div class="empty">Load market data to calculate the nine levels for each Eastern session.</div></div></aside></section>
<footer><span>FXPIVOTS · Data: Twelve Data · Charts: Vela™ by LuxAlgo</span><span>Quotes are not tick-streamed. Sessions are based on New York time, including DST.</span></footer></main>`;
let seq=0;
function status(message,error=false){$('connection').textContent='● '+message;$('connection').className='status '+(error?'bad':'');}
function fmt(n){return n.toFixed(state.symbol.includes('JPY')?3:5);}
function setRefresh(){clearInterval(state.refreshTimer);const n=+$('refresh').value;if(n)state.refreshTimer=setInterval(()=>{if(!$('key').value.trim())return;loadData();},n);}
function updateRows(){
 $('sessions').innerHTML=state.results.map(s=>`<article class="session" style="--accent:${s.color}"><div class="sessiontop"><span class="dot"></span><strong>${s.name}</strong><span class="sessioncount">${s.count??0} bars</span></div><p class="window">${nyLabel(s.start)} → ${nyLabel(s.end)}</p>${s.error?`<p class="err">${s.error}</p>`:`<div class="ohlc">${[['O',s.O],['H',s.H],['L',s.L],['C',s.C]].map(([k,v])=>`<span>${k} <b>${fmt(v)}</b></span>`).join('')}</div><div class="forecast">Projected range: <b>${s.forecast}</b></div><div class="levels">${LEVELS.map(k=>`<div class="level ${k==='PP'?'mid':''}"><span>${k}</span><strong>${fmt(s.levels[k])}</strong></div>`).join('')}</div>`}</article>`).join('');
}
function clearLines(){if(!state.chart)return;for(const id of state.drawings){try{state.chart.drawings.remove(id)}catch(e){console.warn('Could not remove drawing',e)}}state.drawings=[];}
function drawLines(){if(!state.chart||!state.bars.length)return;clearLines();
 const anchor=state.bars[state.bars.length-1].time;
 for(const s of state.results){if(!state.enabled[s.id]||!s.levels)continue;
 for(const k of LEVELS){try{const d=state.chart.drawings.add('hline',{paneId:'price',anchors:[{time:anchor,price:s.levels[k]}]});state.chart.drawings.update(d.id,{style:{lineColor:s.color,lineWidth:k==='PP'?2:1}});state.chart.drawings.lock(d.id);state.drawings.push(d.id);}catch(e){console.warn('Pivot line error',k,e);$('notice').textContent='Pivot table is accurate; Vela drawing API may need an update for this installed version.';}}
 }
}
async function renderChart(){
 if(!state.bars.length)return;
 const candles=aggregate(state.bars,state.timeframe);
 const el=$('chart');
 try{if(state.chart){try{state.chart.destroy()}catch(e){console.warn(e)}state.chart=null;}
 state.drawings=[];el.innerHTML='';
 state.chart=new Vela('#chart',{data:candles,timeframe:String(state.timeframe),theme:'dark'});
 await state.chart.ready();drawLines();
 }catch(e){el.innerHTML=`<div class="placeholder">Vela chart could not initialize: ${escapeHTML(e.message)}<br/>The pivot calculator is still available.</div>`;console.error(e);}
}
function escapeHTML(x){return String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function loadData(){
 const key=$('key').value.trim();if(!key){status('Enter API key',true);return;}
 if(state.fetching)return;state.fetching=true;const request=++seq;$('load').disabled=true;$('reload').disabled=true;status('Loading candles…');
 try{
 const url=new URL('https://api.twelvedata.com/time_series');
 for(const [k,v] of Object.entries({symbol:state.symbol,interval:'15min',outputsize:'700',timezone:'UTC',format:'JSON',apikey:key}))url.searchParams.set(k,v);
 const response=await fetch(url);if(!response.ok)throw Error(`HTTP ${response.status} from Twelve Data`);
 const data=parseTwelve(await response.json());if(request!==seq)return;
 if(data.length<100)throw Error('Not enough 15-minute candles for reliable session calculations');
 state.bars=data;state.results=sessions(data);state.lastUpdate=Date.now();
 $('charttitle').textContent=state.symbol;$('updated').textContent='Fetched '+new Date(state.lastUpdate).toLocaleTimeString()+' · '+data.length+' candles';
 updateRows();await renderChart();status('Data loaded');
 $('notice').textContent='Source: Twelve Data 15-minute OHLC. Current candle may be incomplete. Session pivots use only completed candles; missing market-hours bars cause a warning.';
 }catch(e){status('Data unavailable',true);$('notice').textContent=e.message;console.error(e);}
 finally{state.fetching=false;$('load').disabled=false;$('reload').disabled=false;}
}
$('symbol').addEventListener('change',e=>{state.symbol=e.target.value;state.bars=[];state.results=[];$('sessions').innerHTML='<div class="empty">Load candles for this symbol.</div>';$('chart').innerHTML='<div class="placeholder">Click Load live data to load the selected pair.</div>';if(state.chart){try{state.chart.destroy()}catch{}}state.chart=null;status('Symbol changed');});
$('timeframe').addEventListener('change',e=>{state.timeframe=+e.target.value;renderChart();});
$('refresh').addEventListener('change',setRefresh);
$('load').addEventListener('click',loadData);$('reload').addEventListener('click',loadData);
document.querySelectorAll('[data-cut]').forEach(el=>el.addEventListener('change',e=>{state.enabled[e.target.dataset.cut]=e.target.checked;drawLines();}));
setRefresh();
