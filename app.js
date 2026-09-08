// Real Stock, shared logic. Everything reads the selected network's RPC and DexScreener directly from the browser.

// ---------- networks ----------
const NETWORKS={
  base:{key:"base",label:"Base",issuer:"Coinbase",chainId:8453,dexChain:"base",
    rpcs:["https://base-rpc.publicnode.com","https://mainnet.base.org","https://base.drpc.org"],
    explorer:"https://basescan.org/token/",explorerName:"Basescan",quote:"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",quoteSym:"USDC",
    factory:"0xB20f000000000000000000000000000000000000",verify:"b20",
    listUrl:"https://www.base.org/stocks",listName:"base.org/stocks",feedNote:"Chainlink total return feed on Base",
    tokens:[
["AAPLc","Apple","0xb200000000000000000000C2e324d24d7eEcd1fb","0x787f13dEa48Db0897CbCDD985de77809D837F988"],
["AMZNc","Amazon","0xb200000000000000000000d9192b6B456483C2E8","0x06A8E4b3aBB3B7543d8396FB2B763d22820cB295"],
["COINc","Coinbase","0xb200000000000000000000c85a31389D71F3ecfb","0x408e44f504A7371a345F03a73dDC96A4b48e8aa7"],
["CRCLc","Circle","0xB20000000000000000000019f6E7C675b73C2e4D","0x0231cF2635D1E17bB5c2462cc7504Ba1fBd61f33"],
["GOOGLc","Alphabet","0xb2000000000000000000002D0BA3164cc74f58B7","0x5bF49E0ffA937CE2FfF033c739aD7C634c4D34F2"],
["INTCc","Intel","0xB2000000000000000000004AFF16039bA04bdFBc","0xAB657C39bac0D5886250D70849e2E3E008F2EECB"],
["METAc","Meta","0xb2000000000000000000008bC8786B856E61707C","0x6526aE6797A76123638b863AeE4dD27Ba4E4b27D"],
["MSFTc","Microsoft","0xB200000000000000000000Ab99cFa739E253872B","0xeB10A6c9aa7E537aEd766C08c35Dae35B321b18c"],
["MSTRc","Strategy","0xb2000000000000000000004884b426556b92883d","0xB3cE282CD188b35DA0E38D8Bc7d58e33173D202a"],
["NVDAc","NVIDIA","0xb20000000000000000000078ee7ce2fE4908108C","0x04689a41629776563E6822F76f2e57D148d28513"],
["SNDKc","Sandisk","0xb200000000000000000000397293Cb8cda9a10c5","0x388b0dC46C0Fb05A74BeE0994fa5b02c6Fcca2eA"],
["SPCXc","SpaceX","0xb2000000000000000000007b9fcbd005511aCBd5","0x6A634B235903C4ad6376892180d6fF8612e3Fa68"],
["TSLAc","Tesla","0xb2000000000000000000001e800a7f5189430cD0","0xFaf869185383a24F8cb00e27BdA6b63B9905DCb4"]].map(c=>({symbol:c[0],name:c[1],address:c[2],feed:c[3],root:c[0].replace(/c$/,"")}))},
  robinhood:{key:"robinhood",label:"Robinhood Chain",issuer:"Robinhood",chainId:4663,dexChain:"robinhood",
    rpcs:["https://rpc.mainnet.chain.robinhood.com"],
    explorer:"https://robinhoodchain.blockscout.com/token/",explorerName:"Blockscout",quote:"0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",quoteSym:"USDG",
    beacon:"0xe10b6f6b275de231345c20d14ab812db62151b00",poolManager:"0x8366a39CC670B4001A1121B8F6A443A643e40951",verify:"beacon",
    listUrl:"https://docs.robinhood.com/chain/contracts/",listName:"docs.robinhood.com/chain/contracts",registry:"https://api.robinhood.com/rhj/assets",
    feedsUrl:"data/robinhood_feeds.json",feedNote:"Chainlink tokenized equity feed on Robinhood Chain",
    tokens:null /* loaded from data/robinhood.json */}
};
const NET_KEY=(new URLSearchParams(location.search).get("net")||(function(){try{return localStorage.getItem("rs_net")}catch(e){return null}})()||"base");
const NET=NETWORKS[NET_KEY]||NETWORKS.base;
try{ localStorage.setItem("rs_net",NET.key); }catch(e){}
const SEL={policyId:"0xdb3de624",isAuthorized:"0x55a1179e",policyExists:"0x330f5637",oraclePaused:"0x7706ba52",pausedFeatures:"0xde9997e3",uiMultiplier:"0xa60bf13d",newUIMultiplier:"0xdc767007",effectiveAt:"0x97a4064f",name:"0x06fdde03",symbol:"0x95d89b41",decimals:"0x313ce567",totalSupply:"0x18160ddd",multiplier:"0x1b3ed722",contractURI:"0xe8a3d485",isB20:"0xfa19b927",latestRoundData:"0xfeaf968c",transfer:"0xa9059cbb",balanceOf:"0x70a08231",paused:"0x5c975abb"};
const POLICY_REGISTRY="0x8453000000000000000000000000000000000002";
const SCOPE={sender:"b81736c875ab819dd97f59f2a6542cfb731ad52b4ae15a6f24df2fb02b0327f5",receiver:"8a4b3fa2d8b921852bc0089c6ef0958aa6961897be36fd731330fe2cd23f8363",executor:"10be5173aff2a44e748bd9acd8b19fe34689581398a9db7ba2fb671e786ff7d8"};
// Only selectors observed on chain are named. Anything else stays "unknown revert" rather than
// being attributed to a policy denial we did not actually see.
const ERRS={"db42144d":"the simulated sender holds none of this token","e450d38c":"the simulated sender holds none of this token"};
const BEACON_SLOT="0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50";
const QUOTES=new Set(["USDC","USDBC","WETH","ETH","USDT","CBBTC","USDG"]);
const state={rows:{},wallet:null,byAddr:{}};

