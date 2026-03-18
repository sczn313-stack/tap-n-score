/* ============================================================
   docs/sec.js — FULL REPLACEMENT
   B2B LANE VISUAL BUILD
   Adds: visual counted/missed lane grid on Report Card
============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  const viewPrecision = $("viewPrecision");
  const viewReport = $("viewReport");
  const toReportBtn = $("toReportBtn");
  const backBtn = $("backBtn");

  const scoreValue = $("scoreValue");
  const scoreBand = $("scoreBand");
  const runDistance = $("runDistance");
  const runHits = $("runHits");
  const runTime = $("runTime");
  const windageBig = $("windageBig");
  const windageDir = $("windageDir");
  const elevationBig = $("elevationBig");
  const elevationDir = $("elevationDir");
  const goHomeBtn = $("goHomeBtn");

  const secCardImg = $("secCardImg");
  const vendorBtn = $("vendorBtn");
  const surveyBtn = $("surveyBtn");

  const KEY_PAYLOAD = "SCZN3_SEC_PAYLOAD_V1";
  const DEFAULT_SURVEY_URL = "https://forms.gle/uCSDTk5BwT4euLYeA";

  function safeJsonParse(s){ try{return JSON.parse(s);}catch{return null;} }
  function fmt2(n){ return Number(n||0).toFixed(2); }
  function nowStamp(){
    const d=new Date();
    return `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,"0")}`;
  }

  function isB2B(payload){
    return String(payload?.drill?.mode||"").toLowerCase()==="b2b"
        || String(payload?.sku||"").toLowerCase().includes("b2b");
  }

  function scoreBandInfo(score,b2b){
    const s=Number(score)||0;
    if(b2b){
      if(s>=9)return{cls:"scoreBandGreen",text:"STRONG / EXCELLENT"};
      if(s>=6)return{cls:"scoreBandYellow",text:"IMPROVING / SOLID"};
      return{cls:"scoreBandRed",text:"NEEDS WORK"};
    }
    if(s>=90)return{cls:"scoreBandGreen",text:"STRONG / EXCELLENT"};
    if(s>=60)return{cls:"scoreBandYellow",text:"IMPROVING / SOLID"};
    return{cls:"scoreBandRed",text:"NEEDS WORK"};
  }

  function loadPayload(){
    const qp=new URL(location.href).searchParams.get("payload");
    if(qp){
      try{return JSON.parse(decodeURIComponent(escape(atob(qp))));}
      catch{}
    }
    return safeJsonParse(localStorage.getItem(KEY_PAYLOAD)||"");
  }

  function showPrecision(){ viewPrecision.classList.add("viewOn"); viewReport.classList.remove("viewOn"); }
  function showReport(){ viewPrecision.classList.remove("viewOn"); viewReport.classList.add("viewOn"); }

  function renderPrecision(p){
    const b2b=isB2B(p);
    const score=Number(p?.score||0);
    const band=scoreBandInfo(score,b2b);

    scoreValue.textContent=Math.round(score);
    scoreBand.textContent=band.text;
    scoreBand.className="scoreBand "+band.cls;

    if(b2b){
      const taps=Number(p?.hits||p?.shots||0);
      windageBig.textContent=Math.round(score);
      windageDir.textContent="/10";
      elevationBig.textContent=taps;
      elevationDir.textContent="TAPS";
      runDistance.textContent="DRILL MODE";
      runHits.textContent=`${taps} taps`;
      runTime.textContent=nowStamp();
      return;
    }

    windageBig.textContent=fmt2(p?.windage?.clicks);
    windageDir.textContent=p?.windage?.dir||"—";
    elevationBig.textContent=fmt2(p?.elevation?.clicks);
    elevationDir.textContent=p?.elevation?.dir||"—";

    runDistance.textContent=`${Math.round(p?.distanceYds||100)} yds`;
    runHits.textContent=`${p?.shots||0} hits`;
    runTime.textContent=nowStamp();
  }

  async function drawReport(p){
    const b2b=isB2B(p);

    const W=1080,H=1920,pad=60;
    const c=document.createElement("canvas");
    c.width=W;c.height=H;
    const ctx=c.getContext("2d");

    ctx.fillStyle="#06070a";
    ctx.fillRect(0,0,W,H);

    ctx.fillStyle="#fff";
    ctx.font="900 120px system-ui";
    ctx.textAlign="center";
    ctx.fillText(Math.round(p.score||0),W/2,380);

    ctx.font="700 26px system-ui";
    ctx.fillStyle="rgba(255,255,255,.75)";

    if(b2b){
      const hits=Number(p?.hits||p?.shots||0);
      ctx.fillText(`DRILL MODE | ${hits} taps | SCORE ${Math.round(p.score)}/10`,W/2,460);

      // ===== LANE GRID =====
      const total=10;
      const cols=5;
      const rows=2;
      const size=110;
      const gap=36;

      const gridW=cols*size+(cols-1)*gap;
      const startX=(W-gridW)/2;
      const startY=560;

      for(let i=0;i<total;i++){
        const r=Math.floor(i/cols);
        const col=i%cols;

        const x=startX+col*(size+gap);
        const y=startY+r*(size+gap);

        let color="rgba(255,255,255,.25)";
        if(i<hits) color="#48ff8b";       // counted
        else if(i<total) color="#ff4d4d"; // missed

        ctx.beginPath();
        ctx.arc(x+size/2,y+size/2,size/2,0,Math.PI*2);
        ctx.fillStyle=color;
        ctx.fill();

        ctx.lineWidth=4;
        ctx.strokeStyle="rgba(0,0,0,.5)";
        ctx.stroke();
      }

      ctx.fillStyle="rgba(255,255,255,.8)";
      ctx.font="900 28px system-ui";
      ctx.fillText("COUNTED LANES",W/2,startY+rows*(size+gap)+40);
    }

    return c.toDataURL("image/png");
  }

  async function renderReport(p){
    const img=await drawReport(p);
    secCardImg.src=img;

    const v=p.vendorUrl||"#";
    vendorBtn.href=v;
    vendorBtn.textContent="Visit Vendor";

    const s=p.surveyUrl||DEFAULT_SURVEY_URL;
    surveyBtn.href=s;
  }

  const payload=loadPayload();
  if(!payload){ alert("Run a target first."); return; }

  renderPrecision(payload);
  showPrecision();

  toReportBtn.onclick=async()=>{
    showReport();
    await renderReport(payload);
  };

  backBtn.onclick=showPrecision;

  if(goHomeBtn){
    goHomeBtn.onclick=()=>location.href="./index.html?fresh="+Date.now();
  }
})();
