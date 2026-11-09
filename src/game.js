// ================= Rules =================
const PARS=[4,4,3,5,4,3,4,5,4];
const PARS_BY_LEN={3:[4,3,5],9:PARS,18:[4,4,3,5,4,3,4,5,4,4,3,5,4,4,3,4,5,4]};
const SECONDS=25;
const THEMES={all:{label:'All football',cats:null},
  world:{label:'Internationals',cats:['World Cup','Qatar 2022','Euros','Euro 2024','Euro 96','Copa América','AFCON','Women’s game','Olympics','Nations League','Three Lions']},
  clubs:{label:'Club football',cats:['Premier League','Grounds','Seasiders','FA Cup','League Cup','EFL','Golden Boot','Awards','Champions League','Europe','Scotland','Europa League','Conference League']},
  people:{label:'Players & managers',cats:['Career path','Dugout','Ballon d’Or']}};
const DEFAULT_OPTS={len:9,theme:'all',clock:25,match:false};
function cleanOpts(o){o=o||{};return {len:[3,9,18].includes(+o.len)?+o.len:9,theme:THEMES[o.theme]?o.theme:'all',clock:+o.clock===12?12:25,match:!!o.match};}
const optsOf=()=>cleanOpts(state&&state.opts);
const clockSecs=()=>optsOf().clock;
function optsLabel(o){o=cleanOpts(o);return `${o.len} holes · ${THEMES[o.theme].label}${o.clock===12?' · Speed':''}${o.match?' · Match play':''}`;}
const DRIVE={1:110,2:90,3:70,4:50};              // yards per kick by answer rarity (footgolf)
const PROX={1:4,2:9,3:18,4:32};                  // feet from the pin when the shot finds the green
const TIER={1:'Legend',2:'Rare',3:'Uncommon',4:'Common'};
const SHOT={1:'Absolute screamer',2:'Thunderbolt',3:'Clean strike',4:'Played safe'};

// ================= Helpers =================
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ABBR={utd:'united',man:'manchester',sheff:'sheffield',wed:'wednesday',weds:'wednesday',nottm:'nottingham',st:'saint',bham:'birmingham',brum:'birmingham',intl:'international'};
function tokens(s){s=s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[’'.]/g,'').replace(/&/g,' and ')
  .replace(/[^a-z0-9 ]/g,' ').replace(/\bman u\b/g,'manchester united');
  return s.split(/\s+/).filter(w=>w&&!['fc','afc','cf','the','ac','as'].includes(w)).map(w=>ABBR[w]||w);}
function norm(s){return tokens(s).join('').replace(/\s+/g,'');}
// Damerau (optimal string alignment) distance: a swapped pair of letters counts as one slip
function lev(a,b){const m=a.length,n=b.length;if(!m)return n;if(!n)return m;const d=Array.from({length:m+1},(_,i)=>{const r=new Array(n+1).fill(0);r[0]=i;return r;});
  for(let j=0;j<=n;j++)d[0][j]=j;
  for(let i=1;i<=m;i++)for(let j=1;j<=n;j++){const c=a[i-1]===b[j-1]?0:1;d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+c);
    if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1);}return d[m][n];}
const SUFFIX=['city','united','town','athletic','rovers','hotspur','wanderers','albion','county','argyle','cp','ff'];
function parseQ(q){
  const ans=q.a.map(s=>{const [n,t,al]=s.split('|');return {n,t:+t,keys:new Set([n,...(al?al.split(','):[])].map(norm))};});
  const extra=ans.map(a=>{const w=tokens(a.n),out=[];
    if(w.length>1&&SUFFIX.includes(w[w.length-1]))out.push(w.slice(0,-1).join(''));      // "Leicester" for Leicester City
    if(q.p&&w.length>1)out.push(w[w.length-1]);                                          // surname only
    if(w.length>=3)out.push(w.map(x=>x[0]).join(''));                                    // initials: PSG, QPR, WBA
    return out;});
  const count={};extra.flat().forEach(k=>count[k]=(count[k]||0)+1);
  ans.forEach((a,i)=>extra[i].forEach(k=>{if(k.length>=3&&count[k]===1&&!ans.some((b,j)=>j!==i&&(b.keys.has(k)||norm(b.n).startsWith(k))))a.keys.add(k);}));
  return {...q,answers:ans};
}
// Returns {a, fuzzy} or null. Forgives typos, swapped letters, short forms and unambiguous partial names.
function match(q,guess){
  const g=norm(guess);if(g.length<2)return null;
  for(const a of q.answers)if(a.keys.has(g))return {a,fuzzy:false};
  const pre=q.answers.filter(a=>[...a.keys].some(k=>k.startsWith(g)));
  if(pre.length>1)return null;                                   // too vague, e.g. "Sheffield"
  if(pre.length===1&&g.length>=4)return {a:pre[0],fuzzy:false};  // "Leverk" → Bayer Leverkusen
  const tol=g.length>=12?3:g.length>=8?2:g.length>=5?1:0;if(!tol)return null;
  let best=null,bd=99,tie=false;
  for(const a of q.answers){let ad=99;for(const k of a.keys){const d=lev(g,k);
      const pd=k.length>g.length?lev(g,k.slice(0,g.length)):99;ad=Math.min(ad,d,g.length>=6?pd:99);}
    if(ad<bd){bd=ad;best=a;tie=false;}else if(ad===bd&&a!==best)tie=true;}
  return best&&bd<=tol&&!tie?{a:best,fuzzy:true}:null;
}
function rng(str){let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19;}
  return()=>{h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);h^=h>>>16;return(h>>>0)/4294967296;};}
function shuffle(arr,r){const a=arr.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function dayKey(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
const byId=Object.fromEntries(BANK.map(b=>[b.id,parseQ(b)]));
const wait=ms=>new Promise(r=>setTimeout(r,reduce()?Math.min(ms,150):ms));
const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;

// ================= State =================
// Question rotation: questions you haven't seen come first, then the ones seen longest ago,
// and no two shots in a row come from the same category.
const SEEN_KEY='fairwayfc:seen',PSEEN_KEY='fairwayfc:pseen';
function seenList(k){try{return JSON.parse(localStorage.getItem(k))||[];}catch(e){return [];}}
function markSeen(k,id){try{const l=seenList(k).filter(x=>x!==id);l.push(id);localStorage.setItem(k,JSON.stringify(l.slice(-800)));}catch(e){}}
function rotation(ids,r,catOf,seenKey){
  let list=shuffle(ids,r);
  if(seenKey){const pos=new Map(seenList(seenKey).map((id,i)=>[id,i]));list.sort((a,b)=>(pos.has(a)?pos.get(a):-1)-(pos.has(b)?pos.get(b):-1));}
  if(catOf){const out=[],pool=list.slice();while(pool.length){let i=pool.findIndex(id=>!out.length||catOf(id)!==catOf(out[out.length-1]));if(i<0)i=0;out.push(pool.splice(i,1)[0]);}list=out;}
  return list;
}
const MODE_LABEL={daily:'Daily round',practice:'Practice',local:'Pass & play',room:'Online room'};
function newRound(seed,mode='daily',names=['You'],kits=null,opts=null){
  opts=cleanOpts(mode==='daily'?null:opts);
  const r=rng(seed);
  const course=PARS_BY_LEN[opts.len].map(par=>{const yds=par===3?60+Math.round(r()*6)*5:par===4?120+Math.round(r()*10)*5:190+Math.round(r()*12)*5;
    return {par,yds,bend:(r()-.5)*2,phase:r()*6.28,water:r(),bunk:r(),seed:r()};});
  // The daily course layout is shared, but the questions are shuffled fresh for every round and every player.
  // Only an online room shares one question order, so friends in the room answer the same questions.
  const shared=mode==='room',qr=shared?r:Math.random;
  const cats=THEMES[opts.theme].cats,pool=BANK.filter(b=>!cats||cats.includes(b.cat)).map(b=>b.id);
  const order=rotation(pool.length>=12?pool:BANK.map(b=>b.id),qr,id=>byId[id].cat,shared?null:SEEN_KEY);
  const pidx=d=>rotation(PUTTS.map((p,i)=>p.d===d?i:-1).filter(i=>i>=0),qr,null,shared?null:PSEEN_KEY);
  const players=names.map((n,i)=>({name:String(n).trim().slice(0,16)||'Player',scores:[],kit:kits&&kits[i]?kits[i]:null}));
  const s={v:7,mode,daily:mode==='daily',seed,opts,course,order,qi:0,h:0,players,cp:0,room:null,posted:false,
    porder:{1:pidx(1),2:pidx(2),3:pidx(3)},pi:{1:0,2:0,3:0},pread:null,ppending:false,
    rem:course[0].yds,lie:'tee',strokes:0,phase:'start',ft:0,pending:false,holed:false,picked:false};
  s.scores=players[0].scores;return s;
}
const TODAY=dayKey(),KEY='fairwayfc7:'+TODAY,OTHER='fairwayfc7:game',ACTIVE='fairwayfc7:active';
function readKey(k){try{const s=JSON.parse(localStorage.getItem(k));if(s&&s.v===7&&s.players){s.scores=s.players[s.cp].scores;return s;}}catch(e){}return null;}
function save(){try{localStorage.setItem(state.daily?KEY:OTHER,JSON.stringify(state));localStorage.setItem(ACTIVE,state.daily?'daily':'other');}catch(e){}}
let state=readKey(KEY)||newRound(TODAY,'daily');
if(state.daily&&state.phase==='start'){const f=newRound(TODAY,'daily');state.order=f.order;state.porder=f.porder;}
const hole=()=>state.course[state.h];
const curQ=()=>byId[state.order[state.qi%state.order.length]];
const parOf=p=>p.scores.reduce((t,s,i)=>t+s-state.course[i].par,0);
const totOf=p=>p.scores.reduce((a,b)=>a+b,0);
const toPar=()=>parOf(state.players[state.cp]);
const multi=()=>state.players.length>1;
const curName=()=>state.players[state.cp].name;
const fmtPar=v=>v===0?'E':v>0?'+'+v:'−'+Math.abs(v);

// ================= Kits =================
const KIT_COLOURS=[['#d62828','Red'],['#7a1f3d','Claret'],['#ec5f9b','Pink'],['#f47c20','Orange'],['#f6c90e','Yellow'],['#16803c','Green'],
  ['#5ab3e8','Sky blue'],['#1d4ed8','Blue'],['#13254a','Navy'],['#6b2fa3','Purple'],['#15171c','Black'],['#f4f4f2','White']];
const KIT_PATTERNS=[['plain','Plain'],['stripes','Stripes'],['hoops','Hoops'],['halves','Halves'],['sash','Sash']];
const KIT_PRESETS=[
  {shirt:'#d62828',shirt2:'#f4f4f2',pattern:'plain',shorts:'#f4f4f2',socks:'#d62828',num:9},
  {shirt:'#1d4ed8',shirt2:'#f4f4f2',pattern:'plain',shorts:'#f4f4f2',socks:'#1d4ed8',num:7},
  {shirt:'#f4f4f2',shirt2:'#15171c',pattern:'stripes',shorts:'#15171c',socks:'#15171c',num:11},
  {shirt:'#16803c',shirt2:'#f4f4f2',pattern:'hoops',shorts:'#f4f4f2',socks:'#16803c',num:8},
  {shirt:'#f6c90e',shirt2:'#15171c',pattern:'plain',shorts:'#15171c',socks:'#f6c90e',num:10},
  {shirt:'#7a1f3d',shirt2:'#5ab3e8',pattern:'plain',shorts:'#f4f4f2',socks:'#5ab3e8',num:4},
  {shirt:'#5ab3e8',shirt2:'#f4f4f2',pattern:'plain',shorts:'#13254a',socks:'#5ab3e8',num:17},
  {shirt:'#d62828',shirt2:'#15171c',pattern:'halves',shorts:'#15171c',socks:'#d62828',num:6}];
const HEX=/^#[0-9a-f]{6}$/i;
function cleanKit(k){const d=KIT_PRESETS[0],o={};k=k||{};
  for(const f of ['shirt','shirt2','shorts','socks'])o[f]=HEX.test(k[f])?k[f]:d[f];
  o.pattern=KIT_PATTERNS.some(p=>p[0]===k.pattern)?k.pattern:'plain';const n=parseInt(k.num,10);o.num=n>=1&&n<=99?n:10;return o;}
function savedKit(){try{const k=JSON.parse(localStorage.getItem('fairwayfc:kit'));if(k)return cleanKit(k);}catch(e){}return null;}
function myKit(){return savedKit()||cleanKit(KIT_PRESETS[0]);}
function saveKit(k){try{localStorage.setItem('fairwayfc:kit',JSON.stringify(cleanKit(k)));}catch(e){}}
function curKit(){if(state&&state.players&&multi()&&!state.menu){const p=state.players[state.cp];if(p&&p.kit)return cleanKit(p.kit);}return myKit();}
const lum=h=>{const n=parseInt(h.slice(1),16);return (.299*(n>>16)+.587*((n>>8)&255)+.114*(n&255))/255;};

// ================= Sound =================
const Sound=(()=>{let ctx=null,out=null,muted=false,nb=null,amb=null;
  try{muted=localStorage.getItem('fairwayfc:muted')==='1';}catch(e){}
  // iPhones mute Web Audio when the silent switch is on; a looping silent <audio> element moves the page into the media channel.
  let tag=null;
  function silentWav(){const n=800,b=new Uint8Array(44+n),v=new DataView(b.buffer),w=(o,s)=>{for(let i=0;i<s.length;i++)b[o+i]=s.charCodeAt(i);};
    w(0,'RIFF');v.setUint32(4,36+n,true);w(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,8000,true);v.setUint32(28,8000,true);
    v.setUint16(32,1,true);v.setUint16(34,8,true);w(36,'data');v.setUint32(40,n,true);b.fill(128,44);let s='';b.forEach(x=>s+=String.fromCharCode(x));return 'data:audio/wav;base64,'+btoa(s);}
  function unlockTag(){try{if(!tag){tag=document.createElement('audio');tag.setAttribute('playsinline','');tag.setAttribute('x-webkit-airplay','deny');tag.loop=true;tag.preload='auto';tag.src=silentWav();}
    if(tag.paused){const p=tag.play();if(p&&p.catch)p.catch(()=>{});}}catch(e){}}
  function init(){unlockTag();
    if(ctx){if(ctx.state!=='running')ctx.resume().catch(()=>{});return;}const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    ctx=new AC();out=ctx.createGain();out.gain.value=muted?0:.7;out.connect(ctx.destination);
    nb=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);const d=nb.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;ambience();if(!muted)setTimeout(musicOn,400);
    try{const s=ctx.createBufferSource();s.buffer=ctx.createBuffer(1,1,22050);s.connect(ctx.destination);s.start(0);}catch(e){}if(ctx.state!=='running')ctx.resume().catch(()=>{});}
  const ok=()=>ctx&&!muted&&(typeof prefs==='undefined'||prefs.fx);
  function tone(type,f0,f1,dur,vol=.3,delay=0){if(!ok())return;const t=ctx.currentTime+delay,o=ctx.createOscillator(),g=ctx.createGain();
    o.type=type;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);
    g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g).connect(out);o.start(t);o.stop(t+dur+.02);}
  function noise(dur,{type='bandpass',f0=1000,f1=1000,q=1,vol=.3,delay=0,attack=.005}={}){if(!ok())return;const t=ctx.currentTime+delay,s=ctx.createBufferSource();
    s.buffer=nb;const f=ctx.createBiquadFilter();f.type=type;f.Q.value=q;f.frequency.setValueAtTime(f0,t);f.frequency.exponentialRampToValueAtTime(f1,t+dur);
    const g=ctx.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+attack);g.gain.exponentialRampToValueAtTime(.001,t+dur);
    s.connect(f).connect(g).connect(out);s.start(t,Math.random());s.stop(t+dur+.05);}
  function ambience(){ // soft breeze and the odd bird
    const s=ctx.createBufferSource();s.buffer=nb;s.loop=true;const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=380;
    const g=ctx.createGain();g.gain.value=.05;s.connect(f).connect(g).connect(out);s.start();amb=g;
    setInterval(()=>{if(!ok()||Math.random()<.5)return;const b=2400+Math.random()*1500;for(let i=0;i<3;i++)tone('sine',b,b*1.25,.07,.04,i*.11);},4000);}
  // ---- settings: effects / commentary / music ----
  let prefs={fx:true,voice:true,music:true};try{Object.assign(prefs,JSON.parse(localStorage.getItem('fairwayfc:audio'))||{});}catch(e){}
  const savePrefs=()=>{try{localStorage.setItem('fairwayfc:audio',JSON.stringify(prefs));}catch(e){}};
  // ---- music: a gentle looping groove, scheduled ahead on the audio clock ----
  let musicBus=null,musicTimer=null,nextBar=0,bar=0;
  const CHORDS=[[60,64,67,71],[57,60,64,67],[53,57,60,64],[55,59,62,65]];   // Cmaj7, Am7, Fmaj7, G7
  const hz=m=>440*Math.pow(2,(m-69)/12);
  function note(f,t,dur,vol,type='triangle',bus=musicBus){const o=ctx.createOscillator(),gn=ctx.createGain(),lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=2200;
    o.type=type;o.frequency.value=f;gn.gain.setValueAtTime(.0001,t);gn.gain.exponentialRampToValueAtTime(vol,t+.02);gn.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(lp).connect(gn).connect(bus);o.start(t);o.stop(t+dur+.05);}
  function scheduleBar(t){const c=CHORDS[bar%4],beat=60/96;
    c.forEach(m=>note(hz(m-12),t,beat*4,.022,'sine'));                       // pad
    note(hz(c[0]-24),t,beat*1.8,.05,'triangle');note(hz(c[0]-24),t+beat*2,beat*1.8,.045,'triangle'); // bass
    const arp=[0,2,1,3,2,1,3,2];arp.forEach((k,i)=>note(hz(c[k]+12),t+i*beat/2,beat*.45,.018,'sine')); // pluck
    for(let i=0;i<4;i++){const s=ctx.createBufferSource();s.buffer=nb;const f=ctx.createBiquadFilter();f.type='highpass';f.frequency.value=7000;const gn=ctx.createGain();
      const tt=t+i*beat+beat/2;gn.gain.setValueAtTime(.012,tt);gn.gain.exponentialRampToValueAtTime(.0001,tt+.05);s.connect(f).connect(gn).connect(musicBus);s.start(tt,Math.random());s.stop(tt+.06);} // hats
    bar++;}
  function musicOn(){if(!ctx||musicTimer||!prefs.music)return;musicBus=ctx.createGain();musicBus.gain.value=.0001;musicBus.connect(out);
    musicBus.gain.exponentialRampToValueAtTime(.9,ctx.currentTime+2);nextBar=ctx.currentTime+.1;
    musicTimer=setInterval(()=>{while(nextBar<ctx.currentTime+1.2){scheduleBar(nextBar);nextBar+=4*60/96;}},300);}
  function musicOff(){if(musicTimer){clearInterval(musicTimer);musicTimer=null;}if(musicBus){const b=musicBus;b.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.6);setTimeout(()=>b.disconnect(),800);musicBus=null;}}
  function duck(on){if(musicBus)musicBus.gain.setTargetAtTime(on?.35:.9,ctx.currentTime,.2);}
  // ---- commentary: the browser's own speech voice, British if available ----
  let voice=null;const pickVoice=()=>{try{const vs=speechSynthesis.getVoices();voice=vs.find(v=>/en-GB/i.test(v.lang)&&/male|daniel|arthur|george|oliver/i.test(v.name))||vs.find(v=>/en-GB/i.test(v.lang))||vs.find(v=>/^en/i.test(v.lang))||null;}catch(e){}};
  try{pickVoice();speechSynthesis.onvoiceschanged=pickVoice;}catch(e){}
  const clipIds=new Set(window.FAIRWAY_VOICE_IDS||[]),clipCache=new Map();let clipSrc=null,clipQueue=[];
  const fnv=s=>{let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h.toString(16).padStart(8,'0');};
  const loadClip=id=>{if(!clipCache.has(id))clipCache.set(id,fetch((window.FAIRWAY_VOICE||'')+id+'.mp3').then(r=>{if(!r.ok)throw 0;return r.arrayBuffer();}).then(b=>new Promise((res,rej)=>ctx.decodeAudioData(b,res,rej))).catch(()=>null));return clipCache.get(id);};
  async function playClips(texts){try{if(clipSrc){clipSrc.onended=null;clipSrc.stop();}}catch(e){}clipQueue=texts.slice();const mine=clipQueue;
    const bufs=await Promise.all(texts.map(t=>loadClip(fnv(t))));if(mine!==clipQueue)return;
    let t=ctx.currentTime+.02;duck(true);const g2=ctx.createGain();g2.gain.value=1.35;g2.connect(out);
    bufs.forEach((b,i)=>{if(!b)return;const s=ctx.createBufferSource();s.buffer=b;s.connect(g2);s.start(t);t+=b.duration+.08;if(i===bufs.length-1){clipSrc=s;s.onended=()=>duck(false);}});}
  function say(text){if(muted||!prefs.voice)return;const texts=Array.isArray(text)?text:[text];
    if(ctx&&window.FAIRWAY_VOICE&&texts.every(t=>clipIds.has(fnv(t)))){playClips(texts);return;}
    text=texts.join(' ');if(!window.speechSynthesis)return;try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);if(voice)u.voice=voice;u.lang=voice?voice.lang:'en-GB';
    u.rate=1.04;u.pitch=.95;u.volume=1;u.onstart=()=>duck(true);u.onend=()=>duck(false);speechSynthesis.speak(u);}catch(e){}}
  const fxOk=()=>ok()&&prefs.fx;
  return{init,get muted(){return muted},get running(){return !!ctx&&ctx.state==='running'},get prefs(){return prefs},say,
    setPref(k,v){prefs[k]=v;savePrefs();if(k==='music'){v?musicOn():musicOff();}if(k==='voice'&&!v)try{speechSynthesis.cancel();}catch(e){}},
    music(){musicOn();},
    whistle(ms){if(!fxOk())return;const t=ctx.currentTime,o=ctx.createOscillator(),g2=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(1800,t);o.frequency.exponentialRampToValueAtTime(700,t+ms/1000);
      g2.gain.setValueAtTime(.0001,t);g2.gain.exponentialRampToValueAtTime(.035,t+.15);g2.gain.exponentialRampToValueAtTime(.0001,t+ms/1000);o.connect(g2).connect(out);o.start(t);o.stop(t+ms/1000+.05);},
    drumroll(ms){if(!fxOk())return;const n=Math.floor(ms/45);for(let i=0;i<n;i++)noise(.04,{type:'bandpass',f0:220,f1:180,q:2,vol:.05+.15*i/n,delay:i*.045});},
    fanfare(kind){if(!fxOk())return;const t=ctx.currentTime,seq=kind==='eagle'?[72,76,79,84,88]:kind==='birdie'?[72,76,79,84]:kind==='par'?[67,72]:[];
      seq.forEach((m,i)=>{note(hz(m),t+i*.11,.32,.12,'square',out);note(hz(m+12),t+i*.11,.3,.04,'sine',out);});
      if(kind==='bogey'){[0,1,2].forEach(i=>{const o=ctx.createOscillator(),g2=ctx.createGain();o.type='sawtooth';const f=hz(58-i*2);o.frequency.setValueAtTime(f,t+i*.32);o.frequency.linearRampToValueAtTime(f*.94,t+i*.32+.3);
        g2.gain.setValueAtTime(.0001,t+i*.32);g2.gain.exponentialRampToValueAtTime(.06,t+i*.32+.04);g2.gain.exponentialRampToValueAtTime(.0001,t+i*.32+(i===2?.9:.3));o.connect(g2).connect(out);o.start(t+i*.32);o.stop(t+i*.32+1);});}},
    murmur(){if(!fxOk())return;noise(3.5,{type:'bandpass',f0:420,f1:520,q:.6,vol:.06,attack:.8});},
    gust(){if(!fxOk())return;noise(2.5,{type:'bandpass',f0:300,f1:900,q:.5,vol:.07,attack:1});},
    pop(){if(!fxOk())return;tone('sine',700,1100,.07,.08);},
    toggle(){muted=!muted;try{localStorage.setItem('fairwayfc:muted',muted?'1':'0');}catch(e){}init();if(out)out.gain.value=muted?0:.7;if(muted){try{speechSynthesis.cancel();}catch(e){}}else musicOn();return muted;},
    swing(){noise(.3,{f0:400,f1:2800,q:2,vol:.38,attack:.2});},
    strike(big){tone('sine',big?150:125,48,.18,.75);noise(.08,{type:'bandpass',f0:1500,f1:500,q:1,vol:.55});tone('triangle',440,170,.05,.25);},
    step(){noise(.07,{type:'lowpass',f0:600,f1:180,vol:.2});},
    whoosh(){noise(1.4,{f0:1900,f1:450,q:1.5,vol:.13,attack:.1});},
    thud(){tone('sine',120,55,.18,.5);noise(.12,{type:'lowpass',f0:600,f1:200,vol:.25});},
    rough(){noise(.4,{type:'bandpass',f0:1800,f1:700,q:.8,vol:.3});tone('sine',100,60,.15,.3);},
    splash(){noise(.8,{type:'lowpass',f0:3500,f1:250,vol:.55,attack:.01});tone('sine',600,140,.25,.15,.03);noise(.3,{f0:1200,f1:500,q:3,vol:.15,delay:.25});},
    putt(){tone('sine',170,70,.1,.5);noise(.05,{type:'bandpass',f0:1100,f1:500,vol:.28});},
    roll(d){noise(d,{type:'lowpass',f0:500,f1:250,vol:.12,attack:.05});},
    cup(){[0,.09,.16,.22].forEach((d,i)=>tone('sine',1600-i*140,1500-i*140,.08,.22,d));tone('sine',220,110,.12,.25,.3);},
    lip(){tone('sine',1400,1300,.06,.2);tone('sine',1200,1100,.06,.15,.08);},
    cheer(big){const len=big?3:1.7;noise(len,{f0:900,f1:1400,q:.7,vol:big?.45:.28,attack:.25});
      for(let i=0;i<(big?45:20);i++)noise(.05,{type:'highpass',f0:2500,f1:2500,vol:.25,delay:.15+Math.random()*(len-.4)});
      if(big)[523,659,784,1047].forEach((f,i)=>tone('triangle',f,f,.35,.18,.1+i*.12));},
    clap(){for(let i=0;i<14;i++)noise(.05,{type:'highpass',f0:2200,f1:2200,vol:.2,delay:Math.random()*1.1});},
    groan(){[110,138,165].forEach(f=>tone('sawtooth',f,f*.7,1.1,.05));noise(1.1,{type:'lowpass',f0:500,f1:250,vol:.18,attack:.15});},
    ooh(){noise(1.1,{f0:500,f1:950,q:2,vol:.25,attack:.25});},
    tick(last){tone('square',last?1320:880,last?1320:880,.05,.12);},
    tee(){tone('triangle',660,660,.1,.22);tone('triangle',990,990,.2,.22,.1);},
    click(){tone('square',1200,900,.03,.08);}};
})();
// Keep trying to unlock audio on every kind of tap until it is running (iOS only accepts some of these).
['pointerdown','touchend','click','keydown'].forEach(ev=>document.addEventListener(ev,()=>{if(!Sound.running)Sound.init();},{passive:true,capture:true}));

