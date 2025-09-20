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

const ASSET_CATEGORY_OVERRIDES = {
  "MSCI World Minimum Volatility (USD)": "stocks",
  "MSCI World Momentum": "stocks",
  "MSCI USA Small Cap Value Weighted": "stocks",
  "MSCI World Sector Neutral Quality": "stocks",
  "FTSE World Government Bond - Developed Markets (Hedged EUR)": "bonds",
  "Solactive STR 8.5 Daily": "cash",
  "Gold spot price": "gold",
};

function getAssetCategory(name){
  const n = (name||"").toLowerCase();
  if(ASSET_CATEGORY_OVERRIDES[name]) return ASSET_CATEGORY_OVERRIDES[name];
  if(n.includes("gold")) return "gold";
  if(n.includes("bond") || n.includes("gov") || n.includes("treasury") || n.includes("agg") || n.includes("fixed income")) return "bonds";
  if(n.includes("cash") || n.includes("money market") || n.match(/\bstr\b|overnight|tbill|t-bill|mmf/)) return "cash";
  return "stocks";
}

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

function cagrRecurring(portValues, totalInvested){ 
  if(!portValues.length || !totalInvested.length) return 0; 
  const finalValue = portValues[portValues.length-1];
  const totalInv = totalInvested[totalInvested.length-1];
  const months = portValues.length - 1;
  const years = months / 12;
  if(years <= 0 || totalInv <= 0) return 0;
  
  // Use IRR approximation: solve for rate where NPV = 0
  // Simplified approach: (Final Value / Total Invested)^(1/years) - 1
  return Math.pow(finalValue / totalInv, 1/years) - 1;
}
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

function computeRecurringPortfolio(dates, series, weights, rebalance="Annual", monthlyInvestment=1000){
  const cols = Object.keys(series);
  const wVec = cols.map(c=> weights[c]??0);
  const wSum = wVec.reduce((a,b)=>a+b,0)||1;
  const targetW = wVec.map(w=> w/wSum);

  const assetRets = cols.map(c=> pctChangeSeries(series[c]));
  const N = assetRets[0]?.length || 0;
  const step = rebalance==="Monthly"?1: rebalance==="Quarterly"?3:12;
  
  // Track absolute values
  let holdings = new Array(cols.length).fill(0);
  let totalValue = monthlyInvestment; // Start with first month investment
  const portValues = [monthlyInvestment];
  const portRets = [];
  const totalInvested = [monthlyInvestment];
  
  // Initialize first month holdings
  for(let i=0;i<cols.length;i++){
    holdings[i] = monthlyInvestment * targetW[i];
  }
  
  for(let t=0;t<N;t++){
    // Apply returns to existing holdings first
    let valueAfterReturns = 0;
    for(let i=0;i<cols.length;i++){
      holdings[i] *= (1 + (assetRets[i][t]||0));
      valueAfterReturns += holdings[i];
    }
    
    // Add monthly investment after returns
    const investmentAmount = monthlyInvestment;
    for(let i=0;i<cols.length;i++){
      holdings[i] += investmentAmount * targetW[i];
    }
    const newTotalValue = valueAfterReturns + investmentAmount;
    
    // Calculate period return based on money-weighted approach
    const periodReturn = totalValue > 0 ? (valueAfterReturns - totalValue) / totalValue : 0;
    portRets.push(periodReturn);
    
    totalValue = newTotalValue;
    portValues.push(totalValue);
    totalInvested.push(totalInvested[totalInvested.length-1] + investmentAmount);
    
    // Rebalance if needed
    if((t+1)%step===0 && totalValue > 0){
      for(let i=0;i<cols.length;i++){
        holdings[i] = totalValue * targetW[i];
      }
    }
  }
  
  // Create normalized index for metrics calculations (starts at 100)
  const normalizedIdx = [100];
  for(let i=0;i<portRets.length;i++){
    normalizedIdx.push(normalizedIdx[normalizedIdx.length-1] * (1 + portRets[i]));
  }
  
  const idxMap={}; 
  for(let i=0;i<dates.length;i++) {
    idxMap[dates[i]] = normalizedIdx[i];
  }
  
  return { 
    portRets, 
    idxMap, 
    dates, 
    drawdowns: drawdownsFromIndex(idxMap),
    totalInvested: totalInvested,
    portValues: portValues,
    normalizedIndex: normalizedIdx
  };
}

function computeHybridPortfolio(dates, series, weights, rebalance="Annual", initialInvestment=100000, monthlyInvestment=1000){
  const cols = Object.keys(series);
  const wVec = cols.map(c=> weights[c]??0);
  const wSum = wVec.reduce((a,b)=>a+b,0)||1;
  const targetW = wVec.map(w=> w/wSum);

  const assetRets = cols.map(c=> pctChangeSeries(series[c]));
  const N = assetRets[0]?.length || 0;
  const step = rebalance==="Monthly"?1: rebalance==="Quarterly"?3:12;
  
  // Start with initial lump sum investment
  let holdings = new Array(cols.length).fill(0);
  let totalValue = initialInvestment;
  const portValues = [initialInvestment];
  const portRets = [];
  const totalInvested = [initialInvestment];
  
  // Initialize holdings with lump sum
  for(let i=0;i<cols.length;i++){
    holdings[i] = initialInvestment * targetW[i];
  }
  
  for(let t=0;t<N;t++){
    // Apply returns to existing holdings first
    let valueAfterReturns = 0;
    for(let i=0;i<cols.length;i++){
      holdings[i] *= (1 + (assetRets[i][t]||0));
      valueAfterReturns += holdings[i];
    }
    
    // Add monthly investment after returns
    const investmentAmount = monthlyInvestment;
    for(let i=0;i<cols.length;i++){
      holdings[i] += investmentAmount * targetW[i];
    }
    const newTotalValue = valueAfterReturns + investmentAmount;
    
    // Calculate period return based on money-weighted approach
    const periodReturn = totalValue > 0 ? (valueAfterReturns - totalValue) / totalValue : 0;
    portRets.push(periodReturn);
    
    totalValue = newTotalValue;
    portValues.push(totalValue);
    totalInvested.push(totalInvested[totalInvested.length-1] + investmentAmount);
    
    // Rebalance if needed
    if((t+1)%step===0 && totalValue > 0){
      for(let i=0;i<cols.length;i++){
        holdings[i] = totalValue * targetW[i];
      }
    }
  }
  
  // Create normalized index for metrics calculations (starts at 100)
  const normalizedIdx = [100];
  for(let i=0;i<portRets.length;i++){
    normalizedIdx.push(normalizedIdx[normalizedIdx.length-1] * (1 + portRets[i]));
  }
  
  const idxMap={}; 
  for(let i=0;i<dates.length;i++) {
    idxMap[dates[i]] = normalizedIdx[i];
  }
  
  return { 
    portRets, 
    idxMap, 
    dates, 
    drawdowns: drawdownsFromIndex(idxMap),
    totalInvested: totalInvested,
    portValues: portValues,
    normalizedIndex: normalizedIdx
  };
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
const STORAGE_KEY_PORTFOLIOS="backtester_portfolios_v1";
function saveToStorage(rows,weights){ try{ if(rows) localStorage.setItem(STORAGE_KEY_ROWS, JSON.stringify(rows)); if(weights) localStorage.setItem(STORAGE_KEY_WEIGHTS, JSON.stringify(weights)); }catch{} }
function loadFromStorage(){ try{ return { rows: JSON.parse(localStorage.getItem(STORAGE_KEY_ROWS)||"null"), weights: JSON.parse(localStorage.getItem(STORAGE_KEY_WEIGHTS)||"null") }; }catch{ return {rows:null, weights:null}; } }
function savePortfoliosToStorage(portfolios){ try{ localStorage.setItem(STORAGE_KEY_PORTFOLIOS, JSON.stringify(portfolios)); }catch{} }
function loadPortfoliosFromStorage(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY_PORTFOLIOS)||"[]"); }catch{ return []; } }

