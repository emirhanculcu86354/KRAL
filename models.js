/* =========================================================
   KRALLIK 3D — model kütüphanesi
   Kenney.nl (CC0) Castle Kit, Fantasy Town Kit, Nature Kit,
   Blocky Characters modellerini yükler ve bina/karakter
   "prefab"larını parçalardan birleştirir.
   ========================================================= */
(function(){
'use strict';
const KR = window.KR = { ready:false, glb:{}, anims:{}, mats:{}, count:0 };
function b64ToBuf(b64){ const s=atob(b64), n=s.length, u=new Uint8Array(n); for(let i=0;i<n;i++) u[i]=s.charCodeAt(i); return u.buffer; }
const texCache={}, texWait=[];
function texFrom(key){
  if(texCache[key]) return texCache[key];
  const src=window.KR_TEX&&KR_TEX[key]; if(!src) return null;
  const img=new Image(); const t=new THREE.Texture(img); img.onload=()=>{ t.needsUpdate=true; }; img.src=src; texWait.push(img.decode?img.decode().catch(()=>{}):Promise.resolve());
  t.encoding=THREE.sRGBEncoding; t.flipY=false; t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestFilter; t.generateMipmaps=false;
  return texCache[key]=t;
}
KR.texFrom=texFrom;
KR.load=async function(onProg){
  if(!window.KR_GLB||!THREE.GLTFLoader) return false;
  const mgr=new THREE.LoadingManager();
  mgr.setURLModifier(u=>{ const i=u.indexOf('kr:'); return i>=0?((window.KR_TEX&&KR_TEX[u.slice(i+3)])||u):u; });
  const L=new THREE.GLTFLoader(mgr), keys=Object.keys(KR_GLB); let done=0;
  const one=k=>new Promise(res=>{
    try{
      L.parse(b64ToBuf(KR_GLB[k]),'',g=>{
        const pack=k.split('/')[0], root=g.scene;
        root.traverse(o=>{
          if(!o.isMesh) return;
          o.castShadow=true; o.receiveShadow=true;
          const ms=Array.isArray(o.material)?o.material:[o.material];
          const out=ms.map(m=>{
            const mk=pack+'/'+(m.name||'m')+(m.map?'#t':'')+(pack==='nature'?('#'+m.color.getHexString()):'');
            if(KR.mats[mk]) return KR.mats[mk];
            if(m.map){ const tk=pack==='blocky'?null:pack+'/colormap.png'; const t=tk&&texFrom(tk); if(t) m.map=t; else { m.map.magFilter=THREE.NearestFilter; m.map.minFilter=THREE.NearestFilter; m.map.generateMipmaps=false; } }
            if(pack==='nature'&&!m.map){ const NC={stone:0x8a8c88,dirt:0x9a6b4a,grass:0x5d9a3c,woodBark:0x7a5032,woodBarkDark:0x5a3a26,woodInner:0xd9b47a,leafsGreen:0x4f9a3f,leafsDark:0x2f7a35,leafs:0x4f9a3f}; if(NC[m.name]!==undefined) m.color.setHex(NC[m.name]).convertSRGBToLinear(); else m.color.convertSRGBToLinear(); }
            m.roughness=Math.max(m.roughness,.75); m.metalness=Math.min(m.metalness,.1);
            return KR.mats[mk]=m;
          });
          o.material=Array.isArray(o.material)?out:out[0];
        });
        KR.glb[k]=root; KR.anims[k]=g.animations||[];
        res();
      },e=>{ console.warn('model yüklenemedi',k,e); res(); });
    }catch(e){ console.warn('model hatası',k,e); res(); }
  });
  const B=12;
  for(let i=0;i<keys.length;i+=B){ await Promise.all(keys.slice(i,i+B).map(one)); done=Math.min(keys.length,i+B); if(onProg) onProg(done/keys.length); await new Promise(r=>setTimeout(r,0)); }
  KR.count=Object.keys(KR.glb).length; KR.ready=KR.count>50;
  if(KR.ready) buildPalettes();
  if(KR.ready) addSnow();
  await Promise.all(texWait); texWait.length=0;
  Object.values(texCache).forEach(t=>{ t.needsUpdate=true; });
  return KR.ready;
};
/* --- castle kit palette varyantları (çağa göre taş rengi) --- */
const PAL={};
function buildPalettes(){
  const base=Object.keys(KR.mats).find(k=>k.startsWith('castle/'));
  if(!base) return;
  const m0=KR.mats[base];
  PAL[1]=m0;
  [['wood','castle/colormap-wood.png'],['grey','castle/colormap-grey.png'],['marble','castle/colormap-marble.png'],['arcane','castle/colormap-arcane.png']].forEach(([n,k])=>{ const t=texFrom(k); if(t){ const m=m0.clone(); m.map=t; PAL[n]=m; } });
  ['a','b','c','d','e','f','g'].forEach(v=>{ const t=texFrom('castle/variation-'+v+'.png'); if(t){ const m=m0.clone(); m.map=t; PAL[v]=m; } });
  // ızgara: çağ → [duvar paleti]
  PAL.era=[PAL.wood||m0, m0, PAL.grey||m0, PAL.marble||m0];
  const tk=Object.keys(KR.mats).find(k=>k.startsWith('town/')&&KR.mats[k].map); if(tk){ PAL.townA=KR.mats[tk]; const tv=texFrom('town/variation-a.png'); if(tv){ PAL.townB=PAL.townA.clone(); PAL.townB.map=tv; } }
}
KR.pal=PAL;
/* kar: yukarı bakan yüzeyleri kışın beyazlatan küçük gölgelendirici eki */
KR.snowU={value:0};
function snowify(m){
  if(!m||m.userData.snow||!m.isMeshStandardMaterial) return; m.userData.snow=1;
  const prev=m.onBeforeCompile;
  m.onBeforeCompile=function(sh){ if(prev) prev(sh); sh.uniforms.uSnow=KR.snowU;
    sh.fragmentShader='uniform float uSnow;\n'+sh.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n{ vec3 wN=inverseTransformDirection(normal,viewMatrix); float sn=smoothstep(.22,.62,wN.y)*uSnow; diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.93,.96,1.),sn); }'); };
  m.customProgramCacheKey=function(){ return 'snow'; };
  m.needsUpdate=true;
}
function addSnow(){ Object.keys(KR.mats).forEach(k=>{ if(!k.startsWith('blocky/')) snowify(KR.mats[k]); }); Object.values(PAL).forEach(m=>{ if(m&&m.isMaterial) snowify(m); }); if(PAL.era) PAL.era.forEach(snowify); }
KR.snowify=snowify;
function setMat(g,m){ if(!m) return g; g.traverse(o=>{ if(o.isMesh&&o.material&&o.material.map&&!o.userData.keep) o.material=m; }); return g; }
KR.setMat=setMat;
/* --- yardımcılar --- */
KR.has=n=>!!KR.glb[n];
KR.get=function(n){ const t=KR.glb[n]; if(!t) return null; return t.clone(); };
function P(name,x,y,z,ry,s,sy,sz){
  const o=KR.get(name); if(!o) return null;
  o.position.set(x||0,y||0,z||0); if(ry) o.rotation.y=ry;
  if(s!==undefined){ o.scale.set(s, sy===undefined?s:sy, sz===undefined?s:sz); }
  return o;
}
function G(list,scale){
  const g=new THREE.Group();
  list.forEach(e=>{ if(!e) return; if(e.isObject3D) g.add(e); else { const o=P.apply(null,e); if(o) g.add(o); } });
  if(scale) g.scale.setScalar(scale);
  return g;
}
KR.P=P; KR.G=G;
const tintCache={};
KR.tint=function(o,hex,k){ k=k===undefined?1:k; o.traverse(m=>{ if(!m.isMesh) return; const key=m.material.uuid+'|'+hex+'|'+k; if(!tintCache[key]){ const c=m.material.clone(); c.color.lerp(new THREE.Color(hex).convertSRGBToLinear(),k); tintCache[key]=c; } m.material=tintCache[key]; }); return o; };
const H=Math.PI/2;
/* town kit: hücre tabanlı oda; panel varsayılanı hücrenin +x kenarında */
function room(w,d,y,kind,opt){
  opt=opt||{}; const g=[], wood=kind==='wood', pre=wood?'town/wall-wood':'town/wall';
  const x0=-(w-1)/2, z0=-(d-1)/2;
  const pick=(side,i)=>{
    if(opt.door&&side===opt.door[0]&&i===opt.door[1]) return pre+'-door';
    if(opt.win&&((i+side)%2===0)) return pre+(wood?'-window-shutters':'-window-shutters');
    return pre;
  };
  for(let i=0;i<w;i++){ g.push([pick(2,i),x0+i,y,z0+d-1,-H]); g.push([pick(0,i),x0+i,y,z0,H]); }
  for(let j=0;j<d;j++){ g.push([pick(1,j),x0+w-1,y,z0+j,0]); g.push([pick(3,j),x0,y,z0+j,Math.PI]); }
  return g;
}
/* çatı: w×d hücre, sırt x ekseni boyunca */
function gableRoof(w,d,y,high){
  const g=[], x0=-(w-1)/2, pre=high?'town/roof-high':'town/roof';
  if(d===1){ for(let i=0;i<w;i++) g.push([pre+'-gable',x0+i,y,0,0]); return g; }
  // d=2: iki yamaç
  for(let i=0;i<w;i++){ g.push([pre,x0+i,y,-.5,H]); g.push([pre,x0+i,y,.5,-H]); }
  return g;
}
KR.room=room; KR.gableRoof=gableRoof;

/* ---------- binalar ---------- */
const BLD={};
BLD.house=t=>{
  if(t===0) return G([...room(1,1,0,'wood',{door:[2,0]}), ['town/roof-point',0,1,0,0], ['town/chimney',.28,1,-.28,0,.7]],1.45);
  if(t===1) return G([...room(2,1,0,'wood',{door:[2,0],win:1}), ...gableRoof(2,1,1), ['town/chimney',.6,1.05,-.25,0,.7]],1.2);
  if(t===2) return G([...room(2,1,0,'stone',{door:[2,0],win:1}), ...room(2,1,1,'wood',{win:1}), ...gableRoof(2,1,2,true), ['town/chimney',.6,2.3,-.25,0,.7]],1.05);
  return G([...room(2,2,0,'stone',{door:[2,0],win:1}), ...room(2,2,1,'wood',{win:1}), ['town/roof-high-point',0,2,0,0,2.05,1.3,2.05], ['town/banner-red',1.02,1.2,.2,0,.7], ['town/chimney',.55,2.0,-.55,0,.8]],.9);
};
BLD.farm=(t,se)=>{
  const g=[]; se=se||0;
  for(let r=0;r<3;r++) for(let c=0;c<3;c++) g.push(['nature/crops_dirtDoubleRow',-1.1+c*.75,0,-1.1+r*.75,0,.75]);
  const crop=se===0?(t>=1?'nature/crops_wheatStageA':'nature/crops_cornStageA'):se===1?(t>=1?'nature/crops_wheatStageB':'nature/crops_cornStageD'):se===2?(t>=1?'nature/crops_wheatStageB':'nature/crops_cornStageC'):null;
  if(crop) for(let r=0;r<3;r++) for(let c=0;c<3;c++) if(!(r===2&&c===2)) g.push([crop,-1.1+c*.75,0,-1.1+r*.75,(r+c)*.7,1.2]);
  if(se===2){ g.push(['nature/crop_pumpkin',-.35,0,.4,0,1.1]); g.push(['nature/crop_pumpkin',.4,0,-.35,1,1.0]); }
  if(t>=2){ g.push(...room(1,1,0,'stone',{door:[2,0]}).map(e=>[e[0],e[1]*.6+1.05,e[2],e[3]*.6+1.05,e[4],.6])); }
  else g.push(['nature/crop_pumpkin',1.0,0,1.0,0,1.2]);
  g.push(['nature/fence_simple',0,0,1.9,0,3.8,1,1.2]);
  const grp=G(g);
  if(t>=2&&KR.has('town/windmill')){ const bl=P('town/windmill',1.05,1.4,1.45,0,.7); if(bl){ grp.add(bl); grp.userData.blades=bl; } const rf=P('town/roof-point',1.05,.6,1.05,0,.6); if(rf) grp.add(rf); }
  return grp;
};
BLD.lumber=t=>{
  const g=G([...room(1,1,0,'wood',{door:[2,0]}).map(e=>[e[0],e[1]-.4,e[2],e[3]-.4,e[4]]), ['town/roof-point',-.4,1,-.4,0],
    ['nature/log_stackLarge',.55,0,.45,H,1.6], ['nature/log_stack',.55,0,-.35,H,1.4], ['nature/stump_round',-.5,0,.6,0,1.5], ['town/cart',-.1,0,.75,.3,.55], ['survival/resource-planks',-.75,0,.05,.4,2.4], ['survival/workbench',.15,0,-.85,0,2.2]],1.0);
  g.scale.setScalar(1.05); return g;
};
BLD.quarry=t=>G([['survival/resource-stone-large',.0,0,.05,.5,3.0],['survival/tool-pickaxe',.35,0,.25,1.2,2.6],['nature/stone_largeA',-.4,0,-.3,0,1.6],['nature/stone_tallB',.45,0,-.45,0,1.4],['nature/stone_smallA',.5,0,.4,0,1.6],['town/cart-high',-.3,0,.55,.6,.7],['town/poles-horizontal',-.75,0,.1,H,.8],['nature/log',.2,0,.75,.3,1.3]]);
BLD.market=t=>G([['survival/barrel',.92,0,.1,0,2.2],['survival/box-large',-.95,0,.05,.3,2.0],['survival/chest',.2,0,.95,0,2.0],['town/stall-red',-.5,0,-.45,0,.75],['town/stall-green',.5,0,-.45,0,.75],['town/stall',0,0,.5,Math.PI,.75],['town/stall-stool',-.6,0,.55,0,.6],['town/cart',.65,0,.45,-.5,.5],['town/lantern',.9,0,-.9,0,.9]]);
BLD.well=t=>G([['town/fountain-round-detail',0,0,0,0,t>=2?1.2:1.0], ['town/fountain-center',0,0,0,0,.6]]);
BLD.tavern=t=>G([...room(2,1,0,t>=2?'stone':'wood',{door:[2,0],win:1}), ...room(2,1,1,'wood',{win:1}), ...gableRoof(2,1,2,true), ['town/banner-red',1.02,1.1,.25,0,.6], ['town/stall-bench',0,0,.9,0,.5], ['nature/pot_large',-.7,0,.85,0,.8]],1.0);
BLD.chapel=t=>{
  const g=G([...room(1,2,0,'stone',{door:[2,0],win:1}), ['town/roof-high-gable',0,1,-.5,H], ['town/roof-high-gable',0,1,.5,H],
    ['castle/tower-square-base',0,0,-1.3,0,.7], ['castle/tower-square-mid-windows',0,.7,-1.3,0,.7], ['castle/tower-square-roof',0,1.4,-1.3,0,.7]],1.0);
  return g;
};
BLD.tower=t=>{
  const pal=PAL.era&&PAL.era[t];
  const g=G([['castle/tower-square-base',0,0,0,0,1.5],['castle/tower-square-mid-windows',0,1.5,0,0,1.42],
    t>=2?['castle/tower-square-mid',0,2.95,0,0,1.42]:null,
    [t>=1?'castle/tower-square-top-roof-high':'castle/tower-square-top', 0, t>=2?4.4:2.95, 0, 0, 1.5],
    t>=3?['castle/flag',0,6.2,0,0,1.2]:null]);
  return setMat(g,pal);
};
BLD.barracks=t=>{
  const pal=PAL.era&&PAL.era[t];
  const g=G([['castle/tower-square-base',0,0,0,0,1.8,1.1,1.5],['castle/tower-square-mid-door',0,1.1,0,H,1.5,1.1,1.8],['castle/tower-square-top-roof',0,2.2,0,0,1.8,1,1.5],
    ['castle/flag-banner-long',.95,0,.7,0,.7],['castle/flag',-.85,2.2,.65,0,.9]]);
  setMat(g,pal);
  // eğitim kuklası
  const d=P('nature/stump_round',.6,0,.95,0,1.6); if(d) g.add(d);
  return g;
};
BLD.castle=t=>{
  const pal=PAL.era&&PAL.era[Math.max(2,t)];
  const g=G([['castle/tower-square-base',0,0,0,0,2.4,1.4,2.4],['castle/tower-square-mid-windows',0,1.4,0,0,2.2,1.4,2.2],['castle/tower-square-top-roof-high',0,2.8,0,0,2.4],
    ['castle/tower-base',-1.5,0,-1.5,0,1.1,2.5,1.1],['castle/tower-base',1.5,0,-1.5,0,1.1,2.5,1.1],['castle/tower-base',-1.5,0,1.5,0,1.1,2.5,1.1],['castle/tower-base',1.5,0,1.5,0,1.1,2.5,1.1],
    ['castle/tower-hexagon-roof',-1.5,3.25,-1.5,0,1.4],['castle/tower-hexagon-roof',1.5,3.25,-1.5,0,1.4],['castle/tower-hexagon-roof',-1.5,3.25,1.5,0,1.4],['castle/tower-hexagon-roof',1.5,3.25,1.5,0,1.4],
    ['castle/flag-wide',0,5.5,0,0,1.6]]);
  return setMat(g,pal);
};
BLD.wonder=t=>{
  const pal=PAL.marble;
  const g=G([['castle/tower-square-base',0,0,0,0,5.4,.6,5.4],['castle/tower-square-base',0,.6,0,0,4.4,.6,4.4],
    ['nature/statue_column',-1.8,1.2,-1.8,0,2.6],['nature/statue_column',1.8,1.2,-1.8,0,2.6],['nature/statue_column',-1.8,1.2,1.8,0,2.6],['nature/statue_column',1.8,1.2,1.8,0,2.6],
    ['nature/statue_column',0,1.2,-1.8,0,2.6],['nature/statue_column',0,1.2,1.8,0,2.6],['nature/statue_column',-1.8,1.2,0,0,2.6],['nature/statue_column',1.8,1.2,0,0,2.6],
    ['castle/tower-square-base',0,3.6,0,0,4.2,.35,4.2]]);
  setMat(g,pal);
  const gold=new THREE.MeshStandardMaterial({color:new THREE.Color(0xffc93a).convertSRGBToLinear(),metalness:.75,roughness:.28});
  const marb=new THREE.MeshStandardMaterial({color:new THREE.Color(0xf0ebe0).convertSRGBToLinear(),roughness:.6});
  const dome=new THREE.Mesh(new THREE.SphereGeometry(1.7,24,12,0,Math.PI*2,0,Math.PI/2),gold); dome.position.y=3.95; dome.castShadow=true; g.add(dome);
  const drum=new THREE.Mesh(new THREE.CylinderGeometry(1.75,1.85,.3,24),marb); drum.position.y=3.95; g.add(drum);
  const sp=new THREE.Mesh(new THREE.ConeGeometry(.22,1.6,10),gold); sp.position.y=6.4; g.add(sp);
  const orb=new THREE.Mesh(new THREE.SphereGeometry(.28,12,8),gold); orb.position.y=5.6; g.add(orb);
  [[-2.3,-2.3],[2.3,-2.3],[-2.3,2.3],[2.3,2.3]].forEach(([x,z])=>{ const o=new THREE.Mesh(new THREE.ConeGeometry(.18,1.2,8),gold); o.position.set(x,1.8,z); g.add(o); const b2=new THREE.Mesh(new THREE.BoxGeometry(.5,1.2,.5),marb); b2.position.set(x,1.2+.0,z); g.add(b2); });
  return g;
};
BLD.hall=t=>{
  const pal=PAL.era&&PAL.era[t];
  const g=G([...room(2,2,0,'stone',{door:[2,1],win:1}).map(e=>[e[0],e[1]*1.25+.35,e[2],e[3]*1.25+.25,e[4],1.25]), ['town/roof-high-point',.35,1.25,.25,0,2.6,1.5,2.6],
    ['castle/tower-square-base',-1.1,0,-1.1,0,1.1],['castle/tower-square-mid-windows',-1.1,1.1,-1.1,0,1.05],['castle/tower-square-mid',-1.1,2.15,-1.1,0,1.05],['castle/tower-square-top-roof-high',-1.1,3.2,-1.1,0,1.1],
    ['castle/flag',-1.1,4.6,-1.1,0,1.1],['town/banner-red',1.62,1.1,.9,0,.8],['town/lantern',.4,0,1.85,0,.9],['survival/signpost',1.75,0,1.75,-.6,2.4],['survival/barrel',1.8,0,-.2,0,2.2],['survival/barrel',1.85,0,.25,0,2.0]]);
  g.children.forEach(c=>{ if(c.position.x===-1.1) setMat(c,pal); });
  if(t>=2){ const ex=G([['castle/tower-base',1.75,0,-1.6,0,.7,1.9,.7],['castle/tower-hexagon-roof',1.75,2.45,-1.6,0,.9],['castle/tower-base',-1.75,0,1.7,0,.7,1.9,.7],['castle/tower-hexagon-roof',-1.75,2.45,1.7,0,.9],
      ['castle/flag-banner-long',.35,0,1.95,0,.8],['castle/flag-banner-long',-.85,0,1.95,0,.8]]); setMat(ex,pal); g.add(ex); }
  if(t>=3){ const crown=new THREE.Mesh(new THREE.ConeGeometry(.25,.6,6),new THREE.MeshStandardMaterial({color:new THREE.Color(0xffc93a).convertSRGBToLinear(),metalness:.7,roughness:.3})); crown.position.set(-1.1,5.6,-1.1); g.add(crown); }
  return g;
};
BLD.armycamp=t=>G([['nature/tent_detailedOpen',-.9,0,-.8,.3,2.2],['nature/tent_detailedClosed',.95,0,-.9,-.2,2.0],['nature/tent_smallClosed',-.3,0,.95,Math.PI,2.0],
  ['nature/campfire_stones',.4,0,.3,0,1.6],['nature/campfire_logs',.4,0,.3,0,1.2],['survival/barrel',-1.6,0,-.1,0,2.2],['survival/box-large',-1.5,0,.4,.3,2.0],['survival/bedroll-packed',.9,0,.9,0,2.4],['castle/flag-banner-long',1.5,0,.9,0,.9],['town/fence',1.3,0,1.5,0,1.0],['nature/log_stack',-1.4,0,.9,H,1.4]]);
BLD.clinic=t=>{ const g=G([...room(2,1,0,'stone',{door:[2,0],win:1}), ...gableRoof(2,1,1), ['town/banner-green',1.02,.5,.25,0,.6], ['nature/plant_bushLarge',-.8,0,.75,0,2],['nature/flower_redA',.7,0,.75,0,2]],1.2); return g; };
BLD.firehouse=t=>{ const g=G([...room(2,1,0,'stone',{door:[2,0]}), ...room(2,1,1,'stone',{win:1}), ...gableRoof(2,1,2), ['castle/tower-square-base',-.95,0,-.4,0,.55,2.2,.55],['castle/tower-square-roof',-.95,2.2,-.4,0,.6], ['nature/pot_large',.6,0,.8,0,.9]],1.05); return g; };
BLD.blacksmith=t=>{ const g=G([...room(2,1,0,'stone',{door:[2,1]}), ['town/roof-flat',-.5,1,0,0],['town/roof-flat',.5,1,0,0], ['town/chimney',-.7,1.05,-.2,0,1.0], ['town/overhang',0,0,.85,0,1.2], ['survival/workbench-anvil',.55,0,.85,0,2.4], ['survival/workbench-grind',-.55,0,.9,H,2.2], ['survival/barrel',.95,0,.35,0,2.2]],1.15); return g; };
BLD.mine=t=>G([['survival/bucket',.3,0,.85,0,2.6],['survival/box-large',.85,0,.1,.4,2.0],['survival/tool-pickaxe',-.2,0,.95,.3,2.6],['nature/rock_tallA',0,0,-.3,0,2.4],['town/wall-wood-doorway-round'.replace('-doorway-round',''),0,0,.4,-H,1.0],['town/poles',-.4,0,.6,0,.8],['town/cart-high',.6,0,.7,.5,.6],['nature/stone_smallC',-.6,0,.8,0,1.4]]);
BLD.mill=t=>{ const g=G([['castle/tower-base',0,0,0,0,1.2,2.2,1.2],['town/roof-high-point',0,2.85,0,0,1.25]]); const bl=P('town/windmill',0,2.2,.68,0,1.15); if(bl){ g.add(bl); g.userData.blades=bl; } return g; };
BLD.stable=t=>G([...room(2,1,0,'wood',{door:[2,0]}), ...gableRoof(2,1,1), ['town/fence',0,0,1.0,0,1.0],['town/fence',-1.0,0,.6,H,.8],['nature/log_stack',.8,0,.75,0,1.0]],1.2);
BLD.magetower=t=>{ const pal=PAL.arcane||PAL.era&&PAL.era[2]; const g=G([['castle/tower-hexagon-base',0,0,0,0,1.5,1.6,1.5],['castle/tower-hexagon-mid',0,2.1,0,0,1.5],['castle/tower-hexagon-base',0,2.8,0,0,1.2,.9,1.2],['castle/tower-hexagon-roof',0,4.0,0,0,1.6],['castle/tower-slant-roof',0,0,0,0,.001]]); setMat(g,pal); const orb=new THREE.Mesh(new THREE.IcosahedronGeometry(.32,1),new THREE.MeshBasicMaterial({color:0x8fe0ff})); orb.position.y=5.6; orb.name='orb'; g.add(orb); return g; };
BLD.workshop=t=>G([['town/planks',0,0,0,0,2.2],['castle/siege-ballista',-.3,0,-.2,.5,.8],['town/poles-horizontal',.9,0,-.6,H,1.0],['nature/log_stackLarge',.7,0,.6,0,1.4],['town/overhang',-.6,0,.75,0,1.0]]);
BLD.hunter=t=>G([...room(1,1,0,'wood',{door:[2,0]}).map(e=>[e[0],e[1]-.3,e[2],e[3]-.3,e[4]]), ['town/roof-point',-.3,1,-.3,0], ['nature/tent_smallClosed',.55,0,.5,.6,1.6], ['survival/campfire-pit',-.45,0,.6,0,2.4], ['nature/log',.6,0,-.5,1.2,1.2], ['survival/fish-large',-.1,.02,.8,.5,2.2]],1.15);
BLD.statue=t=>G([['castle/tower-square-base',0,0,0,0,1.1,.35,1.1],['nature/statue_column',0,.35,0,0,2.2],['nature/statue_head',0,2.35,0,0,1.3],['nature/flower_redA',.6,0,.6,0,2],['nature/flower_yellowA',-.6,0,-.6,0,2]]);
BLD.garden=t=>G([['nature/fence_simple',0,0,0,0,1.8],['nature/fence_simple',0,0,0,Math.PI/2,1.8],['nature/fence_simple',0,0,0,Math.PI,1.8],['nature/fence_simple',0,0,0,-Math.PI/2,1.8],['nature/flower_redA',-.4,0,-.35,0,3.4],['nature/flower_yellowA',.4,0,.35,0,3.4],['nature/flower_purpleA',.35,0,-.4,0,3.4],['nature/flower_redB',-.35,0,.4,0,3.4],['nature/plant_bushDetailed',0,0,0,0,3.2],['nature/flower_yellowB',0,0,.5,0,3],['nature/flower_purpleA',-.5,0,0,1,3]]);
BLD.lamp=t=>G([['town/lantern',0,0,0,0,1.4],['nature/flower_yellowB',.35,0,.3,0,2],['nature/grass_large',-.3,0,-.25,0,2]]);
BLD.banner=t=>G([['castle/flag-wide',0,0,0,0,2.0],['nature/stone_smallA',.3,0,.3,0,1.2]]);
BLD.dock=t=>G([['nature/bridge_wood',0,0,0,0,2.0],['nature/canoe',.3,0,.4,.3,1.4]]);
/* aynı malzemeli parçaları tek ağa birleştir (çizim çağrısını azaltır) */
const bakeCache={};
function bake(root,keep){
  root.updateMatrixWorld(true);
  const inv=new THREE.Matrix4().copy(root.matrixWorld).invert(), groups={}, kill=[];
  root.traverse(o=>{
    if(!o.isMesh||!o.geometry||o.isSkinnedMesh) return;
    let p=o, skip=false; while(p){ if(keep&&keep.includes(p)) { skip=true; break; } p=p.parent; } if(skip) return;
    const g=o.geometry, hasUV=!!g.attributes.uv, key=o.material.uuid+(hasUV?'u':'');
    (groups[key]=groups[key]||{mat:o.material,uv:hasUV,list:[]}).list.push(o); kill.push(o);
  });
  const out=new THREE.Group();
  for(const k in groups){
    const G0=groups[k]; let n=0; const parts=[];
    G0.list.forEach(o=>{ let g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone(); const m=new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld); g.applyMatrix4(m); if(!g.attributes.normal) g.computeVertexNormals(); parts.push(g); n+=g.attributes.position.count; });
    const pos=new Float32Array(n*3), nor=new Float32Array(n*3), uv=G0.uv?new Float32Array(n*2):null; let off=0;
    parts.forEach(g=>{ const c=g.attributes.position.count; pos.set(g.attributes.position.array.subarray(0,c*3),off*3); nor.set(g.attributes.normal.array.subarray(0,c*3),off*3); if(uv&&g.attributes.uv) uv.set(g.attributes.uv.array.subarray(0,c*2),off*2); off+=c; g.dispose(); });
    const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.BufferAttribute(pos,3)); geo.setAttribute('normal',new THREE.BufferAttribute(nor,3)); if(uv) geo.setAttribute('uv',new THREE.BufferAttribute(uv,2)); geo.computeBoundingSphere();
    const mesh=new THREE.Mesh(geo,G0.mat); mesh.castShadow=true; mesh.receiveShadow=true; out.add(mesh);
  }
  kill.forEach(o=>{ if(o.parent) o.parent.remove(o); });
  // kalanlar (animasyonlu parçalar) korunur
  const rest=[]; root.traverse(o=>{ if(o!==root&&o.parent===root) rest.push(o); });
  root.updateMatrixWorld(true);
  return {baked:out, rest};
}
KR.bake=bake;
const VARI={house:2,tavern:2,clinic:2,firehouse:2,hunter:2,farm:4};
KR.building=function(type,tier,variant){
  if(!KR.ready||!BLD[type]) return null;
  try{
    const vr=VARI[type]?((variant||0)%VARI[type]):0;
    const key=type+'|'+(tier||0)+'|'+vr;
    if(!bakeCache[key]){
      let g=BLD[type](tier||0,vr); if(vr&&PAL.townB&&type!=='farm') g.traverse(o=>{ if(o.isMesh&&o.material===PAL.townA) o.material=PAL.townB; }); if(!g||!g.children.length) return null;
      const keep=g.userData.blades?[g.userData.blades]:[];
      const tmp=new THREE.Group(); tmp.add(g); const r=bake(tmp,keep);
      const proto=new THREE.Group(); proto.add(r.baked);
      if(g.userData.blades){ const bl=g.userData.blades; const wp=new THREE.Vector3(), wq=new THREE.Quaternion(), ws=new THREE.Vector3(); bl.updateMatrixWorld(true); bl.matrixWorld.decompose(wp,wq,ws); bl.parent.remove(bl); bl.position.copy(wp); bl.quaternion.copy(wq); bl.scale.copy(ws); bl.name='blades'; proto.add(bl); }
      bakeCache[key]=proto;
    }
    const w=bakeCache[key].clone(); w.userData.kr=1; const bl=w.getObjectByName('blades'); if(bl) w.userData.blades=bl; return w;
  }catch(e){ console.warn('prefab',type,e); return null; }
};
/* sur ve kapı: maske ile bağlanan castle kit parçaları */
KR.wall=function(t,mask){
  if(!KR.ready) return null;
  const pal=PAL.era&&PAL.era[t], g=new THREE.Group();
  const add=(n,x,z,ry,sx,sy,sz)=>{ const o=P(n,x,0,z,ry,sx,sy,sz); if(o) g.add(o); };
  add('castle/tower-square-base',0,0,0,.9,1.55,.9); add('castle/tower-top',0,0,0,.001);
  const top=P('castle/tower-square-top',0,1.55,0,0,.9,.9,.9); if(top) g.add(top);
  const arm=(dx,dz,ry)=>{ const o=P('castle/wall',dx*.75,0,dz*.75,ry,1.0,1.3,1.0); if(o){ o.scale.set(.6,1.3,1.0); g.add(o);} };
  if(mask&1) arm(0,-1,H); if(mask&2) arm(1,0,0); if(mask&4) arm(0,1,H); if(mask&8) arm(-1,0,0);
  return setMat(g,pal);
};
KR.gate=function(t,mask){
  if(!KR.ready) return null;
  const pal=PAL.era&&PAL.era[t];
  const g=G([['castle/bridge-straight',0,0,0,0,2,1.6,2],['castle/metal-gate',0,0,0,0,1.6,1.9,2.2],['castle/flag',-.9,1.9,0,0,.9],['castle/flag',.9,1.9,0,0,.9]]);
  setMat(g,pal);
  if((mask&5)&&!(mask&10)) g.rotation.y=Math.PI/2;
  return g;
};