// ================= 3D world =================
const G={ok:false};
(function init3D(){
  try{if(!window.THREE)throw 0;
    if(THREE.ColorManagement)THREE.ColorManagement.legacyMode=false;
    const canvas=$('#gl');
    const dpr=devicePixelRatio||1;
    const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(dpr,2.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
    const scene=new THREE.Scene();
    // sky
    const sk=document.createElement('canvas');sk.width=2;sk.height=256;const sg=sk.getContext('2d');const gr=sg.createLinearGradient(0,0,0,256);
    gr.addColorStop(0,'#1f4f9e');gr.addColorStop(.38,'#5e9be0');gr.addColorStop(.47,'#a9cdf0');gr.addColorStop(.5,'#ffe2b8');gr.addColorStop(.53,'#f6c08a');gr.addColorStop(1,'#6f8f5a');sg.fillStyle=gr;sg.fillRect(0,0,2,256);
    const skyTex=new THREE.CanvasTexture(sk);skyTex.encoding=THREE.sRGBEncoding;skyTex.mapping=THREE.EquirectangularReflectionMapping;scene.background=skyTex;
    try{const pm=new THREE.PMREMGenerator(renderer);scene.environment=pm.fromEquirectangular(skyTex).texture;pm.dispose();}catch(e){}
    scene.fog=new THREE.Fog(0xdde6e4,380,1500);
    // the sun: a warm disc with a soft glow, always far away in the same direction
    const SUNDIR=new THREE.Vector3(-.35,.32,-1).normalize();
    const sunTex=(()=>{const c=document.createElement('canvas');c.width=c.height=256;const g2=c.getContext('2d'),rg=g2.createRadialGradient(128,128,0,128,128,128);
      rg.addColorStop(0,'rgba(255,250,235,1)');rg.addColorStop(.07,'rgba(255,240,200,1)');rg.addColorStop(.14,'rgba(255,214,150,.55)');rg.addColorStop(.4,'rgba(255,190,120,.16)');rg.addColorStop(1,'rgba(255,170,100,0)');
      g2.fillStyle=rg;g2.fillRect(0,0,256,256);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t;})();
    const sunSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:sunTex,transparent:true,depthWrite:false,fog:false,blending:THREE.AdditiveBlending}));sunSprite.scale.set(420,420,1);sunSprite.renderOrder=-1;scene.add(sunSprite);
    const camera=new THREE.PerspectiveCamera(52,1,.1,3000);
    scene.add(new THREE.HemisphereLight(0xd6e6ff,0x4f6b2c,.7));
    const sun=new THREE.DirectionalLight(0xffd9a6,1.55);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.radius=3;
    Object.assign(sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:1,far:160});sun.shadow.bias=-.0008;scene.add(sun,sun.target);
    // ground
    const tex=(w,h,draw,rep)=>{const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);
      t.wrapS=t.wrapT=THREE.RepeatWrapping;if(rep)t.repeat.set(rep[0],rep[1]);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;return t;};
    const speckle=(base,dots)=>(g,w,h)=>{g.fillStyle=base;g.fillRect(0,0,w,h);for(let i=0;i<w*h/6;i++){g.fillStyle=dots[i%dots.length];g.globalAlpha=.35;g.fillRect(Math.random()*w,Math.random()*h,1.5,1.5);}g.globalAlpha=1;};
    const blades=(base,cols,n)=>(g,w,h)=>{g.fillStyle=base;g.fillRect(0,0,w,h);
      for(let i=0;i<10;i++){const x=Math.random()*w,y=Math.random()*h,r=20+Math.random()*50,rg=g.createRadialGradient(x,y,0,x,y,r);rg.addColorStop(0,'rgba(0,30,0,.10)');rg.addColorStop(1,'rgba(0,30,0,0)');g.fillStyle=rg;g.fillRect(0,0,w,h);}
      for(let i=0;i<n;i++){const x=Math.random()*w,y=Math.random()*h,l=2+Math.random()*4;g.strokeStyle=cols[i%cols.length];g.globalAlpha=.55;g.lineWidth=1;g.beginPath();g.moveTo(x,y);g.lineTo(x+(Math.random()-.5)*1.6,y-l);g.stroke();}g.globalAlpha=1;};
    const roughTex=tex(256,256,blades('#3f7f2f',['#2f6224','#4f9a3a','#5aa646','#2a5a20','#6bb453'],5200),[150,150]);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(4000,4000),new THREE.MeshLambertMaterial({map:roughTex}));
    ground.rotation.x=-Math.PI/2;ground.position.y=-.4;ground.receiveShadow=true;scene.add(ground);
    const fairTex=tex(64,256,(g,w,h)=>{g.fillStyle='#6fb94a';g.fillRect(0,0,w,h);g.fillStyle='#82cd59';g.fillRect(0,0,w,h/2);
      for(let i=0;i<1600;i++){g.fillStyle=Math.random()<.5?'rgba(255,255,255,.06)':'rgba(0,40,0,.07)';g.fillRect(Math.random()*w,Math.random()*h,1,2);}},null);
    const greenTex=tex(256,256,(g,w,h)=>{g.fillStyle='#8ed661';g.fillRect(0,0,w,h);
      for(let i=0;i<8;i++){const lg=g.createLinearGradient(i*32,0,i*32+32,0);const c=i%2?'rgba(170,236,120,':'rgba(120,200,80,';lg.addColorStop(0,c+'0)');lg.addColorStop(.25,c+'.55)');lg.addColorStop(.75,c+'.55)');lg.addColorStop(1,c+'0)');g.fillStyle=lg;g.fillRect(i*32,0,32,h);}
      const rg=g.createRadialGradient(w*.3,h*.3,10,w*.5,h*.5,w*.75);rg.addColorStop(0,'rgba(255,255,255,.10)');rg.addColorStop(1,'rgba(0,40,0,.14)');g.fillStyle=rg;g.fillRect(0,0,w,h);
      for(let i=0;i<1400;i++){g.fillStyle=Math.random()<.5?'rgba(255,255,255,.05)':'rgba(0,50,0,.06)';g.fillRect(Math.random()*w,Math.random()*h,1,1);}},null);
    greenTex.wrapS=greenTex.wrapT=THREE.ClampToEdgeWrapping;
    // distant hills
    const hillMat=new THREE.MeshStandardMaterial({color:0x3f7a40,roughness:1});
    {const N=320,blob=new THREE.IcosahedronGeometry(1,1),ring=new THREE.InstancedMesh(blob,new THREE.MeshLambertMaterial(),N),m4=new THREE.Matrix4(),q=new THREE.Quaternion(),cols=[0x2c5a2c,0x355f2a,0x26502a,0x3b6a33,0x2f5530];
     for(let i=0;i<N;i++){const a=i/N*Math.PI*2+Math.random()*.02,r=560+Math.random()*120,sx=10+Math.random()*12,sy=12+Math.random()*16;
       m4.compose(new THREE.Vector3(Math.cos(a)*r,sy*.55-2,-260+Math.sin(a)*r),q,new THREE.Vector3(sx,sy,sx));ring.setMatrixAt(i,m4);ring.setColorAt(i,new THREE.Color(cols[i%cols.length]));}
     scene.add(ring);}
    for(let i=0;i<14;i++){const m=new THREE.Mesh(new THREE.SphereGeometry(1,32,16),hillMat);const a=i/14*Math.PI*2;
      m.position.set(Math.cos(a)*900,-40,-300+Math.sin(a)*900);m.scale.set(220+Math.random()*200,90+Math.random()*80,220);scene.add(m);}
    // clouds
    const cc=document.createElement('canvas');cc.width=256;cc.height=128;const cg2=cc.getContext('2d');
    for(let i=0;i<14;i++){const x=40+Math.random()*176,y=50+Math.random()*40,r=26+Math.random()*30,rg=cg2.createRadialGradient(x,y,0,x,y,r);rg.addColorStop(0,'rgba(255,255,255,.95)');rg.addColorStop(1,'rgba(255,255,255,0)');cg2.fillStyle=rg;cg2.beginPath();cg2.arc(x,y,r,0,Math.PI*2);cg2.fill();}
    const cloudTex=new THREE.CanvasTexture(cc);cloudTex.encoding=THREE.sRGBEncoding;const clouds=[];
    for(let i=0;i<16;i++){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:cloudTex,transparent:true,depthWrite:false,fog:false,opacity:.9}));
      const a=Math.random()*Math.PI*2,r=380+Math.random()*500;sp.position.set(Math.cos(a)*r,150+Math.random()*120,-250+Math.sin(a)*r);const sc=140+Math.random()*160;sp.scale.set(sc,sc*.5,1);scene.add(sp);clouds.push(sp);}
    // a few birds circling overhead
    const birdM=new THREE.MeshBasicMaterial({color:0x22313f,side:THREE.DoubleSide,fog:false}),birds=[];
    for(let i=0;i<7;i++){const b=new THREE.Group(),wg=new THREE.PlaneGeometry(1.6,.5);wg.translate(.8,0,0);
      const l=new THREE.Mesh(wg,birdM),r2=new THREE.Mesh(wg,birdM);r2.rotation.y=Math.PI;b.add(l,r2);b.userData={l,r:r2,a:Math.random()*6.28,rad:40+Math.random()*60,h:45+Math.random()*25,sp:.12+Math.random()*.1,ph:Math.random()*6};scene.add(b);birds.push(b);}
    // ball, shadow, trail
    // a classic black-and-white football
    const bc=document.createElement('canvas');bc.width=512;bc.height=256;const bx=bc.getContext('2d');bx.fillStyle='#f7f7f4';bx.fillRect(0,0,512,256);
    const pent=(x,y,r)=>{bx.beginPath();for(let i=0;i<5;i++){const a=-Math.PI/2+i*Math.PI*2/5;bx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);}bx.closePath();bx.fill();};
    bx.fillStyle='#16181c';[[64,40],[192,40],[320,40],[448,40],[0,128],[128,128],[256,128],[384,128],[512,128],[64,216],[192,216],[320,216],[448,216]].forEach(([x,y])=>pent(x,y,y===128?30:22));
    bx.strokeStyle='rgba(0,0,0,.25)';bx.lineWidth=2;for(let x=0;x<512;x+=64){bx.beginPath();bx.moveTo(x,0);bx.lineTo(x+32,256);bx.stroke();}
    const ballTex=new THREE.CanvasTexture(bc);ballTex.encoding=THREE.sRGBEncoding;ballTex.anisotropy=4;
    const ball=new THREE.Mesh(new THREE.SphereGeometry(.34,40,28),new THREE.MeshStandardMaterial({map:ballTex,roughness:.35}));ball.castShadow=true;scene.add(ball);
    const ballBlob=new THREE.Mesh(new THREE.CircleGeometry(.45,28),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.3,depthWrite:false}));
    ballBlob.rotation.x=-Math.PI/2;scene.add(ballBlob);
    const trailN=80,trailGeo=new THREE.BufferGeometry();trailGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(trailN*3),3));
    const trail=new THREE.Line(trailGeo,new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.9}));trail.frustumCulled=false;scene.add(trail);
    // TV-style shot tracer: a glowing comet behind the ball, tinted by how rare the answer was
    const cometN=28,cometGeo=new THREE.BufferGeometry();cometGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(cometN*3),3));cometGeo.setAttribute('color',new THREE.BufferAttribute(new Float32Array(cometN*3),3));
    const comet=new THREE.Points(cometGeo,new THREE.PointsMaterial({size:.9,vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));comet.frustumCulled=false;comet.visible=false;scene.add(comet);
    // footballer: faces -z (towards the target) and stands behind the ball, which sits at the rig's origin
    const rig=new THREE.Group();scene.add(rig);
    const golfer=new THREE.Group();golfer.position.set(-.12,0,1.6);rig.add(golfer);
    const fabric=(c,sheen)=>new THREE.MeshPhysicalMaterial({color:c,roughness:.78,sheen:1,sheenRoughness:.6,sheenColor:new THREE.Color(sheen)});
    const shirt=fabric(0xf26f17,0xffb27a),shorts=fabric(0xf4f4f2,0xffffff),sock=fabric(0xf26f17,0xffb27a),sockBand=fabric(0x0b1626,0x445),
      skin=new THREE.MeshPhysicalMaterial({color:0xd99b72,roughness:.55,clearcoat:.08,clearcoatRoughness:.6}),
      boot=new THREE.MeshPhysicalMaterial({color:0x111318,roughness:.3,clearcoat:.6,clearcoatRoughness:.2}),bootFlash=new THREE.MeshStandardMaterial({color:0xffc929,roughness:.4}),
      sole=new THREE.MeshStandardMaterial({color:0xe9e9e4,roughness:.6}),hairM=new THREE.MeshStandardMaterial({color:0x2a1d14,roughness:.85}),
      dark=new THREE.MeshStandardMaterial({color:0x1a1210,roughness:.5}),trim=fabric(0x0b1626,0x334);
    const V=(x,y,z)=>new THREE.Vector3(x,y,z),UP=V(0,1,0);
    // a smooth tapered limb: a lathe shaped like a real muscle, from a (top) to b (bottom)
    function muscle(parent,a,b,radii,m){const len=a.distanceTo(b),n=radii.length;
      const pts=radii.map((r,i)=>new THREE.Vector2(Math.max(.001,r),len*(1-i/(n-1))-len/2));pts.unshift(new THREE.Vector2(.001,len/2+radii[0]*.6));pts.push(new THREE.Vector2(.001,-len/2-radii[n-1]*.6));pts.reverse();  // bottom to top so the surface faces outwards
      const o=new THREE.Mesh(new THREE.LatheGeometry(pts,24),m);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(UP,a.clone().sub(b).normalize());o.castShadow=true;parent.add(o);return o;}
    function blob(parent,geo,m,x,y,z,sx=1,sy=1,sz=1){const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;parent.add(o);return o;}
    const S=(r,w=28,h=20)=>new THREE.SphereGeometry(r,w,h);
    // legs: hip -> knee -> ankle; each joint is a group so the kick can bend it
    const legs={};
    for(const [side,x] of [['L',-.105],['R',.105]]){
      const hip=new THREE.Group();hip.position.set(x,.93,0);golfer.add(hip);
      muscle(hip,V(0,.02,0),V(0,-.22,.005),[.098,.1,.096,.09],shorts);                     // shorts leg
      muscle(hip,V(0,-.16,0),V(0,-.45,.01),[.083,.08,.072,.062,.055],skin);               // thigh
      const knee=new THREE.Group();knee.position.set(0,-.45,.005);hip.add(knee);
      blob(knee,S(.052),skin,0,0,-.012);                                                   // kneecap
      muscle(knee,V(0,-.03,0),V(0,-.2,.01),[.056,.063,.062,.055],sock);                    // sock over the calf
      muscle(knee,V(0,-.2,.01),V(0,-.39,.0),[.054,.046,.038,.034],sock);
      muscle(knee,V(0,-.05,0),V(0,-.085,.002),[.058,.06,.058],sockBand);                    // sock band
      // boot: a shaped toe and heel with a sole and a flash of colour
      const ft=new THREE.Group();ft.position.set(0,-.41,0);knee.add(ft);
      blob(ft,S(.05),boot,0,-.02,.025,1,.9,1.2);
      blob(ft,S(.052),boot,0,-.04,-.085,.95,.62,1.75);
      blob(ft,new THREE.BoxGeometry(.095,.016,.27),sole,0,-.072,-.05);
      blob(ft,new THREE.BoxGeometry(.004,.03,.12),bootFlash,x>0?.05:-.05,-.04,-.06);
      legs[side]={hip,knee,foot:ft};}
    // hips and shorts
    blob(golfer,S(.19),shorts,0,.97,0,1.1,.5,.8);
    blob(golfer,new THREE.TorusGeometry(.172,.012,8,32),trim,0,1.0,0,1.1,.83,1).rotation.x=Math.PI/2;
    // torso: waist, ribcage, chest and shoulders from one shaped lathe, plus trapezius and shoulder caps
    const torso=new THREE.Group();torso.position.set(0,.98,0);golfer.add(torso);
    const prof=[[.155,0],[.15,.08],[.162,.18],[.185,.3],[.2,.4],[.205,.46],[.19,.52],[.14,.57],[.075,.6]].map(([r,y])=>new THREE.Vector2(r,y));
    blob(torso,new THREE.LatheGeometry(prof,40),shirt,0,0,0,1.2,1,.74);
    blob(torso,S(.11),shirt,-.12,.53,.01,1.1,.55,.8);blob(torso,S(.11),shirt,.12,.53,.01,1.1,.55,.8);  // trapezius
    blob(torso,new THREE.TorusGeometry(.072,.018,10,28),trim,0,.6,-.005,1,1,1.05).rotation.x=Math.PI/2.15;
    blob(torso,new THREE.BoxGeometry(.012,.11,.01),trim,0,.53,-.15).rotation.x=-.25;         // v-neck placket
    // shirt number and name bar on the back
    const nc=document.createElement('canvas');nc.width=256;nc.height=256;const nx=nc.getContext('2d');nx.fillStyle='#fff';nx.textAlign='center';nx.textBaseline='middle';
    nx.font='900 34px "Lilita One", "Arial Black", Arial';nx.fillText('FAIRWAY',128,48);nx.font='900 150px "Lilita One", "Arial Black", Arial';nx.fillText('10',128,150);
    const numTex=new THREE.CanvasTexture(nc);numTex.encoding=THREE.sRGBEncoding;numTex.anisotropy=4;G.kitMats={shirt,shorts,sock,sockBand,trim};G.numCanvas=nc;G.numTex=numTex;
    const num=new THREE.Mesh(new THREE.PlaneGeometry(.26,.26),new THREE.MeshStandardMaterial({map:numTex,transparent:true,roughness:.7}));num.position.set(0,.34,.152);num.rotation.x=-.04;torso.add(num);
    // neck and head with a face, ears and a short haircut
    muscle(torso,V(0,.66,.005),V(0,.56,0),[.05,.054,.058],skin);
    const head=new THREE.Group();head.position.set(0,.79,-.012);torso.add(head);
    blob(head,S(.1,32,24),skin,0,0,0,.9,1.13,1);                                         // cranium
    blob(head,S(.068,28,20),skin,0,-.052,-.018,.92,.72,.86);                             // jaw
    blob(head,S(.02,12,10),skin,0,-.02,-.101,.8,1,1.25);                                 // nose
    for(const sx of [-1,1]){blob(head,S(.024,12,10),skin,.09*sx,-.005,.008,.5,1,.8);     // ears
      blob(head,S(.011,10,8),dark,.034*sx,.004,-.09);                                    // eyes
      blob(head,new THREE.BoxGeometry(.032,.007,.01),hairM,.035*sx,.026,-.093);}           // brows
    blob(head,new THREE.SphereGeometry(.106,32,20,0,Math.PI*2,0,Math.PI*.5),hairM,0,.012,.006,.93,1.08,1.03);  // hair
    blob(head,S(.05,20,14),hairM,0,.066,-.05,1.45,.38,.75);                              // fringe
    // arms: shoulder cap, sleeve, upper arm, elbow, forearm, hand
    const arms={};
    for(const [side,x] of [['L',-.235],['R',.235]]){
      const sh=new THREE.Group();sh.position.set(x,.5,0);torso.add(sh);const o=x>0?1:-1;
      blob(sh,S(.075),shirt,0,0,0,1,1,.95);
      muscle(sh,V(0,0,0),V(.012*o,-.15,0),[.07,.068,.064],shirt);                       // sleeve
      muscle(sh,V(.012*o,-.1,0),V(.02*o,-.27,0),[.052,.05,.044,.038],skin);              // upper arm
      muscle(sh,V(.02*o,-.27,0),V(.03*o,-.5,-.035),[.04,.042,.036,.03,.026],skin);       // forearm
      blob(sh,S(.034),skin,.033*o,-.54,-.04,.8,1.3,.55);                                 // hand
      blob(sh,S(.014),skin,.012*o,-.52,-.055,1,1.6,1);                                   // thumb
      sh.rotation.z=-.1*o;arms[side]=sh;}
    const club=new THREE.Group(),driver=new THREE.Group(),putter=new THREE.Group(),shoulder=new THREE.Group(); // kept so older code paths stay harmless
    // course group
    const course=new THREE.Group();scene.add(course);
    const fx=new THREE.Group();scene.add(fx);
    Object.assign(G,{ok:true,roughTex,comet,cometGeo,cometN,quality:'high',gfxPref:'auto',clouds,birds,renderer,scene,camera,sun,ball,blob:ballBlob,trail,trailGeo,trailN,rig,golfer,torso,shoulder,club,driver,putter,head,legs,arms,course,fx,fairTex,greenTex,idle:false,
      look:new THREE.Vector3(),goalPos:new THREE.Vector3(0,5,10),goalLook:new THREE.Vector3(0,0,-50),rate:4,flag:null,water:null,follow:null,parts:[]});
    function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w<h?60:48;
      const card=$('#card'),ch=card?card.getBoundingClientRect().height:0,shift=Math.min(h*.45,ch)*.9;
      if(shift>4)camera.setViewOffset(w,h+shift,0,shift,w,h);else camera.clearViewOffset();camera.updateProjectionMatrix();}
    addEventListener('resize',resize);resize();G.resize=resize;
    if(window.ResizeObserver)new ResizeObserver(()=>resize()).observe($('#card'));
    // Graphics quality is decided ONCE and never changes mid-game.
    // 'auto' measures the first few seconds on the menu, remembers the answer on this device, and sticks to it.
    const SUNOFF=new THREE.Vector3(-34,46,-60);let last=performance.now(),fN=0,fT=0,measuring=false;
    function applyQuality(level){const hi=level==='high';renderer.setPixelRatio(hi?Math.min(dpr,2.5):Math.min(dpr,1.75));
      if(renderer.shadowMap.enabled!==hi){renderer.shadowMap.enabled=hi;sun.castShadow=hi;scene.traverse(o=>{if(o.material)o.material.needsUpdate=true;});}
      G.quality=level;resize();}
    G.setQuality=pref=>{try{localStorage.setItem('fairwayfc:gfx',pref);}catch(e){}G.gfxPref=pref;
      if(pref==='auto'){let saved=null;try{saved=localStorage.getItem('fairwayfc:gfxAuto2');localStorage.removeItem('fairwayfc:gfxAuto');}catch(e){}if(saved){applyQuality(saved);measuring=false;}else{applyQuality('high');fN=0;fT=0;measuring=true;}}
      else{measuring=false;applyQuality(pref);}};
    let gp='auto';try{gp=localStorage.getItem('fairwayfc:gfx')||'auto';}catch(e){}
    G.setQuality(gp);
    renderer.setAnimationLoop(now=>{const raw=(now-last)/1000,dt=Math.min(.1,raw);last=now;
      if(measuring&&!document.hidden&&raw<.5&&now>6000&&!G.follow){fN++;fT+=raw;if(fN>=240){measuring=false;const level=fT/fN>.036?'low':'high';try{localStorage.setItem('fairwayfc:gfxAuto2',level);}catch(e){}if(level!==G.quality)applyQuality(level);}}
      if(G.follow)G.follow(dt);
      const k=1-Math.exp(-dt*G.rate);camera.position.lerp(G.goalPos,k);G.look.lerp(G.goalLook,k);camera.lookAt(G.look);
      const t=now/1000;
      if(G.flag){const p=G.flag.geometry.attributes.position,base=G.flag.userData.base,amp=G.flag.userData.party?.45:.18;
        for(let i=0;i<p.count;i++){const x=base[i*3];p.setZ(i,Math.sin(x*2.2-t*(G.flag.userData.party?14:5))*amp*(x+1.3)/2.6);}p.needsUpdate=true;}
      if(G.water)G.water.material.color.setHSL(.57,.62,.5+Math.sin(t*1.5)*.03);
      for(const cl of G.clouds){cl.position.x+=dt*4;if(cl.position.x>950)cl.position.x=-950;}
      for(const b of G.birds){const u=b.userData;u.a+=dt*u.sp;const cx=G.ball.position.x,cz=G.ball.position.z-80;b.position.set(cx+Math.cos(u.a)*u.rad,u.h+Math.sin(t*.7+u.ph)*3,cz+Math.sin(u.a)*u.rad);
        b.rotation.y=-u.a;const f=Math.sin(t*9+u.ph)*.6;u.l.rotation.x=f;u.r.rotation.x=-f;}
      G.parts=G.parts.filter(p=>p.update(dt));
      if(G.idle&&G.rig.visible){G.shoulder.rotation.x=Math.sin(t*1.7)*.045;G.torso.scale.y=1+Math.sin(t*1.3)*.006;}
      if(G.crowd&&G.crowd.jump>0){G.crowd.jump-=dt*.6;G.crowd.pose(t);if(G.crowd.jump<=0)G.crowd.pose(0);}
      sun.position.copy(ball.position).add(SUNOFF);sun.target.position.copy(ball.position);sunSprite.position.copy(camera.position).addScaledVector(SUNDIR,900);
      if(G.treeTime)G.treeTime.value=t;if(G.waterTex)G.waterTex.offset.set(t*.012,t*.02);
      renderer.render(scene,camera);});
  }catch(e){G.ok=false;}
})();

