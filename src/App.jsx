import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, AreaChart, Area, BarChart, Bar, Legend, ReferenceLine,
  Cell, ReferenceDot
} from "recharts";

/** AlprhaTrace (no monthly contributions) */

const PREFERRED_ORDER = [
  "MSCI World Minimum Volatility (USD)",
  "MSCI World Momentum",
  "MSCI USA Small Cap Value Weighted",
  "Gold spot price",
  "FTSE World Government Bond - Developed Markets (Hedged EUR)",
  "Solactive STR 8.5 Daily",
  "MSCI World Sector Neutral Quality",
];
const DEFAULT_WEIGHTS = {
  "MSCI World Minimum Volatility (USD)": 0.35,
  "MSCI World Momentum": 0.25,
  "MSCI USA Small Cap Value Weighted": 0.10,
  "Gold spot price": 0.10,
  "FTSE World Government Bond - Developed Markets (Hedged EUR)": 0.10,
  "Solactive STR 8.5 Daily": 0.10,
  "MSCI World Sector Neutral Quality": 0.00,
};

const toMonthStr = (d) => {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = (dt.getMonth() + 1).toString().padStart(2, "0");
  return `${y}-${m}-01`;
};
const addMonths = (dStr, n) => {
  const d = new Date(dStr);
  const nd = new Date(d.getFullYear(), d.getMonth() + n, 1);
  return toMonthStr(nd);
};
const monthsBetween = (startStr, endStr) => {
  const s = new Date(startStr), e = new Date(endStr);
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
};
const rangeMonths = (startStr, endStr) => {
  const out = [], n = monthsBetween(startStr, endStr);
  for (let i = 0; i <= n; i++) out.push(addMonths(startStr, i));
  return out;
};

const IT_ANNUAL_CPI = {
  1994: 4.05, 1995: 5.23, 1996: 4.00, 1997: 2.04, 1998: 1.95, 1999: 1.66, 2000: 2.53,
  2001: 2.78, 2002: 2.46, 2003: 2.67, 2004: 2.20, 2005: 1.98, 2006: 2.09, 2007: 1.82,
  2008: 3.34, 2009: 0.77, 2010: 1.52, 2011: 2.78, 2012: 3.04, 2013: 1.21, 2014: 0.24,
  2015: 0.03, 2016: -0.09, 2017: 1.22, 2018: 1.13, 2019: 0.61, 2020: -0.13, 2021: 1.87,
  2022: 8.20, 2023: 5.62, 2024: 0.98, 2025: 1.8,
};
function buildItalyMonthlyCPI(dates) {
  const out = {}; if (!dates.length) return out; out[dates[0]] = 100;
  for (let i = 1; i < dates.length; i++) {
    const y = new Date(dates[i]).getFullYear();
    const r = IT_ANNUAL_CPI[y] ?? 0;
    const monthlyFactor = Math.pow(1 + r / 100, 1 / 12);
    out[dates[i]] = out[dates[i - 1]] * monthlyFactor;
  } return out;
}

function stdev(arr){ if(!arr.length) return 0; const m=arr.reduce((a,b)=>a+b,0)/arr.length;
  const v=arr.reduce((s,x)=>s+Math.pow(x-m,2),0)/(arr.length-1||1); return Math.sqrt(Math.max(v,0));}
function cagr(indexSeries){ if(!indexSeries.length) return 0; const s=indexSeries[0].value, e=indexSeries[indexSeries.length-1].value;
  const yrs=(indexSeries.length-1)/12; if(yrs<=0||s<=0) return 0; return Math.pow(e/s,1/yrs)-1; }
function annualVol(mrets){ return stdev(mrets)*Math.sqrt(12); }
function sharpe(mrets, rf=0){ const rfM=rf/12; const ex=mrets.map(r=>r-rfM); const mean=ex.reduce((a,b)=>a+b,0)/ex.length;
  const sd=stdev(mrets); return sd===0?0:(mean/sd)*Math.sqrt(12); }
function sortino(mrets, rf=0){ const rfM=rf/12; const dn=mrets.filter(r=>r<rfM); const dd=stdev(dn);
  const mean=(mrets.reduce((a,b)=>a+b,0)/mrets.length)-rfM; return dd===0?0:(mean/dd)*Math.sqrt(12); }