/* ---------- doğa ---------- */
const TREES=['nature/tree_oak','nature/tree_default','nature/tree_detailed','nature/tree_fat','nature/tree_pineRoundA','nature/tree_pineRoundB','nature/tree_pineDefaultA','nature/tree_tall','nature/tree_cone','nature/tree_pineRoundC'];
/* örneklenmiş (instanced) düğüm havuzu: harita ağaç/kayaları tek çizim çağrısıyla */
const POOLS={}; const _m=new THREE.Matrix4(), _z=new THREE.Matrix4().makeScale(0,0,0);
function poolFor(n){
  if(POOLS[n]) return POOLS[n]; const tpl=KR.glb[n]; if(!tpl) return null; tpl.updateMatrixWorld(true);
  const cap=520, parts=[];
  tpl.traverse(ch=>{ if(!ch.isMesh) return; const im=new THREE.InstancedMesh(ch.geometry,ch.material,cap); im.castShadow=true; im.receiveShadow=true; im.frustumCulled=false; for(let i=0;i<cap;i++) im.setMatrixAt(i,_z); im.instanceMatrix.needsUpdate=true; parts.push({im,local:ch.matrixWorld.clone()}); if(KR.scene) KR.scene.add(im); });
  parts.forEach(pt=>pt.im.count=0);
  return POOLS[n]={parts,cap,hw:0,free:Array.from({length:cap},(_,i)=>cap-1-i)};
}
function poolNode(n,r,sc){
  const P0=poolFor(n); if(!P0||!P0.free.length) return null;
  const idx=P0.free.pop(), o=new THREE.Object3D(); if(idx+1>P0.hw){ P0.hw=idx+1; P0.parts.forEach(pt=>pt.im.count=P0.hw); } o.scale.setScalar(sc); o.rotation.y=r()*6.28;
  o.userData.pool={P0,idx};
  o.userData.sync=function(){ o.updateMatrix(); P0.parts.forEach(pt=>{ _m.multiplyMatrices(o.matrix,pt.local); pt.im.setMatrixAt(idx,_m); pt.im.instanceMatrix.needsUpdate=true; }); };
  o.userData.free=function(){ P0.parts.forEach(pt=>{ pt.im.setMatrixAt(idx,_z); pt.im.instanceMatrix.needsUpdate=true; }); P0.free.push(idx); o.userData.free=null; };
  return o;
}
KR.poolReset=function(){ for(const n in POOLS){ const P0=POOLS[n]; P0.parts.forEach(pt=>{ for(let i=0;i<P0.cap;i++) pt.im.setMatrixAt(i,_z); pt.im.instanceMatrix.needsUpdate=true; pt.im.count=0; }); P0.hw=0; P0.free=Array.from({length:P0.cap},(_,i)=>P0.cap-1-i); } };
KR.tree=function(r){ if(!KR.ready) return null; const n=TREES[Math.floor(r()*TREES.length)]; const sc=1.5+r()*.7; if(KR.scene){ const pn=poolNode(n,r,sc); if(pn) return pn; } const o=KR.get(n); if(!o) return null; o.scale.setScalar(sc); o.rotation.y=r()*6.28; return o; };
const ROCKS=['nature/stone_largeA','nature/stone_largeB','nature/stone_largeC','nature/stone_tallA','nature/stone_tallB','nature/stone_tallC','nature/stone_tallD'];
KR.rock=function(r,noPool){ if(!KR.ready) return null; const n=ROCKS[Math.floor(r()*ROCKS.length)]; const sc=1.6+r()*.6; if(KR.scene&&!noPool){ const pn=poolNode(n,r,sc); if(pn) return pn; } const o=KR.get(n); if(!o) return null; o.scale.setScalar(sc); o.rotation.y=r()*6.28; return o; };
KR.decor=function(r){ if(!KR.ready) return null; const L=['nature/flower_redA','nature/flower_yellowA','nature/flower_purpleA','nature/mushroom_redGroup','nature/plant_bush','nature/grass_large','nature/grass','nature/stump_old','nature/plant_bushDetailed','nature/mushroom_tanGroup','nature/grass_leafs']; const o=KR.get(L[Math.floor(r()*L.length)]); if(o){ o.scale.setScalar(1.6+r()*1.2); o.rotation.y=r()*6.28; o.traverse(m=>{ if(m.isMesh) m.castShadow=false; }); } return o; };
/* mevsim renkleri: yaprak malzemeleri */
const leafMats=()=>Object.keys(KR.mats).filter(k=>k.startsWith('nature/')&&/leaf|leaves|grass|bush|plant/i.test(k)).map(k=>KR.mats[k]);
KR.season=function(se){
  if(!KR.ready) return;
  KR.snowTarget=se===3?.85:0;
  const C=[[0x5a9e40,0x2f7a35],[0x4a9238,0x276e2c],[0xd8862a,0xb8502a],[0xe4ece9,0xcbd8d4]][se];
  Object.keys(KR.mats).filter(k=>k.startsWith('nature/')&&/leaf|grass/i.test(k)).forEach(k=>{ const m=KR.mats[k]; m.color.setHex(/Dark/.test(k)?C[1]:(/grass/i.test(k)&&se<3?0x5d9a3c:C[0])).convertSRGBToLinear(); });
};