// --- foliage geometry: soft leafy canopies and layered pines, built once ---
function mergeGeos(list){let n=0;list.forEach(m=>n+=m.attributes.position.count);const P=new Float32Array(n*3),N=new Float32Array(n*3),C=new Float32Array(n*3);let o=0;
  list.forEach(m=>{P.set(m.attributes.position.array,o*3);N.set(m.attributes.normal.array,o*3);C.set(m.attributes.color.array,o*3);o+=m.attributes.position.count;});
  const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.BufferAttribute(P,3));out.setAttribute('normal',new THREE.BufferAttribute(N,3));out.setAttribute('color',new THREE.BufferAttribute(C,3));return out;}
function leafyCrown(){const rr=rng('leafy-canopy'),parts=[];
  for(let i=0;i<8;i++){const rad=1.7+rr()*1.3,cx=(rr()-.5)*3.4,cy=(rr()-.35)*2.8,cz=(rr()-.5)*3.4;const m=new THREE.IcosahedronGeometry(rad,3);
    const p=m.attributes.position,nm=m.attributes.normal,col=new Float32Array(p.count*3);
    for(let v=0;v<p.count;v++){let x=p.getX(v),y=p.getY(v),z=p.getZ(v);const l=Math.hypot(x,y,z)||1,ux=x/l,uy=y/l,uz=z/l;
      const bump=1+.16*Math.sin(ux*9+uy*7)*Math.cos(uz*8-uy*5)+.08*Math.sin(ux*21+uz*17);p.setXYZ(v,ux*rad*bump+cx,uy*rad*bump+cy,uz*rad*bump+cz);nm.setXYZ(v,ux,uy,uz);
      const h=Math.min(1,Math.max(0,(uy*rad+cy+3.2)/6.5)),lit=.5+.5*h,spec=.92+.16*Math.sin(ux*13+uz*11);col[v*3]=.12*lit*spec;col[v*3+1]=.36*lit*spec;col[v*3+2]=.1*lit*spec;}
    m.setAttribute('color',new THREE.BufferAttribute(col,3));parts.push(m);}
  return mergeGeos(parts);}
function pineCrown(){const parts=[];
  for(let i=0;i<6;i++){const r=3.3-i*.5,h=3,m=new THREE.ConeGeometry(r,h,22,3,true).toNonIndexed();const p=m.attributes.position,col=new Float32Array(p.count*3);
    for(let v=0;v<p.count;v++){const x=p.getX(v),z=p.getZ(v),a=Math.atan2(z,x),rf=Math.hypot(x,z)/r,frill=1+Math.sin(a*9+i)*.09*rf;
      const y=p.getY(v)+i*1.45-3.2-rf*.55;p.setXYZ(v,x*frill,y,z*frill);const sh=.45+.55*Math.min(1,(y+4.5)/10)*(1-.35*rf);col[v*3]=.07*sh;col[v*3+1]=.26*sh;col[v*3+2]=.13*sh;}
    m.setAttribute('color',new THREE.BufferAttribute(col,3));parts.push(m);}
  return mergeGeos(parts);}
function grassTuft(){const c=document.createElement('canvas');c.width=64;c.height=64;const x=c.getContext('2d');
  for(let i=0;i<26;i++){const bx=8+Math.random()*48,lean=(Math.random()-.5)*18,h=30+Math.random()*30;x.strokeStyle=['#2f6a24','#4a8f35','#5fa845','#3d7b2c'][i%4];x.lineWidth=2.2;x.beginPath();x.moveTo(bx,64);x.quadraticCurveTo(bx+lean*.3,64-h*.6,bx+lean,64-h);x.stroke();}
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t;}
// --- terrain: flat where the ball travels, rolling mounds further out ---
const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
function heightAt(x,z){const L=hole().yds,d=-z,dc=Math.min(L,Math.max(0,d)),lat=x-cxAt(dc),along=d<0?d:d>L?d-L:0,dist=Math.hypot(lat,along);
  const pin=P(L);if(Math.hypot(x-pin.x,z-pin.z)<62)return 0;
  const ws=waterSpot(),wp=P(ws.d,ws.lat);if(((x-wp.x)/26)**2+((z-wp.z)/18)**2<1)return 0;
  const f=smooth(30,62,dist);if(f<=0)return 0;
  const n=4.2*Math.sin(x*.019+1.3)*Math.cos(z*.016+.4)+2.6*Math.sin(x*.043+z*.029+2.1)+1.3*Math.sin(x*.097-z*.083)+.6*Math.sin(x*.21+z*.17);
  return f*Math.max(0,n+3.4)*1.05;}