function drawdownsFromIndex(idxMap){ let maxSF=-Infinity; const out=[]; Object.keys(idxMap).forEach(d=>{
  const v=idxMap[d]; if(v>maxSF) maxSF=v; out.push({date:d, value: v/maxSF-1});}); return out; }
function pctChangeSeries(vals){ const out=[]; for(let i=1;i<vals.length;i++){ out.push((vals[i]-vals[i-1])/vals[i-1]); } return out; }

function normalizeAndInterpolate(priceTable, startDateStr){
  const dates = priceTable.map(r=>toMonthStr(r.Date||r.date||r["Date"])).filter(Boolean).sort();
  const unique = Array.from(new Set(dates)); const first=unique[0]; const last=unique[unique.length-1];
  const aligned = rangeMonths(startDateStr<first?startDateStr:first, last);

  const cols = Object.keys(priceTable[0]||{}).filter(k=>k.toLowerCase()!=="date");
  const rawByDate={};
  for(const row of priceTable){
    const d = toMonthStr(row.Date||row.date||row["Date"]); if(!rawByDate[d]) rawByDate[d]={};
    for(const c of cols){ const v=row[c]; rawByDate[d][c] = (v===null||v===undefined||v==="")? null: Number(v); }
  }

  const series={};
  for(const c of cols){
    const LIMIT="2003-01-01";
    const orig = aligned.map(d=> rawByDate[d]?.[c] ?? null);
    const firstIdx = orig.findIndex(x=>x!=null && !isNaN(x));
    let scaled = Array.from(orig);
    if(firstIdx>=0){ const base=orig[firstIdx]; scaled = orig.map(x=> (x==null||isNaN(x))? null : (x/base)*100 ); }
    const a = scaled.slice();
    let i=0; while(i<a.length){
      if(a[i]==null){ let j=i+1; while(j<a.length && a[j]==null) j++;
        if(i>0 && j<a.length){ const v0=a[i-1], v1=a[j]; const steps=j-i+1;
          for(let k=1;k<steps;k++) a[i+k-1] = v0 + (v1-v0)*(k/steps); i=j; continue; } }
      i++;
    }
    const sIdx = aligned.findIndex(d=>d>=startDateStr);
    const lIdx = aligned.findIndex(d=>d>=LIMIT);
    const clampIdx = Math.min(firstIdx===-1?aligned.length-1:firstIdx, lIdx===-1?aligned.length-1:lIdx);
    if(sIdx!==-1 && firstIdx> sIdx){
      const endI = Math.max(firstIdx, clampIdx); const endVal = a[firstIdx]; const steps = endI - sIdx;
      if(steps>0){ for(let k=0;k<=steps;k++){ const t=k/steps; a[sIdx+k] = 100 + (endVal-100)*t; } }
    }
    for(let k=1;k<a.length;k++) if(a[k]==null) a[k]=a[k-1];
    for(let k=a.length-2;k>=0;k--) if(a[k]==null) a[k]=a[k+1];
    series[c]=a;
  }
  return { dates: aligned, series, columns: cols };
}

function computePortfolio(dates, series, weights, rebalance="Annual"){
  const cols = Object.keys(series);
  const wVec = cols.map(c=> weights[c]??0);
  const wSum = wVec.reduce((a,b)=>a+b,0)||1;
  const targetW = wVec.map(w=> w/wSum);

  const assetRets = cols.map(c=> pctChangeSeries(series[c]));
  const N = assetRets[0]?.length || 0;
  const step = rebalance==="Monthly"?1: rebalance==="Quarterly"?3:12;
  let curW = targetW.slice();
  const portRets = [];
  for(let t=0;t<N;t++){
    let r=0; for(let i=0;i<cols.length;i++) r += (curW[i]||0) * (assetRets[i][t]||0);
    portRets.push(r);
    let nv=[]; for(let i=0;i<cols.length;i++) nv.push((curW[i]||0)*(1+(assetRets[i][t]||0)));
    const s=nv.reduce((a,b)=>a+b,0)||1; nv=nv.map(v=>v/s);
    if((t+1)%step===0) curW=targetW.slice(); else curW=nv;
  }
  const idx=[100]; for(const r of portRets) idx.push(idx[idx.length-1]*(1+r));
  const idxMap={}; for(let i=0;i<dates.length;i++) idxMap[dates[i]]=idx[i];
  return { portRets, idxMap, dates, drawdowns: drawdownsFromIndex(idxMap) };
}

