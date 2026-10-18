/* =========================================================
   KINGDOM — Online mod (Aşama 1)
   İki oyuncu oda koduyla eşleşir (WebRTC / PeerJS, sunucu gerekmez).
   Her oyuncu kendi krallığını yönetir; birbirlerine sohbet, kaynak
   hediyesi, yardım askeri ve saldırı ordusu gönderebilirler.
   ========================================================= */
(function(){
'use strict';
const NET = window.NET = { on:false, role:null, code:null, conn:null, peer:null, friend:null, fstate:null, log:[], sendCd:0, giftCd:0, lastState:0, transport:null };
const CDN=['https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js','https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js','https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js'];
const PREFIX='kingdom-tr-';
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function myName(){ let n=''; try{ n=localStorage.getItem('kingdom_name')||''; }catch(e){} return n||'Kral'; }
function setName(n){ try{ localStorage.setItem('kingdom_name',n); }catch(e){} }
function code5(){ const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<5;i++) s+=A[Math.floor(Math.random()*A.length)]; return s; }
function loadPeer(){
  if(window.Peer) return Promise.resolve(true);
  return new Promise(res=>{ let i=0; const next=()=>{ if(i>=CDN.length) return res(false); const s=document.createElement('script'); s.src=CDN[i++]; s.onload=()=>res(!!window.Peer); s.onerror=()=>{ s.remove(); next(); }; document.head.appendChild(s); }; next(); });
}
/* --- taşıyıcılar: PeerJS (internet) ve BroadcastChannel (aynı bilgisayar / test) --- */
function localTransport(code,isHost){
  const bc=new BroadcastChannel(PREFIX+code), me=Math.random().toString(36).slice(2), T={ open:false };
  T.send=o=>bc.postMessage({from:me,o});
  bc.onmessage=ev=>{ const d=ev.data; if(!d||d.from===me) return; if(d.o&&d.o.t==='_knock'&&isHost&&!T.open){ T.open=true; T.send({t:'_welcome'}); T.onopen&&T.onopen(); return; } if(d.o&&d.o.t==='_welcome'&&!isHost&&!T.open){ T.open=true; T.onopen&&T.onopen(); return; } if(T.open) T.onmsg&&T.onmsg(d.o); };
  if(!isHost){ const k=()=>{ if(!T.open){ T.send({t:'_knock'}); setTimeout(k,700); } }; k(); }
  T.close=()=>{ try{ bc.close(); }catch(e){} };
  return T;
}
async function peerTransport(code,isHost,onErr){
  const ok=await loadPeer(); if(!ok){ onErr('Online kütüphanesi yüklenemedi. İnternet bağlantını kontrol et.'); return null; }
  const T={ open:false };
  const wire=c=>{ T.conn=c; c.on('open',()=>{ T.open=true; T.onopen&&T.onopen(); }); c.on('data',d=>{ T.onmsg&&T.onmsg(d); }); c.on('close',()=>{ T.open=false; T.onclose&&T.onclose(); }); c.on('error',e=>onErr('Bağlantı hatası: '+(e&&e.type||e))); };
  const peer=isHost?new window.Peer(PREFIX+code,{debug:0}):new window.Peer(undefined,{debug:0});
  T.peer=peer;
  peer.on('error',e=>{ const t=e&&e.type; onErr(t==='unavailable-id'?'Bu oda kodu kullanımda, tekrar dene.':t==='peer-unavailable'?'Oda bulunamadı. Kodu kontrol et, arkadaşın odayı açık tutsun.':t==='network'||t==='server-error'||t==='socket-error'?'Online sunucusuna ulaşılamadı.':'Online hata: '+t); });
  if(isHost){ peer.on('connection',c=>{ if(T.open){ c.close(); return; } wire(c); }); }
  else peer.on('open',()=>{ wire(peer.connect(PREFIX+code,{reliable:true})); });
  T.send=o=>{ if(T.conn&&T.open) try{ T.conn.send(o); }catch(e){} };
  T.close=()=>{ try{ T.conn&&T.conn.close(); }catch(e){} try{ peer.destroy(); }catch(e){} };
  return T;
}
/* --- bağlantı --- */
function status(t,cls){ const el=$('netStatus'); if(el){ el.textContent=t; el.className='netstat '+(cls||''); } }
async function connect(isHost,code){
  disconnect(true);
  NET.role=isHost?'host':'guest'; NET.code=code;
  const local=/[?&]net=local/.test(location.search)||($('netLocal')&&$('netLocal').checked);
  status(isHost?'Oda açılıyor…':'Odaya bağlanılıyor…','wait');
  const onErr=m=>{ status(m,'bad'); toast('🌐 '+m,'bad'); };
  const T=local?localTransport(code,isHost):await peerTransport(code,isHost,onErr);
  if(!T) return; NET.transport=T;
  T.onopen=()=>{ NET.on=true; status('Bağlandı!','ok'); NET.me=NET.me||myName(); send({t:'hello',name:NET.me,ver:'2.5'}); refreshNetUI(); sfx&&sfx('door',.4); };
  T.onmsg=onMsg;
  T.onclose=()=>{ if(NET.on){ toast('🌐 '+(NET.friend||'Arkadaşın')+' oyundan ayrıldı.','bad'); } NET.on=false; status('Bağlantı koptu.','bad'); refreshNetUI(); };
  if(isHost) status('Oda hazır! Kodu arkadaşına ver: '+code,'wait');
}
function disconnect(silent){ if(NET.transport) NET.transport.close(); NET.transport=null; NET.on=false; NET.friend=null; NET.fstate=null; if(!silent) status('Bağlantı kapatıldı.',''); refreshNetUI(); }
function send(o){ if(NET.transport) NET.transport.send(o); }
NET.send=send; NET.connect=connect; NET.disconnect=disconnect;
/* --- mesajlar --- */
function addLog(who,txt,cls){ NET.log.push({who,txt,cls}); if(NET.log.length>60) NET.log.shift(); const box=$('netLog'); if(box){ box.innerHTML=NET.log.map(l=>`<div class="nl ${l.cls||''}">${l.who?`<b>${esc(l.who)}:</b> `:''}${esc(l.txt)}</div>`).join(''); box.scrollTop=box.scrollHeight; } }
const KIND_ENEMY={spear:'melee',archer:'archer',knight:'rider',mage:'archer',catapult:'siege'};
function onMsg(m){
  if(!m||typeof m!=='object') return;
  if(m.t==='hello'){ NET.friend=String(m.name||'Arkadaş').slice(0,16); addLog('','🤝 '+NET.friend+' bağlandı.','sys'); toast('🌐 '+NET.friend+' ile bağlandın!','good'); refreshNetUI(); }
  else if(m.t==='state'){ NET.fstate=m; refreshNetUI(); }
  else if(m.t==='chat'){ addLog(NET.friend,String(m.msg||'').slice(0,140)); toast('💬 '+NET.friend+': '+String(m.msg||'').slice(0,60)); if(!$('netPanel').classList.contains('open')) $('netBtn').classList.add('ping'); }
  else if(m.t==='gift'&&S&&!S.over){ const r=m.res, a=Math.max(0,Math.min(500,m.amt|0)); if(S.res[r]!==undefined){ S.res[r]+=a; toast(`🎁 ${NET.friend} sana ${a} ${RI[r]} hediye etti!`,'good'); addLog('',`🎁 ${a} ${RI[r]} aldın.`,'sys'); sfx&&sfx('coins',.5); } }
  else if(m.t==='help'&&S&&!S.over){ const hall=blds.find(b=>b.type==='hall'); if(!hall) return; const list=(m.units||[]).slice(0,12); list.forEach(k=>{ if(UNITS[k]) spawnSoldier(k,hall,{col:0x3a8ad0,ally:true,ttl:150}); }); toast(`🛡️ ${NET.friend} sana ${list.length} yardım askeri gönderdi!`,'good'); addLog('',`🛡️ ${list.length} yardım askeri geldi.`,'sys'); }
  else if(m.t==='raid'&&S&&!S.over){ incomingRaid(m); }
  else if(m.t==='raidres'){ addLog('',m.won?`⚔️ Ordun hedefe ${m.dmg|0} hasar verdi (${NET.friend}).`:`🛡️ Saldırın püskürtüldü (${NET.friend}).`,'sys'); toast(m.won?`⚔️ Baskın başarılı! +${m.loot|0} altın ganimet`:`🛡️ Saldırın püskürtüldü (${NET.friend}).`,m.won?'good':'bad'); if(m.won&&S) S.res.gold+=m.loot|0; }
  else if(m.t==='cowave'&&S&&!S.over){ coopStart(m.n,false); }
  else if(m.t==='codone'){ NET.coop&&(NET.coop.friend=true); coopCheck(); }
  else if(m.t==='cofail'){ if(NET.coop){ NET.coop=null; toast('🤝 Ortak savunma başarısız: '+NET.friend+' şehrini koruyamadı.','bad'); } }
  else if(m.t==='allyreq'){ askDialog('🏳️','İttifak teklifi',`${NET.friend} seninle ittifak kurmak istiyor. İttifakta birbirinize saldıramazsınız ve ikiniz de +%10 üretim kazanırsınız.`,[{label:'🤝 Kabul et',fn:()=>{ NET.allied=true; send({t:'allyok'}); addLog('','🏳️ İttifak kuruldu!','sys'); toast('🏳️ '+NET.friend+' ile ittifak kuruldu! +%10 üretim','good'); refreshNetUI(); }},{label:'Reddet',fn:()=>send({t:'allyno'})}]); }
  else if(m.t==='allyok'){ NET.allied=true; addLog('','🏳️ İttifak kuruldu!','sys'); toast('🏳️ '+NET.friend+' ittifakı kabul etti! +%10 üretim','good'); refreshNetUI(); }
  else if(m.t==='allyno'){ toast(NET.friend+' ittifak teklifini reddetti.','bad'); }
  else if(m.t==='allyend'){ NET.allied=false; addLog('','İttifak bozuldu.','sys'); toast('⚠️ '+NET.friend+' ittifakı bozdu!','bad'); refreshNetUI(); }
  else if(m.t==='offer'&&S&&!S.over){ const g=m.give||{}, w=m.want||{}; const gk=Object.keys(g)[0], wk=Object.keys(w)[0]; if(!RI[gk]||!RI[wk]) return; const ga=Math.max(1,Math.min(5000,g[gk]|0)), wa=Math.max(1,Math.min(5000,w[wk]|0));
    askDialog('💱','Takas teklifi',`${NET.friend} sana ${ga} ${RI[gk]} veriyor, karşılığında ${wa} ${RI[wk]} istiyor.`,[{label:'✅ Kabul',cost:{[wk]:wa},fn:()=>{ S.res[gk]=(S.res[gk]||0)+ga; send({t:'offerok',id:m.id}); addLog('',`💱 Takas: +${ga} ${RI[gk]}, −${wa} ${RI[wk]}`,'sys'); }},{label:'Reddet',fn:()=>send({t:'offerno',id:m.id})}]); }
  else if(m.t==='offerok'){ const o=NET.offers&&NET.offers[m.id]; if(o){ S.res[o.wk]=(S.res[o.wk]||0)+o.wa; delete NET.offers[m.id]; toast(`💱 ${NET.friend} takası kabul etti: +${o.wa} ${RI[o.wk]}`,'good'); addLog('',`💱 Takas tamam: +${o.wa} ${RI[o.wk]}`,'sys'); } }
  else if(m.t==='offerno'){ const o=NET.offers&&NET.offers[m.id]; if(o){ S.res[o.gk]+=o.ga; delete NET.offers[m.id]; toast(`💱 ${NET.friend} takası reddetti, kaynakların iade edildi.`,'bad'); } }
  else if(m.t==='over'){ addLog('',m.won?`👑 ${NET.friend} oyunu kazandı!`:`💀 ${NET.friend} krallığı yıkıldı.`,'sys'); toast(m.won?`👑 ${NET.friend} zafer kazandı!`:`💀 ${NET.friend} krallığı düştü!`,m.won?'raid':'good'); }
}
function incomingRaid(m){
  const units=(m.units||[]).slice(0,14); if(!units.length) return;
  const a=Math.random()*Math.PI*2, R=HALF-5, cx=Math.cos(a)*R, cz=Math.sin(a)*R, w=Math.max(2,S.wave+1);
  const raid={from:NET.friend,n:units.length,alive:units.length,dmg:0,t:0};
  NET.raids=(NET.raids||[]); NET.raids.push(raid);
  units.forEach(u=>{ const k=KIND_ENEMY[u.k]||'melee'; const x=cx+(Math.random()-.5)*6, z=cz+(Math.random()-.5)*6; curFac=3; addEnemy(k,x,z,0,w,Math.min(3,u.r|0)); curFac=null; const e=enemies[enemies.length-1];
    if(e&&!e.siege){ const mm=makeSoldierMesh(u.k==='knight'?'knight':u.k==='mage'?'mage':u.k==='archer'?'archer':'spear',0xb03030); if(mm){ scene.remove(e.mesh); mm.position.copy(e.mesh.position); if(e.rank>=2) mm.add(auraRing(RANKS[e.rank].aura,.8)); scene.add(mm); e.mesh=mm; } }
    if(e){ e.online=raid.from; e.raid=raid; e.rew=Math.round(e.rew*1.5); } });
  mmPing(cx,cz,'#9ad0ff'); banner('⚔️ ONLINE BASKIN',`${raid.from} ${units.length} asker gönderdi!`);
  toast(`⚔️ ${raid.from} ${units.length} askerle şehrine saldırıyor!`,'raid'); addLog('',`⚔️ ${units.length} askerlik saldırı geliyor!`,'sys');
  if(sfx) sfx('bell',.6);
}
/* --- gönderme --- */
function pickUnits(max){ const sel=(typeof selUnits==='function'?selUnits():[]).filter(u=>!u.ally&&u.kind!=='hero'&&u.hp>0); const pool=sel.length?sel:soldiers.filter(u=>!u.ally&&u.kind!=='hero'&&u.hp>0&&!u.fight&&!u.fighting); return pool.slice(0,max); }
function removeSoldier(u){ scene.remove(u.mesh); if(u.bar) scene.remove(u.bar); if(u.ring) scene.remove(u.ring); const i=soldiers.indexOf(u); if(i>=0) soldiers.splice(i,1); }
function sendArmy(kind){
  if(!NET.on||!S||S.over) return;
  if(NET.sendCd>0){ toast(`⏳ Yeni ordu ${Math.ceil(NET.sendCd)} sn sonra gönderilebilir.`,'bad'); return; }
  if(kind==='raid'&&NET.allied){ toast('🏳️ Müttefikine saldıramazsın. Önce ittifakı boz.','bad'); return; }
  if(kind==='raid'&&(S.time<240||!NET.fstate||(NET.fstate.time||0)<240)){ toast('🕊️ Barış dönemi: iki krallık da en az 4 dakika oynamadan saldırı gönderilemez.','bad'); return; }
  const list=pickUnits(kind==='raid'?12:8); if(!list.length){ toast('Gönderecek boşta asker yok. Önce asker eğit (ya da seç).','bad'); return; }
  const units=list.map(u=>({k:u.kind,r:u.rank||0}));
  list.forEach(u=>{ burst(u.mesh.position.x,1,u.mesh.position.z,kind==='raid'?[0xff5a4a,0xffd54a]:[0x6ab0ff,0xffffff],6,3,.12,.6); removeSoldier(u); });
  send({t:kind,units:units.map(u=>kind==='raid'?u:u.k)}); NET.sendCd=kind==='raid'?75:45;
  addLog('',kind==='raid'?`⚔️ ${units.length} asker saldırıya gitti → ${NET.friend}`:`🛡️ ${units.length} asker yardıma gitti → ${NET.friend}`,'sys');
  toast(kind==='raid'?`⚔️ ${units.length} asker saldırıya yürüyor → ${NET.friend}`:`🛡️ ${units.length} asker yardıma gitti → ${NET.friend}`,'good');
  refreshNetUI();
}
function sendGift(res){
  if(!NET.on||!S||S.over) return; const amt=100;
  if(NET.giftCd>0){ toast(`⏳ ${Math.ceil(NET.giftCd)} sn sonra tekrar hediye gönderebilirsin.`,'bad'); return; }
  if((S.res[res]||0)<amt){ toast('Yeterli '+RI[res]+' yok.','bad'); return; }
  S.res[res]-=amt; send({t:'gift',res,amt}); NET.giftCd=20; addLog('',`🎁 ${amt} ${RI[res]} gönderdin.`,'sys'); toast(`🎁 ${amt} ${RI[res]} gönderildi → ${NET.friend}`,'good'); refreshNetUI();
}
function sendChat(){ const i=$('netMsg'); const t=(i.value||'').trim(); if(!t||!NET.on) return; send({t:'chat',msg:t.slice(0,140)}); addLog(NET.me||myName(),t); i.value=''; }
/* --- ortak savunma, ittifak, takas --- */
function coopStart(n,mine){
  const w=Math.max(3,S.wave+2), a=Math.random()*6.28, R=HALF+8, cx=Math.cos(a)*R, cz=Math.sin(a)*R; const pf=curFac; curFac=Math.floor(Math.random()*4);
  const list=[]; for(let k=0;k<n;k++) list.push(k%5===4?'brute':k%3===2?'archer':'melee'); if(n>=14) list.push(['troll','necro','warlord'][Math.floor(Math.random()*3)]);
  list.forEach(k=>{ addEnemy(k,cx+(Math.random()-.5)*7,cz+(Math.random()-.5)*7,0,w); const e=enemies[enemies.length-1]; if(e) e.coop=true; }); curFac=pf;
  NET.coop={t:180,mine:false,friend:false}; mmPing(cx,cz); banner('🤝 ORTAK SAVUNMA',`${NET.friend} ile aynı anda ${list.length} düşman geliyor!`); toast(`🤝 Ortak savunma başladı! İkiniz de dalgayı püskürtün (3 dk).`,'raid'); addLog('',`🤝 Ortak savunma: ${list.length} düşman`,'sys'); if(sfx) sfx('bell',.6);
}
function coopCheck(){ const c=NET.coop; if(!c) return; if(c.mine&&c.friend){ const g=250+S.wave*25; S.res.gold+=g; S.res.food+=120; NET.coop=null; toast(`🤝 Ortak zafer! İkiniz de dalgayı püskürttünüz: +${g}🪙 +120🌾`,'good'); banner('🤝 ORTAK ZAFER','Müttefikler birlikte kazandı!'); addLog('','🤝 Ortak zafer!','sys'); } }
function sendOffer(){
  if(!NET.on||!S) return; const gk=$('trGive').value, wk=$('trGet').value, ga=Math.max(1,Math.min(5000,parseInt($('trGiveN').value)||0)), wa=Math.max(1,Math.min(5000,parseInt($('trGetN').value)||0));
  if(gk===wk) return toast('Farklı kaynaklar seç.','bad'); if((S.res[gk]||0)<ga) return toast('Yeterli '+RI[gk]+' yok.','bad');
  S.res[gk]-=ga; const id=Math.random().toString(36).slice(2,8); NET.offers=NET.offers||{}; NET.offers[id]={gk,ga,wk,wa}; send({t:'offer',id,give:{[gk]:ga},want:{[wk]:wa}}); addLog('',`💱 Teklif: ${ga} ${RI[gk]} → ${wa} ${RI[wk]} (bekleniyor)`,'sys'); toast('💱 Takas teklifi gönderildi.','good');
}
/* --- her kare --- */
NET.tick=function(dt){
  if(!NET.on) return;
  if(NET.coop&&S){ NET.coop.t-=dt; if(!NET.coop.mine&&!enemies.some(e=>e.coop)){ NET.coop.mine=true; send({t:'codone'}); toast('🛡️ Ortak dalgayı püskürttün! '+NET.friend+' bekleniyor…','good'); coopCheck(); } else if(NET.coop&&NET.coop.t<=0){ NET.coop=null; send({t:'cofail'}); toast('🤝 Ortak savunma süresi doldu.','bad'); } }
  NET.sendCd=Math.max(0,NET.sendCd-dt); NET.giftCd=Math.max(0,NET.giftCd-dt);
  NET.lastState-=dt;
  if(NET.lastState<=0&&S){ NET.lastState=2.5; send({t:'state',time:Math.floor(S.time),era:S.era,pop:Math.floor(S.pop),army:armyN(),wave:S.wave,kills:S.kills,gold:Math.floor(S.res.gold),bld:blds.length,over:!!S.over}); refreshNetUI(); }
  if(NET.raids&&NET.raids.length){ for(let i=NET.raids.length-1;i>=0;i--){ const r=NET.raids[i]; r.t+=dt; const alive=enemies.filter(e=>e.raid===r).length; if(alive===0||r.t>240){ const won=r.dmg>150; const loot=won?Math.min(400,Math.round(r.dmg*.6)):0; if(won&&S) S.res.gold=Math.max(0,S.res.gold-loot*.5); send({t:'raidres',won,dmg:r.dmg,loot}); addLog('',won?`🔥 ${r.from} baskını şehrine ${Math.round(r.dmg)} hasar verdi.`:`🛡️ ${r.from} baskınını püskürttün!`,'sys'); if(!won) toast(`🛡️ ${r.from} baskınını püskürttün!`,'good'); NET.raids.splice(i,1); } } }
};
NET.onBuildingDamage=function(e,amt){ if(e&&e.raid) e.raid.dmg+=amt; };
NET.onGameOver=function(won){ if(NET.on) send({t:'over',won}); };
/* --- arayüz --- */
function refreshNetUI(){
  const b=$('netBtn'); if(b) b.style.display=NET.on||NET.transport?'':'none';
  const f=NET.fstate, fp=$('netFriend');
  if(fp) fp.innerHTML=NET.on?`<div class="nf-name">👤 ${esc(NET.friend||'…')}</div>`+(f?`<div class="nf-grid"><span>🏰 ${esc((ERAS[f.era]||{}).n||'-')}</span><span>👥 ${f.pop|0}</span><span>⚔️ ${f.army|0} asker</span><span>🌊 Dalga ${f.wave|0}</span><span>💀 ${f.kills|0}</span><span>🪙 ${f.gold|0}</span></div>`:'<div class="nf-grid">Durum bekleniyor…</div>'):'<div class="nf-name">Bağlı değil</div>';
  const cd=$('netCd'); if(cd) cd.textContent=NET.sendCd>0?`Ordu bekleme: ${Math.ceil(NET.sendCd)} sn`:(NET.giftCd>0?`Hediye bekleme: ${Math.ceil(NET.giftCd)} sn`:'');
  const lb=$('netLobbyInfo'); if(lb) lb.innerHTML=NET.on?`✅ <b>${esc(NET.friend||'Arkadaşın')}</b> ile bağlısın. Yeni oyun başlat ya da kayıtlı oyununa devam et; sağ üstteki 🌐 düğmesinden etkileşime geç.`:'';
  const al=$('netAlly'); if(al) al.textContent=NET.allied?'💔 İttifakı boz':'🏳️ İttifak teklif et';
  const pb=$('netPlay'); if(pb) pb.style.display=NET.on?'':'none';
}
NET.refresh=refreshNetUI;
function initUI(){
  const nm=$('netName'); if(nm){ nm.value=myName(); nm.onchange=()=>setName(nm.value.trim().slice(0,16)||'Kral'); }
  $('onlineBtn').onclick=()=>{ $('onlineScreen').style.display='flex'; refreshNetUI(); };
  $('netBack').onclick=()=>{ $('onlineScreen').style.display='none'; };
  $('netHost').onclick=()=>{ NET.me=($('netName').value||'').trim().slice(0,16)||'Kral'; setName(NET.me); const c=code5(); $('netCodeShow').textContent=c; $('netCodeBox').style.display=''; connect(true,c); };
  $('netJoin').onclick=()=>{ NET.me=($('netName').value||'').trim().slice(0,16)||'Kral'; setName(NET.me); const c=($('netCode').value||'').trim().toUpperCase(); if(c.length<4){ status('Geçerli bir oda kodu yaz.','bad'); return; } connect(false,c); };
  $('netCopy').onclick=()=>{ try{ navigator.clipboard.writeText($('netCodeShow').textContent); toast('📋 Kod kopyalandı'); }catch(e){} };
  $('netPlay').onclick=()=>{ $('onlineScreen').style.display='none'; $('newScreen').style.display='flex'; };
  $('netBtn').onclick=()=>{ const p=$('netPanel'); p.classList.toggle('open'); $('netBtn').classList.remove('ping'); refreshNetUI(); };
  $('netClose').onclick=()=>$('netPanel').classList.remove('open');
  $('netSend').onclick=sendChat; $('netMsg').addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Enter') sendChat(); });
  $('netMsg').addEventListener('keyup',e=>e.stopPropagation());
  document.querySelectorAll('[data-gift]').forEach(b=>b.onclick=()=>sendGift(b.dataset.gift));
  $('netRaid').onclick=()=>sendArmy('raid'); $('netHelp').onclick=()=>sendArmy('help');
  $('trSend').onclick=sendOffer; ['trGiveN','trGetN'].forEach(id=>{ $(id).addEventListener('keydown',e=>e.stopPropagation()); });
  $('netCoop').onclick=()=>{ if(!NET.on||!S||S.over) return; if(NET.coop) return toast('Ortak savunma zaten sürüyor.','bad'); if((NET.coopCd||0)>S.time) return toast('Ortak savunma '+Math.ceil(NET.coopCd-S.time)+' sn sonra tekrar başlatılabilir.','bad'); NET.coopCd=S.time+300; const n=Math.min(22,8+Math.floor(S.wave*1.2)); send({t:'cowave',n}); coopStart(n,true); };
  $('netAlly').onclick=()=>{ if(!NET.on) return; if(NET.allied){ NET.allied=false; send({t:'allyend'}); toast('İttifakı bozdun.','bad'); refreshNetUI(); } else { send({t:'allyreq'}); toast('🏳️ İttifak teklifi gönderildi.','good'); } };
  $('netLeave').onclick=()=>{ disconnect(); $('netPanel').classList.remove('open'); };
  refreshNetUI();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initUI); else initUI();
})();