// --- course geometry: centre line runs from tee (d=0) towards -z ---
function cxAt(d){const c=hole(),L=c.yds,t=Math.min(1,Math.max(0,d/L));return c.bend*.12*L*Math.sin(Math.PI*t)+7*Math.sin(d/55+c.phase);}
function P(d,lat=0){const x=cxAt(d),tx=cxAt(d+1)-x,len=Math.hypot(tx,1);return new THREE.Vector3(x+lat/len,0,-d+lat*tx/len);}
const roughLat=()=>hole().bend>0?-24:24;
function waterSpot(){const c=hole(),L=c.yds;return {d:Math.max(25,Math.min(L-25,L*(.3+c.water*.4))),lat:(c.bend>0?1:-1)*30};}
function ballSpot(){
  const L=hole().yds;
  if(state.phase==='putt'){const pin=P(L),back=P(L-12).sub(pin).normalize();return pin.add(back.multiplyScalar(state.ft/3));}
  return P(L-state.rem,state.lie==='rough'?roughLat():0);
}
function buildCourse(){
  if(!G.ok)return;const c=hole(),L=c.yds,grp=G.course;
  grp.children.slice().forEach(o=>{grp.remove(o);o.geometry&&o.geometry.dispose();});
  const r=rng(state.seed+':'+state.h);const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3();
  // rolling terrain around the hole
  {const cxs=[];for(let d=0;d<=L;d+=10)cxs.push(cxAt(d));const x0=Math.min(...cxs)-300,x1=Math.max(...cxs)+300,z0=140,z1=-(L+300),W=x1-x0,D=z0-z1;
   const tg=new THREE.PlaneGeometry(W,D,Math.round(W/4.5),Math.round(D/4.5));tg.rotateX(-Math.PI/2);tg.translate(x0+W/2,0,z0-D/2);
   const p=tg.attributes.position,uv=tg.attributes.uv,col=new Float32Array(p.count*3);
   for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),edge=Math.min(x-x0,x1-x,z0-z,z-z1),e=smooth(0,60,edge);let h=heightAt(x,z)*e;if(h<=.001)h=0;
     p.setY(i,h-(1-e)*.4);uv.setXY(i,x/26.67,z/26.67);const shade=.86+Math.min(.22,h*.03)+(Math.sin(x*.05)*Math.cos(z*.04))*.03;col[i*3]=shade;col[i*3+1]=shade;col[i*3+2]=shade*.97;}
   tg.setAttribute('color',new THREE.BufferAttribute(col,3));tg.computeVertexNormals();
   if(!G.terrainTex){G.terrainTex=G.roughTex.clone();G.terrainTex.repeat.set(1,1);G.terrainTex.needsUpdate=true;}
   const terr=new THREE.Mesh(tg,new THREE.MeshLambertMaterial({map:G.terrainTex,vertexColors:true}));terr.receiveShadow=true;grp.add(terr);}
  // first cut: a slightly lighter band of rough hugging the fairway
  {const p2=[],ix=[];let k=0;for(let d=24;d<=L+8;d+=3){const w=(d<45?8+(d-28):17+3*Math.sin(d/40))+4.5;const a=P(d,-w),b=P(d,w);p2.push(a.x,.012,a.z,b.x,.012,b.z);if(k)ix.push(k*2-2,k*2-1,k*2,k*2-1,k*2+1,k*2);k++;}
   const cg=new THREE.BufferGeometry();cg.setAttribute('position',new THREE.Float32BufferAttribute(p2,3));cg.setIndex(ix);cg.computeVertexNormals();
   const cut=new THREE.Mesh(cg,new THREE.MeshLambertMaterial({color:0x4f9a3a,side:THREE.DoubleSide}));cut.receiveShadow=true;grp.add(cut);}
  // grass tufts in the rough along both edges of the fairway
  {G.tuftTex=G.tuftTex||grassTuft();const N=G.quality==='high'?1600:700,tg=new THREE.PlaneGeometry(1.1,1.1);tg.translate(0,.55,0);
   const tufts=new THREE.InstancedMesh(tg,new THREE.MeshStandardMaterial({map:G.tuftTex,alphaTest:.5,side:THREE.DoubleSide,roughness:.9}),N*2);let k=0;
   const wsp=waterSpot(),wpt=P(wsp.d,wsp.lat);
   for(let i=0;i<N;i++){const d=-10+r()*(L+30),side=r()<.5?-1:1,w=(d<45?8+(d-28):17+3*Math.sin(d/40))+4.5;const p=P(d,side*(w+.5+r()*12));const sc2=.6+r()*.9,rot=r()*Math.PI;
     if(((p.x-wpt.x)/21)**2+((p.z-wpt.z)/14)**2<1||Math.hypot(p.x-P(L).x,p.z-P(L).z)<15){m4.makeScale(0,0,0);tufts.setMatrixAt(k++,m4);tufts.setMatrixAt(k++,m4);continue;}
     const hy=heightAt(p.x,p.z);m4.compose(new THREE.Vector3(p.x,hy,p.z),q.setFromAxisAngle(new THREE.Vector3(0,1,0),rot),s.set(sc2,sc2*(.8+r()*.6),sc2));tufts.setMatrixAt(k++,m4);
     m4.compose(new THREE.Vector3(p.x,hy,p.z),q.setFromAxisAngle(new THREE.Vector3(0,1,0),rot+Math.PI/2),s.set(sc2,sc2,sc2));tufts.setMatrixAt(k++,m4);}
   q.identity();grp.add(tufts);}
  // fairway ribbon
  const pos=[],uv=[],idx=[];let n=0;
  for(let d=28;d<=L+4;d+=3){const w=d<45?8+(d-28):17+3*Math.sin(d/40);const a=P(d,-w),b=P(d,w);
    pos.push(a.x,.02,a.z,b.x,.02,b.z);uv.push(0,d/18,1,d/18);if(n)idx.push(n*2-2,n*2-1,n*2,n*2-1,n*2+1,n*2);n++;}
  const fg=new THREE.BufferGeometry();fg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));fg.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));fg.setIndex(idx);fg.computeVertexNormals();
  const fair=new THREE.Mesh(fg,new THREE.MeshLambertMaterial({map:G.fairTex,side:THREE.DoubleSide}));fair.receiveShadow=true;grp.add(fair);
  // tee box
  const t0=P(0);const tee=new THREE.Mesh(new THREE.BoxGeometry(12,.4,16),new THREE.MeshLambertMaterial({color:0x7fca56}));tee.position.set(t0.x,.2,t0.z+2);tee.receiveShadow=true;grp.add(tee);
  [-5.5,5.5].forEach(x=>{const m=new THREE.Mesh(new THREE.SphereGeometry(.16,10,8),new THREE.MeshLambertMaterial({color:0xff3b30}));m.position.set(t0.x+x,.55,t0.z-1.5);grp.add(m);});
  // green, fringe, cup, flag
  const pin=P(L);
  const collar=new THREE.Mesh(new THREE.CircleGeometry(14,56),new THREE.MeshLambertMaterial({color:0x6cb846}));collar.rotation.x=-Math.PI/2;collar.position.set(pin.x,.04,pin.z);collar.receiveShadow=true;grp.add(collar);
  const fringe=new THREE.Mesh(new THREE.RingGeometry(11,12.4,56),new THREE.MeshLambertMaterial({color:0x7fcd55}));fringe.rotation.x=-Math.PI/2;fringe.position.set(pin.x,.055,pin.z);grp.add(fringe);
  const green=new THREE.Mesh(new THREE.CircleGeometry(11,56),new THREE.MeshLambertMaterial({map:G.greenTex}));green.rotation.x=-Math.PI/2;green.rotation.z=r()*Math.PI;green.position.set(pin.x,.06,pin.z);green.receiveShadow=true;grp.add(green);
  const cup=new THREE.Mesh(new THREE.CircleGeometry(.8,32),new THREE.MeshBasicMaterial({color:0x0c0c0c}));cup.rotation.x=-Math.PI/2;cup.position.set(pin.x,.08,pin.z);grp.add(cup);
  const liner=new THREE.Mesh(new THREE.RingGeometry(.8,.92,32),new THREE.MeshBasicMaterial({color:0xf2f2f2}));liner.rotation.x=-Math.PI/2;liner.position.set(pin.x,.081,pin.z);grp.add(liner);
  const stick=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,8,8),new THREE.MeshStandardMaterial({color:0xffffff}));stick.position.set(pin.x,4,pin.z);stick.castShadow=true;grp.add(stick);
  const band=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.5,8),new THREE.MeshStandardMaterial({color:0xff3b30}));band.position.set(pin.x,1.2,pin.z);grp.add(band);
  const fc=document.createElement('canvas');fc.width=128;fc.height=80;const fx2=fc.getContext('2d');fx2.fillStyle='#ffc929';fx2.fillRect(0,0,128,80);
  fx2.fillStyle='#14233a';fx2.font='bold 56px Arial Black, Arial, sans-serif';fx2.textAlign='center';fx2.textBaseline='middle';fx2.fillText(String(state.h+1),64,43);
  const ft=new THREE.CanvasTexture(fc);ft.encoding=THREE.sRGBEncoding;
  const fgeo=new THREE.PlaneGeometry(2.6,1.6,10,4);fgeo.translate(1.3,0,0);
  const flag=new THREE.Mesh(fgeo,new THREE.MeshStandardMaterial({map:ft,side:THREE.DoubleSide,roughness:.6}));flag.position.set(pin.x,7.1,pin.z);flag.castShadow=true;
  flag.userData.base=Float32Array.from(fgeo.attributes.position.array);grp.add(flag);G.flag=flag;
  // gallery behind the green: rope, posts and a crowd
  const back=P(L-12).sub(pin).normalize(),ang=Math.atan2(-back.x,-back.z);
  const posts=new THREE.InstancedMesh(new THREE.CylinderGeometry(.08,.08,1.1,5),new THREE.MeshLambertMaterial({color:0xffffff}),17);
  for(let i=0;i<17;i++){const a2=ang-1.2+i*2.4/16;m4.compose(new THREE.Vector3(pin.x+Math.sin(a2)*19,.55,pin.z+Math.cos(a2)*19),q,s.set(1,1,1));posts.setMatrixAt(i,m4);}grp.add(posts);
  const rope=[];for(let i=0;i<=32;i++){const a2=ang-1.2+i*2.4/32;rope.push(new THREE.Vector3(pin.x+Math.sin(a2)*19,.95-.12*Math.sin((i%2)*Math.PI/2),pin.z+Math.cos(a2)*19));}
  grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(rope),new THREE.LineBasicMaterial({color:0xffd23f})));
  const N=56,body=new THREE.InstancedMesh(new THREE.CapsuleGeometry(.32,.7,3,6),new THREE.MeshLambertMaterial(),N),heads=new THREE.InstancedMesh(new THREE.SphereGeometry(.24,8,6),new THREE.MeshLambertMaterial({color:0xe2b08a}),N);
  const tops=[0xff3b30,0xffc929,0x2f7fd8,0xffffff,0xf47c20,0x1f2f4a,0x3ddc6a,0xb57bff];const people=[];
  for(let i=0;i<N;i++){const a2=ang-1.15+r()*2.3,rad=21+r()*6;people.push({x:pin.x+Math.sin(a2)*rad,z:pin.z+Math.cos(a2)*rad,ph:r()*6});body.setColorAt(i,new THREE.Color(tops[(r()*tops.length)|0]));}
  const crowd={body,heads,people,jump:0,big:false};
  crowd.pose=t=>{people.forEach((p,i)=>{const hop=crowd.jump>0?Math.max(0,Math.sin(t*(crowd.big?14:10)+p.ph))*(crowd.big?.9:.5)*Math.min(1,crowd.jump):0;
      m4.compose(new THREE.Vector3(p.x,1+hop,p.z),q,s.set(1,1,1));body.setMatrixAt(i,m4);m4.compose(new THREE.Vector3(p.x,1.82+hop,p.z),q,s.set(1,1,1));heads.setMatrixAt(i,m4);});
    body.instanceMatrix.needsUpdate=true;heads.instanceMatrix.needsUpdate=true;};
  crowd.pose(0);grp.add(body,heads);G.crowd=crowd;
  const sign=(w,h,draw)=>{const c=document.createElement('canvas');c.width=512;c.height=Math.round(512*h/w);draw(c.getContext('2d'),c.width,c.height);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;
    return new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:t,roughness:.7}));};
  const font=(g2,size)=>g2.font=`900 ${size}px "Lilita One", "Arial Black", Arial, sans-serif`;
  // grandstand behind the green
  const stand=new THREE.Group(),sp=pin.clone().addScaledVector(back,-38);stand.position.set(sp.x,0,sp.z);stand.rotation.y=Math.atan2(back.x,back.z);grp.add(stand);
  const frameM=new THREE.MeshStandardMaterial({color:0xe9eef3,roughness:.6}),seatA=new THREE.MeshStandardMaterial({color:0xf47c20,roughness:.6}),seatB=new THREE.MeshStandardMaterial({color:0x1c2b45,roughness:.6});
  for(let i=0;i<5;i++){const tier=new THREE.Mesh(new THREE.BoxGeometry(34,1.4,3.2),frameM);tier.position.set(0,.7+i*1.4,-i*3.2);tier.castShadow=false;tier.receiveShadow=true;stand.add(tier);
    const seats=new THREE.Mesh(new THREE.BoxGeometry(33,.5,1.2),i%2?seatB:seatA);seats.position.set(0,1.65+i*1.4,-i*3.2+.6);stand.add(seats);}
  const roof=new THREE.Mesh(new THREE.BoxGeometry(36,.4,17),frameM);roof.position.set(0,13.5,-7);stand.add(roof);
  [-17,17].forEach(x=>{const post=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,13.5,10),frameM);post.position.set(x,6.75,-14);stand.add(post);});
  const fans=new THREE.InstancedMesh(new THREE.CapsuleGeometry(.3,.5,3,6),new THREE.MeshLambertMaterial(),80),fanHeads=new THREE.InstancedMesh(new THREE.SphereGeometry(.22,8,6),new THREE.MeshLambertMaterial({color:0xe2b08a}),80);
  for(let i=0;i<80;i++){const row=i%5,x=-15.5+((i*7.3)%31);m4.compose(new THREE.Vector3(x,2.4+row*1.4,-row*3.2+.4),q,s.set(1,1,1));fans.setMatrixAt(i,m4);fans.setColorAt(i,new THREE.Color(tops[(i*3+row)%tops.length]));
    m4.compose(new THREE.Vector3(x,3.15+row*1.4,-row*3.2+.4),q,s.set(1,1,1));fanHeads.setMatrixAt(i,m4);}
  stand.add(fans,fanHeads);
  const board=sign(16,5,(g2,w,h)=>{g2.fillStyle='#0b1626';g2.fillRect(0,0,w,h);g2.fillStyle='#ffc929';g2.fillRect(0,0,w,14);g2.fillRect(0,h-14,w,14);
    g2.fillStyle='#fff';font(g2,74);g2.textAlign='center';g2.textBaseline='middle';g2.fillText('FAIRWAY FC',w/2,h*.38);g2.fillStyle='#ffc929';font(g2,40);g2.fillText(`HOLE ${state.h+1}  ·  PAR ${c.par}`,w/2,h*.72);});
  board.position.set(0,17.4,-7);stand.add(board);
  // tee sign
  const tp=P(0,-9),teeSign=sign(3.6,2.4,(g2,w,h)=>{g2.fillStyle='#14324a';g2.fillRect(0,0,w,h);g2.strokeStyle='#ffc929';g2.lineWidth=14;g2.strokeRect(7,7,w-14,h-14);
    g2.fillStyle='#ffc929';font(g2,120);g2.textAlign='center';g2.textBaseline='middle';g2.fillText(String(state.h+1),w/2,h*.36);
    g2.fillStyle='#fff';font(g2,48);g2.fillText(`PAR ${c.par}  ·  ${c.yds} YDS`,w/2,h*.76);});
  teeSign.position.set(tp.x,2.1,tp.z+3);grp.add(teeSign);
  [-1.5,1.5].forEach(x=>{const leg=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,1.4,8),new THREE.MeshStandardMaterial({color:0x5a3d22}));leg.position.set(tp.x+x,.7,tp.z+3);grp.add(leg);});
  // flower beds by the tee and behind the green
  {const cols=[0xff6b9a,0xffd23f,0xffffff,0xb57bff,0xff5a4e,0xf47c20],N=170,fl=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.13,1),new THREE.MeshStandardMaterial({roughness:.6}),N),
     leaf=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.2,1),new THREE.MeshStandardMaterial({color:0x3f7f2f,roughness:.9}),N);
   const soil=new THREE.MeshLambertMaterial({color:0x5a3d22});
   const bl=P(-3,-15),br=P(-3,15);const beds=[[bl.x,bl.z,3,1.4],[br.x,br.z,3,1.4]];
   const gb=pin.clone().addScaledVector(back,-15.5);beds.push([gb.x,gb.z,5,1.4]);
   beds.forEach(([bx,bz,rx,rz])=>{const e=new THREE.Mesh(new THREE.CircleGeometry(1,24),soil);e.rotation.x=-Math.PI/2;e.scale.set(rx,rz,1);e.position.set(bx,.05,bz);grp.add(e);});
   for(let i=0;i<N;i++){const [bx,bz,rx,rz]=beds[i%beds.length],a2=Math.random()*Math.PI*2,rr=Math.sqrt(Math.random())*.9;const x=bx+Math.cos(a2)*rx*rr,z=bz+Math.sin(a2)*rz*rr;
     m4.compose(new THREE.Vector3(x,.3,z),q,s.set(1,1,1));fl.setMatrixAt(i,m4);fl.setColorAt(i,new THREE.Color(cols[i%cols.length]));m4.compose(new THREE.Vector3(x,.14,z),q,s.set(1,.7,1));leaf.setMatrixAt(i,m4);}
   grp.add(fl,leaf);}
  // a bench and ball washer by the tee
  const bench=new THREE.Mesh(new THREE.BoxGeometry(3,.15,.7),new THREE.MeshStandardMaterial({color:0x7a5230,roughness:.8}));bench.position.set(tp.x-1,.6,tp.z+7);grp.add(bench);
  [-2.2,.2].forEach(x=>{const l=new THREE.Mesh(new THREE.BoxGeometry(.15,.6,.6),frameM);l.position.set(tp.x+x,.3,tp.z+7);grp.add(l);});
  const washer=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.5,12),new THREE.MeshStandardMaterial({color:0x1c2b45}));washer.position.set(tp.x+3,1.05,tp.z+6);grp.add(washer);
  const wpole=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.9,8),frameM);wpole.position.set(tp.x+3,.45,tp.z+6);grp.add(wpole);
  // water
  const ws=waterSpot(),wp=P(ws.d,ws.lat);
  if(!G.waterTex){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.strokeStyle='rgba(255,255,255,.55)';x.lineWidth=2;
    for(let i=0;i<40;i++){const px=Math.random()*256,py=Math.random()*256,w=10+Math.random()*24;x.beginPath();x.moveTo(px,py);x.quadraticCurveTo(px+w/2,py-3,px+w,py);x.stroke();}
    G.waterTex=new THREE.CanvasTexture(c);G.waterTex.wrapS=G.waterTex.wrapT=THREE.RepeatWrapping;G.waterTex.repeat.set(3,3);}
  const water=new THREE.Mesh(new THREE.CircleGeometry(1,48),new THREE.MeshStandardMaterial({color:0x2a86cc,roughness:.06,metalness:.15,transparent:true,opacity:.93}));
  water.rotation.x=-Math.PI/2;water.scale.set(18,11,1);water.position.set(wp.x,.05,wp.z);grp.add(water);G.water=water;
  const ripple=new THREE.Mesh(new THREE.CircleGeometry(1,48),new THREE.MeshBasicMaterial({map:G.waterTex,transparent:true,opacity:.35,depthWrite:false}));ripple.rotation.x=-Math.PI/2;ripple.scale.set(17.5,10.6,1);ripple.position.set(wp.x,.058,wp.z);grp.add(ripple);
  // reeds around the pond
  const reed=new THREE.InstancedMesh(new THREE.ConeGeometry(.12,1.6,5),new THREE.MeshStandardMaterial({color:0x5f7d2c,roughness:.9}),40);
  for(let i=0;i<40;i++){const a2=Math.random()*Math.PI*2,rr=1.02+Math.random()*.06;m4.compose(new THREE.Vector3(wp.x+Math.cos(a2)*18*rr,.8,wp.z+Math.sin(a2)*11*rr),q,s.set(1,.6+Math.random()*.8,1));reed.setMatrixAt(i,m4);}grp.add(reed);
  const bank=new THREE.Mesh(new THREE.CircleGeometry(1,40),new THREE.MeshLambertMaterial({color:0x3a6f2b}));bank.rotation.x=-Math.PI/2;bank.scale.set(20,13,1);bank.position.set(wp.x,.03,wp.z);grp.add(bank);
  // bunkers
  if(!G.sandTex){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.fillStyle='#ecd59a';x.fillRect(0,0,128,128);
    for(let i=0;i<1400;i++){x.fillStyle=Math.random()<.5?'rgba(255,255,255,.2)':'rgba(120,90,40,.12)';x.fillRect(Math.random()*128,Math.random()*128,1,1);}
    G.sandTex=new THREE.CanvasTexture(c);G.sandTex.encoding=THREE.sRGBEncoding;G.sandTex.wrapS=G.sandTex.wrapT=THREE.RepeatWrapping;G.sandTex.repeat.set(2,2);}
  const sand=new THREE.MeshLambertMaterial({map:G.sandTex,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}),lip=new THREE.MeshLambertMaterial({color:0x8f7b45,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  [[L-17-c.bunk*6,(c.bend>0?1:-1)*-15,7,4],[Math.max(40,L*.55),(c.bend>0?1:-1)*20,7,3.5],[L+13,(r()-.5)*10,8,3]].forEach(([d,lat,sx,sz])=>{if(d>L+20)return;
    const p=P(d,lat),b=new THREE.Mesh(new THREE.CircleGeometry(1,40),sand);b.rotation.x=-Math.PI/2;b.scale.set(sx,sz,1);b.position.set(p.x,.07,p.z);b.receiveShadow=true;grp.add(b);
    const l=new THREE.Mesh(new THREE.CircleGeometry(1,40),lip);l.rotation.x=-Math.PI/2;l.scale.set(sx+.7,sz+.6,1);l.position.set(p.x,.062,p.z);grp.add(l);});
  // yardage posts
  [[25,0xff3b30],[50,0xffffff],[75,0x2f7fd8]].forEach(([y,col])=>{if(y>L-25)return;const p=P(L-y,-19);
    const post=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,1.6,8),new THREE.MeshLambertMaterial({color:col}));post.position.set(p.x,.8,p.z);post.castShadow=true;grp.add(post);});
  // trees (instanced)
  const spots=[];
  for(let d=-30;d<L+60;d+=7){for(const side of [-1,1]){if(r()<.25)continue;const lat=side*(34+r()*70);
    const wd=Math.hypot(P(d,lat).x-wp.x,P(d,lat).z-wp.z);if(wd<34)continue;if(d>L-25&&Math.abs(lat)<45)continue;spots.push([d,lat,.8+r()*.7,r()]);}}
  for(let i=0;i<14;i++)spots.push([L+45+r()*70,(r()-.5)*140,.9+r()*.6,r()]);
  G.pineGeo=G.pineGeo||pineCrown();G.leafGeo=G.leafGeo||leafyCrown();
  const crownG=G.pineGeo,crown2=G.leafGeo,trunkG=new THREE.CylinderGeometry(.32,.6,3.4,12);
  G.treeTime=G.treeTime||{value:0};
  const sway=m=>{m.onBeforeCompile=sh=>{sh.uniforms.uTime=G.treeTime;sh.vertexShader='uniform float uTime;\n'+sh.vertexShader.replace('#include <begin_vertex>',
    '#include <begin_vertex>\n#ifdef USE_INSTANCING\nfloat ph=instanceMatrix[3].x*.07+instanceMatrix[3].z*.05;\n#else\nfloat ph=0.;\n#endif\nfloat bend=max(position.y+4.,0.)/8.;transformed.x+=sin(uTime*1.3+ph)*.22*bend;transformed.z+=cos(uTime*1.05+ph)*.14*bend;');};return m;};
  const crowns=new THREE.InstancedMesh(crownG,sway(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9,side:THREE.DoubleSide})),spots.length);
  const rounds=new THREE.InstancedMesh(crown2,sway(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85})),spots.length);
  const trunks=new THREE.InstancedMesh(trunkG,new THREE.MeshStandardMaterial({color:0x5b3e26,roughness:.95}),spots.length);
  const zero=new THREE.Matrix4().makeScale(0,0,0),UPV=new THREE.Vector3(0,1,0);
  spots.forEach(([d,lat,sc,kind],i)=>{const p=P(d,lat);p.y=heightAt(p.x,p.z)-.2;
    m4.compose(new THREE.Vector3(p.x,p.y+1.5*sc,p.z),q,s.set(sc,sc,sc));trunks.setMatrixAt(i,m4);
    if(kind<.5){m4.compose(new THREE.Vector3(p.x,p.y+6.6*sc,p.z),q.setFromAxisAngle(UPV,kind*40),s.set(sc,sc,sc));crowns.setMatrixAt(i,m4);rounds.setMatrixAt(i,zero);}
    else{m4.compose(new THREE.Vector3(p.x,p.y+5.8*sc,p.z),q.setFromAxisAngle(UPV,kind*40),s.set(sc,sc*1.05,sc));rounds.setMatrixAt(i,m4);crowns.setMatrixAt(i,zero);}q.identity();});
  [crowns,rounds,trunks].forEach(m=>{m.castShadow=false;grp.add(m);});
  const shade=new THREE.InstancedMesh(new THREE.CircleGeometry(3.6,12),new THREE.MeshBasicMaterial({color:0x123d12,transparent:true,opacity:.28,depthWrite:false}),spots.length);
  const flat=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
  spots.forEach(([d,lat,sc],i)=>{const p=P(d,lat);m4.compose(new THREE.Vector3(p.x+1.2*sc,heightAt(p.x+1.2*sc,p.z+.8*sc)+.06,p.z+.8*sc),flat,s.set(sc,sc,sc));shade.setMatrixAt(i,m4);});grp.add(shade);
}
// --- placing ball, golfer and camera ---
function aimAt(){const L=hole().yds;return state.phase==='putt'||state.rem<120?P(L):P(Math.min(L,L-state.rem+90));}
function setBall(v,y=0){if(!G.ok)return;G.ball.position.set(v.x,v.y+.34+y,v.z);G.blob.position.set(v.x,.09,v.z);G.ball.visible=true;G.blob.visible=true;}
let kitKey='';
function applyKit(kit,name){
  if(!G.ok||!G.kitMats)return;kit=cleanKit(kit);const label=name&&!/^(you|player \d)$/i.test(name)?name.toUpperCase().slice(0,10):'';
  const key=JSON.stringify(kit)+label;if(key===kitKey)return;kitKey=key;const M=G.kitMats;
  if(kit.pattern==='plain'){if(M.shirt.map){M.shirt.map.dispose();M.shirt.map=null;}M.shirt.color.set(kit.shirt);}
  else{const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle=kit.shirt;x.fillRect(0,0,256,256);x.fillStyle=kit.shirt2;
    if(kit.pattern==='stripes')for(let i=0;i<10;i++)x.fillRect(i*25.6+6,0,13,256);
    if(kit.pattern==='hoops')for(let i=0;i<7;i++)x.fillRect(0,i*37+10,256,18);
    if(kit.pattern==='halves')x.fillRect(0,0,128,256);
    if(kit.pattern==='sash'){x.save();x.translate(128,128);x.rotate(-.75);x.fillRect(-200,-22,400,44);x.restore();}
    const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;if(M.shirt.map)M.shirt.map.dispose();M.shirt.map=t;M.shirt.color.set('#ffffff');}
  M.shirt.needsUpdate=true;M.shorts.color.set(kit.shorts);M.sock.color.set(kit.socks);
  const accent=kit.shirt2!==kit.shirt?kit.shirt2:(lum(kit.shirt)>.6?'#13254a':'#f4f4f2');M.trim.color.set(accent);M.sockBand.color.set(lum(kit.socks)>.6?'#13254a':'#f4f4f2');
  // number and name on the back, in a colour that stands out from the shirt
  const nc=G.numCanvas,nx=nc.getContext('2d');nx.clearRect(0,0,256,256);const base=kit.pattern==='halves'||kit.pattern==='stripes'?'#ffffff':kit.shirt;
  const ink=lum(base)>.6?'#13254a':'#ffffff';nx.fillStyle=ink;nx.textAlign='center';nx.textBaseline='middle';
  if(kit.pattern!=='plain'){nx.strokeStyle=ink==='#ffffff'?'#13254a':'#ffffff';nx.lineWidth=10;nx.lineJoin='round';}
  if(label){nx.font='900 34px "Lilita One", "Arial Black", Arial';if(kit.pattern!=='plain')nx.strokeText(label,128,48);nx.fillText(label,128,48);}
  nx.font='900 150px "Lilita One", "Arial Black", Arial';if(kit.pattern!=='plain')nx.strokeText(String(kit.num),128,150);nx.fillText(String(kit.num),128,150);G.numTex.needsUpdate=true;
}
function resetBody(){if(!G.ok)return;for(const k of ['L','R']){G.legs[k].hip.rotation.set(0,0,0);G.legs[k].knee.rotation.set(0,0,0);G.arms[k].rotation.x=0;}
  G.arms.L.rotation.z=.12;G.arms.R.rotation.z=-.12;G.torso.rotation.set(0,0,0);G.head.rotation.set(0,0,0);}
function poseRig(show=true){
  if(!G.ok)return;const b=ballSpot(),a=aimAt();G.rig.position.copy(b);G.rig.rotation.y=Math.atan2(-(a.x-b.x),-(a.z-b.z));
  const cp=multi()&&!state.menu?state.players[state.cp]:null;applyKit(curKit(),cp?cp.name:savedName());
  G.rig.visible=show;resetBody();G.golfer.position.set(-.12,0,state.phase==='putt'?.95:1.7);G.idle=show;G.trail.visible=false;G.comet.visible=false;setBall(b);
}
function addressCam(instant){
  if(!G.ok)return;const putt=state.phase==='putt';
  const pos=G.rig.localToWorld(new THREE.Vector3(putt?.4:-.5,putt?3.4:3.6,putt?8.5:10));
  const look=putt?P(hole().yds).setY(.3):G.rig.localToWorld(new THREE.Vector3(0,.5,-45));
  G.goalPos.copy(pos);G.goalLook.copy(look);G.rate=3.5;G.follow=null;
  if(instant){G.camera.position.copy(pos);G.look.copy(look);}
}
function flyover(){
  if(!G.ok)return Promise.resolve();
  const L=hole().yds,pin=P(L),tee=P(0);
  G.camera.position.copy(pin).add(new THREE.Vector3(0,70,40));G.look.copy(pin);G.goalPos.copy(G.camera.position);G.goalLook.copy(pin);G.follow=null;
  return new Promise(res=>{const t0=performance.now(),dur=reduce()?10:3200;
    G.follow=()=>{const p=Math.min(1,(performance.now()-t0)/dur),e=p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
      const d=L*(1-e);const c=P(d);G.goalPos.copy(c).add(new THREE.Vector3(0,60-40*e,30));G.goalLook.copy(P(Math.max(0,d-80)));G.rate=6;
      if(p>=1){G.follow=null;poseRig();addressCam();res();}};});
}
// smooth keyframe helper: keys are [time, value] pairs
function keyAt(keys,t){if(t<=keys[0][0])return keys[0][1];for(let i=1;i<keys.length;i++){const [t1,v1]=keys[i],[t0,v0]=keys[i-1];if(t<=t1){const u=(t-t0)/(t1-t0),e=u*u*(3-2*u);return v0+(v1-v0)*e;}}return keys[keys.length-1][1];}
// the kick: a short run-up, plant the left foot, whip the right leg through the ball, follow through with arms out
function swingAnim(putt){
  if(!G.ok)return Promise.resolve();
  const L=G.legs.L,Rt=G.legs.R,gl=G.golfer,k=reduce()?.05:1,z0=gl.position.z;G.idle=false;
  const K=putt?{z:[[0,z0],[.35,.62]],hipR:[[.3,0],[.58,-.5],[.78,.42],[1.1,.32]],kneeR:[[.3,0],[.58,-.55],[.78,-.05]],lean:[[.3,0],[.78,.06]],imp:.76,end:1.1}
    :{z:[[0,z0],[.62,.44]],hipR:[[.6,-.3],[.72,-1.0],[.86,.7],[1.3,1.3]],kneeR:[[.6,-.4],[.72,-1.75],[.84,-.25],[.9,-.05],[1.3,-.3]],
      hipL:[[.6,0],[.72,.14],[.9,-.1]],kneeL:[[.6,0],[.72,-.32],[1.3,-.2]],lean:[[.6,0],[.84,.12],[1.3,.22]],armLz:[[.6,.12],[.88,-1.0]],armRz:[[.6,-.12],[.88,.75]],imp:.85,end:1.3};
  let tt=0,hit=false,step=-1;
  return new Promise(res=>{G.parts.push({update(dt){tt+=dt/k;gl.position.z=keyAt(K.z,tt);
    if(!putt&&tt<.6){const ph=tt*15;L.hip.rotation.x=Math.sin(ph)*.6;Rt.hip.rotation.x=-Math.sin(ph)*.6;L.knee.rotation.x=-Math.max(0,-Math.sin(ph))*1.1;Rt.knee.rotation.x=-Math.max(0,Math.sin(ph))*1.1;
      G.arms.L.rotation.x=-Math.sin(ph)*.7;G.arms.R.rotation.x=Math.sin(ph)*.7;G.torso.rotation.x=-.08;const st=Math.floor(ph/Math.PI);if(st>step){step=st;Sound.step();}}
    else{Rt.hip.rotation.x=keyAt(K.hipR,tt);Rt.knee.rotation.x=keyAt(K.kneeR,tt);G.torso.rotation.x=keyAt(K.lean,tt);
      if(!putt){L.hip.rotation.x=keyAt(K.hipL,tt);L.knee.rotation.x=keyAt(K.kneeL,tt);G.arms.L.rotation.z=keyAt(K.armLz,tt);G.arms.R.rotation.z=keyAt(K.armRz,tt);G.arms.L.rotation.x*=.9;G.arms.R.rotation.x*=.9;G.head.rotation.x=keyAt([[.85,0],[1.3,-.25]],tt);}}
    if(!hit&&tt>=K.imp){hit=true;res();}
    return tt<K.end;}});});
}
function flight(from,to,height,ms,onLand){
  if(!G.ok){onLand&&onLand();return Promise.resolve();}
  const arr=G.trailGeo.attributes.position.array;arr.fill(0);for(let i=0;i<G.trailN;i++){arr[i*3]=from.x;arr[i*3+1]=from.y+.34;arr[i*3+2]=from.z;}
  G.trailGeo.attributes.position.needsUpdate=true;G.trail.visible=true;
  const col=new THREE.Color(G.tracerColor||0xffffff);G.trail.material.color.copy(col);
  const cp=G.cometGeo.attributes.position.array,cc=G.cometGeo.attributes.color.array,hist=[];G.comet.visible=true;
  const dir=to.clone().sub(from);dir.y=0;const len=dir.length()||1;dir.normalize();
  const side=new THREE.Vector3(dir.z,0,-dir.x);
  return new Promise(res=>{const t0=performance.now();if(reduce())ms=50;let ti=0;
    G.follow=()=>{const p=Math.min(1,(performance.now()-t0)/ms);const e=p;
      const pos=from.clone().lerp(to,e);const y=height*4*e*(1-e);setBall(pos,y);G.blob.material.opacity=.3*(1-y/(height+1));G.ball.rotation.x-=.35;G.ball.rotation.z+=.06;
      hist.unshift([pos.x,y+.34,pos.z]);if(hist.length>G.cometN)hist.pop();
      for(let i=0;i<G.cometN;i++){const h=hist[Math.min(i,hist.length-1)],f=1-i/G.cometN;cp[i*3]=h[0];cp[i*3+1]=h[1];cp[i*3+2]=h[2];cc[i*3]=col.r*f;cc[i*3+1]=col.g*f;cc[i*3+2]=col.b*f;}
      G.cometGeo.attributes.position.needsUpdate=true;G.cometGeo.attributes.color.needsUpdate=true;
      const k=Math.floor(p*(G.trailN-1));while(ti<=k){arr[ti*3]=pos.x;arr[ti*3+1]=y+.34;arr[ti*3+2]=pos.z;ti++;}for(let j=ti;j<G.trailN;j++){arr[j*3]=pos.x;arr[j*3+1]=y+.34;arr[j*3+2]=pos.z;}
      G.trailGeo.attributes.position.needsUpdate=true;
      const camBack=Math.min(26,8+len*.06);G.goalPos.copy(pos).addScaledVector(dir,-camBack).add(side.clone().multiplyScalar(-4)).setY(Math.max(4,y*.6+6));
      G.goalLook.copy(pos).setY(y*.8+.5).addScaledVector(dir,8);G.rate=p<.15?2.5:6;
      if(p>=1){G.follow=null;G.comet.visible=false;G.blob.material.opacity=.3;onLand&&onLand();res();}};});
}
function rollTo(to,ms){if(!G.ok)return Promise.resolve();const from=G.ball.position.clone().setY(0);
  return new Promise(res=>{const t0=performance.now();if(reduce())ms=20;
    G.follow=()=>{const p=Math.min(1,(performance.now()-t0)/ms),e=1-Math.pow(1-p,2.2);setBall(from.clone().lerp(to,e));if(p>=1){G.follow=null;res();}};});}