function computeAnnualReturns(idxMap){
  const entries = Object.entries(idxMap).sort((a,b)=> (a[0]<b[0]?-1:1));
  const byY={}; for(const [d,v] of entries){ const y=new Date(d).getFullYear(); if(!byY[y]) byY[y]=[]; byY[y].push({d,v}); }
  const res=[]; const years=Object.keys(byY).map(Number).sort((a,b)=>a-b); let prev=null;
  for(const y of years){ const arr=byY[y].sort((a,b)=>(a.d<b.d?-1:1)); const last=arr[arr.length-1].v;
    if(prev!=null) res.push({year:y, nominal:(last-prev)/prev}); prev=last; }
  return res;
}
function rollingNCAGR(idxMap, years){
  const entries=Object.entries(idxMap).sort((a,b)=> (a[0]<b[0]?-1:1));
  const dates=entries.map(e=>e[0]), vals=entries.map(e=>e[1]);
  const w=years*12, out=[]; for(let i=0;i+w<vals.length;i++){ const c=Math.pow(vals[i+w]/vals[i],1/years)-1; out.push({date:dates[i], value:c}); }
  return out;
}

const STORAGE_KEY_ROWS="backtester_rows_v1";
const STORAGE_KEY_WEIGHTS="backtester_weights_v1";
function saveToStorage(rows,weights){ try{ if(rows) localStorage.setItem(STORAGE_KEY_ROWS, JSON.stringify(rows)); if(weights) localStorage.setItem(STORAGE_KEY_WEIGHTS, JSON.stringify(weights)); }catch{} }
function loadFromStorage(){ try{ return { rows: JSON.parse(localStorage.getItem(STORAGE_KEY_ROWS)||"null"), weights: JSON.parse(localStorage.getItem(STORAGE_KEY_WEIGHTS)||"null") }; }catch{ return {rows:null, weights:null}; } }

