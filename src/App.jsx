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
const formatMonthsAsYearsAndMonths = (months) => {
  if (months === 0) return "0 months";
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years === 0) {
    return `${months} month${months !== 1 ? 's' : ''}`;
  } else if (remainingMonths === 0) {
    return `${years} year${years !== 1 ? 's' : ''}`;
  } else {
    return `${years} year${years !== 1 ? 's' : ''}, ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`;
  }
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
function timeToRecoverFromIndex(idxMap){
  const entries = Object.entries(idxMap).sort((a,b)=> (a[0]<b[0]?-1:1));
  const dates = entries.map(e=>e[0]);
  const vals = entries.map(e=>e[1]);
  
  const recoveries = [];
  let peakValue = -Infinity;
  let peakDate = null;
  let inDrawdown = false;
  let drawdownStartDate = null;
  let drawdownStartValue = null;
  let minValueDuringDrawdown = null;
  
  for(let i=0; i<dates.length; i++){
    const currentValue = vals[i];
    const currentDate = dates[i];
    
    if(currentValue > peakValue){
      // New peak reached - recovery complete
      if(inDrawdown && drawdownStartDate){
        // Calculate recovery time from when drawdown started (when we dropped below previous peak)
        const recoveryMonths = monthsBetween(drawdownStartDate, currentDate);
        // Calculate drawdown depth from the minimum value reached during the drawdown
        const drawdownDepth = minValueDuringDrawdown !== null 
          ? Math.abs((drawdownStartValue - minValueDuringDrawdown) / drawdownStartValue)
          : 0;
        recoveries.push({
          date: drawdownStartDate,
          recoveryDate: currentDate,
          months: recoveryMonths,
          drawdownDepth: drawdownDepth
        });
      }
      peakValue = currentValue;
      peakDate = currentDate;
      inDrawdown = false;
      drawdownStartDate = null;
      drawdownStartValue = null;
      minValueDuringDrawdown = null;
    } else if(currentValue < peakValue){
      // In drawdown
      if(!inDrawdown){
        // Just entered drawdown - record when we dropped below the peak
        inDrawdown = true;
        drawdownStartDate = peakDate || currentDate;
        drawdownStartValue = peakValue;
        minValueDuringDrawdown = currentValue;
      } else {
        // Track the minimum value during the drawdown
        if(currentValue < minValueDuringDrawdown){
          minValueDuringDrawdown = currentValue;
        }
      }
    }
  }
  
  // Handle ongoing drawdowns at the end
  if(inDrawdown && drawdownStartDate){
    const lastDate = dates[dates.length-1];
    const lastValue = vals[vals.length-1];
    const recoveryMonths = monthsBetween(drawdownStartDate, lastDate);
    // Use the minimum value reached during the drawdown, or the last value if it's lower
    const finalMinValue = minValueDuringDrawdown !== null && lastValue < minValueDuringDrawdown 
      ? lastValue 
      : (minValueDuringDrawdown !== null ? minValueDuringDrawdown : lastValue);
    const drawdownDepth = Math.abs((drawdownStartValue - finalMinValue) / drawdownStartValue);
    recoveries.push({
      date: drawdownStartDate,
      recoveryDate: lastDate,
      months: recoveryMonths,
      drawdownDepth: drawdownDepth,
      ongoing: true
    });
  }
  
  return recoveries;
}
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
const STORAGE_KEY_FONT_SIZE="backtester_font_size_v1";
function saveToStorage(rows,weights){ try{ if(rows) localStorage.setItem(STORAGE_KEY_ROWS, JSON.stringify(rows)); if(weights) localStorage.setItem(STORAGE_KEY_WEIGHTS, JSON.stringify(weights)); }catch{} }
function loadFromStorage(){ try{ return { rows: JSON.parse(localStorage.getItem(STORAGE_KEY_ROWS)||"null"), weights: JSON.parse(localStorage.getItem(STORAGE_KEY_WEIGHTS)||"null") }; }catch{ return {rows:null, weights:null}; } }
function savePortfoliosToStorage(portfolios){ try{ localStorage.setItem(STORAGE_KEY_PORTFOLIOS, JSON.stringify(portfolios)); }catch{} }
function loadPortfoliosFromStorage(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY_PORTFOLIOS)||"[]"); }catch{ return []; } }
function saveFontSizeToStorage(fontSize){ try{ localStorage.setItem(STORAGE_KEY_FONT_SIZE, fontSize); }catch{} }
function loadFontSizeFromStorage(){ try{ return localStorage.getItem(STORAGE_KEY_FONT_SIZE) || "small"; }catch{ return "small"; } }

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
  const [includeCurrentPortfolio,setIncludeCurrentPortfolio]=useState(true);
  const [comparisonSortBy,setComparisonSortBy]=useState("cagr"); // "cagr", "vol", "sharpe", "maxDrawdown", "maxTimeToRecover", "name"
  const [comparisonSortOrder,setComparisonSortOrder]=useState("desc"); // "asc", "desc"
  const [comparisonView,setComparisonView]=useState("table"); // "cards", "table"
  const [isLoadingData,setIsLoadingData]=useState(true);
  const [loadedFromUrl, setLoadedFromUrl] = useState(false);
  const [fontSize,setFontSize]=useState(() => loadFontSizeFromStorage()); // "small", "medium", "large"

  useEffect(()=>{ const {rows:sr, weights:sw}=loadFromStorage(); if(sr?.length) setRows(sr); if(sw) setWeights(sw); },[]);
  useEffect(()=>{ setSavedPortfolios(loadPortfoliosFromStorage()); },[]);
  
  // Helper function to get text size class based on fontSize setting
  const getTextSize = (baseSize = "xs") => {
    const sizeMaps = {
      small: { xs: "text-xs", sm: "text-sm", base: "text-base", lg: "text-lg", xl: "text-xl", "2xl": "text-2xl" },
      medium: { xs: "text-sm", sm: "text-base", base: "text-lg", lg: "text-xl", xl: "text-2xl", "2xl": "text-3xl" },
      large: { xs: "text-base", sm: "text-lg", base: "text-xl", lg: "text-2xl", xl: "text-3xl", "2xl": "text-4xl" }
    };
    return sizeMaps[fontSize]?.[baseSize] || `text-${baseSize}`;
  };
  
  useEffect(()=>{ saveFontSizeToStorage(fontSize); },[fontSize]);
  
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
  },[norm,weights,rebalance,startDate,endDate,investmentMode,initial,monthlyInvestment]);

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
    const timeToRecover = timeToRecoverFromIndex(portfolio.idxMap);
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
      nominalIndex, realIndex: realIdx, drawdowns, timeToRecover,
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
  },[portfolio, rf, initial, monthlyInvestment, rollingYears, investmentMode]);

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
    if(!compareMode || !norm) return null;
    
    // Include current portfolio if enabled and it has weights, plus selected saved portfolios
    const hasCurrentPortfolio = includeCurrentPortfolio && Object.keys(weights).length > 0;
    if(!hasCurrentPortfolio && selectedPortfolios.length === 0) return null;
    
    const {dates, series} = norm;
    const lastDate = endDate || dates[dates.length-1];
    const i0 = dates.findIndex(d=>d>=startDate);
    const i1 = dates.findIndex(d=>d>=lastDate);
    const endIdx = i1===-1? dates.length-1 : i1;
    const adates = dates.slice(i0, endIdx+1);
    const aseries={}; for(const c of Object.keys(series)) aseries[c]=series[c].slice(i0, endIdx+1);
    
    const comparisons = [];
    
    // Add current portfolio first if it has weights
    if(hasCurrentPortfolio){
      let portfolioResult;
      if(investmentMode === "recurring"){
        portfolioResult = computeRecurringPortfolio(adates, aseries, weights, rebalance, monthlyInvestment);
      } else if(investmentMode === "hybrid"){
        portfolioResult = computeHybridPortfolio(adates, aseries, weights, rebalance, initial, monthlyInvestment);
      } else {
        portfolioResult = computePortfolio(adates, aseries, weights, rebalance);
      }
      
      if(portfolioResult){
        const entries = Object.entries(portfolioResult.idxMap).sort((a,b)=> (a[0]<b[0]?-1:1));
        const pDates = entries.map(e=>e[0]);
        const vals = entries.map(e=>e[1]);
        const monthly = []; for(let i=1;i<vals.length;i++) monthly.push(vals[i]/vals[i-1]-1);
        
        const nominalIndex = pDates.map((d,i)=>({date:d, value: vals[i]}));
        
        // Calculate CPI-adjusted data
        const cpi = buildItalyMonthlyCPI(pDates);
        const realIdx = pDates.map((d,i)=> ({date:d, value: vals[i] / ( (cpi[d]/cpi[pDates[0]]) )}));
        
        let nominalCAGR, realCAGR;
        if(investmentMode === "recurring" || investmentMode === "hybrid"){
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
        
        // Calculate time to recover
        const timeToRecover = timeToRecoverFromIndex(portfolioResult.idxMap);
        const maxTimeToRecover = timeToRecover.length > 0 
          ? Math.max(...timeToRecover.map(r => r.months))
          : 0;
        
        comparisons.push({
          id: "current",
          name: "Current Portfolio",
          cagr: nominalCAGR,
          realCagr: realCAGR,
          vol: annualVol(monthly),
          sharpe: sharpe(monthly, rf),
          sortino: sortino(monthly, rf),
          maxDrawdown: Math.min(...portfolioResult.drawdowns.map(d=>d.value)),
          maxTimeToRecover,
          finalValue: vals[vals.length-1],
          portfolioResult,
          nominalIndex,
          realIndex: realIdx,
          drawdowns: portfolioResult.drawdowns,
          timeToRecover,
          rolling,
          annualNominal,
          annualReal,
          totalInvested: portfolioResult.totalInvested,
          portValues: portfolioResult.portValues
        });
      }
    }
    
    // Add selected saved portfolios
    // In compare mode, use current investment strategy for all portfolios
    for(const portfolioId of selectedPortfolios){
      const portfolio = savedPortfolios.find(p => p.id === portfolioId);
      if(!portfolio) continue;
      
      let portfolioResult;
      // Use current investment strategy settings instead of saved portfolio's settings
      if(investmentMode === "recurring"){
        portfolioResult = computeRecurringPortfolio(adates, aseries, portfolio.weights, rebalance, monthlyInvestment);
      } else if(investmentMode === "hybrid"){
        portfolioResult = computeHybridPortfolio(adates, aseries, portfolio.weights, rebalance, initial, monthlyInvestment);
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
      // Use current investment strategy for CAGR calculations too
      if(investmentMode === "recurring" || investmentMode === "hybrid"){
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
      
      // Calculate time to recover
      const timeToRecover = timeToRecoverFromIndex(portfolioResult.idxMap);
      const maxTimeToRecover = timeToRecover.length > 0 
        ? Math.max(...timeToRecover.map(r => r.months))
        : 0;
      
      comparisons.push({
        id: portfolio.id,
        name: portfolio.name,
        cagr: nominalCAGR,
        realCagr: realCAGR,
        vol: annualVol(monthly),
        sharpe: sharpe(monthly, rf),
        sortino: sortino(monthly, rf),
        maxDrawdown: Math.min(...portfolioResult.drawdowns.map(d=>d.value)),
        maxTimeToRecover,
        finalValue: vals[vals.length-1],
        portfolioResult,
        nominalIndex,
        realIndex: realIdx,
        drawdowns: portfolioResult.drawdowns,
        timeToRecover,
        rolling,
        annualNominal,
        annualReal,
        totalInvested: portfolioResult.totalInvested,
        portValues: portfolioResult.portValues
      });
    }
    
    // Sort comparisons
    const sorted = [...comparisons].sort((a, b) => {
      let aVal, bVal;
      if(comparisonSortBy === "name") {
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
      } else {
        aVal = a[comparisonSortBy];
        bVal = b[comparisonSortBy];
      }
      
      if(comparisonSortOrder === "asc") {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });
    
    return sorted;
  }, [compareMode, selectedPortfolios, includeCurrentPortfolio, norm, startDate, endDate, rebalance, rf, savedPortfolios, weights, investmentMode, initial, monthlyInvestment, comparisonSortBy, comparisonSortOrder]);

  // Helper functions for comparison
  const getBestPortfolio = (metric) => {
    if(!comparePortfolios || comparePortfolios.length === 0) return null;
    if(metric === "maxDrawdown") {
      return comparePortfolios.reduce((best, p) => p[metric] > best[metric] ? p : best);
    }
    return comparePortfolios.reduce((best, p) => p[metric] > best[metric] ? p : best);
  };
  
  const getWorstPortfolio = (metric) => {
    if(!comparePortfolios || comparePortfolios.length === 0) return null;
    if(metric === "maxDrawdown") {
      return comparePortfolios.reduce((worst, p) => p[metric] < worst[metric] ? p : worst);
    }
    return comparePortfolios.reduce((worst, p) => p[metric] < worst[metric] ? p : worst);
  };
  
  const exportComparison = () => {
    if(!comparePortfolios || comparePortfolios.length === 0) return;
    
    const headers = ["Portfolio", "Strategy", "CAGR %", "Real CAGR %", "Volatility %", "Sharpe", "Sortino", "Max DD %", "Final Value"];
    const rows = comparePortfolios.map(p => [
      p.name,
      investmentMode === "lump_sum" ? "Lump Sum" : investmentMode === "recurring" ? "Recurring" : "Hybrid",
      (p.cagr * 100).toFixed(2),
      (p.realCagr * 100).toFixed(2),
      (p.vol * 100).toFixed(2),
      p.sharpe.toFixed(2),
      p.sortino.toFixed(2),
      (p.maxDrawdown * 100).toFixed(2),
      euroTick(p.finalValue)
    ]);
    
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `portfolio-comparison-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const assetsWithWeight = useMemo(()=> columns.filter(a => (weights[a]??0) > 0), [columns, weights]);

  const [assetRollingYears, setAssetRollingYears] = useState(10);
  const [perfTab, setPerfTab] = useState("portfolio"); // 'portfolio' | 'assets'
  const [assetInvestmentMode, setAssetInvestmentMode] = useState("lump_sum"); // 'lump_sum' | 'recurring' | 'hybrid'
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
      
      let idxMap = {};
      
      // For recurring/hybrid modes, compute portfolio values over time
      if (assetInvestmentMode === "recurring" || assetInvestmentMode === "hybrid") {
        // Calculate portfolio values accounting for monthly contributions
        const portValues = assetInvestmentMode === "recurring" 
          ? [monthlyInvestment] 
          : [initial];
        
        for (let i = 1; i < slice.length; i++) {
          const prevValue = slice[i - 1];
          const currValue = slice[i];
          const lastPortValue = portValues[portValues.length - 1];
          
          if (prevValue > 0) {
            // Apply asset return to existing portfolio value, then add monthly contribution
            const newPortValue = lastPortValue * (currValue / prevValue) + monthlyInvestment;
            portValues.push(newPortValue);
          } else {
            portValues.push(lastPortValue + monthlyInvestment);
          }
        }
        
        // Normalize to create an index starting at 100
        const firstPortValue = portValues[0];
        if (firstPortValue > 0) {
          for (let i = 0; i < adates.length; i++) {
            idxMap[adates[i]] = (portValues[i] / firstPortValue) * 100;
          }
        } else {
          // Fallback to asset prices if portfolio value is 0
          for (let i = 0; i < adates.length; i++) idxMap[adates[i]] = slice[i];
        }
      } else {
        // For lump sum, use asset prices directly
        for (let i = 0; i < adates.length; i++) idxMap[adates[i]] = slice[i];
      }
      
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
  }, [norm, assetsWithWeight, startDate, endDate, assetRollingYears, assetInvestmentMode, initial, monthlyInvestment]);

  // Helper function to compute asset value with investment strategy
  const computeAssetValue = (dates, values, investmentMode, initialAmount, monthlyAmount) => {
    if (investmentMode === "lump_sum") {
      const firstVal = values[0] || 100;
      const lastVal = values[values.length - 1] || firstVal;
      return {
        finalValue: firstVal > 0 ? (lastVal / firstVal) * initialAmount : 0,
        portValues: null,
        totalInvested: null
      };
    } else if (investmentMode === "recurring") {
      const portValues = [monthlyAmount]; // Start with first month
      const totalInvested = [monthlyAmount];
      let totalValue = monthlyAmount;
      
      for (let i = 1; i < values.length; i++) {
        const prevValue = values[i - 1];
        const currValue = values[i];
        if (prevValue > 0) {
          totalValue = totalValue * (currValue / prevValue) + monthlyAmount;
        } else {
          totalValue += monthlyAmount;
        }
        portValues.push(totalValue);
        totalInvested.push(totalInvested[totalInvested.length - 1] + monthlyAmount);
      }
      return {
        finalValue: totalValue,
        portValues,
        totalInvested
      };
    } else { // hybrid
      const portValues = [initialAmount]; // Start with lump sum
      const totalInvested = [initialAmount];
      let totalValue = initialAmount;
      
      for (let i = 1; i < values.length; i++) {
        const prevValue = values[i - 1];
        const currValue = values[i];
        if (prevValue > 0) {
          totalValue = totalValue * (currValue / prevValue) + monthlyAmount;
        } else {
          totalValue += monthlyAmount;
        }
        portValues.push(totalValue);
        totalInvested.push(totalInvested[totalInvested.length - 1] + monthlyAmount);
      }
      return {
        finalValue: totalValue,
        portValues,
        totalInvested
      };
    }
  };

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
      
      // For recurring/hybrid, compute normalized index for drawdown calculations
      let normalizedIdxMap = idxMap;
      if (assetInvestmentMode === "recurring" || assetInvestmentMode === "hybrid") {
        const normalizedValues = [100];
        for (let i = 1; i < slice.length; i++) {
          const prevVal = slice[i - 1];
          const currVal = slice[i];
          if (prevVal > 0) {
            normalizedValues.push(normalizedValues[normalizedValues.length - 1] * (currVal / prevVal));
          } else {
            normalizedValues.push(normalizedValues[normalizedValues.length - 1]);
          }
        }
        normalizedIdxMap = {};
        for (let i = 0; i < adates.length; i++) {
          normalizedIdxMap[adates[i]] = normalizedValues[i];
        }
      }
      
      const dd = drawdownsFromIndex(normalizedIdxMap);
      const maxDD = dd.length ? Math.min(...dd.map(d=>d.value)) : 0;
      const assetTimeToRecover = timeToRecoverFromIndex(normalizedIdxMap);
      const maxTimeToRecover = assetTimeToRecover.length > 0 
        ? Math.max(...assetTimeToRecover.map(r => r.months))
        : 0;
      
      // Calculate final value and portfolio values based on investment mode
      const assetValueResult = computeAssetValue(
        adates,
        slice,
        assetInvestmentMode,
        initial,
        monthlyInvestment
      );
      
      // Calculate CAGR based on investment mode
      let assetCagr;
      let assetVol;
      let assetSharpe;
      
      if (assetInvestmentMode === "recurring" || assetInvestmentMode === "hybrid") {
        // Use money-weighted CAGR for recurring/hybrid
        assetCagr = cagrRecurring(assetValueResult.portValues, assetValueResult.totalInvested);
        
        // Calculate monthly returns from portfolio values for volatility/Sharpe
        const portMonthly = [];
        for (let i = 1; i < assetValueResult.portValues.length; i++) {
          const prevVal = assetValueResult.portValues[i - 1];
          const currVal = assetValueResult.portValues[i];
          if (prevVal > 0) {
            portMonthly.push((currVal - prevVal) / prevVal);
          } else {
            portMonthly.push(0);
          }
        }
        assetVol = annualVol(portMonthly);
        assetSharpe = sharpe(portMonthly, rf);
      } else {
        // Use time-weighted CAGR for lump sum
        assetCagr = cagr(entries);
        assetVol = annualVol(monthly);
        assetSharpe = sharpe(monthly, rf);
      }
      
      summaries.push({
        asset,
        cagr: assetCagr,
        vol: assetVol,
        sharpe: assetSharpe,
        maxDrawdown: maxDD,
        maxTimeToRecover,
        finalValue: assetValueResult.finalValue,
        timeToRecover: assetTimeToRecover,
      });
    }
    return summaries;
  }, [norm, assetsWithWeight, startDate, endDate, rf, initial, monthlyInvestment, assetInvestmentMode]);

  // Show loading screen while data is being loaded
  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-bloomberg-bg text-bloomberg-text flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bloomberg-accent mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2 text-bloomberg-accent">Loading AlphaTrace</h2>
          <p className="text-bloomberg-text-dim">Loading default Curvo dataset...</p>
        </div>
      </div>
    );
  }

  // Font size scaling factors (as CSS custom properties)
  const fontSizeScale = {
    small: 0.875, // 14px base
    medium: 1,    // 16px base  
    large: 1.125  // 18px base
  };

  return (
    <>
      <style>{`
        :root {
          --font-size-multiplier: ${fontSizeScale[fontSize]};
        }
        .font-size-adjust {
          font-size: calc(1rem * var(--font-size-multiplier));
        }
        .font-size-adjust .text-xs { font-size: calc(0.75rem * var(--font-size-multiplier)); }
        .font-size-adjust .text-sm { font-size: calc(0.875rem * var(--font-size-multiplier)); }
        .font-size-adjust .text-base { font-size: calc(1rem * var(--font-size-multiplier)); }
        .font-size-adjust .text-lg { font-size: calc(1.125rem * var(--font-size-multiplier)); }
        .font-size-adjust .text-xl { font-size: calc(1.25rem * var(--font-size-multiplier)); }
        .font-size-adjust .text-2xl { font-size: calc(1.5rem * var(--font-size-multiplier)); }
        .font-size-adjust .text-3xl { font-size: calc(1.875rem * var(--font-size-multiplier)); }
        .font-size-adjust .text-4xl { font-size: calc(2.25rem * var(--font-size-multiplier)); }
      `}</style>
      <div className="min-h-screen bg-bloomberg-bg text-bloomberg-text font-size-adjust">
      <div className="max-w-[1920px] mx-auto px-4 md:px-8 lg:px-12 py-4 space-y-3">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-bloomberg-border pb-3 mb-4">
          <h1 className="text-2xl font-bold text-bloomberg-accent tracking-tight">ALPHATRACE</h1>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleSharePortfolio}
              disabled={!Object.keys(weights).length}
              className="px-3 py-1.5 text-xs border border-bloomberg-border bg-bloomberg-panel hover:bg-bloomberg-border disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded" 
              title="Share Portfolio"
            >
              SHARE
            </button>
            <button 
              onClick={()=>setShowPortfolioManager(s=>!s)} 
              className="px-3 py-1.5 text-xs border border-bloomberg-border bg-bloomberg-panel hover:bg-bloomberg-border transition-colors rounded" 
              title="Portfolio Manager"
            >
              PORTFOLIO
            </button>
            <button onClick={()=>setShowData(s=>!s)} className="px-3 py-1.5 text-xs border border-bloomberg-border bg-bloomberg-panel hover:bg-bloomberg-border transition-colors rounded" title="Data & Settings">SETTINGS</button>
          </div>
        </header>

        {/* Data & Settings */}
        {showData && (
          <div className="bg-bloomberg-panel border border-bloomberg-border p-4 space-y-3 animate-slide-down rounded">
            <h2 className="font-semibold text-bloomberg-accent text-sm uppercase tracking-wide">Data & Settings</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="block text-xs text-bloomberg-text-dim uppercase tracking-wide">Upload file</label>
                <div className="text-xs text-bloomberg-text-dim mb-2">
                  Default Curvo dataset loaded automatically. Upload your own data to override.
                </div>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="w-full text-xs bg-bloomberg-bg border border-bloomberg-border p-2 text-bloomberg-text rounded file:mr-4 file:py-1 file:px-3 file:bg-bloomberg-panel file:border file:border-bloomberg-border file:text-bloomberg-text file:text-xs file:cursor-pointer file:rounded" />
                <label className="block text-xs text-bloomberg-text-dim uppercase tracking-wide">Start Date</label>
                <input type="month" min={dataBounds.first||undefined} max={dataBounds.last||undefined} value={startDate.slice(0,7)} onChange={(e)=>handleStartChange(e.target.value)} className="w-full border border-bloomberg-border bg-bloomberg-bg text-bloomberg-text p-2 text-xs rounded" />
                <label className="block text-xs text-bloomberg-text-dim uppercase tracking-wide">End Date (optional)</label>
                <input type="month" value={endDate?endDate.slice(0,7):""} onChange={(e)=>setEndDate(e.target.value?e.target.value+"-01":"")} className="w-full border border-bloomberg-border bg-bloomberg-bg text-bloomberg-text p-2 text-xs rounded" />
                <label className="block text-xs text-bloomberg-text-dim uppercase tracking-wide">Rebalance</label>
                <select value={rebalance} onChange={(e)=>setRebalance(e.target.value)} className="w-full border border-bloomberg-border bg-bloomberg-bg text-bloomberg-text p-2 text-xs rounded">
                  <option>Monthly</option><option>Quarterly</option><option>Annual</option>
                </select>
                <label className="block text-xs text-bloomberg-text-dim uppercase tracking-wide">Risk-free (annual, decimal)</label>
                <input type="number" step="0.001" value={rf} onChange={(e)=>setRf(Number(e.target.value))} className="w-full border border-bloomberg-border bg-bloomberg-bg text-bloomberg-text p-2 text-xs rounded" />
                <label className="block text-xs text-bloomberg-text-dim uppercase tracking-wide">Font Size</label>
                <select value={fontSize} onChange={(e)=>setFontSize(e.target.value)} className="w-full border border-bloomberg-border bg-bloomberg-bg text-bloomberg-text p-2 text-xs rounded">
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <p className="text-xs text-bloomberg-text-dim">Dataset & weights are saved locally (no banner shown).</p>
              </div>
            </div>
          </div>
        )}

        
        {/* Portfolio Manager */}
        {showPortfolioManager && (
          <div className="bg-bloomberg-panel border border-bloomberg-border p-4 space-y-4 animate-slide-down rounded">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-bloomberg-accent text-sm uppercase tracking-wide">Portfolio Manager</h2>
              <button 
                onClick={()=>setCompareMode(s=>!s)} 
                className={`px-3 py-1.5 text-xs border transition-colors rounded ${compareMode ? 'bg-bloomberg-accent text-bloomberg-bg border-bloomberg-accent' : 'border-bloomberg-border bg-bloomberg-bg hover:bg-bloomberg-border'}`}
                title="Compare Portfolios"
              >
                COMPARE
              </button>
            </div>
            
            {/* Save Current Portfolio - Only show if not already saved */}
            {!isCurrentPortfolioSaved && (
              <div className="border border-bloomberg-border p-4 bg-bloomberg-bg rounded">
                <h3 className="font-medium mb-3 text-xs uppercase tracking-wide text-bloomberg-text-dim">Save Current Portfolio</h3>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-xs text-bloomberg-text-dim mb-1 uppercase tracking-wide">Portfolio Name</label>
                    <input 
                      type="text" 
                      value={portfolioName}
                      onChange={(e)=>setPortfolioName(e.target.value)}
                      placeholder="e.g., Conservative Growth"
                      className="w-full border border-bloomberg-border bg-bloomberg-panel text-bloomberg-text p-2 text-xs rounded"
                    />
                  </div>
                  <button 
                    onClick={saveCurrentPortfolio}
                    disabled={!portfolioName.trim() || !Object.keys(weights).length}
                    className="px-4 py-2 bg-bloomberg-accent text-bloomberg-bg text-xs uppercase tracking-wide hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity rounded"
                  >
                    Save
                  </button>
                  <button 
                    onClick={handleSharePortfolio}
                    disabled={!Object.keys(weights).length}
                    className="px-4 py-2 bg-bloomberg-panel border border-bloomberg-border text-bloomberg-text text-xs uppercase tracking-wide hover:bg-bloomberg-border disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded"
                    title="Share portfolio via URL"
                  >
                    Share
                  </button>
                </div>
              </div>
            )}

            {/* Current Portfolio Already Saved */}
            {isCurrentPortfolioSaved && (
              <div className="border border-bloomberg-border p-4 bg-bloomberg-bg rounded">
                <h3 className="font-medium mb-2 text-xs uppercase tracking-wide text-bloomberg-accent">Current Portfolio</h3>
                <p className="text-xs text-bloomberg-text-dim mb-3">
                  This portfolio configuration is already saved. You can share it or modify it to save a new version.
                </p>
                <button 
                  onClick={handleSharePortfolio}
                  disabled={!Object.keys(weights).length}
                  className="px-4 py-2 bg-bloomberg-panel border border-bloomberg-border text-bloomberg-text text-xs uppercase tracking-wide hover:bg-bloomberg-border disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded"
                  title="Share portfolio via URL"
                >
                  Share Current Portfolio
                </button>
              </div>
            )}

            {/* Saved Portfolios */}
            {savedPortfolios.length > 0 && (
              <div className="border border-bloomberg-border p-4 rounded">
                <h3 className="font-medium mb-3 text-xs uppercase tracking-wide text-bloomberg-text-dim">Saved Portfolios ({savedPortfolios.length})</h3>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {savedPortfolios.map((portfolio) => (
                    <div key={portfolio.id} className="flex items-center justify-between p-2 bg-bloomberg-bg border border-bloomberg-border rounded">
                      <div className="flex-1">
                        {editingPortfolioId === portfolio.id ? (
                          <div className="flex items-center gap-2">
                            <input 
                              type="text" 
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="border border-bloomberg-border bg-bloomberg-panel text-bloomberg-text px-2 py-1 text-xs flex-1 rounded"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRename();
                                if (e.key === 'Escape') handleCancelRename();
                              }}
                              autoFocus
                            />
                            <button 
                              onClick={handleSaveRename}
                              className="px-2 py-1 bg-bloomberg-accent text-bloomberg-bg text-xs hover:opacity-90 rounded"
                            >
                              ✓
                            </button>
                            <button 
                              onClick={handleCancelRename}
                              className="px-2 py-1 bg-bloomberg-panel border border-bloomberg-border text-bloomberg-text text-xs hover:bg-bloomberg-border rounded"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-sm">{portfolio.name}</span>
                              <span className="text-xs text-bloomberg-text-dim">
                                {portfolio.investmentMode === "lump_sum" ? "LUMP SUM" : 
                                 portfolio.investmentMode === "recurring" ? "RECURRING" : "HYBRID"}
                              </span>
                            </div>
                            <div className="text-xs text-bloomberg-text-dim mt-1">
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
                            className="accent-bloomberg-accent"
                          />
                        )}
                        <button 
                          onClick={()=>handleShareSavedPortfolio(portfolio)}
                          className="px-2 py-1 bg-bloomberg-panel border border-bloomberg-border text-bloomberg-text text-xs hover:bg-bloomberg-border rounded"
                          title="Copy shareable link"
                        >
                          SHARE
                        </button>
                        <button 
                          onClick={()=>handleRenamePortfolio(portfolio)}
                          className="px-2 py-1 bg-bloomberg-panel border border-bloomberg-border text-bloomberg-text text-xs hover:bg-bloomberg-border rounded"
                          title="Rename portfolio"
                        >
                          EDIT
                        </button>
                        <button 
                          onClick={()=>loadPortfolio(portfolio)}
                          className="px-2 py-1 bg-bloomberg-accent text-bloomberg-bg text-xs hover:opacity-90"
                        >
                          LOAD
                        </button>
                        <button 
                          onClick={()=>deletePortfolio(portfolio.id)}
                          className="px-2 py-1 bg-bloomberg-negative text-bloomberg-bg text-xs hover:opacity-90 rounded"
                        >
                          DEL
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {compareMode && (
                  <div className="mt-4 p-3 bg-bloomberg-bg border border-bloomberg-border rounded">
                    <div className="text-xs text-bloomberg-text-dim">
                      <strong className="text-bloomberg-accent">COMPARE MODE:</strong> {includeCurrentPortfolio && Object.keys(weights).length > 0 ? "Current portfolio included. " : ""}Select saved portfolios to compare. 
                      Selected: <span className="text-bloomberg-accent">{selectedPortfolios.length}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Assets */}
        <div className="bg-bloomberg-panel border border-bloomberg-border p-4 space-y-3 animate-fade-in rounded">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-bloomberg-accent text-sm uppercase tracking-wide">Assets</h2>
            <button
              onClick={()=>{
                const zeros={};
                for(const c of columns) zeros[c]=0;
                setWeights(zeros);
              }}
              className="text-xs px-2 py-1 border border-bloomberg-border bg-bloomberg-bg text-bloomberg-text hover:bg-bloomberg-border transition-colors rounded"
              title="Set all weights to 0%"
            >ZERO ALL</button>
          </div>
          <div className="text-xs text-bloomberg-text-dim">Data updated to 2025-08</div>
          <ul className="divide-y divide-bloomberg-border">
            {columns.map((c)=>(
              <li key={c} className="py-2 flex items-center justify-between">
                <span className="text-xs flex items-center gap-2">
                  <span className={`text-[9px] px-2 py-0.5 border capitalize text-center w-20 shrink-0 font-mono rounded ${
                    getAssetCategory(c)==="stocks"?"bg-bloomberg-bg border-bloomberg-accent text-bloomberg-accent":
                    getAssetCategory(c)==="bonds"?"bg-bloomberg-bg border-bloomberg-positive text-bloomberg-positive":
                    getAssetCategory(c)==="cash"?"bg-bloomberg-bg border-bloomberg-text-dim text-bloomberg-text-dim":
                    "bg-bloomberg-bg border-bloomberg-warning text-bloomberg-warning"
                  }`}>
                    {getAssetCategory(c).toUpperCase()}
                  </span>
                  <span className="text-bloomberg-text">{c}</span>
                </span>
                <div className="flex items-center gap-2">
                  <input type="number" step="1" className="w-20 border border-bloomberg-border bg-bloomberg-bg text-bloomberg-text p-2 text-right text-xs rounded"
                    value={Math.round((weights[c]??0)*100)}
                    onChange={(e)=>setWeights(w=>({...w, [c]: Math.max(0, Number(e.target.value)||0)/100 }))}
                    title="Weight in percent"
                  />
                  <span className="text-xs text-bloomberg-text-dim">%</span>
                </div>
              </li>
            ))}
          </ul>
          <div className="text-xs mt-2 font-medium text-bloomberg-text">
            Total: <span className={sumPct===100 ? 'text-bloomberg-positive' : 'text-bloomberg-negative'}>{sumPct}%</span> {sumPct!==100 && (<button onClick={normalizeWeights} className="ml-2 px-2 py-1 border border-bloomberg-border bg-bloomberg-panel text-bloomberg-text hover:bg-bloomberg-border text-xs transition-colors rounded">NORMALIZE</button>)}
          </div>
          <div className="text-xs text-bloomberg-text-dim">Need fund data? Download from <a href="https://curvo.eu/backtest/en/funds" target="_blank" rel="noopener noreferrer" className="text-bloomberg-accent hover:underline">Curvo's fund database</a>.</div>
        </div>

        {/* Performance Tabs */}
        <div className="bg-bloomberg-panel border border-bloomberg-border p-4 animate-fade-in rounded">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 mr-4">
              <button onClick={()=>setPerfTab("portfolio")} className={`px-3 py-1.5 border text-xs uppercase tracking-wide transition-colors rounded ${perfTab==='portfolio' ? 'bg-bloomberg-accent text-bloomberg-bg border-bloomberg-accent' : 'border-bloomberg-border bg-bloomberg-bg text-bloomberg-text hover:bg-bloomberg-border'}`}>Portfolio</button>
              <button onClick={()=>setPerfTab("assets")} className={`px-3 py-1.5 border text-xs uppercase tracking-wide transition-colors rounded ${perfTab==='assets' ? 'bg-bloomberg-accent text-bloomberg-bg border-bloomberg-accent' : 'border-bloomberg-border bg-bloomberg-bg text-bloomberg-text hover:bg-bloomberg-border'}`}>Assets</button>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-bloomberg-text-dim uppercase tracking-wide">Start:</label>
              <input type="month" min={dataBounds.first||undefined} max={dataBounds.last||undefined} value={startDate.slice(0,7)} onChange={(e)=>handleStartChange(e.target.value)} className="border border-bloomberg-border bg-bloomberg-bg text-bloomberg-text p-1 text-xs rounded" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-bloomberg-text-dim uppercase tracking-wide">End:</label>
              <input type="month" min={dataBounds.first||undefined} max={dataBounds.last||undefined} value={endDate?endDate.slice(0,7):""} onChange={(e)=>handleEndChange(e.target.value)} className="border border-bloomberg-border bg-bloomberg-bg text-bloomberg-text p-1 text-xs rounded" />
            </div>
          </div>
        </div>

        {/* Portfolio Summary */}
        {metrics && perfTab==='portfolio' && !compareMode && (
          <div className="bg-bloomberg-panel border border-bloomberg-border p-6 animate-slide-up rounded">
            <h2 className="text-lg font-bold mb-4 text-bloomberg-accent uppercase tracking-wide">Portfolio Summary</h2>
            
            {/* Investment Mode Toggle */}
            <div className="mb-6 p-4 bg-bloomberg-bg border border-bloomberg-border rounded">
              <div className="text-xs font-bold text-bloomberg-text-dim mb-3 uppercase tracking-wide">Investment Strategy</div>
              <div className="flex flex-wrap gap-4 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="investmentMode" 
                    value="lump_sum" 
                    checked={investmentMode === "lump_sum"}
                    onChange={(e)=>setInvestmentMode(e.target.value)}
                    className="accent-bloomberg-accent"
                  />
                  <span className="text-xs font-medium text-bloomberg-text">Lump Sum Only</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="investmentMode" 
                    value="recurring" 
                    checked={investmentMode === "recurring"}
                    onChange={(e)=>setInvestmentMode(e.target.value)}
                    className="accent-bloomberg-accent"
                  />
                  <span className="text-xs font-medium text-bloomberg-text">Monthly Recurring Only</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="investmentMode" 
                    value="hybrid" 
                    checked={investmentMode === "hybrid"}
                    onChange={(e)=>setInvestmentMode(e.target.value)}
                    className="accent-bloomberg-accent"
                  />
                  <span className="text-xs font-medium text-bloomberg-text">Lump Sum + Monthly</span>
                </label>
              </div>
              
              {investmentMode === "lump_sum" ? (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-bloomberg-text-dim uppercase tracking-wide">Initial amount:</label>
                  <input 
                    type="number" 
                    step={1000} 
                    value={initial} 
                    onChange={(e)=>setInitial(Number(e.target.value)||0)} 
                    className="border border-bloomberg-border bg-bloomberg-panel text-bloomberg-text rounded p-2 w-32 font-medium text-xs" 
                    placeholder="100000"
                  />
                  <span className="text-xs text-bloomberg-text-dim">€</span>
                </div>
              ) : investmentMode === "recurring" ? (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-bloomberg-text-dim uppercase tracking-wide">Monthly investment:</label>
                  <input 
                    type="number" 
                    step={100} 
                    value={monthlyInvestment} 
                    onChange={(e)=>setMonthlyInvestment(Number(e.target.value)||0)} 
                    className="border border-bloomberg-border bg-bloomberg-panel text-bloomberg-text rounded p-2 w-32 font-medium text-xs" 
                    placeholder="1000"
                  />
                  <span className="text-xs text-bloomberg-text-dim">€/month</span>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-bloomberg-text-dim uppercase tracking-wide">Initial lump sum:</label>
                    <input 
                      type="number" 
                      step={1000} 
                      value={initial} 
                      onChange={(e)=>setInitial(Number(e.target.value)||0)} 
                      className="border border-bloomberg-border bg-bloomberg-panel text-bloomberg-text rounded p-2 w-32 font-medium text-xs" 
                      placeholder="100000"
                    />
                    <span className="text-xs text-bloomberg-text-dim">€</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-bloomberg-text-dim uppercase tracking-wide">Monthly investment:</label>
                    <input 
                      type="number" 
                      step={100} 
                      value={monthlyInvestment} 
                      onChange={(e)=>setMonthlyInvestment(Number(e.target.value)||0)} 
                      className="border border-bloomberg-border bg-bloomberg-panel text-bloomberg-text rounded p-2 w-32 font-medium text-xs" 
                      placeholder="1000"
                    />
                    <span className="text-xs text-bloomberg-text-dim">€/month</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="grid md:grid-cols-5 gap-4">
              <div className="bg-bloomberg-bg border border-bloomberg-border p-4 animate-fade-in rounded" style={{animationDelay: '0.1s'}}>
                <div className="text-xs font-bold text-bloomberg-text-dim uppercase tracking-wide">
                  {(investmentMode === "recurring" || investmentMode === "hybrid") ? "Total Invested" : "Initial Investment"}
                </div>
                <div className="text-base font-bold mt-2 text-bloomberg-text">
                  {(investmentMode === "recurring" || investmentMode === "hybrid")
                    ? euroTick(metrics.totalInvested[metrics.totalInvested.length-1] || 0)
                    : euroTick(initial)
                  }
                </div>
              </div>
              <div className="bg-bloomberg-bg border border-bloomberg-border p-4 animate-fade-in" style={{animationDelay: '0.2s'}}>
                <div className="text-xs font-bold text-bloomberg-text-dim uppercase tracking-wide">Final Value</div>
                <div className="text-xs flex flex-col leading-6 mt-2">
                  <span><span className="text-bloomberg-text-dim">Nominal:</span> <span className="font-semibold text-bloomberg-text">{euroTick(metrics.nominalValue[metrics.nominalValue.length-1]?.value)}</span></span>
                  <span><span className="text-bloomberg-text-dim">Real:</span> <span className="font-semibold text-bloomberg-text">{euroTick(metrics.realValue[metrics.realValue.length-1]?.value)}</span></span>
                </div>
              </div>
              <div className="bg-bloomberg-bg border border-bloomberg-border p-4 animate-fade-in" style={{animationDelay: '0.3s'}}>
                <div className="text-xs font-bold text-bloomberg-text-dim uppercase tracking-wide">CAGR</div>
                <div className="text-xs flex flex-col leading-6 mt-2">
                  <span><span className="text-bloomberg-text-dim">Nominal:</span> <span className={`font-semibold ${metrics.cagr >= 0 ? 'text-bloomberg-positive' : 'text-bloomberg-negative'}`}>{(metrics.cagr*100).toFixed(2)}%</span></span>
                  <span><span className="text-bloomberg-text-dim">Real:</span> <span className={`font-semibold ${metrics.realCagr >= 0 ? 'text-bloomberg-positive' : 'text-bloomberg-negative'}`}>{(metrics.realCagr*100).toFixed(2)}%</span></span>
                </div>
              </div>
              <div className="bg-bloomberg-bg border border-bloomberg-border p-4 animate-fade-in" style={{animationDelay: '0.4s'}}>
                <div className="text-xs font-bold text-bloomberg-text-dim uppercase tracking-wide">Risk Ratios (rf={rf})</div>
                <div className="text-xs flex flex-col leading-6 mt-2">
                  <span><span className="text-bloomberg-text-dim">Sharpe:</span> <span className="font-semibold text-bloomberg-text">{metrics.sharpe.toFixed(2)}</span></span>
                  <span><span className="text-bloomberg-text-dim">Sortino:</span> <span className="font-semibold text-bloomberg-text">{metrics.sortino.toFixed(2)}</span></span>
                </div>
              </div>
              <div className="bg-bloomberg-bg border border-bloomberg-border p-4 animate-fade-in" style={{animationDelay: '0.5s'}}>
                <div className="text-xs font-bold text-bloomberg-text-dim uppercase tracking-wide">Risk (Annualized)</div>
                <div className="text-xs flex flex-col leading-6 mt-2">
                  <span><span className="text-bloomberg-text-dim">Volatility:</span> <span className="font-semibold text-bloomberg-text">{(metrics.vol*100).toFixed(2)}%</span></span>
                  <span><span className="text-bloomberg-text-dim">Max Drawdown:</span> <span className="font-semibold text-bloomberg-negative">{(metrics.maxDrawdown*100).toFixed(2)}%</span></span>
                  {metrics.timeToRecover && metrics.timeToRecover.length > 0 && (
                    <span><span className="text-bloomberg-text-dim">Max Time to Recover:</span> <span className="font-semibold text-bloomberg-text">{formatMonthsAsYearsAndMonths(Math.max(...metrics.timeToRecover.map(r => r.months)))} ({Math.max(...metrics.timeToRecover.map(r => r.months))} months)</span></span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Investment Strategy Selector in Compare Mode */}
        {compareMode && perfTab==='portfolio' && (
          <div className="bg-bloomberg-panel border border-bloomberg-border p-6 animate-slide-up rounded mb-4">
            <h2 className="text-lg font-bold mb-4 text-bloomberg-accent uppercase tracking-wide">Current Portfolio Investment Strategy</h2>
            <div className="p-4 bg-bloomberg-bg border border-bloomberg-border rounded">
              <div className="text-xs font-bold text-bloomberg-text-dim mb-3 uppercase tracking-wide">Investment Strategy</div>
              <div className="flex flex-wrap gap-4 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="investmentMode" 
                    value="lump_sum" 
                    checked={investmentMode === "lump_sum"}
                    onChange={(e)=>setInvestmentMode(e.target.value)}
                    className="accent-bloomberg-accent"
                  />
                  <span className="text-xs font-medium text-bloomberg-text">Lump Sum Only</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="investmentMode" 
                    value="recurring" 
                    checked={investmentMode === "recurring"}
                    onChange={(e)=>setInvestmentMode(e.target.value)}
                    className="accent-bloomberg-accent"
                  />
                  <span className="text-xs font-medium text-bloomberg-text">Monthly Recurring Only</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="investmentMode" 
                    value="hybrid" 
                    checked={investmentMode === "hybrid"}
                    onChange={(e)=>setInvestmentMode(e.target.value)}
                    className="accent-bloomberg-accent"
                  />
                  <span className="text-xs font-medium text-bloomberg-text">Lump Sum + Monthly</span>
                </label>
              </div>
              
              {investmentMode === "lump_sum" ? (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-bloomberg-text-dim uppercase tracking-wide">Initial amount:</label>
                  <input 
                    type="number" 
                    step={1000} 
                    value={initial} 
                    onChange={(e)=>setInitial(Number(e.target.value)||0)} 
                    className="border border-bloomberg-border bg-bloomberg-panel text-bloomberg-text rounded p-2 w-32 font-medium text-xs" 
                    placeholder="100000"
                  />
                  <span className="text-xs text-bloomberg-text-dim">€</span>
                </div>
              ) : investmentMode === "recurring" ? (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-bloomberg-text-dim uppercase tracking-wide">Monthly investment:</label>
                  <input 
                    type="number" 
                    step={100} 
                    value={monthlyInvestment} 
                    onChange={(e)=>setMonthlyInvestment(Number(e.target.value)||0)} 
                    className="border border-bloomberg-border bg-bloomberg-panel text-bloomberg-text rounded p-2 w-32 font-medium text-xs" 
                    placeholder="1000"
                  />
                  <span className="text-xs text-bloomberg-text-dim">€/month</span>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-bloomberg-text-dim uppercase tracking-wide">Initial lump sum:</label>
                    <input 
                      type="number" 
                      step={1000} 
                      value={initial} 
                      onChange={(e)=>setInitial(Number(e.target.value)||0)} 
                      className="border border-bloomberg-border bg-bloomberg-panel text-bloomberg-text rounded p-2 w-32 font-medium text-xs" 
                      placeholder="100000"
                    />
                    <span className="text-xs text-bloomberg-text-dim">€</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-bloomberg-text-dim uppercase tracking-wide">Monthly investment:</label>
                    <input 
                      type="number" 
                      step={100} 
                      value={monthlyInvestment} 
                      onChange={(e)=>setMonthlyInvestment(Number(e.target.value)||0)} 
                      className="border border-bloomberg-border bg-bloomberg-panel text-bloomberg-text rounded p-2 w-32 font-medium text-xs" 
                      placeholder="1000"
                    />
                    <span className="text-xs text-bloomberg-text-dim">€/month</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Portfolio Comparison Summary */}
        {compareMode && comparePortfolios && perfTab==='portfolio' && (
          <div className="bg-bloomberg-panel border border-bloomberg-border p-6 animate-slide-up rounded">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
              <h2 className="text-lg font-bold text-bloomberg-accent uppercase tracking-wide">Portfolio Comparison ({comparePortfolios.length} portfolios)</h2>
              
              <div className="flex flex-wrap items-center gap-3">
                {/* Include Current Portfolio Toggle */}
                {Object.keys(weights).length > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={includeCurrentPortfolio}
                      onChange={(e)=>setIncludeCurrentPortfolio(e.target.checked)}
                      className="accent-bloomberg-accent"
                    />
                    <span className="text-xs text-bloomberg-text">Include Current</span>
                  </label>
                )}
                
                {/* View Toggle */}
                <div className="flex items-center gap-2 border border-bloomberg-border rounded overflow-hidden">
                  <button
                    onClick={()=>setComparisonView("cards")}
                    className={`px-2 py-1 text-xs transition-colors ${comparisonView === "cards" ? 'bg-bloomberg-accent text-bloomberg-bg' : 'bg-bloomberg-bg text-bloomberg-text hover:bg-bloomberg-border'}`}
                  >
                    Cards
                  </button>
                  <button
                    onClick={()=>setComparisonView("table")}
                    className={`px-2 py-1 text-xs transition-colors ${comparisonView === "table" ? 'bg-bloomberg-accent text-bloomberg-bg' : 'bg-bloomberg-bg text-bloomberg-text hover:bg-bloomberg-border'}`}
                  >
                    Table
                  </button>
                </div>
                
                {/* Sort Controls */}
                <select 
                  value={comparisonSortBy} 
                  onChange={(e)=>setComparisonSortBy(e.target.value)}
                  className="text-xs border border-bloomberg-border bg-bloomberg-bg text-bloomberg-text rounded px-2 py-1"
                >
                  <option value="name">Sort by Name</option>
                  <option value="cagr">Sort by CAGR</option>
                  <option value="realCagr">Sort by Real CAGR</option>
                  <option value="sharpe">Sort by Sharpe</option>
                  <option value="sortino">Sort by Sortino</option>
                  <option value="vol">Sort by Volatility</option>
                  <option value="maxDrawdown">Sort by Max DD</option>
                  <option value="maxTimeToRecover">Sort by Max Time to Recover</option>
                </select>
                
                <button
                  onClick={()=>setComparisonSortOrder(prev => prev === "asc" ? "desc" : "asc")}
                  className="px-2 py-1 text-xs border border-bloomberg-border bg-bloomberg-bg text-bloomberg-text hover:bg-bloomberg-border rounded"
                  title={comparisonSortOrder === "asc" ? "Sort Descending" : "Sort Ascending"}
                >
                  {comparisonSortOrder === "asc" ? "↑" : "↓"}
                </button>
                
                {/* Export Button */}
                <button
                  onClick={exportComparison}
                  className="px-3 py-1 text-xs border border-bloomberg-border bg-bloomberg-bg text-bloomberg-text hover:bg-bloomberg-border rounded"
                  title="Export comparison to CSV"
                >
                  Export CSV
                </button>
              </div>
            </div>
            
            {comparisonView === "cards" ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {comparePortfolios.map((portfolio, index) => {
                  const bestCAGR = getBestPortfolio("cagr");
                  const bestSharpe = getBestPortfolio("sharpe");
                  const worstDD = getWorstPortfolio("maxDrawdown");
                  
                  return (
                    <div key={portfolio.id} className={`bg-bloomberg-bg border border-bloomberg-border p-4 animate-fade-in rounded ${portfolio.id === "current" ? "ring-2 ring-bloomberg-accent" : ""}`} style={{animationDelay: `${(index * 0.1)}s`}}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-bold text-bloomberg-text truncate" title={portfolio.name}>
                    {portfolio.name}
                        </div>
                        {portfolio.id === "current" && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-bloomberg-accent text-bloomberg-bg rounded uppercase">Current</span>
                        )}
                  </div>
                  <div className="text-[10px] text-bloomberg-text-dim mb-3 uppercase">
                        {investmentMode === "lump_sum" ? "Lump Sum" : investmentMode === "recurring" ? "Recurring" : "Hybrid"}
                  </div>
                  <div className="text-xs flex flex-col leading-6 space-y-1">
                        <div>
                          <span className="text-bloomberg-text-dim">CAGR:</span> 
                          <span className={`font-semibold ml-1 ${portfolio.cagr >= 0 ? 'text-bloomberg-positive' : 'text-bloomberg-negative'} ${bestCAGR?.id === portfolio.id ? 'underline' : ''}`}>
                            {(portfolio.cagr*100).toFixed(2)}%
                            {bestCAGR?.id === portfolio.id && <span className="text-[9px] ml-1">★</span>}
                          </span>
                  </div>
                        <div>
                          <span className="text-bloomberg-text-dim">Real CAGR:</span> 
                          <span className={`font-semibold ml-1 ${portfolio.realCagr >= 0 ? 'text-bloomberg-positive' : 'text-bloomberg-negative'}`}>
                            {(portfolio.realCagr*100).toFixed(2)}%
                          </span>
                </div>
                        <div>
                          <span className="text-bloomberg-text-dim">Volatility:</span> 
                          <span className="font-semibold ml-1 text-bloomberg-text">{(portfolio.vol*100).toFixed(2)}%</span>
            </div>
                        <div>
                          <span className="text-bloomberg-text-dim">Sharpe:</span> 
                          <span className={`font-semibold ml-1 text-bloomberg-text ${bestSharpe?.id === portfolio.id ? 'underline' : ''}`}>
                            {portfolio.sharpe.toFixed(2)}
                            {bestSharpe?.id === portfolio.id && <span className="text-[9px] ml-1">★</span>}
                          </span>
                        </div>
                        <div>
                          <span className="text-bloomberg-text-dim">Sortino:</span> 
                          <span className="font-semibold ml-1 text-bloomberg-text">{portfolio.sortino.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-bloomberg-text-dim">Max DD:</span> 
                          <span className={`font-semibold ml-1 text-bloomberg-negative ${worstDD?.id === portfolio.id ? 'underline' : ''}`}>
                            {(portfolio.maxDrawdown*100).toFixed(2)}%
                            {worstDD?.id === portfolio.id && <span className="text-[9px] ml-1">⚠</span>}
                          </span>
                        </div>
                        {portfolio.maxTimeToRecover > 0 && (
                          <div>
                            <span className="text-bloomberg-text-dim">Max Time to Recover:</span> 
                            <span className="font-semibold ml-1 text-bloomberg-text">
                              {formatMonthsAsYearsAndMonths(portfolio.maxTimeToRecover)} ({portfolio.maxTimeToRecover} months)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-bloomberg-border">
                      <th className="text-left p-2 font-bold text-bloomberg-accent">Portfolio</th>
                      <th className="text-left p-2 font-bold text-bloomberg-accent">Strategy</th>
                      <th className="text-right p-2 font-bold text-bloomberg-accent cursor-pointer hover:bg-bloomberg-bg" onClick={()=>{setComparisonSortBy("cagr"); setComparisonSortOrder(prev => prev === "asc" ? "desc" : "asc");}}>
                        CAGR {comparisonSortBy === "cagr" && (comparisonSortOrder === "asc" ? "↑" : "↓")}
                      </th>
                      <th className="text-right p-2 font-bold text-bloomberg-accent">Real CAGR</th>
                      <th className="text-right p-2 font-bold text-bloomberg-accent cursor-pointer hover:bg-bloomberg-bg" onClick={()=>{setComparisonSortBy("vol"); setComparisonSortOrder(prev => prev === "asc" ? "desc" : "asc");}}>
                        Volatility {comparisonSortBy === "vol" && (comparisonSortOrder === "asc" ? "↑" : "↓")}
                      </th>
                      <th className="text-right p-2 font-bold text-bloomberg-accent cursor-pointer hover:bg-bloomberg-bg" onClick={()=>{setComparisonSortBy("sharpe"); setComparisonSortOrder(prev => prev === "asc" ? "desc" : "asc");}}>
                        Sharpe {comparisonSortBy === "sharpe" && (comparisonSortOrder === "asc" ? "↑" : "↓")}
                      </th>
                      <th className="text-right p-2 font-bold text-bloomberg-accent">Sortino</th>
                      <th className="text-right p-2 font-bold text-bloomberg-accent cursor-pointer hover:bg-bloomberg-bg" onClick={()=>{setComparisonSortBy("maxDrawdown"); setComparisonSortOrder(prev => prev === "asc" ? "desc" : "asc");}}>
                        Max DD {comparisonSortBy === "maxDrawdown" && (comparisonSortOrder === "asc" ? "↑" : "↓")}
                      </th>
                      <th className="text-right p-2 font-bold text-bloomberg-accent cursor-pointer hover:bg-bloomberg-bg" onClick={()=>{setComparisonSortBy("maxTimeToRecover"); setComparisonSortOrder(prev => prev === "asc" ? "desc" : "asc");}}>
                        Max Time to Recover {comparisonSortBy === "maxTimeToRecover" && (comparisonSortOrder === "asc" ? "↑" : "↓")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparePortfolios.map((portfolio, index) => {
                      const bestCAGR = getBestPortfolio("cagr");
                      const bestSharpe = getBestPortfolio("sharpe");
                      const worstDD = getWorstPortfolio("maxDrawdown");
                      
                      return (
                        <tr 
                          key={portfolio.id} 
                          className={`border-b border-bloomberg-border hover:bg-bloomberg-bg ${portfolio.id === "current" ? "bg-bloomberg-bg/50" : ""}`}
                        >
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{portfolio.name}</span>
                              {portfolio.id === "current" && (
                                <span className="text-[9px] px-1.5 py-0.5 bg-bloomberg-accent text-bloomberg-bg rounded uppercase">Current</span>
                              )}
                            </div>
                          </td>
                          <td className="p-2 text-bloomberg-text-dim uppercase text-[10px]">
                            {investmentMode === "lump_sum" ? "Lump Sum" : investmentMode === "recurring" ? "Recurring" : "Hybrid"}
                          </td>
                          <td className={`p-2 text-right font-semibold ${portfolio.cagr >= 0 ? 'text-bloomberg-positive' : 'text-bloomberg-negative'} ${bestCAGR?.id === portfolio.id ? 'underline' : ''}`}>
                            {(portfolio.cagr*100).toFixed(2)}%{bestCAGR?.id === portfolio.id && <span className="ml-1">★</span>}
                          </td>
                          <td className={`p-2 text-right font-semibold ${portfolio.realCagr >= 0 ? 'text-bloomberg-positive' : 'text-bloomberg-negative'}`}>
                            {(portfolio.realCagr*100).toFixed(2)}%
                          </td>
                          <td className="p-2 text-right">{(portfolio.vol*100).toFixed(2)}%</td>
                          <td className={`p-2 text-right font-semibold ${bestSharpe?.id === portfolio.id ? 'underline' : ''}`}>
                            {portfolio.sharpe.toFixed(2)}{bestSharpe?.id === portfolio.id && <span className="ml-1">★</span>}
                          </td>
                          <td className="p-2 text-right">{portfolio.sortino.toFixed(2)}</td>
                          <td className={`p-2 text-right font-semibold text-bloomberg-negative ${worstDD?.id === portfolio.id ? 'underline' : ''}`}>
                            {(portfolio.maxDrawdown*100).toFixed(2)}%{worstDD?.id === portfolio.id && <span className="ml-1">⚠</span>}
                          </td>
                          <td className="p-2 text-right">
                            {portfolio.maxTimeToRecover > 0 
                              ? `${formatMonthsAsYearsAndMonths(portfolio.maxTimeToRecover)} (${portfolio.maxTimeToRecover} months)`
                              : "N/A"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Portfolio Analysis */}
        {false && metrics && perfTab==='portfolio' && (
          <div className="bg-bloomberg-panel border border-bloomberg-border p-6 animate-fade-in rounded">
            <h2 className="text-lg font-bold mb-4 text-bloomberg-accent uppercase tracking-wide">Portfolio Analysis</h2>
                <div className="bg-bloomberg-bg border-l-4 border-bloomberg-accent p-4 mb-6 rounded">
              <div className="text-xs text-bloomberg-text space-y-2">
                <p><strong>Strategy:</strong> {
                  investmentMode === "recurring" 
                    ? `${euroTick(monthlyInvestment)}/month recurring` 
                    : investmentMode === "hybrid"
                    ? `${euroTick(initial)} initial + ${euroTick(monthlyInvestment)}/month`
                    : `${euroTick(initial)} lump sum`
                } • <strong>Performance:</strong> {(metrics.cagr*100).toFixed(2)}% CAGR, {(metrics.vol*100).toFixed(2)}% vol, {Math.abs(metrics.maxDrawdown*100).toFixed(2)}% max DD</p>
                
                <p><strong>Risk-Adjusted:</strong> {metrics.sharpe > 1 ? 'Excellent' : metrics.sharpe > 0.5 ? 'Good' : 'Needs improvement'} Sharpe ({metrics.sharpe.toFixed(2)}) • <strong>Allocation:</strong> {Object.values(weights).some(w => w > 0.4) ? 'Consider reducing concentration >40%' : 'Well-diversified'} • <strong>Rebalancing:</strong> {rebalance.toLowerCase()}</p>
              </div>
            </div>
          </div>
        )}

        {/* Portfolio Value */}
        {metrics && perfTab==='portfolio' && !compareMode && (
          <div className="bg-bloomberg-panel border border-bloomberg-border p-4 animate-fade-in rounded">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Portfolio Value (€): Nominal vs Real — Avg Italy inflation ≈ {(metrics.avgInfl*100).toFixed(2)}% p.a.</h3>
              <button onClick={exportPortfolioValue} className="p-2 rounded hover:bg-bloomberg-border" title="Download CSV" aria-label="Download CSV">⬇️</button>
            </div>
            <p className="text-sm text-bloomberg-text-dim mb-3">This chart shows how your portfolio value grows over time. The blue line represents nominal returns (not adjusted for inflation), while the green line shows real returns (purchasing power after accounting for Italian CPI inflation).{(investmentMode === "recurring" || investmentMode === "hybrid") ? " The gray line shows your cumulative invested amount." : ""}</p>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics.nominalValue.map((p,i)=>({
                  date:p.date, 
                  nominal:p.value, 
                  real:metrics.realValue[i].value,
                  ...((investmentMode === "recurring" || investmentMode === "hybrid") ? {invested: metrics.totalInvested[i]} : {})
                }))} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                  <XAxis dataKey="date" tickFormatter={(d)=>d.slice(0,7)} minTickGap={32} stroke="#8b949e" tick={{fill: '#8b949e', fontSize: 11}} />
                  <YAxis tickFormatter={euroTick} stroke="#8b949e" tick={{fill: '#8b949e', fontSize: 11}} />
                  <Tooltip formatter={euroTick} labelFormatter={(l)=>l.slice(0,10)} contentStyle={{backgroundColor: '#141b2d', border: '1px solid #1e2a3a', color: '#d4d4d4'}} />
                  <Legend wrapperStyle={{color: '#d4d4d4'}} />
                  <Line type="monotone" dataKey="nominal" dot={false} strokeWidth={3} stroke="#00d4aa" name="Nominal Value" isAnimationActive={true} animationDuration={1000} />
                  <Line type="monotone" dataKey="real" dot={false} strokeWidth={3} stroke="#00a8ff" name="Real Value" isAnimationActive={true} animationDuration={1000} />
                  {(investmentMode === "recurring" || investmentMode === "hybrid") && (
                    <Line type="monotone" dataKey="invested" dot={false} strokeWidth={2} stroke="#8b949e" strokeDasharray="5 5" name="Total Invested" isAnimationActive={true} animationDuration={1000} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Portfolio Comparison Value Chart */}
        {compareMode && comparePortfolios && perfTab==='portfolio' && (
          <div className="bg-bloomberg-panel border border-bloomberg-border p-4 animate-fade-in rounded">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Portfolio Value Comparison (Normalized to 100)</h3>
            </div>
            <p className="text-sm text-bloomberg-text-dim mb-3">This chart compares the performance of selected portfolios over time. All portfolios are normalized to start at 100 for easy comparison.</p>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={comparePortfolios[0]?.nominalIndex.map((point, index) => {
                  const dataPoint = { date: point.date };
                  comparePortfolios.forEach((portfolio, portfolioIndex) => {
                    dataPoint[portfolio.name] = portfolio.nominalIndex[index]?.value || 0;
                  });
                  return dataPoint;
                }) || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                  <XAxis dataKey="date" tickFormatter={(d)=>d.slice(0,7)} minTickGap={32} stroke="#8b949e" tick={{fill: '#8b949e', fontSize: 11}} />
                  <YAxis tickFormatter={(v)=>v.toFixed(0)} stroke="#8b949e" tick={{fill: '#8b949e', fontSize: 11}} />
                  <Tooltip formatter={(v)=>v.toFixed(2)} labelFormatter={(l)=>l.slice(0,10)} contentStyle={{backgroundColor: '#141b2d', border: '1px solid #1e2a3a', color: '#d4d4d4'}} />
                  <Legend />
                  {comparePortfolios.map((portfolio, index) => {
                    const colors = ['#00d4aa', '#00a8ff', '#ff6b6b', '#ffa500', '#9d4edd', '#06ffa5', '#ff006e', '#8338ec'];
                    return (
                      <Line 
                        key={portfolio.id}
                        type="monotone" 
                        dataKey={portfolio.name} 
                        dot={false} 
                        strokeWidth={3} 
                        stroke={colors[index % colors.length]} 
                        name={portfolio.name}
                        isAnimationActive={true}
                        animationDuration={800}
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
          <div className="bg-bloomberg-panel border border-bloomberg-border p-4 rounded">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Max Drawdowns Over Time (Nominal)</h3>
              <button onClick={exportDrawdowns} className="p-2 rounded hover:bg-bloomberg-border" title="Download CSV" aria-label="Download CSV">⬇️</button>
            </div>
            <p className="text-sm text-bloomberg-text-dim mb-3">Drawdowns represent the decline from peak portfolio value. The red dot marks the worst drawdown period. Lower drawdowns indicate better downside protection.</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.drawdowns}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                  <XAxis dataKey="date" tickFormatter={(d)=>d.slice(0,7)} minTickGap={32} stroke="#8b949e" tick={{fill: '#8b949e', fontSize: 11}} />
                  <YAxis tickFormatter={(v)=>(v*100).toFixed(0)+"%"} stroke="#8b949e" tick={{fill: '#8b949e', fontSize: 11}} />
                  <Tooltip formatter={(v)=>(v*100).toFixed(2)+"%"} labelFormatter={(l)=>l.slice(0,10)} contentStyle={{backgroundColor: '#141b2d', border: '1px solid #1e2a3a', color: '#d4d4d4'}} />
                  <ReferenceLine y={0} stroke="#8b949e" />
                  <Area type="monotone" dataKey="value" stroke="#ff6b6b" fill="#ff6b6b" fillOpacity={0.3} isAnimationActive={true} animationDuration={1000} />
                  {metrics.ddMinPoint && (
                    <ReferenceDot x={metrics.ddMinPoint.date} y={metrics.ddMinPoint.value} r={6} fill="#ff6b6b" stroke="#d4d4d4" />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Portfolio Comparison Drawdowns Chart */}
        {compareMode && comparePortfolios && perfTab==='portfolio' && (
          <div className="bg-bloomberg-panel border border-bloomberg-border p-4 rounded">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Drawdowns Comparison</h3>
            </div>
            <p className="text-sm text-bloomberg-text-dim mb-3">Compare drawdowns across selected portfolios. Lower values indicate better downside protection.</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={comparePortfolios[0]?.drawdowns.map((point, index) => {
                  const dataPoint = { date: point.date };
                  comparePortfolios.forEach((portfolio) => {
                    dataPoint[portfolio.name] = (portfolio.drawdowns[index]?.value || 0) * 100;
                  });
                  return dataPoint;
                }) || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                  <XAxis dataKey="date" tickFormatter={(d)=>d.slice(0,7)} minTickGap={32} stroke="#8b949e" tick={{fill: '#8b949e', fontSize: 11}} />
                  <YAxis tickFormatter={(v)=>v.toFixed(0)+"%"} stroke="#8b949e" tick={{fill: '#8b949e', fontSize: 11}} />
                  <Tooltip formatter={(v)=>v.toFixed(2)+"%"} labelFormatter={(l)=>l.slice(0,10)} contentStyle={{backgroundColor: '#141b2d', border: '1px solid #1e2a3a', color: '#d4d4d4'}} />
                  <ReferenceLine y={0} stroke="#8b949e" />
                  <Legend wrapperStyle={{color: '#d4d4d4'}} />
                  {comparePortfolios.map((portfolio, index) => {
                    const colors = ['#00d4aa', '#00a8ff', '#ff6b6b', '#ffa500', '#9d4edd', '#06ffa5', '#ff006e', '#8338ec'];
                    return (
                      <Line 
                        key={portfolio.id}
                        type="monotone" 
                        dataKey={portfolio.name} 
                        dot={false} 
                        strokeWidth={3} 
                        stroke={colors[index % colors.length]} 
                        name={portfolio.name}
                        isAnimationActive={true}
                        animationDuration={800}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Time to Recover Chart */}
        {metrics && perfTab==='portfolio' && !compareMode && metrics.timeToRecover && metrics.timeToRecover.length > 0 && (
          <div className="bg-bloomberg-panel border border-bloomberg-border p-4 rounded">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Time to Recover from Drawdowns</h3>
            </div>
            <p className="text-sm text-bloomberg-text-dim mb-3">Shows how long it took the portfolio to recover from each drawdown. Each bar represents a recovery period in months. Lower recovery times indicate better resilience.</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.timeToRecover.map((r, i) => ({
                  recovery: `Recovery ${i + 1}`,
                  months: r.months,
                  date: r.date.slice(0, 7),
                  ongoing: r.ongoing || false
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                  <XAxis dataKey="recovery" stroke="#8b949e" tick={{fill: '#8b949e', fontSize: 11}} />
                  <YAxis label={{ value: 'Months', angle: -90, position: 'insideLeft', style: {fill: '#8b949e', fontSize: 11} }} stroke="#8b949e" tick={{fill: '#8b949e', fontSize: 11}} />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload[0]) return null;
                      const index = parseInt(payload[0].payload.recovery.match(/\d+/)?.[0]) - 1;
                      const recovery = metrics.timeToRecover[index];
                      if (!recovery) return null;
                      return (
                        <div className="bg-bloomberg-panel border border-bloomberg-border p-2 rounded" style={{backgroundColor: '#141b2d', border: '1px solid #1e2a3a', color: '#d4d4d4'}}>
                          <p className="font-semibold text-xs">{`${formatMonthsAsYearsAndMonths(payload[0].value)} (${payload[0].value} months)${recovery.ongoing ? ' (ongoing)' : ''}`}</p>
                          <p className="text-xs text-bloomberg-text-dim">Started: {recovery.date.slice(0, 7)}</p>
                          <p className="text-xs text-bloomberg-text-dim">Recovered: {recovery.recoveryDate.slice(0, 7)}</p>
                          <p className="text-xs text-bloomberg-text-dim">Drawdown: {(recovery.drawdownDepth * 100).toFixed(2)}%</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="months" fill="#00d4aa" isAnimationActive={true} animationDuration={800}>
                    {metrics.timeToRecover.map((r, i) => (
                      <Cell key={i} fill={r.ongoing ? '#ff6b6b' : '#00d4aa'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Portfolio Comparison Time to Recover Chart */}
        {compareMode && comparePortfolios && perfTab==='portfolio' && (
          <div className="bg-bloomberg-panel border border-bloomberg-border p-4 rounded">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Time to Recover Comparison</h3>
            </div>
            <p className="text-sm text-bloomberg-text-dim mb-3">Compare recovery times across selected portfolios. Each bar shows recovery time in months. Red bars indicate ongoing drawdowns. Lower values indicate faster recovery.</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={(() => {
                    // Find max number of recoveries across all portfolios
                    const maxRecoveries = Math.max(...comparePortfolios.map(p => (p.timeToRecover?.length || 0)));
                    const data = [];
                    
                    for(let i = 0; i < maxRecoveries; i++) {
                      const dataPoint = { recovery: `Recovery ${i + 1}` };
                      comparePortfolios.forEach((portfolio) => {
                        if (portfolio.timeToRecover && portfolio.timeToRecover[i]) {
                          dataPoint[portfolio.name] = portfolio.timeToRecover[i].months;
                        }
                      });
                      data.push(dataPoint);
                    }
                    return data;
                  })()}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                  <XAxis dataKey="recovery" stroke="#8b949e" tick={{fill: '#8b949e', fontSize: 11}} />
                  <YAxis label={{ value: 'Months', angle: -90, position: 'insideLeft', style: {fill: '#8b949e', fontSize: 11} }} stroke="#8b949e" tick={{fill: '#8b949e', fontSize: 11}} />
                  <Tooltip formatter={(v) => `${formatMonthsAsYearsAndMonths(v)} (${v} months)`} contentStyle={{backgroundColor: '#141b2d', border: '1px solid #1e2a3a', color: '#d4d4d4'}} />
                  <Legend wrapperStyle={{color: '#d4d4d4'}} />
                  {comparePortfolios.map((portfolio, index) => {
                    const colors = ['#00d4aa', '#00a8ff', '#ff6b6b', '#ffa500', '#9d4edd', '#06ffa5', '#ff006e', '#8338ec'];
                    return (
                      <Bar 
                        key={portfolio.id}
                        dataKey={portfolio.name}
                        fill={colors[index % colors.length]}
                        name={portfolio.name}
                      >
                        {(() => {
                          const portfolioRecoveries = portfolio.timeToRecover || [];
                          return portfolioRecoveries.map((r, i) => (
                            <Cell key={i} fill={r.ongoing ? '#ff6b6b' : colors[index % colors.length]} />
                          ));
                        })()}
                      </Bar>
                    );
                  })}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Rolling N-Year CAGR with min/max + average */}
        {metrics && perfTab==='portfolio' && !compareMode && (
          <div className="bg-bloomberg-panel border border-bloomberg-border p-4 rounded">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Rolling {rollingYears}-Year Buy & Hold (Annualized)</h3>
              <div className="flex gap-2 items-center">
                <input type="number" min={1} max={40} value={rollingYears} onChange={(e)=>setRollingYears(Math.max(1, Number(e.target.value)||10))} className="w-20 border border-bloomberg-border bg-bloomberg-bg text-bloomberg-text rounded p-1" />
                <button onClick={exportRolling} className="p-2 rounded hover:bg-bloomberg-border" title="Download CSV" aria-label="Download CSV">⬇️</button>
              </div>
            </div>
            <p className="text-sm text-bloomberg-text-dim mb-3">Shows annualized returns for any {rollingYears}-year holding period. Red/green dots mark worst/best periods. The gray line shows the average across all periods, helping assess return consistency.</p>
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
          <div className="bg-bloomberg-panel border border-bloomberg-border p-4 rounded">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Rolling 10-Year Returns Comparison</h3>
              <div className="flex gap-2 items-center">
                <input type="number" min={1} max={40} value={rollingYears} onChange={(e)=>setRollingYears(Math.max(1, Number(e.target.value)||10))} className="w-20 border border-bloomberg-border bg-bloomberg-bg text-bloomberg-text rounded p-1" />
              </div>
            </div>
            <p className="text-sm text-bloomberg-text-dim mb-3">Compare rolling returns across selected portfolios for different holding periods.</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={comparePortfolios[0]?.rolling.map((point, index) => {
                  const dataPoint = { date: point.date };
                  comparePortfolios.forEach((portfolio) => {
                    dataPoint[portfolio.name] = (portfolio.rolling[index]?.value || 0) * 100;
                  });
                  return dataPoint;
                }) || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                  <XAxis dataKey="date" tickFormatter={(d)=>d.slice(0,7)} minTickGap={32} stroke="#8b949e" tick={{fill: '#8b949e', fontSize: 11}} />
                  <YAxis tickFormatter={(v)=>v.toFixed(0)+"%"} stroke="#8b949e" tick={{fill: '#8b949e', fontSize: 11}} />
                  <Tooltip formatter={(v)=>v.toFixed(2)+"%"} labelFormatter={(l)=>l.slice(0,10)} contentStyle={{backgroundColor: '#141b2d', border: '1px solid #1e2a3a', color: '#d4d4d4'}} />
                  <ReferenceLine y={0} stroke="#ff6b6b" />
                  <Legend wrapperStyle={{color: '#d4d4d4'}} />
                  {comparePortfolios.map((portfolio, index) => {
                    const colors = ['#00d4aa', '#00a8ff', '#ff6b6b', '#ffa500', '#9d4edd', '#06ffa5', '#ff006e', '#8338ec'];
                    return (
                      <Line 
                        key={portfolio.id}
                        type="monotone" 
                        dataKey={portfolio.name} 
                        dot={false} 
                        strokeWidth={3} 
                        stroke={colors[index % colors.length]} 
                        name={portfolio.name}
                        isAnimationActive={true}
                        animationDuration={800}
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
          <div className="bg-bloomberg-panel border border-bloomberg-border p-4 rounded">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Annual Returns: Nominal vs Real (Italy CPI)</h3>
              <button onClick={exportAnnualReturns} className="p-2 rounded hover:bg-bloomberg-border" title="Download CSV" aria-label="Download CSV">⬇️</button>
            </div>
            <p className="text-sm text-bloomberg-text-dim mb-3">Year-by-year performance comparison. Green bars show nominal returns, blue bars show inflation-adjusted real returns. Highlighted borders mark best/worst performing years.</p>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(metrics.annualNominal||[]).map((r,i)=>({year:r.year, nominal:r.nominal*100, real:(metrics.annualReal[i]?.nominal??0)*100}))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                  <XAxis dataKey="year" stroke="#8b949e" tick={{fill: '#8b949e', fontSize: 11}} />
                  <YAxis tickFormatter={(v)=>v.toFixed(0)+"%"} stroke="#8b949e" tick={{fill: '#8b949e', fontSize: 11}} />
                  <Tooltip formatter={(v)=>Number(v).toFixed(2)+"%"} contentStyle={{backgroundColor: '#141b2d', border: '1px solid #1e2a3a', color: '#d4d4d4'}} />
                  <Legend wrapperStyle={{color: '#d4d4d4'}} />
                  <Bar dataKey="nominal" fill="#00d4aa" isAnimationActive={true} animationDuration={800}>
                    {(metrics.annualNominal||[]).map((r,i)=>{
                      const isMin=i===metrics.annualMinNomIdx, isMax=i===metrics.annualMaxNomIdx;
                      const base=(r.nominal>=0)?"#00d4aa":"#ff6b6b";
                      const stroke=isMin?"#ff6b6b": (isMax?"#00d4aa": undefined);
                      const sw=(isMin||isMax)?2:0;
                      return <Cell key={`n-${i}`} fill={base} stroke={stroke} strokeWidth={sw} />;
                    })}
                  </Bar>
                  <Bar dataKey="real" fill="#00a8ff" isAnimationActive={true} animationDuration={800}>
                    {(metrics.annualReal||[]).map((r,i)=>{
                      const val=(r?.nominal??0);
                      const isMin=i===metrics.annualMinRealIdx, isMax=i===metrics.annualMaxRealIdx;
                      const base=(val>=0)?"#00a8ff":"#ff6b6b";
                      const stroke=isMin?"#ff6b6b": (isMax?"#00a8ff": undefined);
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
          <div className="bg-bloomberg-panel border border-bloomberg-border p-4 rounded">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Annual Returns Comparison</h3>
            </div>
            <p className="text-sm text-bloomberg-text-dim mb-3">Compare year-by-year returns across selected portfolios.</p>
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
                    const colors = ['#00d4aa', '#00a8ff', '#ff6b6b', '#ffa500', '#9d4edd', '#06ffa5', '#ff006e', '#8338ec'];
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
          <div className="bg-bloomberg-panel border border-bloomberg-border p-4 sm:p-6 animate-fade-in rounded">
            <h2 className="text-lg sm:text-xl font-bold mb-4 text-bloomberg-accent uppercase tracking-wide">Performance by Asset</h2>

            {/* Investment Strategy Selector */}
            <div className="mb-6 p-4 bg-bloomberg-bg border border-bloomberg-border rounded">
              <h3 className="text-sm font-semibold mb-3 text-bloomberg-text">Investment Strategy</h3>
              <div className="flex flex-wrap gap-3 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="assetInvestmentMode"
                    value="lump_sum"
                    checked={assetInvestmentMode === "lump_sum"}
                    onChange={(e)=>setAssetInvestmentMode(e.target.value)}
                    className="cursor-pointer"
                  />
                  <span className="text-xs sm:text-sm text-bloomberg-text">Lump Sum</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="assetInvestmentMode"
                    value="recurring"
                    checked={assetInvestmentMode === "recurring"}
                    onChange={(e)=>setAssetInvestmentMode(e.target.value)}
                    className="cursor-pointer"
                  />
                  <span className="text-xs sm:text-sm text-bloomberg-text">Monthly Investment</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="assetInvestmentMode"
                    value="hybrid"
                    checked={assetInvestmentMode === "hybrid"}
                    onChange={(e)=>setAssetInvestmentMode(e.target.value)}
                    className="cursor-pointer"
                  />
                  <span className="text-xs sm:text-sm text-bloomberg-text">Both</span>
                </label>
              </div>
              
              {/* Investment Amount Controls */}
              <div className="flex flex-col sm:flex-row gap-4">
                {(assetInvestmentMode === "lump_sum" || assetInvestmentMode === "hybrid") && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs sm:text-sm text-bloomberg-text-dim">Initial amount:</label>
                    <input 
                      type="number" 
                      step={1000} 
                      value={initial} 
                      onChange={(e)=>setInitial(Number(e.target.value)||0)} 
                      className="border border-bloomberg-border bg-bloomberg-bg text-bloomberg-text rounded p-2 w-32 font-medium text-xs sm:text-sm" 
                      placeholder="100000"
                    />
                    <span className="text-xs sm:text-sm text-bloomberg-text-dim">€</span>
                  </div>
                )}
                {(assetInvestmentMode === "recurring" || assetInvestmentMode === "hybrid") && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs sm:text-sm text-bloomberg-text-dim">Monthly investment:</label>
                    <input 
                      type="number" 
                      step={100} 
                      value={monthlyInvestment} 
                      onChange={(e)=>setMonthlyInvestment(Number(e.target.value)||0)} 
                      className="border border-bloomberg-border bg-bloomberg-bg text-bloomberg-text rounded p-2 w-32 font-medium text-xs sm:text-sm" 
                      placeholder="1000"
                    />
                    <span className="text-xs sm:text-sm text-bloomberg-text-dim">€</span>
                  </div>
                )}
              </div>
            </div>

            {/* Asset Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {assetSummaries.map((s, idx)=> (
                <div key={s.asset} className="bg-bloomberg-bg border border-bloomberg-border p-4 animate-fade-in rounded" style={{animationDelay: `${(idx * 0.1)}s`}}>
                  <div className="text-xs sm:text-sm font-bold text-bloomberg-text truncate" title={s.asset}>{s.asset}</div>
                  <div className="text-[10px] sm:text-xs text-bloomberg-text-dim capitalize mt-1">{getAssetCategory(s.asset)}</div>
                  <div className="text-xs sm:text-sm flex flex-col leading-5 sm:leading-6 mt-2">
                    <span><span className="text-bloomberg-text-dim">CAGR:</span> <span className="font-semibold">{(s.cagr*100).toFixed(2)}%</span></span>
                    <span><span className="text-bloomberg-text-dim">Volatility:</span> <span className="font-semibold">{(s.vol*100).toFixed(2)}%</span></span>
                    <span><span className="text-bloomberg-text-dim">Sharpe:</span> <span className="font-semibold">{s.sharpe.toFixed(2)}</span></span>
                    <span><span className="text-bloomberg-text-dim">Max DD:</span> <span className="font-semibold">{(s.maxDrawdown*100).toFixed(2)}%</span></span>
                    {s.maxTimeToRecover > 0 && (
                      <span><span className="text-bloomberg-text-dim">Max Time to Recover:</span> <span className="font-semibold">{formatMonthsAsYearsAndMonths(s.maxTimeToRecover)} ({s.maxTimeToRecover} months)</span></span>
                    )}
                    <span><span className="text-bloomberg-text-dim">Final Value:</span> <span className="font-semibold">{euroTick(s.finalValue)}</span></span>
                  </div>
                </div>
              ))}
            </div>

            {/* Rolling 10-Year Annualized */}
            <div className="mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                <h3 className="text-xs sm:text-sm font-semibold">Rolling {assetRollingYears}-Year Annualized</h3>
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <label className="text-bloomberg-text-dim">Years:</label>
                  <input type="number" min={1} max={40} value={assetRollingYears} onChange={(e)=>setAssetRollingYears(Math.max(1, Number(e.target.value)||10))} className="w-20 border border-bloomberg-border bg-bloomberg-bg text-bloomberg-text rounded p-1 text-xs" />
                </div>
              </div>
              <div className="h-72 sm:h-80 w-full overflow-x-auto">
                <ResponsiveContainer width="100%" height="100%" minHeight={288}>
                  <LineChart data={perAssetsCombined.rollingData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                    <XAxis dataKey="date" tickFormatter={(d)=>d.slice(0,7)} minTickGap={32} stroke="#8b949e" tick={{fill: '#8b949e', fontSize: 10}} />
                    <YAxis tickFormatter={(v)=>v.toFixed(0)+"%"} stroke="#8b949e" tick={{fill: '#8b949e', fontSize: 10}} />
                    <Tooltip formatter={(v)=>Number(v).toFixed(2)+"%"} labelFormatter={(l)=>l.slice(0,10)} contentStyle={{backgroundColor: '#141b2d', border: '1px solid #1e2a3a', color: '#d4d4d4', fontSize: '11px'}} />
                    <ReferenceLine y={0} stroke="#ff6b6b" />
                    <Legend wrapperStyle={{color: '#d4d4d4', fontSize: '10px'}} />
                    {perAssetsCombined.assets.map((asset, idx)=> {
                      const colors = ['#00d4aa', '#00a8ff', '#ff6b6b', '#ffa500', '#9d4edd', '#06ffa5', '#ff006e', '#8338ec'];
                      return <Line key={asset} type="monotone" dataKey={asset} dot={false} strokeWidth={2} stroke={colors[idx % colors.length]} isAnimationActive={true} animationDuration={800} />;
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Max Drawdowns */}
            <div className="mb-8">
              <h3 className="text-xs sm:text-sm font-semibold mb-2">Max Drawdowns</h3>
              <div className="h-72 sm:h-80 w-full overflow-x-auto">
                <ResponsiveContainer width="100%" height="100%" minHeight={288}>
                  <LineChart data={perAssetsCombined.ddData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                    <XAxis dataKey="date" tickFormatter={(d)=>d.slice(0,7)} minTickGap={32} stroke="#8b949e" tick={{fill: '#8b949e', fontSize: 10}} />
                    <YAxis tickFormatter={(v)=>v.toFixed(0)+"%"} stroke="#8b949e" tick={{fill: '#8b949e', fontSize: 10}} />
                    <Tooltip formatter={(v)=>Number(v).toFixed(2)+"%"} labelFormatter={(l)=>l.slice(0,10)} contentStyle={{backgroundColor: '#141b2d', border: '1px solid #1e2a3a', color: '#d4d4d4', fontSize: '11px'}} />
                    <ReferenceLine y={0} stroke="#8b949e" />
                    <Legend wrapperStyle={{color: '#d4d4d4', fontSize: '10px'}} />
                    {perAssetsCombined.assets.map((asset, idx)=> {
                      const colors = ['#00d4aa', '#00a8ff', '#ff6b6b', '#ffa500', '#9d4edd', '#06ffa5', '#ff006e', '#8338ec'];
                      return <Line key={asset} type="monotone" dataKey={asset} dot={false} strokeWidth={3} stroke={colors[idx % colors.length]} isAnimationActive={true} animationDuration={800} />;
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Time to Recovery from Worst Drawdown */}
            <div className="mb-8">
              <h3 className="text-xs sm:text-sm font-semibold mb-2">Time to Recovery from Worst Drawdown</h3>
              <p className="text-xs text-bloomberg-text-dim mb-3">Shows the time (in months) it took each asset to recover from its worst drawdown period.</p>
              <div className="h-72 sm:h-80 w-full overflow-x-auto">
                <ResponsiveContainer width="100%" height="100%" minHeight={288}>
                  <BarChart 
                    data={assetSummaries.map(s => ({
                      asset: s.asset,
                      months: s.maxTimeToRecover || 0
                    }))}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                    <XAxis type="number" tickFormatter={(v)=>`${v} months`} stroke="#8b949e" tick={{fill: '#8b949e', fontSize: 10}} />
                    <YAxis dataKey="asset" type="category" width={150} stroke="#8b949e" tick={{fill: '#8b949e', fontSize: 9}} />
                    <Tooltip 
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const value = payload[0].value;
                          return (
                            <div style={{
                              backgroundColor: '#141b2d',
                              border: '1px solid #1e2a3a',
                              padding: '8px',
                              borderRadius: '4px',
                              fontSize: '11px'
                            }}>
                              <p style={{ color: '#ffffff', margin: '0 0 4px 0', fontWeight: 'bold' }}>{label}</p>
                              <p style={{ color: '#d4d4d4', margin: 0 }}>
                                {`${formatMonthsAsYearsAndMonths(value)} (${value} months)`}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="months" radius={[0, 4, 4, 0]}>
                      {assetSummaries.map((s, idx) => {
                        const colors = ['#00d4aa', '#00a8ff', '#ff6b6b', '#ffa500', '#9d4edd', '#06ffa5', '#ff006e', '#8338ec'];
                        return <Cell key={s.asset} fill={colors[idx % colors.length]} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Annual Returns */}
            <div>
              <h3 className="text-xs sm:text-sm font-semibold mb-2">Annual Returns</h3>
              <div className="h-80 sm:h-96 w-full overflow-x-auto">
                <ResponsiveContainer width="100%" height="100%" minHeight={320}>
                  <BarChart data={perAssetsCombined.annualData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                    <XAxis dataKey="year" stroke="#8b949e" tick={{fill: '#8b949e', fontSize: 10}} />
                    <YAxis tickFormatter={(v)=>v.toFixed(0)+"%"} stroke="#8b949e" tick={{fill: '#8b949e', fontSize: 10}} />
                    <Tooltip formatter={(v)=>Number(v).toFixed(2)+"%"} contentStyle={{backgroundColor: '#141b2d', border: '1px solid #1e2a3a', color: '#d4d4d4', fontSize: '11px'}} />
                    <Legend wrapperStyle={{color: '#d4d4d4', fontSize: '10px'}} />
                    {perAssetsCombined.assets.map((asset, idx)=> {
                      const colors = ['#00d4aa', '#00a8ff', '#ff6b6b', '#ffa500', '#9d4edd', '#06ffa5', '#ff006e', '#8338ec'];
                      return <Bar key={asset} dataKey={asset} fill={colors[idx % colors.length]} isAnimationActive={true} animationDuration={800} />;
                    })}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        )}

        {/* Toast Notification */}
        {showToast && (
          <div className="fixed top-4 right-4 bg-bloomberg-accent text-bloomberg-bg px-6 py-3 border border-bloomberg-accent z-50 flex items-center gap-2 font-mono text-xs uppercase tracking-wide animate-slide-in-right">
            <span>✓</span>
            <span>URL COPIED!</span>
          </div>
        )}

      </div>
    </div>
    </>
  );
}