function dropInCup(){if(!G.ok)return Promise.resolve();const b=G.ball;return new Promise(res=>{const t0=performance.now();
  G.follow=()=>{const p=Math.min(1,(performance.now()-t0)/250);b.position.y=.34-1*p;if(p>=1){G.follow=null;b.visible=false;G.blob.visible=false;res();}};});}
function particles(at,color,count,speed,up,life,size=.35){
  if(!G.ok)return;const geo=new THREE.BufferGeometry(),arr=new Float32Array(count*3),vel=[];
  for(let i=0;i<count;i++){arr.set([at.x,at.y+.2,at.z],i*3);const a=Math.random()*Math.PI*2,s=speed*(.4+Math.random()*.6);vel.push([Math.cos(a)*s,up*(.5+Math.random()*.7),Math.sin(a)*s]);}
  geo.setAttribute('position',new THREE.BufferAttribute(arr,3));
  const m=new THREE.Points(geo,new THREE.PointsMaterial({color,size,transparent:true,opacity:1,depthWrite:false}));G.fx.add(m);let t=0;
  G.parts.push({update(dt){t+=dt;for(let i=0;i<count;i++){vel[i][1]-=18*dt;arr[i*3]+=vel[i][0]*dt;arr[i*3+1]=Math.max(.1,arr[i*3+1]+vel[i][1]*dt);arr[i*3+2]+=vel[i][2]*dt;}
    geo.attributes.position.needsUpdate=true;m.material.opacity=Math.max(0,1-t/life);if(t>life){G.fx.remove(m);geo.dispose();return false;}return true;}});
}
function ripples(at){if(!G.ok)return;for(let k=0;k<3;k++){const m=new THREE.Mesh(new THREE.RingGeometry(.8,1.1,32),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,depthWrite:false}));
  m.rotation.x=-Math.PI/2;m.position.set(at.x,.1,at.z);G.fx.add(m);let t=-k*.2;
  G.parts.push({update(dt){t+=dt;const s=1+Math.max(0,t)*8;m.scale.set(s,s,s);m.material.opacity=Math.max(0,.9-t);if(t>1){G.fx.remove(m);m.geometry.dispose();return false;}return true;}});}}
function partyFlag(on){if(G.flag)G.flag.userData.party=on;}
function crowdCheer(big){if(G.crowd){G.crowd.jump=big?2.4:1.4;G.crowd.big=big;}}
function aimLine(show){if(!G.ok)return;if(G.aim){G.scene.remove(G.aim);G.aim.geometry.dispose();G.aim=null;}if(!show)return;
  const b=ballSpot(),pin=P(hole().yds);const geo=new THREE.BufferGeometry().setFromPoints([b.clone().setY(.12),pin.clone().setY(.12)]);
  G.aim=new THREE.Line(geo,new THREE.LineDashedMaterial({color:0xffffff,dashSize:.35,gapSize:.25,transparent:true,opacity:.8}));G.aim.computeLineDistances();G.scene.add(G.aim);}

// ================= 2D confetti =================
function confetti(){if(reduce())return;const cv=$('#confetti'),W=innerWidth,H=innerHeight,dpr=devicePixelRatio||1;cv.width=W*dpr;cv.height=H*dpr;
  const g=cv.getContext('2d');g.scale(dpr,dpr);const cols=['#ffc929','#ff5a4e','#ffffff','#3ddc6a','#47b2ff','#b57bff'];
  const bits=Array.from({length:160},()=>({x:W/2+(Math.random()-.5)*80,y:H*.35,vx:(Math.random()-.5)*16,vy:-Math.random()*13-4,s:5+Math.random()*6,c:cols[Math.random()*6|0],a:Math.random()*6,va:(Math.random()-.5)*.4}));
  const t0=performance.now();(function f(n){g.clearRect(0,0,W,H);bits.forEach(b=>{b.vy+=.32;b.vx*=.99;b.x+=b.vx;b.y+=b.vy;b.a+=b.va;g.save();g.translate(b.x,b.y);g.rotate(b.a);g.fillStyle=b.c;g.fillRect(-b.s/2,-b.s/4,b.s,b.s/2);g.restore();});
    if(n-t0<3000)requestAnimationFrame(f);else g.clearRect(0,0,W,H);})(t0);}
// ---- broadcast graphics ----
let bannerT=null;
function banner(main,sub,small,color){const b=$('#banner');if(!b)return;b.style.setProperty('--bc',color||'var(--gold)');
  b.innerHTML=`<b>${esc(main)}</b><span>${esc(sub)}${small?`<i>${esc(small)}</i>`:''}</span>`;b.classList.remove('on');void b.offsetWidth;b.classList.add('on');
  clearTimeout(bannerT);bannerT=setTimeout(()=>b.classList.remove('on'),3200);}
function wipe(){const w=$('#wipe');if(!w||reduce())return;w.classList.remove('go');void w.offsetWidth;w.classList.add('go');Sound.gust&&Sound.gust();}
const TIPS=['Rarer answers kick further','Typos are forgiven','Legend answers can hole out from 75 yards','Read the green: answer the putting question for a wider zone','New daily course at midnight','Out of time? That’s a splash and a penalty'];
let tickerText='';
function ticker(){const el=$('#tkIn');if(!el)return;let items=[];
  if(multi()&&!state.menu)items=standings().map((s,i)=>`<span>${i+1}. ${esc(s.p.name)} <b class="${!optsOf().match&&s.tp<0?'u':''}">${scoreText(s)}</b> thru ${s.thru}</span>`);
  else if(state.mode==='room'&&Room.peers.length&&!state.menu)items=Room.peers.map(p=>({n:cleanName((p.presence||{}).name)||'Player',tp:+(p.presence||{}).toPar||0,th:+(p.presence||{}).thru||0})).sort((a,b)=>a.tp-b.tp).map((r,i)=>`<span>${i+1}. ${esc(r.n)} <b>${r.th?fmtPar(r.tp):'E'}</b> thru ${r.th}</span>`);
  else{const today=(Board.docs||[]).filter(d=>d.days&&d.days[TODAY]).sort((a,b)=>a.days[TODAY].toPar-b.days[TODAY].toPar).slice(0,8);
    if(today.length)items=[`<span><b>Today’s leaders</b></span>`].concat(today.map((d,i)=>`<span>${i+1}. ${esc(Board.name(d.id))} <b>${fmtPar(d.days[TODAY].toPar)}</b></span>`));}
  if(!state.menu&&state.phase!=='done'){const c=hole();items.unshift(`<span><b>Hole ${state.h+1}</b> · Par ${c.par} · ${c.yds} yds</span>`);}
  items=items.concat(TIPS.map(t=>`<span>${esc(t)}</span>`));
  const html=items.join('');if(html===tickerText)return;tickerText=html;el.innerHTML=html+html;}
function shout(text,sub,gold){const s=$('#shout');s.className='shout'+(gold?' gold':'');s.innerHTML=esc(text)+(sub?`<small>${esc(sub)}</small>`:'');void s.offsetWidth;s.classList.add('go');}

// ================= HUD & scorecard =================
function hud(){
  const inGame=!['menu','done'].includes(state.phase)&&!state.menu;
  let h='';
  if(inGame){const c=hole(),tp=toPar();
    const toPin=state.phase==='putt'?`${state.ft}<small style="font-size:12px"> ft</small>`:`${state.rem}`;
    if(multi()||state.mode==='room')h+=`<div class="chip who"><b>${esc(curName())}</b><i>${state.mode==='room'?'Room '+esc(state.room?.code||''):'To play'}</i></div>`;
    h+=`<div class="chip"><b>${state.h+1}<small style="font-size:12px;color:var(--dim)">/${state.course.length}</small></b><i>Par ${c.par}</i></div>
    <div class="chip"><b>${toPin}</b><i>${state.phase==='putt'?'To cup':'To pin'}</i></div>
    <div class="chip ${tp<0?'under':''}"><b>${state.scores.length?fmtPar(tp):'E'}</b><i>Score</i></div>`;}
  if(inGame)h+=`<button class="iconbtn home" id="homeBtn" aria-label="Main menu"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5.5v-6h-5v6H4a1 1 0 0 1-1-1z" fill="currentColor"/></svg><span>HOME</span></button>`;
  h+=`<button class="iconbtn" id="cardBtn" aria-label="Scorecard and leaderboard">${state.mode==='room'&&inGame?'ROOM<br>'+Room.peers.length:'CARD'}</button>
   <button class="iconbtn snd ${Sound.muted?'off':''}" id="snd" aria-label="Sound settings">${Sound.muted?'SOUND<br>OFF':'SOUND<br>ON'}</button>`;
  $('#chips').innerHTML=h;document.body.classList.toggle('ingame',inGame);ticker();
  $('#cardBtn').onclick=()=>{Sound.pop();openSheet(state.mode==='room'&&inGame?'room':inGame||state.phase==='done'?'card':'board');};
  $('#snd').onclick=()=>{Sound.init();Sound.pop();openSheet('sound');};
  if($('#homeBtn'))$('#homeBtn').onclick=()=>{Sound.pop();if(busy){toast('Wait for the ball to stop');return;}openSheet('home');};
  Room.update();
}
// Standings. Stroke play: lowest score to par. Match play: most holes won outright (a tie for the lowest halves the hole).
function holesWon(){const w=state.players.map(()=>0);
  for(let i=0;i<state.course.length;i++){const sc=state.players.map(p=>p.scores[i]);if(sc.some(s=>s==null))continue;const lo=Math.min(...sc);const who=sc.filter(s=>s===lo).length===1?sc.indexOf(lo):-1;if(who>=0)w[who]++;}return w;}
function standings(){const won=optsOf().match?holesWon():null;
  return state.players.map((p,i)=>({p,i,tp:parOf(p),thru:p.scores.length,tot:totOf(p),won:won?won[i]:0}))
    .sort((a,b)=>won?(b.won-a.won||a.tp-b.tp):(a.tp-b.tp||a.tot-b.tot));}
const scoreText=s=>optsOf().match?`${s.won} won`:(s.thru?fmtPar(s.tp):'E');
function cardTable(){
  const cls=d=>d<=-2?'s-eagle':d===-1?'s-birdie':d===0?'':d===1?'s-bogey':'s-double';const n=state.course.length,out=[];
  for(let start=0;start<n;start+=9){const idx=[...Array(Math.min(9,n-start)).keys()].map(k=>k+start),last=start+9>=n,lab=n<=9?'TOT':start===0?'OUT':'IN';
    const sum=(arr)=>arr.reduce((t,v)=>t+v,0);
    let h='<tr><th class="lab">HOLE</th>'+idx.map(i=>`<th class="${i===state.h&&state.phase!=='done'?'cur':''}">${i+1}</th>`).join('')+`<th>${lab}</th>${n>9&&last?'<th>TOT</th>':''}</tr>`;
    h+='<tr><td class="lab">YDS</td>'+idx.map(i=>`<td>${state.course[i].yds}</td>`).join('')+`<td>${sum(idx.map(i=>state.course[i].yds))}</td>${n>9&&last?`<td>${sum(state.course.map(c=>c.yds))}</td>`:''}</tr>`;
    h+='<tr><td class="lab">PAR</td>'+idx.map(i=>`<td>${state.course[i].par}</td>`).join('')+`<td>${sum(idx.map(i=>state.course[i].par))}</td>${n>9&&last?`<td>${sum(state.course.map(c=>c.par))}</td>`:''}</tr>`;
    state.players.forEach((p,pi)=>{const got=idx.filter(i=>p.scores[i]!=null);
      h+=`<tr class="${multi()&&pi===state.cp&&state.phase!=='done'?'me':''}"><td class="lab">${multi()?esc(p.name.slice(0,8).toUpperCase()):'SCORE'}</td>`+idx.map(i=>{const s=p.scores[i];return s==null?'<td></td>':`<td class="${cls(s-state.course[i].par)}">${s}</td>`;}).join('')+
        `<td>${got.length?sum(got.map(i=>p.scores[i])):''}</td>${n>9&&last?`<td>${p.scores.length?totOf(p):''}</td>`:''}</tr>`;});
    out.push(`<div class="sc-wrap"><table class="sc">${h}</table></div>`);}
  return out.join('');
}
let sheetTab=null,homeGen=0,meterStop=null;
function settleLive(){ // a question that was on screen when you left counts as running out of time
  if(state.ppending){state.ppending=false;state.pread='bad';state.pi[PD(state.ft)]++;}
  if(state.pending){state.pending=false;state.strokes+=2;state.qi++;if(state.strokes>=hole().par+4){state.scores[state.h]=hole().par+4;state.phase='holeDone';}}}
function goHome(){homeGen++;clearInterval(timer);if(meterStop)meterStop();meterStop=null;if(G.ok)G.follow=null;settleLive();
  if(state.mode==='room')Room.leave();delete state.menu;save();menuScreen();}
function openSheet(tab){sheetTab=tab;$('#sheet').hidden=false;renderSheet();}
function closeSheet(){sheetTab=null;$('#sheet').hidden=true;}
function renderSheet(){
  if(!sheetTab)return;const tabs=[['card','Scorecard'],['board','Leaderboard']];if(state.mode==='room')tabs.push(['room','Room']);tabs.push(['badges','Badges']);tabs.push(['sound','Settings']);
  let body='';
  if(sheetTab==='card')body=cardTable()+(state.mode!=='daily'||state.phase==='done'?'':'<p class="muted">Your daily score posts to the leaderboard when you sign the card.</p>');
  if(sheetTab==='home'){const live=state.pending||state.ppending||(document.querySelector('#guess')&&!busy)||document.querySelector('.opt:not(:disabled)');
    $('#sheetCard').innerHTML=`<div class="kicker"><span class="cat">Main menu</span><span>${esc(MODE_LABEL[state.mode])}</span></div>
      <h2 class="q">Leave this hole?</h2>
      <p class="hint">${state.mode==='room'?'You’ll leave the room. You can join again with the same code.':'Your round is saved. Tap <b>Continue</b> on the main menu to carry on from here.'}${live?' <b>The question on screen will count as out of time.</b>':''}</p>
      <div class="row end"><button class="btn ghost" id="stay">Keep playing</button><button class="btn" id="goHome">Main menu</button></div>`;
    $('#stay').onclick=closeSheet;$('#sheet').onclick=e=>{if(e.target.id==='sheet')closeSheet();};$('#goHome').onclick=()=>{closeSheet();goHome();};return;}
  if(sheetTab==='badges')body=badgesHTML();
  if(sheetTab==='board')body=Board.html();
  if(sheetTab==='room')body=Room.html();
  if(sheetTab==='sound'){const p=Sound.prefs,tg=(k,l,d)=>`<label class="toggle"><input type="checkbox" id="pf-${k}" ${p[k]?'checked':''}><span><b>${l}</b><em>${d}</em></span></label>`;
    body=`<label class="toggle"><input type="checkbox" id="pf-master" ${Sound.muted?'':'checked'}><span><b>All sound</b><em>Master switch</em></span></label>
      ${tg('fx','Effects','Swings, crowd, splashes')}${tg('voice','Commentary','A commentator calls your shots')}${tg('music','Music','Background music')}
      <p class="muted">No sound on iPhone? Turn the volume up with the side buttons. Commentary uses your phone’s built-in voice.</p>
      <div class="kicker"><span>Graphics</span><span>${G.ok?(G.quality==='high'?'Now: high':'Now: battery saver'):''}</span></div>
      <div class="seg gfx">${[['auto','Auto'],['high','High'],['low','Battery saver']].map(([k,l])=>`<button data-g="${k}" class="${(G.gfxPref||'auto')===k?'on':''}">${l}</button>`).join('')}</div>
      <p class="muted">Auto picks once for this device and never switches mid-game. High is sharpest with shadows. Battery saver runs smoother on older phones.</p>`;}
  const inGame=!['menu','start','done'].includes(state.phase);
  $('#sheetCard').innerHTML=`<div class="tabs" role="tablist">${tabs.map(([k,l])=>`<button role="tab" class="tab ${k===sheetTab?'on':''}" data-t="${k}" aria-selected="${k===sheetTab}">${l}</button>`).join('')}</div>
    ${body}
    <div class="row end">${inGame?'<button class="btn ghost" id="quit">Main menu</button>':''}<button class="btn" id="closeCard">Close</button></div>`;
  document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{Sound.pop();sheetTab=b.dataset.t;renderSheet();});
  $('#closeCard').onclick=closeSheet;$('#sheet').onclick=e=>{if(e.target.id==='sheet')closeSheet();};
  if($('#quit'))$('#quit').onclick=()=>{closeSheet();goHome();};
  if(sheetTab==='sound'){$('#pf-master').onchange=e=>{if(Sound.muted===e.target.checked)Sound.toggle();hud();renderSheet();};
    ['fx','voice','music'].forEach(k=>$('#pf-'+k).onchange=e=>{Sound.init();Sound.setPref(k,e.target.checked);if(k==='voice'&&e.target.checked)Sound.say('Commentary on.');});}
  if(sheetTab==='board')Board.bind();
  document.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>{if(G.ok){if(b.dataset.g==='auto'){try{localStorage.removeItem('fairwayfc:gfxAuto2');}catch(e){}}G.setQuality(b.dataset.g);}Sound.pop();renderSheet();});
}
function setCard(html,min){const c=$('#card');c.className='card'+(min?' min':'');void c.offsetWidth;c.innerHTML=html;c.scrollTop=0;}
function toast(text){const t=document.createElement('div');t.className='toast';t.textContent=text;document.body.appendChild(t);setTimeout(()=>t.remove(),3400);}

// ================= Hosted build: our own small backend =================
// The Netlify build sets window.FAIRWAY_API; on claude.ai it is absent and the artifact capabilities are used instead.
const API=window.FAIRWAY_API||null;
function playerId(){let id=null;try{id=localStorage.getItem('fairwayfc:pid');}catch(e){}
  if(!id||!/^[a-z0-9]{12,40}$/.test(id)){id=Array.from(crypto.getRandomValues(new Uint8Array(12)),b=>b.toString(16).padStart(2,'0')).join('');try{localStorage.setItem('fairwayfc:pid',id);}catch(e){}}return id;}
const BADWORDS=['fuck','shit','cunt','nigg','fag','bitch','twat','wank','dick','cock','piss','slut','whore','rape','nazi','retard','paki','spaz','bollock','arse','prick','tits','porn','sex','kkk','hitler'];
function cleanName(s){const n=String(s||'').replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,16);
  const flat=n.toLowerCase().replace(/[0]/g,'o').replace(/[1!|]/g,'i').replace(/3/g,'e').replace(/[4@]/g,'a').replace(/[5$]/g,'s').replace(/7/g,'t').replace(/[^a-z]/g,'');
  return BADWORDS.some(w=>flat.includes(w))?'':n;}
function savedName(){try{return localStorage.getItem('fairwayfc:name')||'';}catch(e){return '';}}
function httpRoomApi(){
  let peerId=null;try{peerId=sessionStorage.getItem('fairwayfc:peer');}catch(e){}
  if(!peerId){peerId=Array.from(crypto.getRandomValues(new Uint8Array(8)),b=>b.toString(16).padStart(2,'0')).join('');try{sessionStorage.setItem('fairwayfc:peer',peerId);}catch(e){}}
  return {join:async(name)=>{
    const code=name.replace(/^fairway-/,'');let pres={},handlers=[],prev=new Map(),alive=true,pt=null,ok=false;
    const push=async(extra)=>{try{const r=await fetch(API+'/room',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({code,peer:peerId},pres,extra||{}))});ok=r.ok;}catch(e){ok=false;}};
    const poll=async()=>{if(!alive)return;try{const r=await fetch(API+'/room?code='+encodeURIComponent(code),{cache:'no-store'});if(!r.ok)return;const j=await r.json();
      const peers=(j.peers||[]).map(p=>({peer:p.peer,by:null,isMe:p.peer===peerId,sameTab:p.peer===peerId,kind:'viewer',guest:false,presence:p,updatedAt:p.ts}));
      const joined=[],updated=[],now=new Map();for(const p of peers){const key=JSON.stringify(p.presence);now.set(p.peer,key);if(!prev.has(p.peer))joined.push(p);else if(prev.get(p.peer)!==key)updated.push(p);}
      const left=[...prev.keys()].filter(k=>!now.has(k)).map(k=>({peer:k,presence:{}}));prev=now;
      handlers.forEach(h=>{try{h({peers,joined,left,updated});}catch(e){}});}catch(e){}};
    await push();if(!ok)throw new Error('room unavailable');
    const tick=setInterval(()=>{push();poll();},3000);
    return {name,connected:()=>alive,
      presence:async p=>{Object.assign(pres,p);clearTimeout(pt);pt=setTimeout(push,250);},
      onPeers:h=>{handlers.push(h);poll();return()=>{handlers=handlers.filter(x=>x!==h);};},
      peers:()=>[],leave:async()=>{alive=false;clearInterval(tick);try{await fetch(API+'/room',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code,peer:peerId,leave:true}),keepalive:true});}catch(e){}}};}};
}