async function loadRegistry(){
  if(NET.tokens) { NET.tokens.forEach(t=>state.byAddr[t.address.toLowerCase()]=t); return NET.tokens; }
  const [j,fj]=await Promise.all([fetch("data/robinhood.json").then(r=>r.json()), fetch(NET.feedsUrl).then(r=>r.json()).catch(()=>({}))]);
  NET.feeds=fj;
  NET.tokens=j.tokens.map(t=>({symbol:t.symbol,name:t.name,address:t.address,root:t.symbol,logo:null,feed:(fj[t.symbol]||{}).proxy||null,chainId:t.chainId,status:t.status,multiplier:t.multiplier?Number(t.multiplier):null,pendingMultiplier:t.pendingMultiplier||null,isin:t.isin,trading:t.trading,decimals:t.decimals,uid:t.uid}));
  NET.fetchedAt=j.fetchedAt; NET.tokens.forEach(t=>state.byAddr[t.address.toLowerCase()]=t); mountFooter(); return NET.tokens;
}
// Each issuer is priced against its OWN Chainlink feed. Feeds are total return: they already
// include that issuer's multiplier, so a feed price is directly comparable to that token's DEX price.
function feedFor(t){ return (t&&t.feed)||null; }
// The same underlying priced by the other issuer, for the cross issuer view. Not a premium:
// each issuer's token is its own claim with its own multiplier.
function otherIssuerFeed(root){ const c=NETWORKS.base.tokens.find(t=>t.root.toUpperCase()===String(root||"").toUpperCase()); return c?{feed:c.feed,rpcs:NETWORKS.base.rpcs,label:"Coinbase on Base"}:null; }