// URL sharing functions
function encodePortfolioToUrl(weights, investmentMode, initial, monthlyInvestment, startDate, endDate, rebalance) {
  const portfolioData = {
    w: weights,
    mode: investmentMode,
    init: initial,
    monthly: monthlyInvestment,
    start: startDate,
    end: endDate,
    rebal: rebalance
  };
  
  try {
    const jsonString = JSON.stringify(portfolioData);
    const encoded = btoa(jsonString);
    return encoded;
  } catch (error) {
    console.error('Error encoding portfolio to URL:', error);
    return null;
  }
}

function decodePortfolioFromUrl(encodedString) {
  try {
    const jsonString = atob(encodedString);
    const portfolioData = JSON.parse(jsonString);
    return portfolioData;
  } catch (error) {
    console.error('Error decoding portfolio from URL:', error);
    return null;
  }
}

function getPortfolioShareUrl(weights, investmentMode, initial, monthlyInvestment, startDate, endDate, rebalance) {
  const encoded = encodePortfolioToUrl(weights, investmentMode, initial, monthlyInvestment, startDate, endDate, rebalance);
  if (!encoded) return null;
  
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}?portfolio=${encoded}`;
}

function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  } else {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    return new Promise((resolve, reject) => {
      if (document.execCommand('copy')) {
        resolve();
      } else {
        reject(new Error('Failed to copy text'));
      }
      document.body.removeChild(textArea);
    });
  }
}

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
  const [investmentMode,setInvestmentMode]=useState("lump_sum"); // "lump_sum", "recurring", or "hybrid"
  const [monthlyInvestment,setMonthlyInvestment]=useState(1000);
  const [savedPortfolios,setSavedPortfolios]=useState([]);
  const [showPortfolioManager,setShowPortfolioManager]=useState(false);
  const [portfolioName,setPortfolioName]=useState("");
  const [compareMode,setCompareMode]=useState(false);
  const [selectedPortfolios,setSelectedPortfolios]=useState([]);
  const [isLoadingData,setIsLoadingData]=useState(true);
  const [loadedFromUrl, setLoadedFromUrl] = useState(false);

  useEffect(()=>{ const {rows:sr, weights:sw}=loadFromStorage(); if(sr?.length) setRows(sr); if(sw) setWeights(sw); },[]);
  useEffect(()=>{ setSavedPortfolios(loadPortfoliosFromStorage()); },[]);
  
  // Load portfolio from URL parameters after data is loaded
  useEffect(() => {
    if (!isLoadingData && rows.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const portfolioParam = urlParams.get('portfolio');
      
      if (portfolioParam) {
        const portfolioData = decodePortfolioFromUrl(portfolioParam);
        if (portfolioData) {
          // Load portfolio data from URL
          if (portfolioData.w) {
            setWeights(portfolioData.w);
            setLoadedFromUrl(true);
          }
          if (portfolioData.mode) setInvestmentMode(portfolioData.mode);
          if (portfolioData.init !== undefined) setInitial(portfolioData.init);
          if (portfolioData.monthly !== undefined) setMonthlyInvestment(portfolioData.monthly);
          if (portfolioData.start) setStartDate(portfolioData.start);
          if (portfolioData.end) setEndDate(portfolioData.end);
          if (portfolioData.rebal) setRebalance(portfolioData.rebal);
          
          // Clean up URL parameters after loading
          const newUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        }
      }
    }
  }, [isLoadingData, rows.length]);
  
  // Auto-load default data file on startup
  useEffect(()=>{
    const loadDefaultData = async () => {
      // Check if data is already loaded from localStorage
      if(rows.length > 0) {
        setIsLoadingData(false);
        return;
      }
      
      try {
        const response = await fetch('./curvo_data_202508.xlsx');
        if (!response.ok) throw new Error('Failed to fetch data file');
        
        const arrayBuffer = await response.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, {type: "array"});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rowsA = XLSX.utils.sheet_to_json(ws, {header: 1, raw: true});
        
        if (!rowsA.length) {
          setIsLoadingData(false);
          return;
        }
        
        const headers = rowsA[0].map(h => (h == null ? "" : String(h))).map(h => h.trim());
        let dateIdx = headers.findIndex(h => h.toLowerCase() === "date");
        if (dateIdx === -1) dateIdx = 0;
        
        const body = rowsA.slice(1).filter(r => Array.isArray(r) && r.some(x => !(x === undefined || x === null || x === "")));
        const normalized = body.map(arr => {
          const obj = {};
          headers.forEach((h, i) => {
            if (!h) return;
            const v = arr[i];
            if (i === dateIdx) {
              if (typeof v === "number") {
                const dc = XLSX.SSF.parse_date_code(v);
                const d = new Date(dc.y, dc.m - 1, dc.d);
                obj["Date"] = toMonthStr(d);
              } else {
                obj["Date"] = toMonthStr(v);
              }
            } else {
              obj[h] = (v === null || v === undefined || v === "") ? null : Number(v);
            }
          });
          return obj;
        });
        
        setRows(normalized);
        const cols = Object.keys(normalized[0] || {}).filter(k => k.toLowerCase() !== "date");
        if (cols.length && !loadedFromUrl) { // Don't override weights if loaded from URL
          const w = {};
          for (const c of cols) w[c] = DEFAULT_WEIGHTS[c] ?? (1 / cols.length);
          setWeights(w);
        }
        console.log('✅ Default Curvo dataset loaded successfully');
      } catch (error) {
        console.log('Default data file not available, user will need to upload data');
      } finally {
        setIsLoadingData(false);
      }
    };
    
    loadDefaultData();
  }, [loadedFromUrl]);

  const rawColumns = useMemo(()=> rows[0]? Object.keys(rows[0]).filter(k=>k.toLowerCase()!=="date") : [], [rows]);
  const columns = useMemo(()=>{
    const CATEGORY_ORDER = ["stocks","bonds","cash","gold"];
    const sorted = [...rawColumns].sort((a,b)=>{
      const ca = getAssetCategory(a), cb = getAssetCategory(b);
      const ia = CATEGORY_ORDER.indexOf(ca), ib = CATEGORY_ORDER.indexOf(cb);
      if(ia!==ib) return ia-ib;
      return a.localeCompare(b);
    });
    return sorted;
  },[rawColumns]);

  useEffect(()=>{
    if(!columns.length || loadedFromUrl) return; // Don't override weights loaded from URL
    const nw={...weights}; let changed=false;
    for(const c of columns){ if(!(c in nw)){ nw[c]= (DEFAULT_WEIGHTS[c]??(1/columns.length)); changed=true; } }
    for(const k of Object.keys(nw)) if(!columns.includes(k)){ delete nw[k]; changed=true; }
    if(changed) setWeights(nw);
  },[columns, loadedFromUrl]);

  useEffect(()=>{ if(rows?.length) saveToStorage(rows,null); },[rows]);
  useEffect(()=>{ if(Object.keys(weights).length) saveToStorage(null,weights); },[weights]);

  const norm = useMemo(()=> !rows.length? null: normalizeAndInterpolate(rows, startDate), [rows,startDate]);

  const dataBounds = useMemo(()=>{
    if(!rows.length) return {first:null,last:null};
    const dlist = rows.map(r=>toMonthStr(r.Date||r.date||r["Date"]))
      .filter(Boolean)
      .sort();
    return {first:dlist[0], last:dlist[dlist.length-1]};
  },[rows]);
  useEffect(()=>{
    if(!endDate && dataBounds.last){
      setEndDate(dataBounds.last);
    }
  }, [dataBounds.last]);
  const handleStartChange=(val)=>{
    if(!val) return; let s=`${val}-01`;
    if(dataBounds.first && s < dataBounds.first) s=dataBounds.first;
    if(dataBounds.last && s > dataBounds.last) s=dataBounds.last;
    setStartDate(s);
    if(endDate && endDate < s) setEndDate(s);
  };
  const handleEndChange=(val)=>{
    let e = val ? `${val}-01` : "";
    if(!e){ setEndDate(""); return; }
    if(dataBounds.first && e < dataBounds.first) e=dataBounds.first;
    if(dataBounds.last && e > dataBounds.last) e=dataBounds.last;
    if(e < startDate) e=startDate;
    setEndDate(e);
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
    
    if(investmentMode === "recurring"){
      return computeRecurringPortfolio(adates, aseries, weights, rebalance, monthlyInvestment);
    } else if(investmentMode === "hybrid"){
      return computeHybridPortfolio(adates, aseries, weights, rebalance, initial, monthlyInvestment);
    } else {
      return computePortfolio(adates, aseries, weights, rebalance);
    }
  },[norm,weights,rebalance,startDate,endDate,investmentMode,monthlyInvestment]);

  const euroTick = (n)=> new Intl.NumberFormat("it-IT",{ style:"currency", currency:"EUR", maximumFractionDigits:0, minimumFractionDigits:0}).format(Number(n||0));

  const metrics = useMemo(()=>{
    if(!portfolio) return null;
    const entries = Object.entries(portfolio.idxMap).sort((a,b)=> (a[0]<b[0]?-1:1));
    const dates = entries.map(e=>e[0]);
    const vals = entries.map(e=>e[1]);
    const monthly = []; for(let i=1;i<vals.length;i++) monthly.push(vals[i]/vals[i-1]-1);

    const cpi = buildItalyMonthlyCPI(dates);
    
    let nominalIndex, realIdx, nominalValue, realValue, totalInvested;
    
    if(investmentMode === "recurring" || investmentMode === "hybrid"){
      // For recurring/hybrid investments, use normalized index for metrics but actual values for display
      nominalIndex = dates.map((d,i)=>({date:d, value: vals[i]})); // This uses normalized values for CAGR/metrics
      realIdx = dates.map((d,i)=> ({date:d, value: vals[i] / ( (cpi[d]/cpi[dates[0]]) )}));
      nominalValue = dates.map((d,i)=>({date:d, value: portfolio.portValues[i]})); // Actual portfolio values
      realValue = dates.map((d,i)=> ({date:d, value: portfolio.portValues[i] / ( (cpi[d]/cpi[dates[0]]) )}));
      totalInvested = portfolio.totalInvested || [];
    } else {
      // For lump sum, scale by initial investment
      nominalIndex = dates.map((d,i)=>({date:d, value: vals[i]}));
      realIdx = dates.map((d,i)=> ({date:d, value: vals[i] / ( (cpi[d]/cpi[dates[0]]) )}));
      nominalValue = nominalIndex.map(p=>({date:p.date, value:(p.value/nominalIndex[0].value)*initial}));
      realValue = realIdx.map(p=>({date:p.date, value:(p.value/realIdx[0].value)*initial}));
      totalInvested = new Array(dates.length).fill(initial);
    }

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

    // Calculate appropriate CAGR based on investment mode
    const nominalCAGR = (investmentMode === "recurring" || investmentMode === "hybrid")
      ? cagrRecurring(portfolio.portValues, portfolio.totalInvested)
      : cagr(nominalIndex);
    
    const realCAGR = (investmentMode === "recurring" || investmentMode === "hybrid")
      ? cagrRecurring(realValue.map(r => r.value), portfolio.totalInvested)
      : cagr(realIdx);

    return {
      cagr: nominalCAGR,
      realCagr: realCAGR,
      vol: annualVol(monthly),
      sharpe: sharpe(monthly, rf),
      sortino: sortino(monthly, rf),
      maxDrawdown: Math.min(...drawdowns.map(d=>d.value)),
      nominalIndex, realIndex: realIdx, drawdowns,
      annualNominal, annualReal, rolling, avgRolling,
      ddMinPoint, rollingMin, rollingMax,
      annualMinNomIdx, annualMaxNomIdx, annualMinRealIdx, annualMaxRealIdx,
      nominalValue, realValue, totalInvested,
      avgInfl: (()=>{
        if(dates.length<2) return 0;
        const arr = Object.values(cpi); const end = arr[arr.length-1]; const yrs=(dates.length-1)/12;
        return yrs>0? Math.pow(end/100, 1/yrs) - 1 : 0;
      })(),
    };
  },[portfolio, rf, initial, rollingYears, investmentMode]);

  const exportData=(filename,rows)=>{
    if(!rows||!rows.length) return;
    const headers=Object.keys(rows[0]); const lines=[headers.join(",")];
    for(const r of rows) lines.push(headers.map(h=>r[h]).join(","));
    const csv=lines.join("\n"); const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url);
  };
  const exportPortfolioValue=()=>{ 
    if(!metrics) return; 
    const rows=metrics.nominalValue.map((p,i)=>({
      Date:p.date, 
      NominalEUR:p.value, 
      RealEUR:metrics.realValue[i].value,
      ...((investmentMode === "recurring" || investmentMode === "hybrid") ? {TotalInvestedEUR: metrics.totalInvested[i]} : {})
    })); 
    exportData("portfolio_value.csv",rows); 
  };
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

  const saveCurrentPortfolio = ()=>{
    if(!portfolioName.trim() || !Object.keys(weights).length) return;
    const newPortfolio = {
      id: Date.now().toString(),
      name: portfolioName.trim(),
      weights: {...weights},
      investmentMode,
      initial,
      monthlyInvestment,
      createdAt: new Date().toISOString()
    };
    const updated = [...savedPortfolios, newPortfolio];
    setSavedPortfolios(updated);
    savePortfoliosToStorage(updated);
    setPortfolioName("");
    setShowPortfolioManager(false);
  };

  const loadPortfolio = (portfolio)=>{
    setWeights(portfolio.weights);
    setInvestmentMode(portfolio.investmentMode);
    setInitial(portfolio.initial);
    setMonthlyInvestment(portfolio.monthlyInvestment);
  };

  const deletePortfolio = (portfolioId)=>{
    const updated = savedPortfolios.filter(p => p.id !== portfolioId);
    setSavedPortfolios(updated);
    savePortfoliosToStorage(updated);
    setSelectedPortfolios(prev => prev.filter(id => id !== portfolioId));
  };

  const handleSharePortfolio = async () => {
    const url = getPortfolioShareUrl(weights, investmentMode, initial, monthlyInvestment, startDate, endDate, rebalance);
    if (url) {
      try {
        await copyToClipboard(url);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 1500);
      } catch (error) {
        console.error('Failed to copy URL:', error);
      }
    }
  };

  const handleRenamePortfolio = (portfolio) => {
    setEditingPortfolioId(portfolio.id);
    setEditingName(portfolio.name);
  };

  const handleSaveRename = () => {
    if (!editingName.trim()) return;
    
    const updated = savedPortfolios.map(p => 
      p.id === editingPortfolioId ? { ...p, name: editingName.trim() } : p
    );
    setSavedPortfolios(updated);
    savePortfoliosToStorage(updated);
    setEditingPortfolioId(null);
    setEditingName("");
  };

  const handleCancelRename = () => {
    setEditingPortfolioId(null);
    setEditingName("");
  };

  const handleShareSavedPortfolio = async (portfolio) => {
    const url = getPortfolioShareUrl(portfolio.weights, portfolio.investmentMode, portfolio.initial, portfolio.monthlyInvestment, startDate, endDate, rebalance);
    if (url) {
      try {
        await copyToClipboard(url);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 1500);
      } catch (error) {
        console.error('Failed to copy URL:', error);
      }
    }
  };

  // Check if current portfolio is already saved
  const isCurrentPortfolioSaved = useMemo(() => {
    return savedPortfolios.some(savedPortfolio => {
      // Compare weights
      const weightsMatch = Object.keys(weights).length === Object.keys(savedPortfolio.weights).length &&
        Object.keys(weights).every(key => Math.abs((weights[key] || 0) - (savedPortfolio.weights[key] || 0)) < 0.001);
      
      // Compare other settings
      const settingsMatch = savedPortfolio.investmentMode === investmentMode &&
        savedPortfolio.initial === initial &&
        savedPortfolio.monthlyInvestment === monthlyInvestment;
      
      return weightsMatch && settingsMatch;
    });
  }, [savedPortfolios, weights, investmentMode, initial, monthlyInvestment]);

  const togglePortfolioSelection = (portfolioId)=>{
    setSelectedPortfolios(prev => 
      prev.includes(portfolioId) 
        ? prev.filter(id => id !== portfolioId)
        : [...prev, portfolioId]
    );
  };

  const comparePortfolios = useMemo(()=>{
    if(!compareMode || selectedPortfolios.length === 0 || !norm) return null;
    
    const {dates, series} = norm;
    const lastDate = endDate || dates[dates.length-1];
    const i0 = dates.findIndex(d=>d>=startDate);
    const i1 = dates.findIndex(d=>d>=lastDate);
    const endIdx = i1===-1? dates.length-1 : i1;
    const adates = dates.slice(i0, endIdx+1);
    const aseries={}; for(const c of Object.keys(series)) aseries[c]=series[c].slice(i0, endIdx+1);
    
    const comparisons = [];
    for(const portfolioId of selectedPortfolios){
      const portfolio = savedPortfolios.find(p => p.id === portfolioId);
      if(!portfolio) continue;
      
      let portfolioResult;
      if(portfolio.investmentMode === "recurring"){
        portfolioResult = computeRecurringPortfolio(adates, aseries, portfolio.weights, rebalance, portfolio.monthlyInvestment);
      } else if(portfolio.investmentMode === "hybrid"){
        portfolioResult = computeHybridPortfolio(adates, aseries, portfolio.weights, rebalance, portfolio.initial, portfolio.monthlyInvestment);
      } else {
        portfolioResult = computePortfolio(adates, aseries, portfolio.weights, rebalance);
      }
      
      if(!portfolioResult) continue;
      
      const entries = Object.entries(portfolioResult.idxMap).sort((a,b)=> (a[0]<b[0]?-1:1));
      const pDates = entries.map(e=>e[0]);
      const vals = entries.map(e=>e[1]);
      const monthly = []; for(let i=1;i<vals.length;i++) monthly.push(vals[i]/vals[i-1]-1);
      
      const nominalIndex = pDates.map((d,i)=>({date:d, value: vals[i]}));
      
      // Calculate CPI-adjusted data
      const cpi = buildItalyMonthlyCPI(pDates);
      const realIdx = pDates.map((d,i)=> ({date:d, value: vals[i] / ( (cpi[d]/cpi[pDates[0]]) )}));
      
      let nominalCAGR, realCAGR;
      if(portfolio.investmentMode === "recurring" || portfolio.investmentMode === "hybrid"){
        nominalCAGR = cagrRecurring(portfolioResult.portValues, portfolioResult.totalInvested);
        const realValues = portfolioResult.portValues.map((val, i) => val / (cpi[pDates[i]]/cpi[pDates[0]]));
        realCAGR = cagrRecurring(realValues, portfolioResult.totalInvested);
      } else {
        nominalCAGR = cagr(nominalIndex);
        realCAGR = cagr(realIdx);
      }
      
      // Calculate rolling returns
      const rolling = rollingNCAGR(portfolioResult.idxMap, 10);
      
      // Calculate annual returns
      const annualNominal = computeAnnualReturns(portfolioResult.idxMap);
      const realIdxMap = {}; 
      for(const r of realIdx) realIdxMap[r.date] = r.value;
      const annualReal = computeAnnualReturns(realIdxMap);
      
      comparisons.push({
        id: portfolio.id,
        name: portfolio.name,
        cagr: nominalCAGR,
        realCagr: realCAGR,
        vol: annualVol(monthly),
        sharpe: sharpe(monthly, rf),
        sortino: sortino(monthly, rf),
        maxDrawdown: Math.min(...portfolioResult.drawdowns.map(d=>d.value)),
        finalValue: vals[vals.length-1],
        portfolioResult,
        nominalIndex,
        realIndex: realIdx,
        drawdowns: portfolioResult.drawdowns,
        rolling,
        annualNominal,
        annualReal,
        totalInvested: portfolioResult.totalInvested,
        portValues: portfolioResult.portValues
      });
    }
    
    return comparisons;
  }, [compareMode, selectedPortfolios, norm, startDate, endDate, rebalance, rf, savedPortfolios]);

  const assetsWithWeight = useMemo(()=> columns.filter(a => (weights[a]??0) > 0), [columns, weights]);

  const [assetRollingYears, setAssetRollingYears] = useState(10);
  const [perfTab, setPerfTab] = useState("portfolio"); // 'portfolio' | 'assets'
  const [showToast, setShowToast] = useState(false);
  const [editingPortfolioId, setEditingPortfolioId] = useState(null);
  const [editingName, setEditingName] = useState("");

  const perAssetsCombined = useMemo(()=>{
    if(!norm || assetsWithWeight.length===0) return null;
    const {dates, series} = norm;
    const lastDate = endDate || dates[dates.length-1];
    const i0 = dates.findIndex(d=>d>=startDate);
    const i1 = dates.findIndex(d=>d>=lastDate);
    const endIdx = i1===-1? dates.length-1 : i1;
    const adates = dates.slice(i0, endIdx+1);

    const rollingByAsset = {};
    const ddByAsset = {};
    const annualByAsset = {};

    for(const asset of assetsWithWeight){
      const arr = series[asset];
      if(!arr) continue;
      const slice = arr.slice(i0, endIdx+1);
      const idxMap = {}; for(let i=0;i<adates.length;i++) idxMap[adates[i]] = slice[i];
      rollingByAsset[asset] = rollingNCAGR(idxMap, assetRollingYears).map(p=>({date:p.date, value:p.value*100}));
      ddByAsset[asset] = drawdownsFromIndex(idxMap).map(p=>({date:p.date, value:p.value*100}));
      annualByAsset[asset] = computeAnnualReturns(idxMap).map(r=>({year:r.year, value:r.nominal*100}));
    }

    const unionDates = (obj, key) => Array.from(new Set(Object.values(obj).flatMap(arr=>arr.map(p=>p[key])))).sort();
    const rollingDates = unionDates(rollingByAsset, "date");
    const ddDates = unionDates(ddByAsset, "date");
    const years = unionDates(annualByAsset, "year");

    const toWide = (obj, axisKey) => (keys) => keys.map(k=>{
      const row = {[axisKey]: k};
      for(const asset of Object.keys(obj)){
        const p = obj[asset].find(x=>x[axisKey]===k);
        if(p) row[asset] = p.value;
      }
      return row;
    });

    const rollingData = toWide(rollingByAsset, "date")(rollingDates);
    const ddData = toWide(ddByAsset, "date")(ddDates);
    const annualData = toWide(annualByAsset, "year")(years);

    return { assets: Object.keys(rollingByAsset), rollingData, ddData, annualData };
  }, [norm, assetsWithWeight, startDate, endDate, assetRollingYears]);

  const assetSummaries = useMemo(()=>{
    if(!norm || assetsWithWeight.length===0) return [];
    const {dates, series} = norm;
    const lastDate = endDate || dates[dates.length-1];
    const i0 = dates.findIndex(d=>d>=startDate);
    const i1 = dates.findIndex(d=>d>=lastDate);
    const endIdx = i1===-1? dates.length-1 : i1;
    const adates = dates.slice(i0, endIdx+1);

    const summaries = [];
    for(const asset of assetsWithWeight){
      const arr = series[asset];
      if(!arr) continue;
      const slice = arr.slice(i0, endIdx+1);
      const idxMap = {}; for(let i=0;i<adates.length;i++) idxMap[adates[i]] = slice[i];
      const entries = adates.map((d, i)=>({date:d, value:slice[i]}));
      const monthly = []; for(let i=1;i<slice.length;i++) monthly.push((slice[i]-slice[i-1])/slice[i-1]);
      const dd = drawdownsFromIndex(idxMap);
      const maxDD = dd.length ? Math.min(...dd.map(d=>d.value)) : 0;
      const assetCagr = cagr(entries);
      const assetVol = annualVol(monthly);
      const assetSharpe = sharpe(monthly, rf);
      const firstVal = entries[0]?.value || 100;
      const lastVal = entries[entries.length-1]?.value || firstVal;
      const finalValue = firstVal>0 ? (lastVal/firstVal)*initial : 0;
      summaries.push({
        asset,
        cagr: assetCagr,
        vol: assetVol,
        sharpe: assetSharpe,
        maxDrawdown: maxDD,
        finalValue,
      });
    }
    return summaries;
  }, [norm, assetsWithWeight, startDate, endDate, rf, initial]);

  // Show loading screen while data is being loaded
  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Loading AlphaTrace</h2>
          <p className="text-gray-600">Loading default Curvo dataset...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">AlphaTrace</h1>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleSharePortfolio}
              disabled={!Object.keys(weights).length}
              className="rounded-full border px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed" 
              title="Share Portfolio"
            >
              🔗
            </button>
            <button 
              onClick={()=>setShowPortfolioManager(s=>!s)} 
              className="rounded-full border px-3 py-1 text-sm hover:bg-gray-100" 
              title="Portfolio Manager"
            >
              💼
            </button>
            <button 
              onClick={()=>setCompareMode(s=>!s)} 
              className={`rounded-full border px-3 py-1 text-sm hover:bg-gray-100 ${compareMode ? 'bg-blue-100 border-blue-300' : ''}`}
              title="Compare Portfolios"
            >
              📊
            </button>
            <button onClick={()=>setShowData(s=>!s)} className="rounded-full border px-3 py-1 text-sm hover:bg-gray-100" title="Data & Settings">⚙️</button>
          </div>
        </header>

        {/* Data & Settings */}
        {showData && (
          <div className="bg-white rounded-2xl shadow p-4 space-y-3">
            <h2 className="font-semibold">Data & Settings</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="block text-sm">Upload file</label>
                <div className="text-xs text-gray-600 mb-2">
                  📊 Default Curvo dataset loaded automatically. Upload your own data to override.
                </div>
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

        
        {/* Portfolio Manager */}
        {showPortfolioManager && (
          <div className="bg-white rounded-2xl shadow p-4 space-y-4">
            <h2 className="font-semibold">Portfolio Manager</h2>
            
            {/* Save Current Portfolio - Only show if not already saved */}
            {!isCurrentPortfolioSaved && (
              <div className="border rounded-lg p-4 bg-green-50">
                <h3 className="font-medium mb-3">Save Current Portfolio</h3>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-sm text-gray-600 mb-1">Portfolio Name</label>
                    <input 
                      type="text" 
                      value={portfolioName}
                      onChange={(e)=>setPortfolioName(e.target.value)}
                      placeholder="e.g., Conservative Growth"
                      className="w-full border rounded p-2"
                    />
                  </div>
                  <button 
                    onClick={saveCurrentPortfolio}
                    disabled={!portfolioName.trim() || !Object.keys(weights).length}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Save Portfolio
                  </button>
                  <button 
                    onClick={handleSharePortfolio}
                    disabled={!Object.keys(weights).length}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    title="Share portfolio via URL"
                  >
                    🔗 Share
                  </button>
                </div>
              </div>
            )}

            {/* Current Portfolio Already Saved */}
            {isCurrentPortfolioSaved && (
              <div className="border rounded-lg p-4 bg-blue-50">
                <h3 className="font-medium mb-2 text-blue-800">Current Portfolio</h3>
                <p className="text-sm text-blue-700 mb-3">
                  This portfolio configuration is already saved. You can share it or modify it to save a new version.
                </p>
                <button 
                  onClick={handleSharePortfolio}
                  disabled={!Object.keys(weights).length}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  title="Share portfolio via URL"
                >
                  🔗 Share Current Portfolio
                </button>
              </div>
            )}

            {/* Saved Portfolios */}
            {savedPortfolios.length > 0 && (
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-3">Saved Portfolios ({savedPortfolios.length})</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {savedPortfolios.map((portfolio) => (
                    <div key={portfolio.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div className="flex-1">
                        {editingPortfolioId === portfolio.id ? (
                          <div className="flex items-center gap-2">
                            <input 
                              type="text" 
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="border rounded px-2 py-1 text-sm flex-1"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRename();
                                if (e.key === 'Escape') handleCancelRename();
                              }}
                              autoFocus
                            />
                            <button 
                              onClick={handleSaveRename}
                              className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                            >
                              ✓
                            </button>
                            <button 
                              onClick={handleCancelRename}
                              className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center gap-3">
                              <span className="font-medium">{portfolio.name}</span>
                              <span className="text-xs text-gray-500">
                                {portfolio.investmentMode === "lump_sum" ? "Lump Sum" : 
                                 portfolio.investmentMode === "recurring" ? "Recurring" : "Hybrid"}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Assets: {Object.keys(portfolio.weights).length} • 
                              Created: {new Date(portfolio.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {compareMode && (
                          <input 
                            type="checkbox" 
                            checked={selectedPortfolios.includes(portfolio.id)}
                            onChange={()=>togglePortfolioSelection(portfolio.id)}
                            className="text-blue-600"
                          />
                        )}
                        <button 
                          onClick={()=>handleShareSavedPortfolio(portfolio)}
                          className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                          title="Copy shareable link"
                        >
                          🔗
                        </button>
                        <button 
                          onClick={()=>handleRenamePortfolio(portfolio)}
                          className="px-3 py-1 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700"
                          title="Rename portfolio"
                        >
                          ✏️
                        </button>
                        <button 
                          onClick={()=>loadPortfolio(portfolio)}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                        >
                          Load
                        </button>
                        <button 
                          onClick={()=>deletePortfolio(portfolio.id)}
                          className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {compareMode && (
                  <div className="mt-4 p-3 bg-blue-50 rounded">
                    <div className="text-sm text-blue-800">
                      <strong>Compare Mode:</strong> Select portfolios to compare their performance. 
                      Selected: {selectedPortfolios.length}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Assets */}
        <div className="bg-white rounded-2xl shadow p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Assets</h2>
            <button
              onClick={()=>{
                const zeros={};
                for(const c of columns) zeros[c]=0;
                setWeights(zeros);
              }}
              className="text-xs px-2 py-1 border rounded hover:bg-gray-100"
              title="Set all weights to 0%"
            >Zero all</button>
          </div>
          <div className="text-xs text-gray-500">Data updated to 2025-08</div>
          <ul className="divide-y">
            {columns.map((c)=>(
              <li key={c} className="py-2 flex items-center justify-between">
                <span className="text-sm flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border capitalize text-center w-24 shrink-0 ${
                    getAssetCategory(c)==="stocks"?"bg-blue-50 border-blue-200 text-blue-700":
                    getAssetCategory(c)==="bonds"?"bg-emerald-50 border-emerald-200 text-emerald-700":
                    getAssetCategory(c)==="cash"?"bg-gray-50 border-gray-200 text-gray-700":
                    "bg-yellow-50 border-yellow-200 text-yellow-700"
                  }`}>
                    {getAssetCategory(c)}
                  </span>
                  {c}
                </span>
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
          <div className="text-xs text-gray-600">Need fund data? Download from <a href="https://curvo.eu/backtest/en/funds" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">Curvo's fund database</a>.</div>
        </div>

        {/* Performance Tabs */}
        <div className="bg-white rounded-2xl shadow p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 mr-4">
              <button onClick={()=>setPerfTab("portfolio")} className={`px-3 py-1 rounded-full border text-sm ${perfTab==='portfolio' ? 'bg-blue-100 border-blue-300' : ''}`}>Portfolio Performance</button>
              <button onClick={()=>setPerfTab("assets")} className={`px-3 py-1 rounded-full border text-sm ${perfTab==='assets' ? 'bg-blue-100 border-blue-300' : ''}`}>Asset Performance</button>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Start:</label>
              <input type="month" min={dataBounds.first||undefined} max={dataBounds.last||undefined} value={startDate.slice(0,7)} onChange={(e)=>handleStartChange(e.target.value)} className="border rounded p-1" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">End:</label>
              <input type="month" min={dataBounds.first||undefined} max={dataBounds.last||undefined} value={endDate?endDate.slice(0,7):""} onChange={(e)=>handleEndChange(e.target.value)} className="border rounded p-1" />
            </div>
          </div>
        </div>

        {/* Portfolio Summary */}
        {metrics && perfTab==='portfolio' && !compareMode && (
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-xl font-bold mb-4">Portfolio Summary</h2>
            
            {/* Investment Mode Toggle */}
            <div className="mb-6 p-4 bg-blue-50 rounded-xl">
              <div className="text-sm font-bold text-gray-700 mb-3">Investment Strategy</div>
              <div className="flex flex-wrap gap-4 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="investmentMode" 
                    value="lump_sum" 
                    checked={investmentMode === "lump_sum"}
                    onChange={(e)=>setInvestmentMode(e.target.value)}
                    className="text-blue-600"
                  />
                  <span className="text-sm font-medium">Lump Sum Only</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="investmentMode" 
                    value="recurring" 
                    checked={investmentMode === "recurring"}
                    onChange={(e)=>setInvestmentMode(e.target.value)}
                    className="text-blue-600"
                  />
                  <span className="text-sm font-medium">Monthly Recurring Only</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="investmentMode" 
                    value="hybrid" 
                    checked={investmentMode === "hybrid"}
                    onChange={(e)=>setInvestmentMode(e.target.value)}
                    className="text-blue-600"
                  />
                  <span className="text-sm font-medium">Lump Sum + Monthly</span>
                </label>
              </div>
              
              {investmentMode === "lump_sum" ? (
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Initial amount:</label>
                  <input 
                    type="number" 
                    step={1000} 
                    value={initial} 
                    onChange={(e)=>setInitial(Number(e.target.value)||0)} 
                    className="border rounded p-2 w-32 font-medium" 
                    placeholder="100000"
                  />
                  <span className="text-sm text-gray-500">€</span>
                </div>
              ) : investmentMode === "recurring" ? (
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Monthly investment:</label>
                  <input 
                    type="number" 
                    step={100} 
                    value={monthlyInvestment} 
                    onChange={(e)=>setMonthlyInvestment(Number(e.target.value)||0)} 
                    className="border rounded p-2 w-32 font-medium" 
                    placeholder="1000"
                  />
                  <span className="text-sm text-gray-500">€/month</span>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Initial lump sum:</label>
                    <input 
                      type="number" 
                      step={1000} 
                      value={initial} 
                      onChange={(e)=>setInitial(Number(e.target.value)||0)} 
                      className="border rounded p-2 w-32 font-medium" 
                      placeholder="100000"
                    />
                    <span className="text-sm text-gray-500">€</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Monthly investment:</label>
                    <input 
                      type="number" 
                      step={100} 
                      value={monthlyInvestment} 
                      onChange={(e)=>setMonthlyInvestment(Number(e.target.value)||0)} 
                      className="border rounded p-2 w-32 font-medium" 
                      placeholder="1000"
                    />
                    <span className="text-sm text-gray-500">€/month</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="grid md:grid-cols-5 gap-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-sm font-bold text-gray-700">
                  {(investmentMode === "recurring" || investmentMode === "hybrid") ? "Total Invested" : "Initial Investment"}
                </div>
                <div className="text-lg font-bold mt-2">
                  {(investmentMode === "recurring" || investmentMode === "hybrid")
                    ? euroTick(metrics.totalInvested[metrics.totalInvested.length-1] || 0)
                    : euroTick(initial)
                  }
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

        {/* Portfolio Comparison Summary */}
        {compareMode && comparePortfolios && perfTab==='portfolio' && (
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-xl font-bold mb-4">Portfolio Comparison ({comparePortfolios.length} portfolios)</h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {comparePortfolios.map((portfolio, index) => (
                <div key={portfolio.id} className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm font-bold text-gray-700 mb-2 truncate" title={portfolio.name}>
                    {portfolio.name}
                  </div>
                  <div className="text-xs text-gray-500 mb-3">
                    {savedPortfolios.find(p => p.id === portfolio.id)?.investmentMode === "lump_sum" ? "Lump Sum" : 
                     savedPortfolios.find(p => p.id === portfolio.id)?.investmentMode === "recurring" ? "Recurring" : "Hybrid"}
                  </div>
                  <div className="text-sm flex flex-col leading-6 space-y-1">
                    <div><span className="text-gray-500">CAGR:</span> <span className="font-semibold">{(portfolio.cagr*100).toFixed(2)}%</span></div>
                    <div><span className="text-gray-500">Real CAGR:</span> <span className="font-semibold">{(portfolio.realCagr*100).toFixed(2)}%</span></div>
                    <div><span className="text-gray-500">Volatility:</span> <span className="font-semibold">{(portfolio.vol*100).toFixed(2)}%</span></div>
                    <div><span className="text-gray-500">Sharpe:</span> <span className="font-semibold">{portfolio.sharpe.toFixed(2)}</span></div>
                    <div><span className="text-gray-500">Sortino:</span> <span className="font-semibold">{portfolio.sortino.toFixed(2)}</span></div>
                    <div><span className="text-gray-500">Max DD:</span> <span className="font-semibold">{(portfolio.maxDrawdown*100).toFixed(2)}%</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Portfolio Analysis */}
        {metrics && perfTab==='portfolio' && (
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-xl font-bold mb-4">Portfolio Analysis</h2>
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
              <div className="text-sm text-blue-800">
                <p className="mb-2"><strong>Investment Strategy:</strong> You're using a {
                  investmentMode === "recurring" 
                    ? `monthly recurring investment of ${euroTick(monthlyInvestment)}` 
                    : investmentMode === "hybrid"
                    ? `hybrid approach with ${euroTick(initial)} initial lump sum plus ${euroTick(monthlyInvestment)} monthly contributions`
                    : `lump sum investment of ${euroTick(initial)}`
                }. {
                  investmentMode === "recurring" 
                    ? 'This dollar-cost averaging approach helps reduce timing risk and can smooth out market volatility over time.' 
                    : investmentMode === "hybrid"
                    ? 'This hybrid approach combines immediate market exposure with dollar-cost averaging benefits, balancing timing risk with consistent investing.'
                    : 'This lump sum approach captures full market exposure immediately but may be subject to timing risk.'
                }</p>
                
                <p className="mb-2"><strong>Current Portfolio Performance:</strong> Your portfolio shows a {(metrics.cagr*100).toFixed(2)}% nominal CAGR with {(metrics.vol*100).toFixed(2)}% volatility and a maximum drawdown of {Math.abs(metrics.maxDrawdown*100).toFixed(2)}%.</p>
                
                <p className="mb-2"><strong>Strengths:</strong> {metrics.sharpe > 1 ? 'Excellent risk-adjusted returns with Sharpe ratio above 1.0' : metrics.sharpe > 0.5 ? 'Good risk-adjusted returns' : 'Room for improvement in risk-adjusted returns'}. The diversified approach helps reduce overall portfolio volatility.</p>
                
                <p><strong>Improvement Suggestions:</strong> {
                  investmentMode === "recurring" 
                    ? 'Consider increasing monthly contributions during market downturns to take advantage of lower prices.' 
                    : investmentMode === "hybrid"
                    ? 'Your hybrid approach is well-balanced. Consider adjusting the monthly contribution amount based on market conditions or income changes.'
                    : 'Consider adding recurring investments to reduce timing risk and benefit from dollar-cost averaging.'
                } {Object.values(weights).some(w => w > 0.4) ? 'Consider reducing concentration in any single asset above 40%' : 'Asset allocation appears well-diversified'}. Regular rebalancing ({rebalance.toLowerCase()}) helps maintain target allocations and can enhance long-term returns.</p>
              </div>
            </div>
          </div>
        )}

        {/* Portfolio Value */}
        {metrics && perfTab==='portfolio' && !compareMode && (
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Portfolio Value (€): Nominal vs Real — Avg Italy inflation ≈ {(metrics.avgInfl*100).toFixed(2)}% p.a.</h3>
              <button onClick={exportPortfolioValue} className="p-2 rounded hover:bg-gray-100" title="Download CSV" aria-label="Download CSV">⬇️</button>
            </div>
            <p className="text-sm text-gray-600 mb-3">This chart shows how your portfolio value grows over time. The blue line represents nominal returns (not adjusted for inflation), while the green line shows real returns (purchasing power after accounting for Italian CPI inflation).{(investmentMode === "recurring" || investmentMode === "hybrid") ? " The gray line shows your cumulative invested amount." : ""}</p>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics.nominalValue.map((p,i)=>({
                  date:p.date, 
                  nominal:p.value, 
                  real:metrics.realValue[i].value,
                  ...((investmentMode === "recurring" || investmentMode === "hybrid") ? {invested: metrics.totalInvested[i]} : {})
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(d)=>d.slice(0,7)} minTickGap={32} />
                  <YAxis tickFormatter={euroTick} />
                  <Tooltip formatter={euroTick} labelFormatter={(l)=>l.slice(0,10)} />
                  <Legend />
                  <Line type="monotone" dataKey="nominal" dot={false} strokeWidth={3} stroke="#2563eb" name="Nominal Value" />
                  <Line type="monotone" dataKey="real" dot={false} strokeWidth={3} stroke="#10b981" name="Real Value" />
                  {(investmentMode === "recurring" || investmentMode === "hybrid") && (
                    <Line type="monotone" dataKey="invested" dot={false} strokeWidth={2} stroke="#6b7280" strokeDasharray="5 5" name="Total Invested" />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Portfolio Comparison Value Chart */}
        {compareMode && comparePortfolios && perfTab==='portfolio' && (
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Portfolio Value Comparison (Normalized to 100)</h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">This chart compares the performance of selected portfolios over time. All portfolios are normalized to start at 100 for easy comparison.</p>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={comparePortfolios[0]?.nominalIndex.map((point, index) => {
                  const dataPoint = { date: point.date };
                  comparePortfolios.forEach((portfolio, portfolioIndex) => {
                    dataPoint[portfolio.name] = portfolio.nominalIndex[index]?.value || 0;
                  });
                  return dataPoint;
                }) || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(d)=>d.slice(0,7)} minTickGap={32} />
                  <YAxis tickFormatter={(v)=>v.toFixed(0)} />
                  <Tooltip formatter={(v)=>v.toFixed(2)} labelFormatter={(l)=>l.slice(0,10)} />
                  <Legend />
                  {comparePortfolios.map((portfolio, index) => {
                    const colors = ['#2563eb', '#dc2626', '#059669', '#7c3aed', '#ea580c', '#0891b2', '#be123c', '#65a30d'];
                    return (
                      <Line 
                        key={portfolio.id}
                        type="monotone" 
                        dataKey={portfolio.name} 
                        dot={false} 
                        strokeWidth={3} 
                        stroke={colors[index % colors.length]} 
                        name={portfolio.name}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Drawdowns with min highlight */}
        {metrics && perfTab==='portfolio' && !compareMode && (
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

        {/* Portfolio Comparison Drawdowns Chart */}
        {compareMode && comparePortfolios && perfTab==='portfolio' && (
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Drawdowns Comparison</h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">Compare drawdowns across selected portfolios. Lower values indicate better downside protection.</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={comparePortfolios[0]?.drawdowns.map((point, index) => {
                  const dataPoint = { date: point.date };
                  comparePortfolios.forEach((portfolio) => {
                    dataPoint[portfolio.name] = (portfolio.drawdowns[index]?.value || 0) * 100;
                  });
                  return dataPoint;
                }) || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(d)=>d.slice(0,7)} minTickGap={32} />
                  <YAxis tickFormatter={(v)=>v.toFixed(0)+"%"} />
                  <Tooltip formatter={(v)=>v.toFixed(2)+"%"} labelFormatter={(l)=>l.slice(0,10)} />
                  <ReferenceLine y={0} stroke="#999" />
                  <Legend />
                  {comparePortfolios.map((portfolio, index) => {
                    const colors = ['#2563eb', '#dc2626', '#059669', '#7c3aed', '#ea580c', '#0891b2', '#be123c', '#65a30d'];
                    return (
                      <Line 
                        key={portfolio.id}
                        type="monotone" 
                        dataKey={portfolio.name} 
                        dot={false} 
                        strokeWidth={3} 
                        stroke={colors[index % colors.length]} 
                        name={portfolio.name}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Rolling N-Year CAGR with min/max + average */}
        {metrics && perfTab==='portfolio' && !compareMode && (
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
                  <ReferenceLine y={0} stroke="#dc2626" />
                  <ReferenceLine y={metrics.avgRolling*100} stroke="#6b7280" label={{ value: `Avg ${(metrics.avgRolling*100).toFixed(2)}%`, position: 'right' }} />
                  <Line type="monotone" dataKey="value" dot={false} strokeWidth={3} />
                  {metrics.rollingMin && (<ReferenceDot x={metrics.rollingMin.date} y={metrics.rollingMin.value*100} r={5} fill="#dc2626" stroke="#991b1b" />)}
                  {metrics.rollingMax && (<ReferenceDot x={metrics.rollingMax.date} y={metrics.rollingMax.value*100} r={5} fill="#16a34a" stroke="#166534" />)}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Portfolio Comparison Rolling Returns Chart */}
        {compareMode && comparePortfolios && perfTab==='portfolio' && (
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Rolling 10-Year Returns Comparison</h3>
              <div className="flex gap-2 items-center">
                <input type="number" min={1} max={40} value={rollingYears} onChange={(e)=>setRollingYears(Math.max(1, Number(e.target.value)||10))} className="w-20 border rounded p-1" />
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-3">Compare rolling returns across selected portfolios for different holding periods.</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={comparePortfolios[0]?.rolling.map((point, index) => {
                  const dataPoint = { date: point.date };
                  comparePortfolios.forEach((portfolio) => {
                    dataPoint[portfolio.name] = (portfolio.rolling[index]?.value || 0) * 100;
                  });
                  return dataPoint;
                }) || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(d)=>d.slice(0,7)} minTickGap={32} />
                  <YAxis tickFormatter={(v)=>v.toFixed(0)+"%"} />
                  <Tooltip formatter={(v)=>v.toFixed(2)+"%"} labelFormatter={(l)=>l.slice(0,10)} />
                  <ReferenceLine y={0} stroke="#dc2626" />
                  <Legend />
                  {comparePortfolios.map((portfolio, index) => {
                    const colors = ['#2563eb', '#dc2626', '#059669', '#7c3aed', '#ea580c', '#0891b2', '#be123c', '#65a30d'];
                    return (
                      <Line 
                        key={portfolio.id}
                        type="monotone" 
                        dataKey={portfolio.name} 
                        dot={false} 
                        strokeWidth={3} 
                        stroke={colors[index % colors.length]} 
                        name={portfolio.name}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Annual Returns with min/max highlights */}
        {metrics && perfTab==='portfolio' && !compareMode && (
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

        {/* Portfolio Comparison Annual Returns Chart */}
        {compareMode && comparePortfolios && perfTab==='portfolio' && (
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Annual Returns Comparison</h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">Compare year-by-year returns across selected portfolios.</p>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparePortfolios[0]?.annualNominal.map((point, index) => {
                  const dataPoint = { year: point.year };
                  comparePortfolios.forEach((portfolio) => {
                    dataPoint[portfolio.name] = (portfolio.annualNominal[index]?.nominal || 0) * 100;
                  });
                  return dataPoint;
                }) || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis tickFormatter={(v)=>v.toFixed(0)+"%"} />
                  <Tooltip formatter={(v)=>Number(v).toFixed(2)+"%"} />
                  <Legend />
                  {comparePortfolios.map((portfolio, index) => {
                    const colors = ['#2563eb', '#dc2626', '#059669', '#7c3aed', '#ea580c', '#0891b2', '#be123c', '#65a30d'];
                    return (
                      <Bar 
                        key={portfolio.id}
                        dataKey={portfolio.name} 
                        fill={colors[index % colors.length]}
                        name={portfolio.name}
                      />
                    );
                  })}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Performance by Asset */}
        {perfTab==='assets' && assetsWithWeight.length > 0 && perAssetsCombined && (
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-xl font-bold mb-4">Performance by Asset</h2>

            {/* Controls */}
            <div className="mb-4 flex items-center gap-3">
              <label className="text-sm text-gray-600">Initial amount for per-asset final value:</label>
              <input 
                type="number" 
                step={1000} 
                value={initial} 
                onChange={(e)=>setInitial(Number(e.target.value)||0)} 
                className="border rounded p-2 w-32 font-medium" 
                placeholder="100000"
              />
              <span className="text-sm text-gray-500">€</span>
            </div>

            {/* Asset Summary */}
            <div className="grid md:grid-cols-4 gap-4 mb-6">
              {assetSummaries.map((s)=> (
                <div key={s.asset} className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm font-bold text-gray-700 truncate" title={s.asset}>{s.asset}</div>
                  <div className="text-xs text-gray-500 capitalize mt-1">{getAssetCategory(s.asset)}</div>
                  <div className="text-sm flex flex-col leading-6 mt-2">
                    <span><span className="text-gray-500">CAGR:</span> <span className="font-semibold">{(s.cagr*100).toFixed(2)}%</span></span>
                    <span><span className="text-gray-500">Volatility:</span> <span className="font-semibold">{(s.vol*100).toFixed(2)}%</span></span>
                    <span><span className="text-gray-500">Sharpe:</span> <span className="font-semibold">{s.sharpe.toFixed(2)}</span></span>
                    <span><span className="text-gray-500">Max DD:</span> <span className="font-semibold">{(s.maxDrawdown*100).toFixed(2)}%</span></span>
                    <span><span className="text-gray-500">Final Value:</span> <span className="font-semibold">{euroTick(s.finalValue)}</span></span>
                  </div>
                </div>
              ))}
            </div>

            {/* Rolling 10-Year Annualized */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Rolling {assetRollingYears}-Year Annualized</h3>
                <div className="flex items-center gap-2 text-sm">
                  <label className="text-gray-600">Years:</label>
                  <input type="number" min={1} max={40} value={assetRollingYears} onChange={(e)=>setAssetRollingYears(Math.max(1, Number(e.target.value)||10))} className="w-20 border rounded p-1" />
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={perAssetsCombined.rollingData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(d)=>d.slice(0,7)} minTickGap={32} />
                    <YAxis tickFormatter={(v)=>v.toFixed(0)+"%"} />
                    <Tooltip formatter={(v)=>Number(v).toFixed(2)+"%"} labelFormatter={(l)=>l.slice(0,10)} />
                    <ReferenceLine y={0} stroke="#dc2626" />
                    <Legend />
                    {perAssetsCombined.assets.map((asset, idx)=> (
                      <Line key={asset} type="monotone" dataKey={asset} dot={false} strokeWidth={2} stroke={`hsl(${(idx*137.5)%360},70%,50%)`} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Max Drawdowns */}
            <div className="mb-8">
              <h3 className="font-semibold mb-2">Max Drawdowns</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={perAssetsCombined.ddData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(d)=>d.slice(0,7)} minTickGap={32} />
                    <YAxis tickFormatter={(v)=>v.toFixed(0)+"%"} />
                    <Tooltip formatter={(v)=>Number(v).toFixed(2)+"%"} labelFormatter={(l)=>l.slice(0,10)} />
                    <ReferenceLine y={0} stroke="#999" />
                    <Legend />
                    {perAssetsCombined.assets.map((asset, idx)=> (
                      <Line key={asset} type="monotone" dataKey={asset} dot={false} strokeWidth={3} stroke={`hsl(${(idx*137.5)%360},70%,40%)`} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Annual Returns */}
            <div>
              <h3 className="font-semibold mb-2">Annual Returns</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perAssetsCombined.annualData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis tickFormatter={(v)=>v.toFixed(0)+"%"} />
                    <Tooltip formatter={(v)=>Number(v).toFixed(2)+"%"} />
                    <Legend />
                    {perAssetsCombined.assets.map((asset, idx)=> (
                      <Bar key={asset} dataKey={asset} fill={`hsl(${(idx*137.5)%360},70%,50%)`} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        )}

        {/* Toast Notification */}
        {showToast && (
          <div className="fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2">
            <span>✓</span>
            <span>URL Copied!</span>
          </div>
        )}

      </div>
    </div>
  );
}