// ================= Progress: streaks and badges (kept on this device) =================
const BADGES=[
  ['first','First round','Finish any round on your own.'],['underpar','Under par','Finish a round under par.'],['full18','Full 18','Finish an 18-hole round.'],
  ['ace','Hole in one','Hole out with your very first kick.'],['chipin','Screamer','Hole out from the fairway with a Legend answer.'],['eagle','Eagle eye','Make an eagle or better.'],
  ['birdies3','Birdie hat-trick','Make three birdies in one round.'],['longputt','Long range','Hole a putt from 20 feet or more.'],['legend1','Legend','Give your first Legend answer.'],
  ['legend25','Encyclopedia','Give 25 Legend answers.'],['speed','Quick thinker','Finish a speed round at level par or better.'],['themes','Specialist','Finish a theme round in all three topics.'],
  ['streak3','Three in a row','Play the daily round three days running.'],['streak7','Week-long streak','Play the daily round seven days running.'],['host','Host','Finish a pass & play or match play game.']];
function readJSON(k,d){try{return JSON.parse(localStorage.getItem(k))||d;}catch(e){return d;}}
function writeJSON(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
const myBadges=()=>readJSON('fairwayfc:badges',{}),myStats=()=>readJSON('fairwayfc:stats',{legends:0,themes:{}});
let awardQueue=[],awardTimer=null;
function award(id){const b=myBadges();if(b[id])return;b[id]=TODAY;writeJSON('fairwayfc:badges',b);awardQueue.push(id);if(!awardTimer)awardTimer=setTimeout(flushAwards,2600);}
function flushAwards(){awardTimer=null;const id=awardQueue.shift();if(!id)return;const bd=BADGES.find(x=>x[0]===id);if(bd){toast(`Badge unlocked: ${bd[1]}`);banner('BADGE',bd[1].toUpperCase(),bd[2],'#b57bff');Sound.fanfare('birdie');}
  if(awardQueue.length)awardTimer=setTimeout(flushAwards,2200);}
function bumpStat(k,by=1){const s=myStats();s[k]=(s[k]||0)+by;writeJSON('fairwayfc:stats',s);return s[k];}
const dayKeyOf=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function dailyStreak(){const days=new Set(localHistory().map(r=>r.date));let n=0;const d=new Date();if(!days.has(dayKeyOf(d)))d.setDate(d.getDate()-1);while(days.has(dayKeyOf(d))){n++;d.setDate(d.getDate()-1);}return n;}
function weekDays(){const d=new Date(),out=[];const back=(d.getDay()+6)%7;d.setDate(d.getDate()-back);for(let i=0;i<=back;i++){out.push(dayKeyOf(d));d.setDate(d.getDate()+1);}return out;}
function badgesHTML(){const b=myBadges(),got=BADGES.filter(x=>b[x[0]]).length,st=dailyStreak();
  return `<div class="kicker"><span class="cat">${got} of ${BADGES.length} badges</span><span>${st?st+'-day streak':'No streak yet'}</span></div>
    <div class="badges">${BADGES.map(([id,n,d])=>`<div class="badge ${b[id]?'got':''}"><b>${esc(n)}</b><span>${esc(d)}</span>${b[id]?`<em>Unlocked ${esc(new Date(b[id]+'T12:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'}))}</em>`:''}</div>`).join('')}</div>`;}

// ================= Live rooms (who's on the page right now) =================
const Room={api:undefined,r:null,peers:[],code:null,unsub:null,last:{}};
Room.load=async()=>{if(Room.api!==undefined)return Room.api;if(API){Room.api=httpRoomApi();return Room.api;}if(!window.claude||!claude.use){Room.api=null;return null;}try{Room.api=await claude.use('room');}catch(e){Room.api=null;}return Room.api;};
Room.join=async(code)=>{const api=await Room.load();if(!api)return false;
  try{Room.leave();Room.r=await api.join('fairway-'+code);Room.code=code;Room.last={};
    Room.unsub=Room.r.onPeers(ch=>{Room.peers=ch.peers.filter(p=>p.kind==='viewer');
      for(const p of ch.updated.concat(ch.joined)){if(p.isMe)continue;const pr=p.presence||{},l=pr.last;const key=p.peer;
        if(l&&typeof l.h==='number'&&(!Room.last[key]||Room.last[key]<l.h+1)){Room.last[key]=l.h+1;const nm=cleanName(pr.name)||'Someone';
          if(typeof l.d==='number'&&l.d<0){toast(`${nm} ${l.d<=-2?'eagled':'birdied'} hole ${l.h+1}`);Sound.clap();}}
        if(ch.joined.includes(p)&&!p.isMe)toast(`${cleanName(pr.name)||'Someone'} joined the room`);}
      if(sheetTab==='room')renderSheet();if(state.mode==='room'){const b=$('#cardBtn');if(b)b.innerHTML='ROOM<br>'+Room.peers.length;}});
    Room.update();return true;}catch(e){Room.r=null;return false;}};
Room.update=()=>{if(!Room.r||state.mode!=='room')return;const p=state.players[0],h=p.scores.length;
  const last=h?{h:h-1,d:p.scores[h-1]-state.course[h-1].par}:null;
  const o=optsOf();Room.r.presence({name:p.name,thru:h,toPar:parOf(p),total:totOf(p),done:state.phase==='done',last,opts:{len:o.len,theme:o.theme,clock:o.clock}}).catch(()=>{});};
Room.leave=()=>{try{Room.unsub&&Room.unsub();Room.r&&Room.r.leave();}catch(e){}Room.r=null;Room.unsub=null;Room.peers=[];};
Room.html=()=>{if(!Room.r)return '<p class="muted">You’re not in a room. Start an online room from the main menu.</p>';
  const rows=Room.peers.map(p=>{const pr=p.presence||{};return{me:p.isMe&&p.sameTab,name:cleanName(pr.name)||'Player',thru:+pr.thru||0,tp:+pr.toPar||0,done:!!pr.done};})
    .sort((a,b)=>(b.thru>0)-(a.thru>0)||a.tp-b.tp||b.thru-a.thru);
  return `<div class="kicker"><span class="cat">Room ${esc(Room.code.toUpperCase())}</span><span>${rows.length} playing</span></div>
    <p class="muted">Friends join from the main menu with code <b class="code">${esc(Room.code.toUpperCase())}</b>. Everyone plays the same holes.</p>
    <ol class="board">${rows.map((r,i)=>`<li class="${r.me?'you':''}"><span class="pos">${i+1}</span><span class="nm">${esc(r.name)}${r.me?' <i>you</i>':''}</span><span class="th">${r.done?'F':r.thru?'Thru '+r.thru:'—'}</span><b class="${r.tp<0?'under':''}">${r.thru?fmtPar(r.tp):'E'}</b></li>`).join('')}</ol>`;};

// ================= Shared leaderboard (daily rounds) =================
const Board={db:null,user:null,me:null,docs:[],names:{},status:'loading',tab:'today'};
Board.refresh=async()=>{
  try{const r=await fetch(`${API}/board?day=${TODAY}`,{cache:'no-store'});if(!r.ok)throw 0;const j=await r.json(),map={};
    for(const t of j.today||[]){map[t.id]=map[t.id]||{id:t.id};map[t.id].days={[TODAY]:{total:t.total,toPar:t.toPar}};Board.names[t.id]={name:t.name};}
    for(const w of j.week||[]){map[w.id]=Object.assign(map[w.id]||{id:w.id},{week:{rounds:w.rounds,sum:w.sum}});Board.names[w.id]=Board.names[w.id]||{name:w.name};}
    for(const a of j.all||[]){map[a.id]=Object.assign(map[a.id]||{id:a.id},{rounds:a.rounds,sum:a.sum,best:a.best});Board.names[a.id]=Board.names[a.id]||{name:a.name};}
    Board.docs=Object.values(map);Board.status='ready';}catch(e){if(Board.status!=='ready')Board.status='error';}
  if(sheetTab==='board')renderSheet();
};
Board.init=async()=>{
  if(API){Board.mode='api';Board.me=playerId();await Board.refresh();setInterval(()=>{if(sheetTab==='board')Board.refresh();},20000);return;}
  if(!window.claude||!claude.use){Board.status='off';return;}
  try{const [db,user]=await Promise.all([claude.use('db'),claude.use('user')]);Board.db=db;Board.user=user;
    if(!db){Board.status='off';if(sheetTab==='board')renderSheet();return;}
    Board.me=user?await user.id():null;
    const t=setTimeout(()=>{if(Board.status==='loading'){Board.status='slow';if(sheetTab==='board')renderSheet();}},10000);
    db.collection('scores').onSnapshot(async snap=>{clearTimeout(t);Board.docs=snap.docs.filter(d=>d.exists).map(d=>({id:d.id,...d.data()}));Board.status='ready';
      if(user&&Board.docs.length){try{Board.names=await user.profiles(Board.docs.map(d=>d.id));}catch(e){}}
      if(sheetTab==='board')renderSheet();},()=>{clearTimeout(t);Board.status='error';if(sheetTab==='board')renderSheet();});
  }catch(e){Board.status='off';}
};
Board.name=id=>(Board.names[id]&&Board.names[id].name)||'Player';
Board.post=async(total,tp,birdies)=>{
  if(Board.mode==='api'){const name=cleanName(savedName());if(!name)return 'needname';
    try{const r=await fetch(API+'/board',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:Board.me,name,day:TODAY,total,toPar:tp,birdies})});
      if(!r.ok)return 'error';const j=await r.json();await Board.refresh();return j.status==='already'?'already':'ok';}catch(e){return 'error';}}
  if(!Board.db||!Board.me)return 'off';
  for(let i=0;i<25&&Board.status==='loading';i++)await new Promise(r=>setTimeout(r,200));   // never write before the current scores have loaded
  if(Board.status!=='ready')return 'error';
  const cur=Board.docs.find(d=>d.id===Board.me)||{},days=Object.assign({},cur.days||{});
  if(days[TODAY])return 'already';
  days[TODAY]={total,toPar:tp,birdies,at:Date.now()};
  const keep=Object.keys(days).sort().slice(-60),trimmed={};keep.forEach(k=>trimmed[k]=days[k]);
  const rounds=(cur.rounds||0)+1,sum=(cur.sum||0)+tp,best=cur.best==null?tp:Math.min(cur.best,tp);
  try{await Board.db.doc('scores/'+Board.me).set({days:trimmed,rounds,sum,best,lastDay:TODAY,updatedAt:Date.now()});return 'ok';}
  catch(e){return e&&e.code==='not_permitted'?'denied':'error';}
};
Board.html=()=>{
  const mine=localHistory();
  if(Board.status==='off'||Board.status==='error'){
    return `<p class="muted">${Board.mode==='api'?'Can’t reach the leaderboard right now. Check your connection.':'The shared leaderboard works when the game is opened on claude.ai by someone signed in.'}</p>${mine.length?`<div class="kicker"><span>Your daily rounds on this device</span></div><ol class="board">${mine.slice(-8).reverse().map(r=>`<li><span class="pos">·</span><span class="nm">${esc(r.date)}</span><span class="th">${r.total}</span><b class="${r.toPar<0?'under':''}">${fmtPar(r.toPar)}</b></li>`).join('')}</ol>`:''}`;}
  if(Board.status==='loading'||Board.status==='slow')return `<p class="muted">${Board.status==='slow'?'The leaderboard is taking a while to load.':'Loading the leaderboard…'}</p>`;
  const tabs=`<div class="seg"><button class="${Board.tab==='today'?'on':''}" data-b="today">Today</button><button class="${Board.tab==='week'?'on':''}" data-b="week">This week</button><button class="${Board.tab==='all'?'on':''}" data-b="all">All time</button></div>`;
  let rows;
  if(Board.tab==='today'){rows=Board.docs.filter(d=>d.days&&d.days[TODAY]).map(d=>({id:d.id,tp:d.days[TODAY].toPar,sub:d.days[TODAY].total+' strokes'})).sort((a,b)=>a.tp-b.tp);}
  else if(Board.tab==='week'){const wk=weekDays();
    rows=Board.docs.map(d=>{let w=d.week;if(!w&&d.days){const ds=wk.filter(k=>d.days[k]);w=ds.length?{rounds:ds.length,sum:ds.reduce((t,k)=>t+d.days[k].toPar,0)}:null;}return w&&w.rounds?{id:d.id,tp:Math.round(w.sum/w.rounds*10)/10,n:w.rounds,sub:`${w.rounds} round${w.rounds===1?'':'s'} this week · total ${fmtPar(w.sum)}`}:null;})
      .filter(Boolean).sort((a,b)=>a.tp-b.tp||b.n-a.n);}
  else{rows=Board.docs.filter(d=>d.rounds).map(d=>({id:d.id,tp:d.best,sub:`${d.rounds} round${d.rounds===1?'':'s'} · avg ${fmtPar(Math.round(d.sum/d.rounds*10)/10)}`})).sort((a,b)=>a.tp-b.tp||0);}
  const list=rows.length?`<ol class="board">${rows.slice(0,50).map((r,i)=>`<li class="${r.id===Board.me?'you':''}"><span class="pos">${i+1}</span><span class="nm">${esc(Board.name(r.id))}${r.id===Board.me?' <i>you</i>':''}<small>${esc(r.sub)}</small></span><b class="${r.tp<0?'under':''}">${fmtPar(r.tp)}</b></li>`).join('')}</ol>`:
    `<p class="muted">${Board.tab==='today'?'No scores yet today. Finish the daily round to post the first one.':Board.tab==='week'?'No daily rounds yet this week.':'No rounds posted yet.'}</p>`;
  return `${tabs}<p class="muted">${Board.tab==='today'?'Today’s daily round, lowest score first.':Board.tab==='week'?'Average score per daily round since Monday. Play every day to climb.':'Best daily round per player.'}</p>${list}`;
};
Board.bind=()=>document.querySelectorAll('[data-b]').forEach(b=>b.onclick=()=>{Board.tab=b.dataset.b;renderSheet();});
function localHistory(){try{return JSON.parse(localStorage.getItem('fairwayfc:history'))||[];}catch(e){return [];}}
function addHistory(rec){try{const h=localHistory().filter(r=>r.date!==rec.date);h.push(rec);localStorage.setItem('fairwayfc:history',JSON.stringify(h.slice(-120)));}catch(e){}}

// ================= Commentary lines =================
const pick2=a=>a[Math.floor(Math.random()*a.length)],pick=pick2;
const LINES={
  1:['Oh, that is a monster! Absolutely hammered.','What a strike! That’s gone for miles.','Get in! Legendary knowledge, legendary hit.'],
  2:['Lovely contact. That’s a big one.','Oh, sweetly struck. Deep cut, deep drive.','That’s found some serious distance.'],
  3:['Solid. Right down the middle.','Nicely played. No complaints there.','Safe enough. Good position.'],
  4:['Playing it safe there.','Bit of a short one, but it’s on the short grass.','The obvious answer, and an obvious shot.'],
  shank:['Oh dear. That’s shanked into the rough.','Oh no, that’s not on the list. Into the long stuff.','Ugly. Very ugly.'],
  water:['Oh, it’s in the drink! Penalty stroke.','Splash! Too slow, and it’s found the water.'],
  green:['That’s on the dance floor.','Lovely approach, it’s on the green.'],
  close:['Oh, that is stiff! Tap-in range.','What an approach! Right by the flag.'],
  holed:['It’s gone in! Unbelievable!','In the hole! Get in there!'],
  putt:['It’s in! Lovely putt.','Rattled the back of the cup!','Dead centre. Beautiful.'],
  bigputt:['From miles away! What a putt!','Unbelievable! The crowd goes wild!'],
  misputt:['Oh, it’s slid by.','Not enough on it. So close.','Just missed. Unlucky.'],
  read:['Read that perfectly.','Knows this green like the back of his hand.'],
  misread:['Misread that one. Tricky now.','Ooh, that read was off.']
};
// ================= Screens =================
let timer=null,busy=false;
function orbitCam(){if(!G.ok)return;const pin=P(hole().yds);G.camera.position.set(pin.x+120,90,pin.z+60);G.look.copy(pin);G.goalPos.set(pin.x-60,70,pin.z+120);G.goalLook.copy(P(hole().yds/2));G.rate=.15;G.rig.visible=false;}
function rulesHTML(){return `<ol class="rules">
      <li><b>Every kick is a question.</b> Name one correct answer in 25 seconds. Typos and short names are fine.</li>
      <li><b>Rarer answers fly further</b> and land closer to the pin.</li>
      <li><b>Wrong answer?</b> Shanked into the rough. <b>Out of time?</b> In the water, +1 penalty.</li>
      <li><b>On the green,</b> answer a quick question to read the break, then stop the power meter in the white zone.</li>
    </ol>
    <div class="tiers">${[4,3,2,1].map(t=>`<div class="tier t${t}"><b>${DRIVE[t]}y</b><span>${TIER[t]}</span></div>`).join('')}</div>`;}
const QDATE=typeof QUESTIONS_UPDATED!=='undefined'?QUESTIONS_UPDATED:'',QNEWS=typeof WHATS_NEW!=='undefined'?WHATS_NEW:[];
function whatsNewHTML(){let seen='';try{seen=localStorage.getItem('fairwayfc:seenNews')||'';}catch(e){}
  if(!QDATE||!QNEWS.length||seen===QDATE)return '';
  return `<div class="news" id="news"><div class="kicker"><span class="cat">What’s new</span><span>${esc(new Date(QDATE+'T12:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'}))}</span></div>
    <ul>${QNEWS.slice(0,5).map(n=>`<li>${esc(n)}</li>`).join('')}</ul><button class="btn ghost" id="newsOk">Got it</button></div>`;}