export default function App(){
  const [rows,setRows]=useState([]);
  const [startDate,setStartDate]=useState("1994-11-01");
  const [endDate,setEndDate]=useState("");
  const [rebalance,setRebalance]=useState("Annual");
  const [rf,setRf]=useState(0.02);
  const [initial,setInitial]=useState(100000);
  const [showData,setShowData]=useState(false);
  const [rollingYears,setRollingYears]=useState(10);
  const [weights,setWeights]=useState({});

  useEffect(()=>{ const {rows:sr, weights:sw}=loadFromStorage(); if(sr?.length) setRows(sr); if(sw) setWeights(sw); },[]);

  const rawColumns = useMemo(()=> rows[0]? Object.keys(rows[0]).filter(k=>k.toLowerCase()!=="date") : [], [rows]);
  const columns = useMemo(()=>{
    const pref=PREFERRED_ORDER.filter(c=>rawColumns.includes(c));
    const other=rawColumns.filter(c=>!pref.includes(c)).sort();
    return [...pref,...other];
  },[rawColumns]);

  useEffect(()=>{
    if(!columns.length) return;
    const nw={...weights}; let changed=false;
    for(const c of columns){ if(!(c in nw)){ nw[c]= (DEFAULT_WEIGHTS[c]??(1/columns.length)); changed=true; } }
    for(const k of Object.keys(nw)) if(!columns.includes(k)){ delete nw[k]; changed=true; }
    if(changed) setWeights(nw);
  },[columns]);

  useEffect(()=>{ if(rows?.length) saveToStorage(rows,null); },[rows]);
  useEffect(()=>{ if(Object.keys(weights).length) saveToStorage(null,weights); },[weights]);

  const norm = useMemo(()=> !rows.length? null: normalizeAndInterpolate(rows, startDate), [rows,startDate]);

  const dataBounds = useMemo(()=>{
    if(!rows.length) return {first:null,last:null};
    const dlist = rows.map(r=>toMonthStr(r.Date||r.date||r["Date"])).filter(Boolean).sort();
    return {first:dlist[0], last:dlist[dlist.length-1]};
  },[rows]);
  const handleStartChange=(val)=>{
    if(!val) return; let s=`${val}-01`;
    if(dataBounds.first && s < dataBounds.first) s=dataBounds.first;
    if(dataBounds.last && s > dataBounds.last) s=dataBounds.last;
    setStartDate(s);
  };

  const portfolio = useMemo(()=>{
    if(!norm) return null;
    const {dates, series} = norm;
    const lastDate = endDate || dates[dates.length-1];
    const i0 = dates.findIndex(d=>d>=startDate);
    const i1 = dates.findIndex(d=>d>=lastDate);
    const endIdx = i1===-1? dates.length-1 : i1;
    const adates = dates.slice(i0, endIdx+1);
    const aseries={}; for(const c of Object.keys(series)) aseries[c]=series[c].slice(i0, endIdx+1);
    return computePortfolio(adates, aseries, weights, rebalance);
  },[norm,weights,rebalance,startDate,endDate]);

  const euroTick = (n)=> new Intl.NumberFormat("it-IT",{ style:"currency", currency:"EUR", maximumFractionDigits:0, minimumFractionDigits:0}).format(Number(n||0));

  const metrics = useMemo(()=>{
    if(!portfolio) return null;
    const entries = Object.entries(portfolio.idxMap).sort((a,b)=> (a[0]<b[0]?-1:1));
    const dates = entries.map(e=>e[0]);
    const vals = entries.map(e=>e[1]);
    const monthly = []; for(let i=1;i<vals.length;i++) monthly.push(vals[i]/vals[i-1]-1);

    const cpi = buildItalyMonthlyCPI(dates);
    const realIdx = dates.map((d,i)=> ({date:d, value: vals[i] / ( (cpi[d]/cpi[dates[0]]) )}));

    const nominalIndex = dates.map((d,i)=>({date:d, value: vals[i]}));
    const drawdowns = portfolio.drawdowns;

    const annualNominal = computeAnnualReturns(portfolio.idxMap);
    const realIdxMap={}; for(const r of realIdx) realIdxMap[r.date]=r.value;
    const annualReal = computeAnnualReturns(realIdxMap);

    const rolling = rollingNCAGR(portfolio.idxMap, rollingYears);
    const avgRolling = rolling.length? (rolling.reduce((a,b)=>a+b.value,0)/rolling.length) : 0;

    const ddMinPoint = drawdowns.reduce((m,p)=> (p.value < (m?.value ?? 1) ? p : m), null);
    const rollingMin = rolling.reduce((m,p)=> (p.value < (m?.value ?? Infinity) ? p : m), null);
    const rollingMax = rolling.reduce((m,p)=> (p.value > (m?.value ?? -Infinity) ? p : m), null);
    const annualMinNomIdx = (annualNominal||[]).reduce((mi,p,i,arr)=> (i===0||p.nominal < arr[mi].nominal? i: mi), 0);
    const annualMaxNomIdx = (annualNominal||[]).reduce((mi,p,i,arr)=> (i===0||p.nominal > arr[mi].nominal? i: mi), 0);
    const annualMinRealIdx = (annualReal||[]).reduce((mi,p,i,arr)=> (i===0|| (p?.nominal ?? 0) < (arr[mi]?.nominal ?? 0)? i: mi), 0);
    const annualMaxRealIdx = (annualReal||[]).reduce((mi,p,i,arr)=> (i===0|| (p?.nominal ?? 0) > (arr[mi]?.nominal ?? 0)? i: mi), 0);

    return {
      cagr: cagr(nominalIndex),
      realCagr: cagr(realIdx),
      vol: annualVol(monthly),
      sharpe: sharpe(monthly, rf),
      sortino: sortino(monthly, rf),
      maxDrawdown: Math.min(...drawdowns.map(d=>d.value)),
      nominalIndex, realIndex: realIdx, drawdowns,
      annualNominal, annualReal, rolling, avgRolling,
      ddMinPoint, rollingMin, rollingMax,
      annualMinNomIdx, annualMaxNomIdx, annualMinRealIdx, annualMaxRealIdx,
      nominalValue: nominalIndex.map(p=>({date:p.date, value:(p.value/nominalIndex[0].value)*initial})),
      realValue: realIdx.map(p=>({date:p.date, value:(p.value/realIdx[0].value)*initial})),
      avgInfl: (()=>{
        if(dates.length<2) return 0;
        const arr = Object.values(cpi); const end = arr[arr.length-1]; const yrs=(dates.length-1)/12;
        return yrs>0? Math.pow(end/100, 1/yrs) - 1 : 0;
      })(),
    };
  },[portfolio, rf, initial, rollingYears]);

  const exportData=(filename,rows)=>{
    if(!rows||!rows.length) return;
    const headers=Object.keys(rows[0]); const lines=[headers.join(",")];
    for(const r of rows) lines.push(headers.map(h=>r[h]).join(","));
    const csv=lines.join("\n"); const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url);
  };
  const exportPortfolioValue=()=>{ if(!metrics) return; const rows=metrics.nominalValue.map((p,i)=>({Date:p.date, NominalEUR:p.value, RealEUR:metrics.realValue[i].value})); exportData("portfolio_value.csv",rows); };
  const exportDrawdowns=()=>{ if(!metrics) return; const rows=metrics.drawdowns.map(p=>({Date:p.date, Drawdown:p.value})); exportData("drawdowns.csv",rows); };
  const exportRolling=()=>{ if(!metrics) return; const rows=metrics.rolling.map(p=>({StartDate:p.date, CAGR:p.value})); exportData(`rolling_${rollingYears}y_cagr.csv`,rows); };
  const exportAnnualReturns=()=>{ if(!metrics) return; const rows=(metrics.annualNominal||[]).map((r,i)=>({Year:r.year, Nominal:r.nominal, Real:(metrics.annualReal[i]?.nominal??0)})); exportData("annual_returns.csv",rows); };

  const handleFile = async (e)=>{
    const f=e.target.files?.[0]; if(!f) return;
    const buf = await f.arrayBuffer();
    let normalized=[];
    if(f.name.endsWith(".xlsx")||f.name.endsWith(".xls")){
      const wb=XLSX.read(buf,{type:"array"}); const ws=wb.Sheets[wb.SheetNames[0]];
      const rowsA=XLSX.utils.sheet_to_json(ws,{header:1, raw:true}); if(!rowsA.length) return;
      const headers=rowsA[0].map(h=>(h==null?"":String(h))).map(h=>h.trim());
      let dateIdx=headers.findIndex(h=>h.toLowerCase()==="date"); if(dateIdx===-1) dateIdx=0;
      const body=rowsA.slice(1).filter(r=> Array.isArray(r) && r.some(x=>!(x===undefined||x===null||x==="")));
      normalized=body.map(arr=>{ const obj={};
        headers.forEach((h,i)=>{ if(!h) return;
          const v=arr[i];
          if(i===dateIdx){ if(typeof v==="number"){ const dc=XLSX.SSF.parse_date_code(v); const d=new Date(dc.y, dc.m-1, dc.d); obj["Date"]=toMonthStr(d); } else { obj["Date"]=toMonthStr(v); } }
          else { obj[h]=(v===null||v===undefined||v==="")? null: Number(v); }
        }); return obj; });
    } else if(f.name.endsWith(".csv")){
      const txt=new TextDecoder().decode(new Uint8Array(buf));
      const [header, ...lines]=txt.split(/\r?\n/).filter(Boolean);
      const cols=header.split(","); normalized=lines.map(line=>{ const parts=line.split(","); const row={};
        cols.forEach((c,i)=> row[c]=parts[i]); row.Date=toMonthStr(row.Date||row.date||row["date"]);
        for(const c of cols) if(c!=="Date" && c.toLowerCase()!=="date") row[c]= row[c]===""? null: Number(row[c]); return row; });
    } else return;
    setRows(normalized);
    const cols = Object.keys(normalized[0]||{}).filter(k=>k.toLowerCase()!=="date");
    if(cols.length){ const w={}; for(const c of cols) w[c]= DEFAULT_WEIGHTS[c] ?? (1/cols.length); setWeights(w); }
  };

  const sumPct = Math.round(Object.values(weights).reduce((a,b)=>a+(Number(b)||0),0)*100);
  const normalizeWeights = ()=>{
    const total=Object.values(weights).reduce((a,b)=>a+(Number(b)||0),0); if(total===0) return;
    const nw={}; for(const k of Object.keys(weights)) nw[k]=(weights[k]||0)/total; setWeights(nw);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">AlphaTrace</h1>
          <div className="flex items-center gap-3">
            <button onClick={()=>setShowData(s=>!s)} className="rounded-full border px-3 py-1 text-sm" title="Data & Settings">⚙️</button>
          </div>
        </header>

        {/* Data & Settings */}
        {showData && (
          <div className="bg-white rounded-2xl shadow p-4 space-y-3">
            <h2 className="font-semibold">Data & Settings</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="block text-sm">Upload file</label>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="w-full" />
                <label className="block text-sm">Start Date</label>
                <input type="month" min={dataBounds.first||undefined} max={dataBounds.last||undefined} value={startDate.slice(0,7)} onChange={(e)=>handleStartChange(e.target.value)} className="w-full border rounded p-2" />
                <label className="block text-sm">End Date (optional)</label>
                <input type="month" value={endDate?endDate.slice(0,7):""} onChange={(e)=>setEndDate(e.target.value?e.target.value+"-01":"")} className="w-full border rounded p-2" />
                <label className="block text-sm">Rebalance</label>
                <select value={rebalance} onChange={(e)=>setRebalance(e.target.value)} className="w-full border rounded p-2">
                  <option>Monthly</option><option>Quarterly</option><option>Annual</option>
                </select>
                <label className="block text-sm">Risk-free (annual, decimal)</label>
                <input type="number" step="0.001" value={rf} onChange={(e)=>setRf(Number(e.target.value))} className="w-full border rounded p-2" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <p className="text-xs text-gray-600">Dataset & weights are saved locally (no banner shown).</p>
              </div>
            </div>
          </div>
        )}

        {/* Assets */}
        <div className="bg-white rounded-2xl shadow p-4 space-y-3">
          <h2 className="font-semibold">Assets</h2>
          <ul className="divide-y">
            {columns.map((c)=>(
              <li key={c} className="py-2 flex items-center justify-between">
                <span className="text-sm">{c}</span>
                <div className="flex items-center gap-2">
                  <input type="number" step="1" className="w-20 border rounded p-2 text-right"
                    value={Math.round((weights[c]??0)*100)}
                    onChange={(e)=>setWeights(w=>({...w, [c]: Math.max(0, Number(e.target.value)||0)/100 }))}
                    title="Weight in percent"
                  />
                  <span className="text-sm">%</span>
                </div>
              </li>
            ))}
          </ul>
          <div className="text-sm mt-2 font-medium">
            Total: {sumPct}% {sumPct!==100 && (<button onClick={normalizeWeights} className="ml-2 px-2 py-1 border rounded text-xs">Normalize</button>)}
          </div>
          <div className="text-xs text-gray-600">Weights are integers (e.g., 35 = 35%). Internally normalized for calculations.</div>
        </div>

        {/* Portfolio Summary */}
        {metrics && (
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-xl font-bold mb-4">Portfolio Summary</h2>
            <div className="grid md:grid-cols-5 gap-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-sm font-bold text-gray-700">Initial Investment</div>
                <div className="flex items-center gap-2 mt-2">
                  <input 
                    type="number" 
                    step={1000} 
                    value={initial} 
                    onChange={(e)=>setInitial(Number(e.target.value)||0)} 
                    className="text-lg font-bold border rounded p-2 w-full" 
                    placeholder="100000"
                  />
                  <span className="text-sm text-gray-500">€</span>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-sm font-bold text-gray-700">Final Value</div>
                <div className="text-sm flex flex-col leading-6 mt-2">
                  <span><span className="text-gray-500">Nominal:</span> <span className="font-semibold">{euroTick(metrics.nominalValue[metrics.nominalValue.length-1]?.value)}</span></span>
                  <span><span className="text-gray-500">Real:</span> <span className="font-semibold">{euroTick(metrics.realValue[metrics.realValue.length-1]?.value)}</span></span>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-sm font-bold text-gray-700">CAGR</div>
                <div className="text-sm flex flex-col leading-6 mt-2">
                  <span><span className="text-gray-500">Nominal:</span> <span className="font-semibold">{(metrics.cagr*100).toFixed(2)}%</span></span>
                  <span><span className="text-gray-500">Real:</span> <span className="font-semibold">{(metrics.realCagr*100).toFixed(2)}%</span></span>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-sm font-bold text-gray-700">Risk Ratios (rf={rf})</div>
                <div className="text-sm flex flex-col leading-6 mt-2">
                  <span><span className="text-gray-500">Sharpe:</span> <span className="font-semibold">{metrics.sharpe.toFixed(2)}</span></span>
                  <span><span className="text-gray-500">Sortino:</span> <span className="font-semibold">{metrics.sortino.toFixed(2)}</span></span>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-sm font-bold text-gray-700">Risk (Annualized)</div>
                <div className="text-sm flex flex-col leading-6 mt-2">
                  <span><span className="text-gray-500">Volatility:</span> <span className="font-semibold">{(metrics.vol*100).toFixed(2)}%</span></span>
                  <span><span className="text-gray-500">Max Drawdown:</span> <span className="font-semibold">{(metrics.maxDrawdown*100).toFixed(2)}%</span></span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Portfolio Analysis */}
        {metrics && (
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-xl font-bold mb-4">Portfolio Analysis</h2>
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
              <div className="text-sm text-blue-800">
                <p className="mb-2"><strong>Current Portfolio Performance:</strong> Your portfolio shows a {(metrics.cagr*100).toFixed(2)}% nominal CAGR with {(metrics.vol*100).toFixed(2)}% volatility and a maximum drawdown of {Math.abs(metrics.maxDrawdown*100).toFixed(2)}%.</p>
                
                <p className="mb-2"><strong>Strengths:</strong> {metrics.sharpe > 1 ? 'Excellent risk-adjusted returns with Sharpe ratio above 1.0' : metrics.sharpe > 0.5 ? 'Good risk-adjusted returns' : 'Room for improvement in risk-adjusted returns'}. The diversified approach helps reduce overall portfolio volatility.</p>
                
                <p><strong>Improvement Suggestions:</strong> Consider {metrics.maxDrawdown < -0.15 ? 'increasing defensive assets during volatile periods' : 'maintaining current risk level'}. {Object.values(weights).some(w => w > 0.4) ? 'Consider reducing concentration in any single asset above 40%' : 'Asset allocation appears well-diversified'}. Regular rebalancing ({rebalance.toLowerCase()}) helps maintain target allocations and can enhance long-term returns.</p>
              </div>
            </div>
          </div>
        )}

        {/* Portfolio Value */}
        {metrics && (
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Portfolio Value (€): Nominal vs Real — Avg Italy inflation ≈ {(metrics.avgInfl*100).toFixed(2)}% p.a.</h3>
              <button onClick={exportPortfolioValue} className="p-2 rounded hover:bg-gray-100" title="Download CSV" aria-label="Download CSV">⬇️</button>
            </div>
            <p className="text-sm text-gray-600 mb-3">This chart shows how your portfolio value grows over time. The blue line represents nominal returns (not adjusted for inflation), while the green line shows real returns (purchasing power after accounting for Italian CPI inflation).</p>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics.nominalValue.map((p,i)=>({date:p.date, nominal:p.value, real:metrics.realValue[i].value}))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(d)=>d.slice(0,7)} minTickGap={32} />
                  <YAxis tickFormatter={euroTick} />
                  <Tooltip formatter={euroTick} labelFormatter={(l)=>l.slice(0,10)} />
                  <Legend />
                  <Line type="monotone" dataKey="nominal" dot={false} strokeWidth={3} stroke="#2563eb" />
                  <Line type="monotone" dataKey="real" dot={false} strokeWidth={3} stroke="#10b981" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Drawdowns with min highlight */}
        {metrics && (
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Max Drawdowns Over Time (Nominal)</h3>
              <button onClick={exportDrawdowns} className="p-2 rounded hover:bg-gray-100" title="Download CSV" aria-label="Download CSV">⬇️</button>
            </div>
            <p className="text-sm text-gray-600 mb-3">Drawdowns represent the decline from peak portfolio value. The red dot marks the worst drawdown period. Lower drawdowns indicate better downside protection.</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.drawdowns}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(d)=>d.slice(0,7)} minTickGap={32} />
                  <YAxis tickFormatter={(v)=>(v*100).toFixed(0)+"%"} />
                  <Tooltip formatter={(v)=>(v*100).toFixed(2)+"%"} labelFormatter={(l)=>l.slice(0,10)} />
                  <ReferenceLine y={0} stroke="#999" />
                  <Area type="monotone" dataKey="value" stroke="#8884d8" fillOpacity={1} />
                  {metrics.ddMinPoint && (
                    <ReferenceDot x={metrics.ddMinPoint.date} y={metrics.ddMinPoint.value} r={6} fill="#dc2626" stroke="#991b1b" />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Rolling N-Year CAGR with min/max + average */}
        {metrics && (
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Rolling {rollingYears}-Year Buy & Hold (Annualized)</h3>
              <div className="flex gap-2 items-center">
                <input type="number" min={1} max={40} value={rollingYears} onChange={(e)=>setRollingYears(Math.max(1, Number(e.target.value)||10))} className="w-20 border rounded p-1" />
                <button onClick={exportRolling} className="p-2 rounded hover:bg-gray-100" title="Download CSV" aria-label="Download CSV">⬇️</button>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-3">Shows annualized returns for any {rollingYears}-year holding period. Red/green dots mark worst/best periods. The gray line shows the average across all periods, helping assess return consistency.</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics.rolling.map(d=>({date:d.date, value:d.value*100}))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(d)=>d.slice(0,7)} minTickGap={32} />
                  <YAxis tickFormatter={(v)=>v.toFixed(0)+"%"} />
                  <Tooltip formatter={(v)=>Number(v).toFixed(2)+"%"} labelFormatter={(l)=>l.slice(0,10)} />
                  <ReferenceLine y={metrics.avgRolling*100} stroke="#6b7280" label={{ value: `Avg ${(metrics.avgRolling*100).toFixed(2)}%`, position: 'right' }} />
                  <Line type="monotone" dataKey="value" dot={false} strokeWidth={3} />
                  {metrics.rollingMin && (<ReferenceDot x={metrics.rollingMin.date} y={metrics.rollingMin.value*100} r={5} fill="#dc2626" stroke="#991b1b" />)}
                  {metrics.rollingMax && (<ReferenceDot x={metrics.rollingMax.date} y={metrics.rollingMax.value*100} r={5} fill="#16a34a" stroke="#166534" />)}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Annual Returns with min/max highlights */}
        {metrics && (
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Annual Returns: Nominal vs Real (Italy CPI)</h3>
              <button onClick={exportAnnualReturns} className="p-2 rounded hover:bg-gray-100" title="Download CSV" aria-label="Download CSV">⬇️</button>
            </div>
            <p className="text-sm text-gray-600 mb-3">Year-by-year performance comparison. Green bars show nominal returns, blue bars show inflation-adjusted real returns. Highlighted borders mark best/worst performing years.</p>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(metrics.annualNominal||[]).map((r,i)=>({year:r.year, nominal:r.nominal*100, real:(metrics.annualReal[i]?.nominal??0)*100}))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis tickFormatter={(v)=>v.toFixed(0)+"%"} />
                  <Tooltip formatter={(v)=>Number(v).toFixed(2)+"%"} />
                  <Legend />
                  <Bar dataKey="nominal" fill="#16a34a">
                    {(metrics.annualNominal||[]).map((r,i)=>{
                      const isMin=i===metrics.annualMinNomIdx, isMax=i===metrics.annualMaxNomIdx;
                      const base=(r.nominal>=0)?"#16a34a":"#dc2626";
                      const stroke=isMin?"#991b1b": (isMax?"#166534": undefined);
                      const sw=(isMin||isMax)?2:0;
                      return <Cell key={`n-${i}`} fill={base} stroke={stroke} strokeWidth={sw} />;
                    })}
                  </Bar>
                  <Bar dataKey="real" fill="#0ea5e9">
                    {(metrics.annualReal||[]).map((r,i)=>{
                      const val=(r?.nominal??0);
                      const isMin=i===metrics.annualMinRealIdx, isMax=i===metrics.annualMaxRealIdx;
                      const base=(val>=0)?"#16a34a":"#dc2626";
                      const stroke=isMin?"#991b1b": (isMax?"#166534": undefined);
                      const sw=(isMin||isMax)?2:0;
                      return <Cell key={`r-${i}`} fill={base} stroke={stroke} strokeWidth={sw} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