/* ---------- karakterler (Blocky Characters, düğüm animasyonlu) ---------- */
const ROLE={
  villager:['blocky/character-a','blocky/character-b','blocky/character-c','blocky/character-e','blocky/character-f','blocky/character-k','blocky/character-m','blocky/character-n','blocky/character-i','blocky/character-q'],
  spear:['blocky/character-j'], archer:['blocky/character-m'], knight:['blocky/character-g','blocky/character-h'], hero:['blocky/character-p'],
  melee:['blocky/character-l'], brute:['blocky/character-o'], earcher:['blocky/character-r'], merchant:['blocky/character-d'],
  orc:['blocky/character-o'], zombie:['blocky/character-l'], bandit:['blocky/character-p','blocky/character-q','blocky/character-r'], barb:['blocky/character-a','blocky/character-k','blocky/character-b'], king:['blocky/character-o']
};
KR.charNames=ROLE;
const clipCache={};
function clips(name){ if(clipCache[name]) return clipCache[name]; const a={}; (KR.anims[name]||[]).forEach(c=>a[c.name]=c); return clipCache[name]=a; }
function findBone(root,re){ let f=null; root.traverse(o=>{ if(!f&&re.test(o.name)) f=o; }); return f; }
KR.char=function(role,opts){
  if(!KR.ready) return null; opts=opts||{};
  const list=ROLE[role]||ROLE.villager, name=opts.name||list[Math.floor(Math.random()*list.length)];
  const src=KR.glb[name]; if(!src) return null;
  const body=src.clone(); const wrap=new THREE.Group(); wrap.add(body);
  body.scale.setScalar(opts.scale||.62);
  const mixer=new THREE.AnimationMixer(body), C=clips(name), acts={};
  ['idle','walk','sprint','attack-melee-right','holding-right-shoot','die','pick-up','interact-right','emote-yes','holding-right','holding-both','sit'].forEach(n=>{ if(C[n]) acts[n]=mixer.clipAction(C[n]); });
  const hand=findBone(body,/arm-?right|right-?arm|hand.*r|arm_r/i)||findBone(body,/arm/i);
  wrap.userData.ch={mixer,acts,cur:null,hand,name,body};
  if(opts.tint){ body.traverse(o=>{ if(o.isMesh){ const key=o.material.uuid+'*'+opts.tint; if(!tintCache[key]){ const c=o.material.clone(); c.color.multiply(new THREE.Color(opts.tint)); tintCache[key]=c; } o.material=tintCache[key]; } }); }
  KR.play(wrap,'idle');
  return wrap;
};
KR.play=function(w,n,once,speed){
  const ch=w&&w.userData.ch; if(!ch) return; if(ch.cur===n) return;
  const a=ch.acts[n]||ch.acts.idle; if(!a) return;
  const prev=ch.cur&&ch.acts[ch.cur];
  a.reset(); a.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat); a.clampWhenFinished=!!once; a.timeScale=speed||1; a.play();
  if(prev&&prev!==a) prev.crossFadeTo(a,.18,false);
  ch.cur=n;
};
KR.attach=function(w,obj){ const ch=w&&w.userData.ch; if(!ch||!obj) return; (ch.hand||ch.body).add(obj); };
})();