function menuScreen(){
  closeSheet();clearInterval(timer);
  const daily=readKey(KEY);const done=daily&&daily.phase==='done',started=daily&&daily.phase!=='start'&&!done;
  const dTot=done?totOf(daily.players[0]):0,dPar=done?daily.players[0].scores.reduce((t,s,i)=>t+s-daily.course[i].par,0):0;
  const other=readKey(OTHER),resume=other&&!['start','done'].includes(other.phase)&&other.mode!=='room';
  let active='daily';try{active=localStorage.getItem(ACTIVE)||'daily';}catch(e){}
  // the round you were last playing gets a big Continue button at the top
  const cont=active==='other'&&resume?other:started?daily:resume?other:null;
  state=daily||newRound(TODAY,'daily');state.menu=true;buildCourse();orbitCam();hud();
  $('#sub').textContent=new Date().toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}).toUpperCase();
  setCard(`<div class="kicker"><span class="cat">Clubhouse</span><span>9 holes · Par ${PARS.reduce((a,b)=>a+b)}</span></div>
    <h2 class="title">Football brain. <span>Golden boot.</span></h2>
    ${whatsNewHTML()}
    <div class="modes">
    ${cont?`<button class="mode hero cont" id="m-cont"><b>Continue</b><span>${esc(MODE_LABEL[cont.mode])}${cont.players.length>1?' · '+cont.players.length+' players':''} · hole ${cont.h+1} of ${cont.course.length}${cont.opts&&cont.opts.theme!=='all'?' · '+esc(THEMES[cont.opts.theme].label):''}</span><em>${cont.players.length>1?esc(cont.players[cont.cp].name)+' to play':'Your score: '+fmtPar(cont.players[0].scores.reduce((t,s,i)=>t+s-cont.course[i].par,0))}</em></button>`:''}
      <button class="mode ${cont?'':'hero'}" id="m-daily"><b>Daily round</b><span>Today’s nine holes, random questions every time. Posts to the leaderboard.</span>
        <em>${done?`Done today: ${dTot} (${fmtPar(dPar)})`:started?`In progress · hole ${daily.h+1} · tap to continue`:'Not played yet'}${dailyStreak()>1?` · ${dailyStreak()}-day streak`:''}</em></button>
    </div>
    <div class="kicker"><span>Solo</span><span>Play on your own</span></div>
    <div class="modes">
      <button class="mode" id="m-quick"><i class="tag3">3 HOLES</i><b>Quick round</b><span>Three holes, done in five minutes.</span></button>
      <button class="mode" id="m-full"><i class="tag18">18 HOLES</i><b>Full round</b><span>The full 18. Par 72.</span></button>
      <button class="mode" id="m-speed"><i class="tagspd">12 SECONDS</i><b>Speed round</b><span>Nine holes, half the time to answer.</span></button>
      <button class="mode" id="m-theme"><i class="tagthm">PICK A TOPIC</i><b>Theme round</b><span>Internationals, club football, or players &amp; managers.</span></button>
    </div>
    <div class="kicker"><span>With friends</span><span>Same phone or online</span></div>
    <div class="modes">
      <button class="mode" id="m-local"><i class="tagpp">2–4 PLAYERS</i><b>Pass &amp; play</b><span>Take turns on one phone. Lowest score wins.</span></button>
      <button class="mode" id="m-match"><i class="tagmp">HEAD TO HEAD</i><b>Match play</b><span>Win holes outright. Most holes won takes it.</span></button>
      <button class="mode" id="m-room"><i class="tagon">ONLINE</i><b>Online room</b><span>Friends join with a code on their own phones.</span></button>
      <button class="mode" id="m-practice"><i class="tagcu">YOUR RULES</i><b>Custom round</b><span>Choose holes, topic and clock yourself.</span></button>
    </div>
    <div class="row"><button class="btn ghost" id="m-kit"><span class="kitdot" style="--a:${myKit().shirt};--b:${myKit().pattern==='plain'?myKit().shirt:myKit().shirt2}"></span>${savedKit()?'Your kit':'Pick your kit'}</button><button class="btn ghost" id="m-board">Leaderboard</button><button class="btn ghost" id="m-badges">Badges ${BADGES.filter(x=>myBadges()[x[0]]).length}/${BADGES.length}</button>${API?'<button class="btn ghost" id="m-remind">Daily reminder</button>':''}</div>
    <details class="how"><summary>How to play</summary>${rulesHTML()}</details>
    <p class="muted ver">Version 2.2${QDATE?' · questions updated '+esc(new Date(QDATE+'T12:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'})):''}</p>`);
  const go=fn=>()=>{Sound.init();Sound.pop();fn();};
  $('#m-daily').onclick=go(()=>{state=readKey(KEY)||newRound(TODAY,'daily');delete state.menu;if(state.phase==='start'){const f=newRound(TODAY,'daily');state.order=f.order;state.porder=f.porder;state.qi=0;}
    if(state.phase==='done')return route();if(state.phase==='start')return begin();buildCourse();route();});
  const solo=o=>()=>{state=newRound('practice-'+Date.now(),'practice',['You'],null,o);begin();};
  $('#m-quick').onclick=go(solo({len:3}));$('#m-full').onclick=go(solo({len:18}));$('#m-speed').onclick=go(solo({len:9,clock:12}));
  $('#m-theme').onclick=go(themePick);
  $('#m-local').onclick=go(()=>localSetup({match:false}));$('#m-match').onclick=go(()=>localSetup({match:true}));$('#m-room').onclick=go(roomSetup);
  $('#m-practice').onclick=go(practiceSetup);
  if($('#newsOk'))$('#newsOk').onclick=()=>{try{localStorage.setItem('fairwayfc:seenNews',QDATE);}catch(e){}$('#news').remove();Sound.pop();};
  $('#m-board').onclick=go(()=>openSheet('board'));
  $('#m-badges').onclick=go(()=>openSheet('badges'));if($('#m-remind'))$('#m-remind').onclick=go(remindScreen);
  $('#m-kit').onclick=go(()=>kitScreen(myKit(),k=>{saveKit(k);menuScreen();},menuScreen,'Your kit'));
  if($('#m-cont'))$('#m-cont').onclick=go(()=>{state=cont===daily?readKey(KEY):readKey(OTHER);delete state.menu;buildCourse();$('#sub').textContent=MODE_LABEL[state.mode].toUpperCase();if(multi()&&state.phase==='shot'&&state.strokes===0)handoff();else route();});
}
async function begin(){
  delete state.menu;state.phase='shot';save();buildCourse();partyFlag(false);hud();
  $('#sub').textContent=(state.mode==='room'?'ROOM '+state.room.code:MODE_LABEL[state.mode]).toUpperCase();
  Sound.tee();wipe();setTimeout(()=>banner('HOLE 1',`PAR ${hole().par} · ${hole().yds} YDS`,MODE_LABEL[state.mode]),450);setCard(`<p class="muted">Flying over hole 1 · Par ${hole().par} · ${hole().yds} yards…</p>`,1);
  Sound.say(pick(['Welcome to the first tee.','Lovely day for it. Hole one.','Here we go. First tee.']));
  const gen=homeGen;await flyover();if(gen!==homeGen)return;if(multi())handoff();else route();
}
// Kit designer: live 3D preview, the player slowly turns so you see the front and the number on the back
function kitScreen(start,onDone,onBack,title){
  let kit=cleanKit(start);
  state.menu=true;buildCourse();poseRig();G.rig.visible=true;G.idle=true;
  let ang=0;if(G.ok){G.rate=4;G.follow=dt=>{ang+=(dt||.016)*.55;const c=G.golfer.getWorldPosition(new THREE.Vector3());
    const off=new THREE.Vector3(Math.sin(ang)*3.4,1.45,-Math.cos(ang)*3.4).applyQuaternion(G.rig.quaternion);G.goalPos.copy(c).add(off);G.goalLook.copy(c).setY(1.2);};}
  const sw=(field,list)=>`<div class="swatches" role="group" aria-label="${field}">${list.map(([hex,name])=>`<button class="sw ${kit[field]===hex?'on':''}" data-f="${field}" data-v="${hex}" style="--c:${hex}" aria-label="${name}" aria-pressed="${kit[field]===hex}"></button>`).join('')}</div>`;
  const draw=()=>{applyKit(kit,savedName());
    setCard(`<div class="kicker"><span class="cat">${esc(title||'Your kit')}</span><span>Turns so you can see the back</span></div>
      <div class="kitrow"><label>Shirt</label>${sw('shirt',KIT_COLOURS)}</div>
      <div class="kitrow"><label>Pattern</label><div class="seg pat">${KIT_PATTERNS.map(([k,l])=>`<button data-p="${k}" class="${kit.pattern===k?'on':''}">${l}</button>`).join('')}</div></div>
      ${kit.pattern!=='plain'?`<div class="kitrow"><label>Second colour</label>${sw('shirt2',KIT_COLOURS)}</div>`:''}
      <div class="kitrow"><label>Shorts</label>${sw('shorts',KIT_COLOURS)}</div>
      <div class="kitrow"><label>Socks</label>${sw('socks',KIT_COLOURS)}</div>
      <div class="kitrow"><label for="kitnum">Number</label><input type="number" id="kitnum" min="1" max="99" inputmode="numeric" value="${kit.num}"></div>
      <div class="row"><button class="btn ghost" id="kitRand">Surprise me</button></div>
      <div class="row end"><button class="btn ghost" id="kitBack">Back</button><button class="btn" id="kitDone">Save kit</button></div>`,true);
    document.querySelectorAll('.sw').forEach(b=>b.onclick=()=>{Sound.pop();kit[b.dataset.f]=b.dataset.v;keep(draw);});
    document.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{Sound.pop();kit.pattern=b.dataset.p;if(kit.pattern!=='plain'&&kit.shirt2===kit.shirt)kit.shirt2=kit.shirt==='#f4f4f2'?'#15171c':'#f4f4f2';keep(draw);});
    $('#kitnum').oninput=e=>{const n=parseInt(e.target.value,10);if(n>=1&&n<=99){kit.num=n;applyKit(kit,savedName());}};
    $('#kitRand').onclick=()=>{Sound.pop();const c=()=>KIT_COLOURS[Math.floor(Math.random()*KIT_COLOURS.length)][0];
      kit={shirt:c(),shirt2:c(),pattern:KIT_PATTERNS[Math.floor(Math.random()*KIT_PATTERNS.length)][0],shorts:c(),socks:c(),num:1+Math.floor(Math.random()*30)};keep(draw);};
    $('#kitBack').onclick=()=>{G.follow=null;Sound.pop();onBack();};
    $('#kitDone').onclick=()=>{G.follow=null;Sound.tee();onDone(cleanKit(kit));};};
  const keep=fn=>{const c=$('#card'),y=c.scrollTop;fn();c.scrollTop=y;};
  draw();
}
function lastOpts(){try{return cleanOpts(JSON.parse(localStorage.getItem('fairwayfc:opts')));}catch(e){return cleanOpts(DEFAULT_OPTS);}}
function keepOpts(o){try{localStorage.setItem('fairwayfc:opts',JSON.stringify(cleanOpts(o)));}catch(e){}}
function optsHTML(o,withScoring){o=cleanOpts(o);const seg=(k,list)=>`<div class="seg opt" data-k="${k}">${list.map(([v,l])=>`<button data-v="${v}" class="${String(o[k])===String(v)?'on':''}">${l}</button>`).join('')}</div>`;
  return `<div class="optgrid">
    <div class="kitrow"><label>Holes</label>${seg('len',[[3,'Quick 3'],[9,'9 holes'],[18,'18 holes']])}</div>
    <div class="kitrow"><label>Questions</label>${seg('theme',Object.entries(THEMES).map(([k,t])=>[k,t.label]))}</div>
    <div class="kitrow"><label>Clock</label>${seg('clock',[[25,'Normal · 25s'],[12,'Speed · 12s']])}</div>
    ${withScoring?`<div class="kitrow"><label>Scoring</label>${seg('match',[[false,'Stroke play'],[true,'Match play']])}</div>`:''}</div>
    <p class="hint optnote">${withScoring?'<b>Stroke play:</b> lowest total wins. <b>Match play:</b> win holes outright; most holes won takes it.':'<b>Speed</b> halves the clock. Themes narrow the questions to one area of the game.'}</p>`;}
function bindOpts(o,redraw){document.querySelectorAll('.seg.opt').forEach(s=>s.querySelectorAll('button').forEach(b=>b.onclick=()=>{Sound.pop();const k=s.dataset.k,v=b.dataset.v;
  o[k]=k==='theme'?v:k==='match'?v==='true':+v;keepOpts(o);redraw();}));}