// ---------- helpers ----------
let rpcIdx=0;
async function rpcOn(rpcs,method,params){
  for(let i=0;i<rpcs.length;i++){
    const url=rpcs[(rpcIdx+i)%rpcs.length];
    try{
      const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})});
      const j=await r.json();
      if(j.error){ if(/rate|limit|429/i.test(JSON.stringify(j.error))) continue; throw new Error(JSON.stringify(j.error)); }
      return j.result;
    }catch(e){ if(i===rpcs.length-1) throw e; rpcIdx++; }
  }
}
const rpc=(m,p)=>rpcOn(NET.rpcs,m,p);
// Every network read is bound to the chain it claims to be. A wrong chainId means the
// answer belongs to a different asset, so it is discarded rather than displayed.
const CHAIN_HEX={base:"0x2105",robinhood:"0x1237"};
let chainOk=null;
async function assertChain(){
  if(chainOk!==null) return chainOk;
  try{ const id=await rpc("eth_chainId",[]); chainOk=(id||"").toLowerCase()===CHAIN_HEX[NET.key]; }catch(e){ chainOk=false; }
  if(!chainOk){ const b=document.getElementById("banner"); if(b){ b.style.display="block"; b.textContent="The RPC for "+NET.label+" did not report the expected chain id, so results are not being shown."; } }
  return chainOk;
}
const pad=(h)=>h.replace(/^0x/,"").padStart(64,"0");
const call=(to,data,from)=>rpc("eth_call",[Object.assign({to,data},from?{from}:{}),"latest"]);
const hexToStr=(h)=>{ if(!h||h.length<130) return null; const len=parseInt(h.slice(66,130),16); const hex=h.slice(130,130+len*2); try{ return decodeURIComponent(hex.replace(/(..)/g,"%$1")); }catch(e){ return null; } };
const hexToBig=(h)=>h&&h!=="0x"?BigInt(h):null;
const short=(a)=>a.slice(0,6)+"..."+a.slice(-4);
const fmt=(n,d=2)=>n==null?"n/a":Number(n).toLocaleString("en-US",{maximumFractionDigits:d});
const usd=(n)=>n==null?"n/a":"$"+fmt(n,n<1?4:2);
const usdBig=(n)=>n==null?"n/a":n>=1e9?"$"+(n/1e9).toFixed(2)+"B":n>=1e6?"$"+(n/1e6).toFixed(2)+"M":n>=1e3?"$"+(n/1e3).toFixed(1)+"K":usd(n);
const pct=(n)=>n==null?'<span class="sub">\u2014</span>':((n>=0?"+":"\u2212")+Math.abs(Number(n)).toFixed(2)+"%");
const ago=(ts)=>{ if(!ts) return "n/a"; const s=Date.now()/1000-ts; if(s<90) return Math.round(s)+"s"; if(s<5400) return Math.round(s/60)+"m"; if(s<172800) return (s/3600).toFixed(1)+"h"; return (s/86400).toFixed(1)+"d"; };
const esc=(s)=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
async function pool(items,fn,limit=5){ const out=new Array(items.length); let i=0; await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{ while(i<items.length){ const k=i++; try{ out[k]=await fn(items[k],k); }catch(e){ out[k]=null; } } })); return out; }

// ---------- onchain reads ----------
async function tokenCore(addr){
  const [name,symbol,dec,sup,mult,uri,isb,beacon,paused]=await Promise.all([
    call(addr,SEL.name).then(hexToStr).catch(()=>null),
    call(addr,SEL.symbol).then(hexToStr).catch(()=>null),
    call(addr,SEL.decimals).then(hexToBig).catch(()=>null),
    call(addr,SEL.totalSupply).then(hexToBig).catch(()=>null),
    (NET.verify==="beacon"?call(addr,SEL.uiMultiplier):call(addr,SEL.multiplier)).then(hexToBig).catch(()=>null),
    NET.verify==="b20"?call(addr,SEL.contractURI).then(hexToStr).catch(()=>null):Promise.resolve(null),
    NET.verify==="b20"?call(NET.factory,SEL.isB20+pad(addr)).then(h=>!!h&&/1$/.test(h)).catch(()=>null):Promise.resolve(null),
    NET.verify==="beacon"?rpc("eth_getStorageAt",[addr,BEACON_SLOT,"latest"]).then(h=>h?"0x"+h.slice(-40):null).catch(()=>null):Promise.resolve(null),
    (NET.verify==="beacon"
      ? call(addr,SEL.paused).then(h=>(h&&h!=="0x")?/1$/.test(h):null).catch(()=>null)
      : call(addr,SEL.pausedFeatures).then(h=>{ if(!h||h.length<130) return null; const off=parseInt(h.slice(2,66),16)*2+2; const len=parseInt(h.slice(off,off+64),16); return len>0; }).catch(()=>null))]);
  let pending=null;
  if(NET.verify==="beacon"){
    try{
      const [nm,ef]=await Promise.all([call(addr,SEL.newUIMultiplier).then(hexToBig).catch(()=>null), call(addr,SEL.effectiveAt).then(hexToBig).catch(()=>null)]);
      if(nm!=null&&mult!=null&&nm!==mult) pending={value:Number(nm)/1e18,effectiveAt:ef!=null?Number(ef):null};
    }catch(e){}
  }
  let meta=null; if(uri&&uri.startsWith("data:application/json;base64,")){ try{ meta=JSON.parse(atob(uri.split(",")[1])); }catch(e){} }
  const d=dec==null?null:Number(dec);
  const reg=state.byAddr[addr.toLowerCase()];
  return {addr,name,symbol,dec:d,supply:sup==null||d==null?null:Number(sup)/10**d,multiplier:mult==null?(reg&&reg.multiplier!=null?reg.multiplier:null):Number(mult)/1e18,uri,meta,isB20:isb,beacon,beaconOk:beacon?beacon.toLowerCase()===(NET.beacon||"").toLowerCase():null,paused,pending,
    image:(meta&&typeof meta.image==="string"&&/^https:\/\//.test(meta.image))?meta.image:(reg&&reg.logo?reg.logo:null)};
}
async function oracleFeed(feed,rpcs,label){
  if(!feed) return null;
  try{
    const h=await rpcOn(rpcs||NET.rpcs,"eth_call",[{to:feed,data:SEL.latestRoundData},"latest"]);
    if(!h||h.length<2+64*5) return null;
    const raw=BigInt("0x"+h.slice(2+64,2+128));
    const upd=parseInt(h.slice(2+64*3,2+64*4),16);
    if(raw<=0n||!upd) return {error:"feed returned no usable value"};
    let paused=null;
    try{ const p=await rpcOn(rpcs||NET.rpcs,"eth_call",[{to:feed,data:SEL.oraclePaused},"latest"]); if(p&&p!=="0x") paused=/1$/.test(p); }catch(e){}
    return {price:Number(raw)/1e8,updatedAt:upd,paused,source:label||NET.feedNote};
  }catch(e){ return {error:"feed read failed"}; }
}
async function dex(addr){
  try{ const r=await fetch("https://api.dexscreener.com/latest/dex/tokens/"+addr); const j=await r.json();
    const a=addr.toLowerCase();
    const ps=(j.pairs||[]).filter(p=>p.chainId===NET.dexChain&&(p.baseToken.address.toLowerCase()===a||p.quoteToken.address.toLowerCase()===a)).map(p=>{
      const isBase=p.baseToken.address.toLowerCase()===a; const other=isBase?p.quoteToken:p.baseToken;
      const pu=Number(p.priceUsd||0);
      // Only trust priceUsd when OUR token is the base side of the pair. Inverting a pair whose
      // base side is an unrelated token would price that token, not this one.
      const price=(isBase&&pu>0)?pu:null;
      const chg=isBase?((p.priceChange||{}).h24??null):null;
      return {p,other,price,chg,liq:(p.liquidity||{}).usd||0,good:isBase&&QUOTES.has((other.symbol||"").toUpperCase())};
    });
    const sorted=ps.slice().sort((x,y)=>((y.good&&!!y.price)-(x.good&&!!x.price))||(y.liq-x.liq));
    const b=sorted.find(x=>x.price!=null)||null;
    const quoteOnly=!b&&ps.length>0;
    const vol=ps.reduce((s,x)=>s+((x.p.volume||{}).h24||0),0);
    const chg=b?(b.chg!=null?b.chg:((sorted.find(x=>x.chg!=null)||{}).chg??null)):null;
    return {pairs:ps.length,quoteOnly,best:b?b.p:null,vol24:vol,price:b?b.price:null,liq:b?b.liq:null,venue:b?b.p.dexId:null,pairAddress:b?b.p.pairAddress:null,pairUrl:b?b.p.url:null,quote:b?b.other.symbol:null,chg};
  }catch(e){ return {pairs:0,best:null,vol24:0,price:null,liq:null,chg:null}; }
}
async function lookalikes(root,self,extra){
  const terms=[...new Set([root,extra].filter(Boolean).map(x=>String(x).trim()).filter(x=>x.length>=2))];
  const seen={};
  await Promise.all(terms.map(async q=>{
    try{ const r=await fetch("https://api.dexscreener.com/latest/dex/search?q="+encodeURIComponent(q)); const j=await r.json();
      for(const p of (j.pairs||[])){ if(p.chainId!==NET.dexChain) continue;
        for(const t of [p.baseToken,p.quoteToken]){ const a=t.address.toLowerCase(); if(state.byAddr[a]||(self&&a===self.toLowerCase())||QUOTES.has((t.symbol||"").toUpperCase())) continue;
          const s=(t.symbol||"").toLowerCase(), n=(t.name||"").toLowerCase(), ql=q.toLowerCase();
          if(s===ql||s.includes(ql)||n.includes(ql)){ const liq=(p.liquidity||{}).usd||0; if(!seen[a]||seen[a].liq<liq) seen[a]={addr:t.address,name:t.name,symbol:t.symbol,liq}; } } }
    }catch(e){}
  }));
  return Object.values(seen).sort((a,b)=>b.liq-a.liq).slice(0,10);
}
function holderFor(dx){ return NET.poolManager||dx.pairAddress||null; }
// Direct policy read (Base only): B20 exposes policyId(bytes32 scope); the Policy Registry
// precompile answers isAuthorized(policyId, account) and never reverts.
async function policyRead(token, wallet, holder){
  if(NET.verify!=="b20"||!wallet) return null;
  const out={};
  for(const [name,scope] of Object.entries(SCOPE)){
    try{
      const idHex=await call(token,SEL.policyId+scope);
      if(!idHex||idHex==="0x") { out[name]={id:null,ok:null}; continue; }
      const id=BigInt(idHex);
      const exists=await rpcOn(NET.rpcs,"eth_call",[{to:POLICY_REGISTRY,data:SEL.policyExists+pad("0x"+id.toString(16))},"latest"]).catch(()=>null);
      if(!exists||!/1$/.test(exists)){ out[name]={id:id.toString(),ok:null,unknownPolicy:true}; continue; }
      const who=name==="sender"?(holder||wallet):wallet;
      const a=await rpcOn(NET.rpcs,"eth_call",[{to:POLICY_REGISTRY,data:SEL.isAuthorized+pad("0x"+id.toString(16))+pad(who)},"latest"]);
      out[name]={id:id.toString(),ok:(a&&/1$/.test(a))?true:false,who};
    }catch(e){ out[name]={id:null,ok:null,err:true}; }
  }
  return out;
}
function decodeRevert(msg){
  const m=String(msg||"").match(/0x([0-9a-f]{8})/i);
  if(!m) return null;
  return ERRS[m[1].toLowerCase()]||("reverted with 0x"+m[1]);
}
// Simulation is a second, narrower signal: one sender, one recipient, one unit, this block.
async function policyProbe(token, holder, to){
  if(!holder||!to) return {status:"unknown",detail:"no pool holder available to simulate from"};
  try{
    const r=await call(token,SEL.transfer+pad(to)+pad("1"),holder);
    if(r&&r!=="0x"&&!/1$/.test(r)) return {status:"unknown",detail:"transfer call returned false"};
    if(!r||r==="0x") return {status:"unknown",detail:"empty return data, could not confirm"};
    return {status:"ok",detail:"simulated 1 unit transfer from the deepest pool succeeded at the current block"};
  }
  catch(e){
    const d=decodeRevert(e.message||e);
    if(d&&/insufficient balance/.test(d)) return {status:"unknown",detail:"the simulated sender has no balance right now"};
    if(d&&/policy forbids/.test(d)) return {status:"blocked",detail:"policy forbids this transfer"};
    if(d&&/paused/.test(d)) return {status:"blocked",detail:"token transfers are paused"};
    return {status:"unknown",detail:"simulation unavailable"+(d?": "+d:"")};
  }
}
async function loadRow(t,light){
  const feed=feedFor(t);
  const [core,orc,dx]=await Promise.all([light?Promise.resolve({addr:t.address,name:t.name,symbol:t.symbol,dec:t.decimals||18,supply:null,multiplier:t.multiplier!=null?t.multiplier:null,image:t.logo||null,isB20:null,beaconOk:null,paused:null}):tokenCore(t.address), oracleFeed(feed,NET.rpcs), dex(t.address)]);
  const good=orc&&orc.price>0&&!orc.error;
  const prem=(dx.price>0&&good)?(dx.price/orc.price-1)*100:null;
  const mcap=(core.supply!=null&&good)?core.supply*orc.price:null;
  const row={t,core,orc,dx,prem,mcap}; state.rows[t.address.toLowerCase()]=row; return row;
}
async function loadAll(onRow){
  if(!(await assertChain())) return state.rows;
  const toks=await loadRegistry();
  const light=toks.length>20;
  await pool(toks,async t=>{ const r=await loadRow(t,light); if(onRow) onRow(r); return r; },light?6:13);
  return state.rows;
}
function resolve(q){
  q=(q||"").trim(); if(/^0x[0-9a-fA-F]{40}$/.test(q)) return q;
  const t=q.toUpperCase().replace(/C$/,""); const hit=(NET.tokens||[]).find(c=>c.symbol.toUpperCase().replace(/C$/,"")===t||c.name.toUpperCase()===q.toUpperCase()); return hit?hit.address:null;
}
function isOfficial(core){ if(!core) return false; if(NET.verify==="b20") return !!(core.isB20&&core.meta&&/metadata\.coinbase\.com/.test(JSON.stringify(core.meta))); return !!core.beaconOk; }

// ---------- ui bits ----------
const ICON={
  pass:'<svg class="ic" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 8.5 6.5 12 13 4.5"/></svg>',
  fail:'<svg class="ic warnv" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
  unk:'<svg class="ic warnv" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5.5 5.5a2.5 2.5 0 1 1 3 2.4V10"/><path d="M8.5 12.6h.01"/></svg>',
  pend:'<svg class="ic spin" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 1.6a6.4 6.4 0 1 1-6.4 6.4" stroke-linecap="round"/></svg>',
  big:{pass:'<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><path d="M6 17l7 7 13-15"/></svg>',
       fail:'<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" class="warnv"><path d="M8 8l16 16M24 8L8 24"/></svg>',
       unk:'<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" class="warnv"><path d="M11 11a5 5 0 1 1 6 4.9V20"/><path d="M17 26h.01"/></svg>'}
};
const LOGO='<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M3 10V3H10 M22 29H29V22"/><path d="M11 24V8H17C21 8 23 10 23 14S21 20 17 20H11 M17 20L23 24"/></svg>';
const tradeLinks=(t,dx)=>{ if(NET.key==="base") return '<a target="_blank" rel="noopener" href="https://aerodrome.finance/swap?from='+NET.quote+'&to='+t.address+'">Trade on Aerodrome</a>';
  return dx&&dx.pairUrl?'<a target="_blank" rel="noopener" href="'+esc(dx.pairUrl)+'">Trade on '+esc(dx.venue||"DEX")+'</a>':''; };
const infoLinks=(addr)=>'<a target="_blank" rel="noopener" href="'+NET.explorer+addr+'">'+NET.explorerName+'</a> <a target="_blank" rel="noopener" href="https://dexscreener.com/'+NET.dexChain+'/'+addr+'">DexScreener</a>';
const logo=(core,t)=>{ const img=(core&&core.image)||(t&&t.logo); const fb=esc((((t?t.symbol:core&&core.symbol)||"?")+"").replace(/c$/,"").slice(0,4));
  return img?'<img src="'+esc(img)+'" alt="" onerror="this.replaceWith(Object.assign(document.createElement(\'div\'),{className:\'ph\',textContent:\''+fb+'\'}))">':'<div class="ph">'+fb+'</div>'; };
const tokenCell=(core,t)=>'<div class="tk">'+logo(core,t)+'<div><b>'+esc(t?t.symbol:core.symbol||"?")+'</b><small>'+esc((core&&core.name)||(t?t.name:""))+'</small></div></div>';
// One evidence row: number, name, result text with icon, supporting detail.
function evrow(n,status,title,result,detail){
  const ic=status==="pass"?ICON.pass:status==="fail"?ICON.fail:status==="pending"?ICON.pend:ICON.unk;
  const cls=(status==="fail"||status==="unknown")?" warnv":"";
  return '<div class="evrow"><div class="n">'+String(n).padStart(2,"0")+'</div><div><div class="t">'+title+'</div>'+(detail?'<div class="d">'+detail+'</div>':'')+'</div><div class="r'+cls+'">'+esc(result)+ic+'</div></div>';
}
// ---------- market hours (NYSE, ignores holidays) ----------
function marketStatus(){
  const now=new Date(); const et=new Date(now.toLocaleString("en-US",{timeZone:"America/New_York"}));
  const day=et.getDay(), mins=et.getHours()*60+et.getMinutes();
  const open=day>=1&&day<=5&&mins>=570&&mins<960;
  let next=new Date(et);
  if(open){ next.setHours(16,0,0,0); }
  else { next.setHours(9,30,0,0); if(next<=et) next.setDate(next.getDate()+1); while(next.getDay()===0||next.getDay()===6) next.setDate(next.getDate()+1); }
  const diff=Math.max(0,next-et); const h=Math.floor(diff/3600000), m=Math.floor(diff%3600000/60000);
  return {open,label:open?"US market open, closes in "+h+"h "+m+"m":"US market closed, opens in "+h+"h "+m+"m"};
}
function sessionNote(){ const s=marketStatus(); return s.open?"US regular session open":"US regular session closed, feeds run 24/5"; }

// ---------- wallet ----------
async function connectWallet(){
  if(!window.ethereum){ alert("No wallet found. Install an EVM wallet."); return null; }
  const acc=await window.ethereum.request({method:"eth_requestAccounts"}); state.wallet=acc[0]||null;
  paintWallet(); document.dispatchEvent(new CustomEvent("wallet",{detail:state.wallet})); return state.wallet;
}
function paintWallet(){ const b=document.getElementById("connect"); if(b) b.textContent=state.wallet?short(state.wallet):"Connect wallet"; }
async function restoreWallet(){
  try{ if(window.ethereum){ const acc=await window.ethereum.request({method:"eth_accounts"}); if(acc&&acc[0]) state.wallet=acc[0]; } }catch(e){}
  paintWallet(); if(state.wallet) document.dispatchEvent(new CustomEvent("wallet",{detail:state.wallet}));
  if(window.ethereum&&window.ethereum.on) window.ethereum.on("accountsChanged",a=>{ state.wallet=a[0]||null; paintWallet(); document.dispatchEvent(new CustomEvent("wallet",{detail:state.wallet})); });
}

// ---------- shared chrome ----------
function withNet(href){ const u=new URL(href,location.href); u.searchParams.set("net",NET.key); return u.pathname.split("/").pop()+u.search; }
function mountNav(active){
  const el=document.getElementById("nav"); if(!el) return;
  const links=[["index.html","Check"],["stocks.html","Tokens"],["portfolio.html","Portfolio"]];
  const segs=Object.values(NETWORKS).map(n=>'<button data-net="'+n.key+'"'+(n.key===NET.key?' class="on"':'')+'>'+n.label+'</button>').join("");
  el.className="top";
  el.innerHTML='<a class="brand" href="'+withNet("index.html")+'">'+LOGO+'<b>Real Stock</b></a>'
    +'<nav class="nav">'+links.map(l=>'<a href="'+withNet(l[0])+'"'+(l[0]===active?' class="on"':"")+'>'+l[1]+'</a>').join("")+'</nav>'
    +'<div class="hright"><div class="seg">'+segs+'</div><button class="linkbtn" id="connect">Connect wallet</button></div>';
  document.getElementById("connect").onclick=connectWallet;
  el.querySelectorAll(".seg button").forEach(b=>b.onclick=()=>{ const k=b.dataset.net; if(k===NET.key) return; try{ localStorage.setItem("rs_net",k); }catch(x){} const u=new URL(location.href); u.searchParams.set("net",k); u.searchParams.delete("q"); location.href=u.toString(); });
  restoreWallet();
}
function mountFooter(){ const f=document.getElementById("foot"); if(f){ f.className="foot"; f.innerHTML='Data read live from '+esc(NET.label)+' RPC and DexScreener, directly in your browser. No backend, no keys. '+(NET.key==="base"?'Canonical list from base.org/stocks and docs.base.org. B20 precompiles, B20Factory and Chainlink feeds on Base.':'Canonical list from Robinhood\'s asset registry (api.robinhood.com/rhj/assets, snapshot '+esc(NET.fetchedAt||"")+') and docs.robinhood.com/chain/contracts. Reference prices use the Chainlink feed of the same underlying on Base.')+' Tokenized stocks are available only in eligible jurisdictions outside the US. Market hours ignore exchange holidays. Informational only, not investment advice.'; } }