function keepScroll(fn){const c=$('#card'),y=c.scrollTop;fn();c.scrollTop=y;}
function practiceSetup(){
  const o=lastOpts();o.match=false;
  const draw=()=>keepScroll(()=>{setCard(`<div class="kicker"><span class="cat">Practice</span><span>A brand-new course</span></div>
    <h2 class="q">Set up your round</h2>${optsHTML(o,false)}
    <div class="row end"><button class="btn ghost" id="back">Back</button><button class="btn" id="go">Tee off</button></div>`,true);
    bindOpts(o,draw);$('#back').onclick=menuScreen;$('#go').onclick=()=>{state=newRound('practice-'+Date.now(),'practice',['You'],null,o);begin();};});
  draw();
}
// Daily reminder: a repeating calendar event, so phones remind people without any app or account
function remindScreen(){let t='18:00';
  const draw=()=>setCard(`<div class="kicker"><span class="cat">Daily reminder</span><span>Keeps your streak alive</span></div>
    <h2 class="q">When should we remind you?</h2>
    <div class="seg opt">${['07:30','12:30','18:00','20:00'].map(x=>`<button data-r="${x}" class="${x===t?'on':''}">${x}</button>`).join('')}</div>
    <p class="hint">This adds a daily event to your phone’s calendar with a link back to the game. You can delete it from your calendar any time.</p>
    <div class="row end"><button class="btn ghost" id="back">Back</button><button class="btn" id="addCal">Add to calendar</button></div><p class="muted" id="rmsg"></p>`,true);
  const bind=()=>{document.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{Sound.pop();t=b.dataset.r;draw();bind();});$('#back').onclick=menuScreen;
    $('#addCal').onclick=()=>{const [hh,mm]=t.split(':').map(Number),d=new Date();if(d.getHours()*60+d.getMinutes()>=hh*60+mm)d.setDate(d.getDate()+1);
      const p=n=>String(n).padStart(2,'0'),start=`${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}T${p(hh)}${p(mm)}00`,now=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+/,'');
      const url=location.origin+'/';const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Fairway FC//Daily reminder//EN','BEGIN:VEVENT',`UID:fairwayfc-${Date.now()}@fairwayfc`,`DTSTAMP:${now}`,
        `DTSTART:${start}`,'DURATION:PT10M','RRULE:FREQ=DAILY','SUMMARY:Fairway FC daily round',`DESCRIPTION:Today's course is ready. Keep your streak going: ${url}`,`URL:${url}`,
        'BEGIN:VALARM','TRIGGER:PT0M','ACTION:DISPLAY','DESCRIPTION:Fairway FC daily round','END:VALARM','END:VEVENT','END:VCALENDAR'].join('\r\n');
      const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([ics],{type:'text/calendar'}));a.download='fairway-fc-daily.ics';document.body.appendChild(a);a.click();
      setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},2000);$('#rmsg').textContent='Opening your calendar… tap Add to save the reminder.';Sound.tee();};};
  draw();bind();
}
function themePick(){
  setCard(`<div class="kicker"><span class="cat">Theme round</span><span>9 holes</span></div>
    <h2 class="q">Pick your topic</h2>
    <div class="modes">${Object.entries(THEMES).filter(([k])=>k!=='all').map(([k,t])=>`<button class="mode" data-t="${k}"><b>${esc(t.label)}</b><span>${k==='world'?'World Cups, Euros, Copa América, the Lionesses and England.':k==='clubs'?'Premier League, the cups, grounds, Europe and the Seasiders.':'Career paths, managers and award winners.'}</span></button>`).join('')}</div>
    <div class="row end"><button class="btn ghost" id="back">Back</button></div>`,true);
  document.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{Sound.pop();state=newRound('practice-'+Date.now(),'practice',['You'],null,{len:9,theme:b.dataset.t});begin();});
  $('#back').onclick=menuScreen;
}
function localSetup(preset){
  let names=['Player 1','Player 2'];
  const mine=myKit(),pool=KIT_PRESETS.filter(k=>k.shirt!==mine.shirt);
  let kits=[mine,pool[0],pool[1],pool[2]].map(cleanKit);const o=Object.assign(lastOpts(),preset||{});
  const draw=()=>{setCard(`<div class="kicker"><span class="cat">${o.match?'Match play':'Pass &amp; play'}</span><span>${names.length} players</span></div>
    <h2 class="q">Who’s playing?</h2>
    <div class="names">${names.map((n,i)=>`<div class="namerow"><label for="pn${i}">Player ${i+1}</label><input type="text" id="pn${i}" maxlength="16" value="${esc(n)}" autocomplete="off"><button class="kitbtn" data-k="${i}" aria-label="Change kit for player ${i+1}"><span class="kitdot" style="--a:${kits[i].shirt};--b:${kits[i].pattern==='plain'?kits[i].shirt:kits[i].shirt2}"></span>Kit</button>${names.length>2?`<button class="x" data-i="${i}" aria-label="Remove player ${i+1}">✕</button>`:''}</div>`).join('')}</div>
    <div class="row">${names.length<4?'<button class="btn ghost" id="addp">Add player</button>':''}</div>
    <p class="hint">Each player plays the whole hole, then passes the phone on. Everyone gets different questions. Tap <b>Kit</b> to choose each player’s colours.</p>
    ${optsHTML(o,true)}
    <div class="row end"><button class="btn ghost" id="back">Back</button><button class="btn" id="startp">Tee off</button></div>`);
    const grab=()=>names=names.map((_,i)=>$('#pn'+i).value);
    if($('#addp'))$('#addp').onclick=()=>{grab();names.push('Player '+(names.length+1));draw();};
    document.querySelectorAll('.namerow .x').forEach(b=>b.onclick=()=>{grab();const i=+b.dataset.i;names.splice(i,1);kits.push(kits.splice(i,1)[0]);draw();});
    document.querySelectorAll('.kitbtn').forEach(b=>b.onclick=()=>{grab();const i=+b.dataset.k;Sound.pop();
      kitScreen(kits[i],k=>{kits[i]=k;state.menu=true;orbitCam();draw();},()=>{orbitCam();draw();},`${names[i]||'Player '+(i+1)}’s kit`);});
    bindOpts(o,()=>{grab();keepScroll(draw);});
    $('#back').onclick=menuScreen;
    $('#startp').onclick=()=>{grab();state=newRound('local-'+Date.now(),'local',names.map((n,i)=>cleanName(n)||'Player '+(i+1)),kits.slice(0,names.length),o);begin();};};
  draw();
}
async function roomSetup(){
  let nm='';try{nm=localStorage.getItem('fairwayfc:name')||'';}catch(e){}
  const code=Array.from({length:4},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');const ro=lastOpts();ro.match=false;
  setCard(`<div class="kicker"><span class="cat">Online room</span><span id="rstat">Connecting…</span></div>
    <h2 class="q">Play the same holes with friends.</h2>
    <div class="names"><div class="namerow"><label for="rname">Your name</label><input type="text" id="rname" maxlength="16" value="${esc(nm)}" placeholder="e.g. Jack" autocomplete="off"></div>
      <div class="namerow"><label for="rcode">Room code</label><input type="text" id="rcode" maxlength="8" value="${code}" autocomplete="off" autocapitalize="characters" spellcheck="false"></div></div>
    <p class="hint">Share the code. Everyone who enters it gets the same course and questions, and sees each other’s scores live.</p>
    <div id="roomOpts">${optsHTML(ro,false)}</div>
    <p class="hint">Joining a room someone has already started? You’ll get their settings automatically.</p>
    <div class="row end"><button class="btn ghost" id="back">Back</button><button class="btn" id="join" disabled>Join room</button></div>`);
  const redraw=()=>{$('#roomOpts').innerHTML=optsHTML(ro,false);bindOpts(ro,redraw);};bindOpts(ro,redraw);
  $('#back').onclick=menuScreen;
  const api=await Room.load();
  if(!api){$('#rstat').textContent='Unavailable';$('#join').disabled=true;
    $('.hint').innerHTML='<b>Online rooms aren’t available here.</b> Try pass &amp; play instead.';return;}
  $('#rstat').textContent='Ready';$('#join').disabled=false;
  $('#join').onclick=async()=>{const name=cleanName($('#rname').value),c=$('#rcode').value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
    if(!name){$('#rname').focus();$('.hint').innerHTML='<b>Add a name</b> (keep it friendly) so others know who you are.';return;}
    if(c.length<3){$('.hint').innerHTML='<b>Room codes are 3 to 8 letters or numbers.</b>';return;}
    try{localStorage.setItem('fairwayfc:name',name);}catch(e){}
    $('#join').disabled=true;$('#rstat').textContent='Joining…';
    const ok=await Room.join(c.toLowerCase());
    if(!ok){$('#rstat').textContent='Couldn’t join';$('#join').disabled=false;$('.hint').innerHTML='<b>Couldn’t join that room.</b> Check your connection and try again.';return;}
    // if someone is already in the room, use their settings so everyone plays the same course
    $('#rstat').textContent='Checking the room…';let theirs=null;
    for(let i=0;i<8&&!theirs;i++){await new Promise(r=>setTimeout(r,250));const p=Room.peers.find(x=>!x.isMe&&x.presence&&x.presence.opts);if(p)theirs=cleanOpts(p.presence.opts);}
    const use=theirs||cleanOpts(ro);
    state=newRound('room-'+c+'-'+TODAY+'-'+use.len+use.theme+use.clock,'room',[name],null,use);state.room={code:c};
    toast(theirs?`Joined room ${c}: ${optsLabel(use)}`:`You’re in room ${c}`);begin();};
}
function handoff(){
  hud();poseRig();addressCam();
  const p=state.players[state.cp],others=standings().map(s=>({n:s.p.name,tp:s.tp,thru:s.thru,txt:scoreText(s)}));
  Sound.say(pick2(['Next player, you’re up.','Over to you now.','Your turn. Good luck.']));banner(p.name.toUpperCase(),`HOLE ${state.h+1} · PAR ${hole().par}`,`${state.scores.length?fmtPar(toPar()):'E'} so far`);
  setCard(`<div class="kicker"><span class="cat">Hole ${state.h+1} · Par ${hole().par} · ${hole().yds} yds</span><span>Pass &amp; play</span></div>
    <h2 class="title">${esc(p.name)}, <span>you’re up.</span></h2>
    <p class="hint">Pass the phone to <b>${esc(p.name)}</b>.</p>
    <ol class="board">${others.map((o,i)=>`<li class="${o.n===p.name?'you':''}"><span class="pos">${i+1}</span><span class="nm">${esc(o.n)}</span><span class="th">${o.thru?'Thru '+o.thru:'—'}</span><b class="${!optsOf().match&&o.tp<0?'under':''}">${o.txt}</b></li>`).join('')}</ol>
    <div class="row end"><button class="btn" id="ready">I’m ready</button></div>`);
  $('#ready').onclick=()=>{Sound.tee();route();};
}
function shotScreen(){
  hud();poseRig();addressCam();
  const q=curQ(),factor=state.lie==='rough'?.8:1,reach=state.rem<=DRIVE[4]*factor+5;markSeen(SEEN_KEY,q.id);
  state.pending=true;save();
  const hint=state.lie==='rough'?'<b>In the rough.</b> Every shot goes 20% shorter.':reach?'<b>Any correct answer finds the green.</b> Rarer lands closer.':
    state.rem<=DRIVE[1]?'<b>A Legend answer</b> could reach the green from here.':`<b>${state.rem} yards</b> to the pin. Rarer answers fly further.`;
  setCard(`<div class="kicker"><span class="cat">${esc(q.cat)}</span><span>Shot ${state.strokes+1} · <span id="secs">${clockSecs()}</span>s</span></div>
    <h2 class="q">${esc(q.q)}</h2>
    <div class="clock" id="clk"><i></i></div>
    <p class="hint">${hint}</p>
    <form id="f" autocomplete="off"><input type="text" id="guess" placeholder="Type your answer…" aria-label="Your answer" enterkeyhint="go" autocapitalize="words" spellcheck="false"><button class="btn green">Kick</button></form>`);
  const inp=$('#guess');setTimeout(()=>inp.focus({preventScroll:true}),50);
  $('#f').onsubmit=e=>{e.preventDefault();if(inp.value.trim())takeShot(inp.value.trim());};
  const SECS=clockSecs(),end=performance.now()+SECS*1000;let last=SECS;clearInterval(timer);
  timer=setInterval(()=>{if(!$('#clk')){clearInterval(timer);return;}const left=Math.max(0,end-performance.now()),sec=Math.ceil(left/1000);
    $('#clk i').style.transform=`scaleX(${left/(SECS*1000)})`;$('#secs').textContent=sec;$('#clk').classList.toggle('low',left<6000);
    if(sec!==last){last=sec;if(sec<=5&&sec>0)Sound.tick(sec===1);}
    if(left<=0)takeShot(null);},100);
}

async function takeShot(guess){
  if(busy)return;busy=true;clearInterval(timer);document.activeElement&&document.activeElement.blur();
  $('#card').querySelectorAll('input,button').forEach(e=>e.disabled=true);
  const q=curQ(),c=hole();state.qi++;state.pending=false;
  const m=guess==null?null:match(q,guess),hit=m&&m.a;
  const from=ballSpot();const wasRough=state.lie==='rough';
  const res={q:q.id,guess,hit:hit&&hit.n,tier:hit&&hit.t,fuzzy:m&&m.fuzzy};
  state.strokes++;
  if(guess==null){state.strokes++;res.kind='water';res.title='Splash!';res.line='Out of time. One-stroke penalty, and you’ll replay from the same spot.';}
  else if(!hit){const adv=state.rem>45?18:Math.max(3,Math.round(state.rem*.4));state.rem-=adv;state.lie='rough';
    res.kind='shank';res.title='Shanked it';res.line=`“${guess}” isn’t on the list. It squirts ${adv} yards into the rough.`;}
  else{const t=hit.t,dist=Math.round(DRIVE[t]*(wasRough?.8:1));
    if(dist>=state.rem-5){
      if(t===1&&state.rem<=75&&!wasRough){res.kind='holed';res.title=state.strokes===1?'Hole in one!':'Holed it!';res.line=`From ${state.rem} yards with a Legend answer.`;res.from=state.rem;state.rem=0;state.holed=true;}
      else{const ft=Math.round(PROX[t]*(wasRough?1.5:1));res.kind='green';res.title=ft<=6?'Stiffed it!':'On the green';res.line=`${state.rem} yards in. It settles ${ft} feet from the cup.`;
        state.rem=0;state.ft=ft;state.phase='putt';}
    }else{state.rem-=dist;state.lie='fairway';res.kind='fairway';res.title=SHOT[t];res.line=`${dist} yards, straight down the middle. ${state.rem} to go.`;res.dist=dist;}
  }
  if(!state.holed&&state.phase!=='putt'&&state.strokes>=c.par+4)state.picked=true;
  if(!multi()){if(hit&&hit.t===1){award('legend1');if(bumpStat('legends')>=25)award('legend25');}if(res.kind==='holed'){award('chipin');if(state.strokes===1)award('ace');}}
  save();
  await playShot(res,from);
  busy=false;shotResult(res);
}
async function playShot(res,from){
  setCard(`<p class="muted">${res.guess==null?'Time’s up…':'Run-up…'}</p>`,1);
  const L=hole().yds,pin=P(L);
  G.tracerColor=res.tier?{1:0xffb21e,2:0xb57bff,3:0x47b2ff,4:0xffffff}[res.tier]:0xff5a4e;
  if(res.guess!=null)await swingAnim(false);
  Sound.strike(res.tier===1);particles(from,0x7fca56,14,3,4,.6,.25);
  if(res.kind==='water'){const ws=waterSpot(),wp=P(ws.d,ws.lat);Sound.whoosh();
    await flight(from,wp,12,1500);Sound.splash();G.ok&&(G.ball.visible=false,G.blob.visible=false);ripples(wp);particles(wp,0xffffff,60,4,9,1.2,.5);
    shout('SPLASH!','+1 penalty');Sound.say(pick2(LINES.water));await wait(900);Sound.groan();await wait(900);return;}
  if(res.kind==='shank'){const to=ballSpot();await flight(from,to,2.5,800);Sound.rough();particles(to,0x2e6b22,40,3,5,.9);shout('SHANKED!');Sound.groan();Sound.say(pick2(LINES.shank));await wait(1300);return;}
  Sound.whoosh();
  const h=res.tier===1?22:res.tier===2?18:res.tier===3?14:10,ms=res.tier===1?2200:1900;Sound.whistle(ms);
  if(res.kind==='fairway')setTimeout(()=>Sound.say(pick2(LINES[res.tier])),500);
  if(res.kind==='fairway'){const to=ballSpot();await flight(from,to,h,ms);Sound.thud();particles(to,0x9be070,14,2,3,.6);
    shout(res.title.toUpperCase(),`${res.dist} YARDS`,res.tier<=2);banner(`${res.dist} YDS`,`${state.rem} TO THE PIN`,TIER[res.tier]+' answer',{1:'#ffb21e',2:'#b57bff',3:'#47b2ff',4:'#e8edf2'}[res.tier]);if(res.tier<=2)Sound.ooh();await rollTo(to.clone(),300);await wait(1100);return;}
  const back=P(L-12).sub(pin).normalize();
  if(res.kind==='holed'){const land=pin.clone().addScaledVector(back,6);await flight(from,land,h,ms);Sound.thud();
    if(G.ok){G.goalPos.copy(pin).addScaledVector(back,9).setY(3);G.goalLook.copy(pin);G.rate=3;}
    await rollTo(pin.clone(),800);Sound.cup();await dropInCup();partyFlag(true);crowdCheer(true);confetti();Sound.cheer(true);shout(res.title.toUpperCase(),`FROM ${res.from} YARDS`,true);Sound.say(pick2(LINES.holed));Sound.fanfare('eagle');await wait(2200);return;}
  const land=pin.clone().addScaledVector(back,state.ft/3+3),stop=pin.clone().addScaledVector(back,state.ft/3);
  await flight(from,land,h,ms);Sound.thud();if(G.ok){G.goalPos.copy(pin).addScaledVector(back,state.ft/3+14).setY(5);G.goalLook.copy(pin);G.rate=2.5;}
  Sound.say(pick2(state.ft<=6?LINES.close:LINES.green));await rollTo(stop,700);Sound.murmur();shout(res.title.toUpperCase(),`${state.ft} FEET`,state.ft<=9);if(state.ft<=9){Sound.cheer(false);crowdCheer(false);}else Sound.clap();await wait(1300);
}
function answerBlock(qid,hitName){
  const q=byId[qid],sorted=q.answers.slice().sort((a,b)=>a.t-b.t||a.n.localeCompare(b.n));
  const legends=sorted.filter(a=>a.t===1&&a.n!==hitName).slice(0,4).map(a=>`<b>${esc(a.n)}</b>`).join(', ');
  return `${legends?`<p class="rarer">Legend answers: ${legends}</p>`:''}
    <details><summary>See all ${q.answers.length} answers</summary><ul class="ans">${sorted.map(a=>`<li class="${a.n===hitName?'you':''}"><span class="dot t${a.t}"></span>${esc(a.n)}</li>`).join('')}</ul></details>`;
}
function shotResult(res){
  hud();
  const good=res.kind==='holed'||(res.tier&&res.tier<=2);
  const tag=res.hit?`<span class="tag t${res.tier}">${TIER[res.tier]}</span> `:`<span class="tag miss">${res.kind==='water'?'Time':'Miss'}</span> `;
  const said=res.hit?(res.fuzzy?`“${esc(res.guess)}” counted as <b>${esc(res.hit)}</b>. `:`You said <b>${esc(res.hit)}</b>. `):'';
  const nextLabel=state.holed||state.picked?'Finish hole':state.phase==='putt'?'Line up putt':'Next shot';
  setCard(`<div class="kicker"><span>Hole ${state.h+1} · Stroke ${state.strokes}</span><span>${state.phase==='putt'?state.ft+' ft to the cup':state.holed?'In the cup':state.rem+' yds to pin'}</span></div>
    <div class="result"><h3 class="${good?'good':''}">${tag}${esc(res.title)}</h3><p>${said}${esc(res.line)}</p></div>
    ${answerBlock(res.q,res.hit)}
    <div class="row end"><button class="btn" id="nx">${nextLabel}</button></div>`);
  const b=$('#nx');b.focus({preventScroll:true});b.onclick=()=>{Sound.click();if(state.holed||state.picked)endHole();else route();};
}

// ---------- Putting ----------
let raf=null;
const PD=ft=>ft<=8?1:ft<=18?2:3,PLABEL={1:'Easy read',2:'Tricky read',3:'Hard read'},PSECS=12;
function puttScreen(){
  clearInterval(timer);hud();poseRig();addressCam();aimLine(true);
  if(state.pread==null)return puttQuestion();
  const ft=state.ft,good=state.pread==='good',max=Math.max(12,Math.ceil(ft*1.6));
  const tol=(1+ft*.04)*(good?2.2:.75),period=Math.max(800,1700-ft*22)*(good?1.4:.8);
  const zl=Math.max(0,(ft-tol)/max*100),zw=Math.min(100-zl,tol*2/max*100);
  setCard(`<div class="kicker"><span class="cat">${good?'Break read':'Misread'}</span><span>Putt for ${state.strokes+1}</span></div>
    <h2 class="q">${ft} feet. Stop the meter in the white zone.</h2>
    <p class="hint">${good?'<b>You read the break.</b> Wide zone, slow meter.':'<b>You misread it.</b> Tight zone, quick meter.'}</p>
    <div class="meter" id="meter" role="button" tabindex="0" aria-label="Putting power meter">
      <div class="zone" style="left:${zl}%;width:${zw}%"></div><div class="cur" id="cur"></div>
      <div class="lab"><span>SOFT</span><span>${max} FT</span></div></div>
    <div class="row"><button class="btn green" id="putt">Putt</button><span class="muted">Tap the meter, the button or press Space.</span></div>`);
  const cur=$('#cur'),t0=performance.now();let pos=0,done=false;
  cancelAnimationFrame(raf);
  (function f(n){const ph=((n-t0)%period)/period;pos=ph<.5?ph*2:2-ph*2;cur.style.left=(pos*100)+'%';if(!done)raf=requestAnimationFrame(f);})(t0);
  const stop=()=>{if(done)return;done=true;meterStop=null;cancelAnimationFrame(raf);removeEventListener('keydown',key);hitPutt(pos*max,ft,tol);};
  meterStop=()=>{done=true;cancelAnimationFrame(raf);removeEventListener('keydown',key);};
  const key=e=>{if(e.code==='Space'||e.key==='Enter'){e.preventDefault();stop();}};
  addEventListener('keydown',key);$('#putt').onclick=stop;$('#meter').onclick=stop;$('#putt').focus({preventScroll:true});
}
function puttQuestion(){
  const d=PD(state.ft),list=state.porder[d],pidx=list[state.pi[d]%list.length],pq=PUTTS[pidx];markSeen(PSEEN_KEY,pidx);
  state.ppending=true;save();
  const opts=shuffle([pq.a,...pq.w],Math.random);
  setCard(`<div class="kicker"><span class="cat">Read the green · ${PLABEL[d]}</span><span>${state.ft} ft · <span id="secs">${PSECS}</span>s</span></div>
    <h2 class="q">${esc(pq.q)}</h2>
    <div class="clock" id="clk"><i></i></div>
    <div class="opts">${opts.map((o,i)=>`<button class="opt" data-i="${i}">${esc(o)}</button>`).join('')}</div>
    <p class="hint">Get it right to read the break: a wider zone and a slower meter.</p>`);
  let answered=false;
  const answer=pick=>{if(answered)return;answered=true;clearInterval(timer);
    const ok=pick===pq.a;state.pi[d]++;state.ppending=false;state.pread=ok?'good':'bad';save();
    document.querySelectorAll('.opt').forEach(b=>{b.disabled=true;if(b.textContent===pq.a)b.classList.add('right');else if(b.textContent===pick)b.classList.add('wrong');});
    if(ok){Sound.tee();shout('READ IT!','WIDE ZONE',true);Sound.say(pick2(LINES.read));}else{Sound.groan();shout(pick==null?'TOO SLOW':'MISREAD','TIGHT ZONE');Sound.say(pick2(LINES.misread));}
    setTimeout(puttScreen,reduce()?200:1300);};
  document.querySelectorAll('.opt').forEach(b=>b.onclick=()=>{Sound.click();answer(b.textContent);});
  const end=performance.now()+PSECS*1000;let last=PSECS;clearInterval(timer);
  timer=setInterval(()=>{if(!$('#clk')){clearInterval(timer);return;}const left=Math.max(0,end-performance.now()),sec=Math.ceil(left/1000);
    $('#clk i').style.transform=`scaleX(${left/(PSECS*1000)})`;$('#secs').textContent=sec;$('#clk').classList.toggle('low',left<4000);
    if(sec!==last){last=sec;if(sec<=3&&sec>0)Sound.tick(sec===1);}
    if(left<=0)answer(null);},100);
}
async function hitPutt(power,ft,tol){
  busy=true;aimLine(false);state.pread=null;
  $('#card').querySelectorAll('button').forEach(b=>b.disabled=true);
  state.strokes++;const err=power-ft;let res;
  if(Math.abs(err)<=tol){res={kind:'in',title:ft>=20?'Monster putt!':'In the hole!'};state.holed=true;}
  else{const left=Math.round(Math.abs(err)*10)/10;
    if(left<=2){res={kind:'tap',title:err<0?'Just short':'Slid past',line:`${left} feet left. That’s a gimme, tapped in.`};state.strokes++;state.holed=true;}
    else{res={kind:'miss',title:err<0?'Left it short':'Raced past',line:`${left} feet left for the next one.`,left};}}
  if(!state.holed&&state.strokes>=hole().par+4)state.picked=true;
  const pin=P(hole().yds),back=P(hole().yds-12).sub(pin).normalize();
  const endPt=res.kind==='in'?pin.clone():pin.clone().addScaledVector(back,-err/3);
  if(res.kind==='miss')state.ft=res.left;
  save();
  await swingAnim(true);Sound.putt();
  const ms=Math.min(2200,600+ft*40);Sound.roll(ms/1000);if(ft>=12)Sound.drumroll(ms);
  if(G.ok){G.goalPos.copy(G.camera.position);G.goalLook.copy(pin);G.rate=2;}
  await rollTo(endPt,ms);
  if(res.kind==='in'&&ft>=20&&!multi())award('longputt');
  if(res.kind==='in'){Sound.cup();await dropInCup();partyFlag(true);crowdCheer(ft>=15);Sound.say(pick2(ft>=15?LINES.bigputt:LINES.putt));if(ft>=15){confetti();Sound.cheer(true);}else Sound.cheer(false);shout(res.title.toUpperCase(),'',true);}
  else{if(Math.abs(err)<4)Sound.lip();Sound.ooh();Sound.say(pick2(LINES.misputt));shout(res.title.toUpperCase());}
  await wait(1300);busy=false;
  hud();
  setCard(`<div class="kicker"><span>Hole ${state.h+1} · Stroke ${state.strokes}</span><span>${state.holed?'In the cup':state.ft+' ft left'}</span></div>
    <div class="result"><h3 class="${res.kind==='in'?'good':''}">${esc(res.title)}</h3><p>${esc(res.line||'Dead centre, rattled the back of the cup.')}</p></div>
    <div class="row end"><button class="btn" id="nx">${state.holed||state.picked?'Finish hole':'Putt again'}</button></div>`);
  const b=$('#nx');b.focus({preventScroll:true});b.onclick=()=>{Sound.click();if(state.holed||state.picked)endHole();else route();};
}

// ---------- Hole and round end ----------
function holeName(s,par){if(s===1)return 'Hole in one';const d=s-par;return d<=-3?'Albatross':d===-2?'Eagle':d===-1?'Birdie':d===0?'Par':d===1?'Bogey':d===2?'Double bogey':d===3?'Triple bogey':'+'+d;}
function endHole(){const c=hole();state.scores[state.h]=state.picked&&!state.holed?c.par+4:state.strokes;state.phase='holeDone';save();route(true);}
function greenCam(){if(!G.ok)return;aimLine(false);const pin=P(hole().yds);G.goalPos.copy(pin).add(new THREE.Vector3(14,9,16));G.goalLook.copy(pin).setY(1);G.rate=1.2;G.rig.visible=false;}
function resetBall(){Object.assign(state,{rem:hole().yds,lie:'tee',strokes:0,phase:'shot',ft:0,holed:false,picked:false,pread:null,ppending:false,pending:false});state.scores=state.players[state.cp].scores;}
function holeDone(fresh){
  hud();greenCam();
  const c=hole(),s=state.scores[state.h],d=s-c.par,name=holeName(s,c.par);
  if(fresh&&!multi()){if(d<=-2)award('eagle');if(state.scores.filter((x,i)=>x!=null&&x<state.course[i].par).length>=3)award('birdies3');}
  if(fresh){if(d<0){Sound.cheer(d<=-2);Sound.fanfare(d<=-2?'eagle':'birdie');shout(name.toUpperCase(),'',true);if(d<=-2)confetti();crowdCheer(d<=-2);Sound.say(d<=-2?`${name}! Sensational.`:'Birdie! Lovely stuff.');}
    else if(d===0){Sound.clap();Sound.fanfare('par');shout('PAR');Sound.say('A solid par.');}else{Sound.fanfare('bogey');shout(name.toUpperCase());Sound.say(d===1?'Dropped a shot there.':'Oh, a hole to forget.');}}
  const lastHole=state.h===state.course.length-1,lastPlayer=state.cp===state.players.length-1;
  const nextLabel=!lastPlayer?`Pass to ${esc(state.players[state.cp+1].name)}`:lastHole?'Sign the card':'Next tee';
  setCard(`<div class="kicker"><span>${multi()?esc(curName())+' · ':''}Hole ${state.h+1} complete</span><span>Round ${fmtPar(toPar())}</span></div>
    <div class="result"><h3 class="${d<0?'good':''}">${name}</h3><p>${state.picked&&!state.holed?'Picked up at the stroke limit.':`<b>${s}</b> on a par ${c.par}.`}</p></div>
    ${cardTable()}
    <div class="row end"><button class="btn" id="nx">${nextLabel}</button></div>`);
  const b=$('#nx');b.focus({preventScroll:true});
  b.onclick=async()=>{Sound.tee();
    if(!lastPlayer){state.cp++;resetBall();save();buildCourse();handoff();return;}
    if(lastHole){state.phase='done';save();route(true);return;}
    state.h++;state.cp=0;wipe();await new Promise(r=>setTimeout(r,reduce()?0:420));resetBall();save();buildCourse();partyFlag(false);hud();
    setTimeout(()=>banner(`HOLE ${state.h+1}`,`PAR ${hole().par} · ${hole().yds} YDS`,multi()?'Pass & play':MODE_LABEL[state.mode]),300);
    setCard(`<p class="muted">Hole ${state.h+1} · Par ${hole().par} · ${hole().yds} yards</p>`,1);
    Sound.say([`Hole ${state.h+1}.`,`Par ${hole().par}.`]);const gen=homeGen;await flyover();if(gen!==homeGen)return;if(multi())handoff();else route();};
}
const EMO=d=>d<=-2?'🦅':d===-1?'🔴':d===0?'⚪':d===1?'🟦':'⬛';
function shareText(){const p=state.players[0],tot=totOf(p),label=state.daily?new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short'}):MODE_LABEL[state.mode];
  if(multi())return `⛳ Fairway FC · ${label}\n`+standings().map((s,i)=>`${i+1}. ${s.p.name} ${optsOf().match?s.won+' holes won':totOf(s.p)+' ('+fmtPar(s.tp)+')'}`).join('\n');
  return `⛳ Fairway FC · ${label}\n${tot} (${fmtPar(parOf(p))})\n${p.scores.map((s,i)=>EMO(s-state.course[i].par)).join('')}`;}
async function endScreen(fresh){
  hud();greenCam();
  const st=standings(),ranked=st.map(s=>s.p),p=state.players[0],tot=totOf(p),tp=parOf(p),bird=p.scores.filter((s,i)=>s<state.course[i].par).length;
  let posted='';
  if(state.daily){addHistory({date:TODAY,total:tot,toPar:tp});
    if(!state.posted){const r=await Board.post(tot,tp,bird);if(r==='ok'||r==='already'){state.posted=true;save();}
      posted=r==='needname'?'NEEDNAME':r==='ok'?'Posted to the leaderboard.':r==='already'?'Your first round today is already on the leaderboard.':r==='denied'?'This link can’t post scores, so your round is saved on this device.':'Your round is saved on this device.';}
    else posted='On the leaderboard.';}
  let streakNote='';
  if(fresh){const o=optsOf();
    if(multi())award('host');
    else{award('first');if(tp<0)award('underpar');if(state.course.length===18)award('full18');if(o.clock===12&&tp<=0)award('speed');
      if(o.theme!=='all'){const s=myStats();s.themes=s.themes||{};s.themes[o.theme]=1;writeJSON('fairwayfc:stats',s);if(['world','clubs','people'].every(t=>s.themes[t]))award('themes');}}
    if(state.daily){const n=dailyStreak();if(n>=3)award('streak3');if(n>=7)award('streak7');}}
  if(state.daily){const n=dailyStreak();streakNote=n>1?`${n}-day streak. Come back tomorrow to keep it going.`:'Come back tomorrow to start a streak.';}
  const head=multi()?`<h2 class="title">${esc(ranked[0].name)} <span>wins!</span></h2>
      <ol class="board">${st.map((s,i)=>`<li class="${i===0?'you':''}"><span class="pos">${i+1}</span><span class="nm">${esc(s.p.name)}</span><span class="th">${optsOf().match?fmtPar(s.tp):s.tot}</span><b class="${!optsOf().match&&s.tp<0?'under':''}">${optsOf().match?s.won+' won':fmtPar(s.tp)}</b></li>`).join('')}</ol>`
    :`<p class="final">${tot}<small class="${tp<0?'under':''}">${fmtPar(tp)}</small></p>`;
  setCard(`<div class="kicker"><span class="cat">${esc(MODE_LABEL[state.mode])}${state.mode==='room'?' '+esc(state.room.code):''}</span><span>${multi()?state.players.length+' players':bird+' under-par hole'+(bird===1?'':'s')}</span></div>
    ${head}
    ${cardTable()}
    <div class="share" id="share">${esc(shareText())}</div>
    <div class="row"><button class="btn" id="copy">Copy result</button>${state.daily?'<button class="btn ghost" id="seeBoard">Leaderboard</button>':state.mode==='room'?'<button class="btn ghost" id="seeRoom">Room table</button>':'<button class="btn ghost" id="again">Play again</button>'}<button class="btn ghost" id="menu">Main menu</button></div>
    ${posted==='NEEDNAME'?`<form id="nameForm" class="row" autocomplete="off"><input type="text" id="lbName" maxlength="16" placeholder="Your name for the leaderboard" aria-label="Your name for the leaderboard" style="flex:1;min-width:0;font:inherit;font-size:16px;padding:11px 12px;border-radius:12px;border:2px solid var(--edge);background:rgba(0,0,0,.35);color:var(--text)"><button class="btn green">Post score</button></form>`:''}
    <p class="muted" id="msg">${posted==='NEEDNAME'?'Add a name to put your round on today’s leaderboard.':posted||(state.daily?'A new course opens at midnight.':'')}</p>
    ${streakNote?`<p class="streak">${esc(streakNote)}</p>`:''}`);
  if($('#nameForm'))$('#nameForm').onsubmit=async e=>{e.preventDefault();const n=cleanName($('#lbName').value);
    if(!n){$('#msg').textContent='Pick a different name, please.';return;}
    try{localStorage.setItem('fairwayfc:name',n);}catch(err){}$('#msg').textContent='Posting…';
    const r=await Board.post(tot,tp,bird);if(r==='ok'||r==='already'){state.posted=true;save();$('#nameForm').remove();$('#msg').textContent='Posted to the leaderboard.';Sound.fanfare('par');}
    else $('#msg').textContent='Couldn’t post just now. Try again in a moment.';};
  if(fresh){if(multi()){confetti();Sound.cheer(true);Sound.fanfare('eagle');Sound.say('And we have a winner!');}else if(tp<0){confetti();Sound.cheer(true);Sound.fanfare('eagle');Sound.say('What a round! Under par.');}else Sound.say('Round complete. Sign your card.');}
  $('#copy').onclick=()=>{navigator.clipboard.writeText(shareText()).then(()=>$('#msg').textContent='Copied. Paste it in the group chat.')
    .catch(()=>{const r=document.createRange();r.selectNodeContents($('#share'));const s=getSelection();s.removeAllRanges();s.addRange(r);$('#msg').textContent='Selected. Copy it from your keyboard menu.';});};
  $('#menu').onclick=()=>{if(state.mode==='room')Room.leave();menuScreen();};
  if($('#seeBoard'))$('#seeBoard').onclick=()=>openSheet('board');
  if($('#seeRoom'))$('#seeRoom').onclick=()=>openSheet('room');
  if($('#again'))$('#again').onclick=()=>{state=newRound(state.mode+'-'+Date.now(),state.mode,state.players.map(x=>x.name));begin();};
}
function route(fresh){
  if(state.phase==='start')return begin();
  if(state.phase==='done')return endScreen(fresh);
  if(state.phase==='holeDone')return holeDone(fresh);
  if(state.phase==='putt')return puttScreen();
  return shotScreen();
}

// ---------- Boot ----------
Board.init();
(function boot(){
  let active='daily';try{active=localStorage.getItem(ACTIVE)||'daily';}catch(e){}
  const other=active==='other'?readKey(OTHER):null;
  if(other&&other.mode!=='room'&&!['start','done'].includes(other.phase))state=other;
  // leaving mid-question counts as running out of time
  if(state.ppending){state.ppending=false;state.pread='bad';state.pi[PD(state.ft)]++;save();}
  if(state.pending){state.pending=false;state.strokes+=2;state.qi++;if(state.strokes>=hole().par+4){state.scores[state.h]=hole().par+4;state.phase='holeDone';}save();}
  save();buildCourse();poseRig();addressCam(true);
  menuScreen();   // always open on the main menu; a round in progress shows a Continue button there
})();
