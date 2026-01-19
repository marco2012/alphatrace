"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ModeToggle } from "@/components/mode-toggle";
import { Input } from "@/components/ui/input";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";
import { usePortfolio } from "@/context/portfolio-context";
import { Switch } from "@/components/ui/switch";
import { Globe, Database } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CodeBlock } from "@/components/shared/code-block";

import { cn } from "@/lib/utils";

const DATA_SOURCES = {
    msci: {
        title: "MSCI Indexes",
        description: "Data for various MSCI regional and factor indexes.",
        url: "https://www.msci.com/indexes#featured-indexes",
        details: "Total Return (TR) indexes are used where available, with annual TER deducted at processing time."
    },
    managedFutures: {
        title: "Managed Futures",
        description: "Data for iMGP DBi Managed Futures Fund (DBMF) proxy. Calculated using public/code/imgp_dbi_backtest_generator.py.",
        url: "https://www.rcmalternatives.com/fund/sg-cta-index-societe-generale-newedge-uk-limited/",
        code: `#!/usr/bin/env python3
import pandas as pd
import numpy as np
import requests
from io import StringIO
import json

# SG_CTA_INDEX_DATA = [...] (Data truncated for brevity)

def fetch_yahoo_finance_data(ticker='DBMF', start_date='2019-05-08'):
    try:
        start_ts = int(pd.to_datetime(start_date).timestamp())
        end_ts = int(pd.to_datetime('today').timestamp())
        url = f"https://query2.finance.yahoo.com/v8/finance/chart/{ticker}"
        params = {'period1': start_ts, 'period2': end_ts, 'interval': '1d', 'events': 'history', 'includeAdjustedClose': 'true'}
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, params=params, headers=headers, timeout=30)
        if response.status_code == 200:
            data = response.json()
            chart = data['chart']['result'][0]
            df = pd.DataFrame({'Date': pd.to_datetime(chart['timestamp'], unit='s'), 'Adj Close': chart['indicators']['adjclose'][0]['adjclose']})
            return df.dropna()
        return None
    except Exception as e:
        print(f"✗ Yahoo Finance error: {e}")
        return None

def generate_backtest_data(output_file='imgp_dbi_base100.csv'):
    df_proxy = pd.DataFrame(SG_CTA_INDEX_DATA)
    df_proxy['Date'] = pd.to_datetime(df_proxy['date'])
    df_proxy['Index_Value_USD'] = df_proxy['value']
    dbmf_launch = pd.to_datetime('2019-05-08')
    df_proxy = df_proxy[df_proxy['Date'] < dbmf_launch].copy()

    df_dbmf_raw = fetch_yahoo_finance_data('DBMF', '2019-05-08')
    if df_dbmf_raw is not None:
        df_dbmf_raw['YearMonth'] = df_dbmf_raw['Date'].dt.to_period('M')
        df_dbmf_monthly = df_dbmf_raw.groupby('YearMonth').agg({'Date': 'last', 'Adj Close': 'last'}).reset_index(drop=True)
        scaling = df_proxy.iloc[-1]['Index_Value_USD'] / df_dbmf_monthly.iloc[0]['Adj Close']
        df_dbmf_monthly['Index_Value_USD'] = df_dbmf_monthly['Adj Close'] * scaling
        df_dbmf = df_dbmf_monthly[['Date', 'Index_Value_USD']]
        df_combined = pd.concat([df_proxy[['Date', 'Index_Value_USD']], df_dbmf], ignore_index=True)
    else:
        df_combined = df_proxy[['Date', 'Index_Value_USD']].copy()

    df_combined = df_combined.sort_values('Date').reset_index(drop=True)
    # FX Conversion and Rebasing logic...
    return df_combined`
    },
    dfaGlobal: {
        title: "DFA Funds",
        description: "Data for DGEIX (US Core Equity I) and DFEMX (Emerging Markets). Calculated using public/code/dgex.py.",
        url: "https://finance.yahoo.com/quote/DGEIX/",
        url2: "https://finance.yahoo.com/quote/DFEMX/",
        code: `import yfinance as yf
import pandas as pd
from datetime import datetime

def download_scaled_proxy():
    fund_ticker = "DGEIX"      
    currency_ticker = "EURUSD=X"
    start_date = "1990-01-01"
    current_date = datetime.now().strftime("%Y-%m-%d")

    # auto_adjust=True gets the Total Return (dividends reinvested)
    fund_data = yf.download(fund_ticker, start=start_date, end=current_date, interval="1mo", auto_adjust=True)
    curr_data = yf.download(currency_ticker, start=start_date, end=current_date, interval="1mo", auto_adjust=False)

    df_fund = fund_data[['Close']].dropna()
    df_fund.columns = ['Price_USD']
    df_curr = curr_data[['Close']].resample('M').last().dropna()
    df_curr.columns = ['USD_per_EUR']

    df_fund.index = df_fund.index.to_period('M').to_timestamp('M')
    df_curr.index = df_curr.index.to_period('M').to_timestamp('M')

    merged = pd.merge(df_fund, df_curr, left_index=True, right_index=True, how='inner')
    merged['Price_EUR'] = merged['Price_USD'] / merged['USD_per_EUR']

    merged['Scaled_USD'] = (merged['Price_USD'] / merged['Price_USD'].iloc[0]) * 100
    merged['Scaled_EUR'] = (merged['Price_EUR'] / merged['Price_EUR'].iloc[0]) * 100
    
    return merged[['Scaled_USD', 'Scaled_EUR']]`
    },
    ntsg: {
        title: "WisdomTree Global Efficient Core (NTSG)",
        description: "Proxy calculation for 90/60 Global Efficient Core strategy. Calculated using public/code/backtest_ntsg_proxy_msci.py.",
        code: `#!/usr/bin/env python3
# Equity: 90% MSCI World
# Bonds: 60% global treasury proxy (US 10Y)

import pandas as pd
import numpy as np

# Load MSCI World from local Excel...
world_m = msci_world.resample('ME').last()
global_equity_ret = world_m['MSCI World Index'].pct_change()

# Align all data to monthly
data = pd.concat([global_equity_ret, treasury, tbill, usdeur], axis=1).dropna()
data.columns = ['equity', 'yield', 'rate', 'fx']

# Bond Returns ≈ price return from yield change + income
yield_chg = data['yield'].diff() / 100
bond_ret = -7.0 * yield_chg + (data['yield'].shift(1) / 100 / 12)

# Borrowing cost
cash_cost = data['rate'] / 100 / 12

# NTSG: 90% equity + 60% bonds - 50% borrowing cost
ntsg_ret = (0.90 * data['equity'] + 0.60 * bond_ret - 0.50 * cash_cost)

results['90_60_USD'] = 100 * (1 + ntsg_ret).cumprod()
results['90_60_EUR'] = results['90_60_USD'] / data['fx']`
    },
    gold: {
        title: "Gold",
        description: "Historical gold prices.",
        url: "https://www.macrotrends.net/1333/historical-gold-prices-100-year-chart"
    },
    eurBonds: {
        title: "EUR Government Bonds 10y",
        description: "Synthetic and ETF-based backtest for Eurozone government bonds.",
        url: "https://fred.stlouisfed.org/series/IRLTLT01DEM156N",
        url2: "https://www.ishares.com/it/investitore-privato/it/prodotti/251739/",
        details: "Prior to the launch of the iShares Italy Govt Bond ETF (SXRQ.DE), performance is estimated using 10-Year German Government Bond yields with a constant duration of 8.2 years.",
        code: `def get_eur_bonds_10y_portfolio(start_date="1980-01-01"):
    etf_ticker = "SXRQ.DE"
    duration = 8.2
    
    # 1. Synthetic Bond (Yield-Derived from German 10Y)
    yields = get_fred_series_raw("IRLTLT01DEM156N", "Yield")
    yields_m = yields.resample('ME').last()
    
    # Total Return ≈ (Yield / 12) + (-Duration * ΔYield)
    total_return = (yields_m.shift(1) / 12) + (-duration * yields_m.diff())
    syn_index = 100 * (1 + total_return).cumprod()
    
    # 2. Actual ETF Data (iShares Italy Govt Bond)
    etf_data = yf.download(etf_ticker, period="max", auto_adjust=True)
    # Splicing logic...
    return history_eur`
    },
    usAssets: {
        title: "US Benchmarks & Stocks",
        description: "Market data for major US indexes and specific companies.",
        details: "Daily historical data sourced directly from Yahoo Finance.",
        items: [
            { name: "S&P 500 Total Return", ticker: "^SP500TR", url: "https://finance.yahoo.com/quote/%5ESP500TR/" },
            { name: "Berkshire Hathaway (Class B)", ticker: "BRK-B", url: "https://finance.yahoo.com/quote/BRK-B/" },
            { name: "Nasdaq TR (QQQ Proxy)", ticker: "QQQ", url: "https://finance.yahoo.com/quote/QQQ/" }
        ]
    },
    cash: {
        title: "Cash",
        description: "Calculated using market benchmark rates.",
        url: "https://fred.stlouisfed.org/series/IR3TIB01EZM156N",
        url2: "https://fred.stlouisfed.org/series/DTB3"
    },
    commodities: {
        title: "Commodities",
        description: "Broad commodity market data and enhanced strategy proxies.",
        items: [
            { name: "Bloomberg Commodity Index", ticker: "^BCOM", url: "https://finance.yahoo.com/quote/%5EBCOM/" },
            { name: "L&G Multi-Strategy Enhanced Commodities", details: "Spliced ^SPGSCI (pre-2006) and DBC (post-2006) to simulate long-term performance." },
            { name: "WisdomTree Enhanced Commodity", details: "Bloomberg Commodity Index (enhanced with 1.5% annual alpha proxy) spliced with WCOA.L ETF (2016+)." },
            { name: "Bloomberg Roll Select Commodity", details: "3-Phase Splice: ^SPGSCI (pre-2012), ^BCOM (2012-2018), and CMDY (post-2018)." },
            { name: "UBS CMCI Composite Commodity", details: "Hierarchical Splicing: ^SPGSCI (Proxy) -> ^CMCIER (Index) -> UC14.L (ETF)." }
        ],
        code: `# 1. Bloomberg Commodity Index (^BCOM)
# Retrieved directly from Yahoo Finance (1mo interval)

# 2. L&G Multi-Strategy Enhanced Commodities
# Splicing Logic: ^SPGSCI (pre-2006) + DBC (post-2006)
cond_early = returns.index < '2006-02-06'
strat_ret = np.where(cond_early, returns['^SPGSCI'], returns['DBC'])

# 3. WisdomTree Enhanced Commodity
# Alpha Enhancement: 1.5% annual alpha added to BCOM proxy
monthly_alpha = (1.015)**(1/12) - 1
proxy_rets_enhanced = bcom_rets + monthly_alpha
# Stitching: Proxy (pre-2016) + WCOA.L ETF (post-2016)
combined_rets = pd.concat([proxy_rets_enhanced, etf_rets])

# 4. Bloomberg Roll Select Commodity
# 3-Phase Splice:
# 1991-2012: S&P GSCI (^SPGSCI)
# 2012-2018: Bloomberg Commodity Index (^BCOM)
# 2018-Pres: iShares Bloomberg Roll Select (CMDY)
conditions = [
    returns.index < '2012-06-01',
    (returns.index >= '2012-06-01') & (returns.index < '2018-04-03'),
    returns.index >= '2018-04-03'
]
choices = [returns['^SPGSCI'], returns['^BCOM'], returns['CMDY']]
synthetic_returns = np.select(conditions, choices, default=0)

# 5. UBS CMCI Composite Commodity
# Prioritized Splicing (Daily resolution):
# Base: ^SPGSCI (Proxy)
# Overwrite with ^CMCIER (Index) where available
# Overwrite with UC14.L (ETF) where available
combined_rets = proxy_returns.copy()
combined_rets.loc[index_common] = index_returns.loc[index_common]
combined_rets.loc[etf_common] = etf_returns.loc[etf_common]`,
        fullCodeLG: `import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime

def run_long_term_backtest():
    # ^SPGSCI: S&P GSCI Index (Standard proxy for 90s commodities)
    # DBC: Invesco DB Commodity Index (Smart-beta proxy for modern era)
    tickers = ['^SPGSCI', 'DBC']
    start_date = '1991-01-01'
    switch_date = '2006-02-06' # Switch from raw Index to ETF
    
    data = yf.download(tickers, start=start_date, interval="1d")
    df = data['Close']
    returns = df.pct_change()
    
    cond_early = returns.index < switch_date
    strat_ret = np.where(cond_early, returns['^SPGSCI'], returns['DBC'])
    
    strat_series = pd.Series(strat_ret, index=returns.index).fillna(0)
    usd_index = 100 * (1 + strat_series).cumprod()
    
    # Resample to Monthly
    monthly_data = usd_index.resample('ME').last()
    return monthly_data`,
        fullCodeWT: `import yfinance as yf
import pandas as pd
import numpy as np

def get_enhanced_commodity():
    # 1. BCOM Proxy (1991-2016)
    bcom = yf.download("^BCOM", start="1991-01-01", interval="1mo")['Close']
    bcom_rets = bcom.pct_change()
    
    # 2. Apply 1.5% Annual Alpha Enhancement
    monthly_alpha = (1.015)**(1/12) - 1
    proxy_enhanced = bcom_rets + monthly_alpha
    
    # 3. Actual ETF (WCOA.L) 2016-Present
    etf = yf.download("WCOA.L", start="2016-05-01", interval="1mo")['Close']
    etf_rets = etf.pct_change()
    
    # 4. Stitching
    etf_start = etf_rets.index[0]
    combined = pd.concat([proxy_enhanced[proxy_enhanced.index < etf_start], etf_rets])
    
    usd_index = 100 * (1 + combined).cumprod()
    return usd_index`,
        fullCodeRollSelect: `import yfinance as yf
import pandas as pd
import numpy as np

def backtest_bloomberg_roll_select():
    ticker_early = '^SPGSCI'    # 1991-2012
    ticker_mid = '^BCOM'        # 2012-2018
    ticker_modern = 'CMDY'      # 2018-Present
    
    data = yf.download([ticker_early, ticker_mid, ticker_modern], start='1991-01-01', interval="1d")
    returns = data['Close'].pct_change()
    
    conditions = [
        returns.index < '2012-06-01',
        (returns.index >= '2012-06-01') & (returns.index < '2018-04-03'),
        returns.index >= '2018-04-03'
    ]
    choices = [returns[ticker_early], returns[ticker_mid], returns[ticker_modern]]
    synthetic_returns = np.select(conditions, choices, default=0)
    
    strat_series = pd.Series(synthetic_returns, index=returns.index).fillna(0)
    usd_index = 100 * (1 + strat_series).cumprod()
    
    monthly = usd_index.resample('ME').last()
    return monthly`,
        fullCodeUBS: `import yfinance as yf
import pandas as pd
import numpy as np

def get_ubs_cmci():
    tickers = ["UC14.L", "^CMCIER", "^SPGSCI"]
    data = yf.download(tickers, start="1991-01-01", interval="1d")['Close']
    returns = data.pct_change()
    
    # Priority Overwrite Splicing
    combined = returns['^SPGSCI'].copy()
    
    # Overwrite with Index if available
    idx_rets = returns['^CMCIER'].dropna()
    common_idx = combined.index.intersection(idx_rets.index)
    combined.loc[common_idx] = idx_rets.loc[common_idx]
    
    # Overwrite with ETF if available
    etf_rets = returns['UC14.L'].dropna()
    common_etf = combined.index.intersection(etf_rets.index)
    combined.loc[common_etf] = etf_rets.loc[common_etf]
    
    combined = combined.fillna(0)
    usd_index = 100 * (1 + combined).cumprod()
    
    monthly = usd_index.resample('ME').last()
    return monthly`
    }
};

export function SettingsPanel() {
    const { currency, setCurrency } = usePortfolio();
    const [riskFreeRate, setRiskFreeRate] = useState("0.02");

    useEffect(() => {
        const savedRate = localStorage.getItem("alphatrace_risk_free_rate");
        if (savedRate) setRiskFreeRate(savedRate);
    }, []);

    const handleRiskFreeRateChange = (value: string) => {
        const num = parseFloat(value);
        if (!isNaN(num) && num >= 0 && num <= 1) {
            setRiskFreeRate(value);
            localStorage.setItem("alphatrace_risk_free_rate", value);
            toast.success("Risk-free rate updated");
        } else {
            toast.error("Risk-free rate must be between 0 and 1");
        }
    };

    return (
        <div className="flex flex-col gap-6 pb-8">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Settings2 className="h-4 w-4 text-muted-foreground" />
                        <CardTitle>Appearance</CardTitle>
                    </div>
                    <CardDescription>Customize the look and feel.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label>Theme</Label>
                        <ModeToggle />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Financial Settings</CardTitle>
                    <CardDescription>Configure calculation parameters.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Risk-Free Rate</Label>
                        <Input
                            type="number"
                            step="0.001"
                            min="0"
                            max="1"
                            value={riskFreeRate}
                            onChange={(e) => handleRiskFreeRateChange(e.target.value)}
                            placeholder="0.02"
                        />
                        <div className="text-xs text-muted-foreground">
                            Annual risk-free rate (e.g., 0.02 for 2%)
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t">
                        <div className="space-y-0.5">
                            <Label className="flex items-center gap-2">
                                <Globe className="h-4 w-4 text-muted-foreground" />
                                Base Currency
                            </Label>
                            <div className="text-xs text-muted-foreground">
                                Select between EUR and USD for asset data.
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={cn("text-xs font-medium", currency === "EUR" ? "text-primary" : "text-muted-foreground")}>EUR</span>
                            <Switch
                                checked={currency === "USD"}
                                onCheckedChange={(checked) => setCurrency(checked ? "USD" : "EUR")}
                            />
                            <span className={cn("text-xs font-medium", currency === "USD" ? "text-primary" : "text-muted-foreground")}>USD</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-muted-foreground" />
                        <CardTitle>Data Sources</CardTitle>
                    </div>
                    <CardDescription>Documentation and origins of the financial data.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="msci">
                            <AccordionTrigger>{DATA_SOURCES.msci.title}</AccordionTrigger>
                            <AccordionContent>
                                <p className="mb-2">{DATA_SOURCES.msci.description}</p>
                                <a href={DATA_SOURCES.msci.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline break-all">
                                    {DATA_SOURCES.msci.url}
                                </a>
                                <p className="mt-2 text-xs text-muted-foreground italic">{DATA_SOURCES.msci.details}</p>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="futures">
                            <AccordionTrigger>{DATA_SOURCES.managedFutures.title}</AccordionTrigger>
                            <AccordionContent>
                                <p className="mb-2">{DATA_SOURCES.managedFutures.description}</p>
                                <div className="space-y-1 mb-2">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Original Index Data:</p>
                                    <a href={DATA_SOURCES.managedFutures.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline break-all">
                                        {DATA_SOURCES.managedFutures.url}
                                    </a>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Backtest Generator Logic:</p>
                                    <CodeBlock code={DATA_SOURCES.managedFutures.code!} />
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="dfa">
                            <AccordionTrigger>{DATA_SOURCES.dfaGlobal.title}</AccordionTrigger>
                            <AccordionContent>
                                <p className="mb-2">{DATA_SOURCES.dfaGlobal.description}</p>
                                <div className="flex flex-col gap-1 mb-2">
                                    <a href={DATA_SOURCES.dfaGlobal.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline break-all">
                                        {DATA_SOURCES.dfaGlobal.url}
                                    </a>
                                    <a href={DATA_SOURCES.dfaGlobal.url2} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline break-all">
                                        {DATA_SOURCES.dfaGlobal.url2}
                                    </a>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Proxy Calculation Logic:</p>
                                    <CodeBlock code={DATA_SOURCES.dfaGlobal.code!} />
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="ntsg">
                            <AccordionTrigger>{DATA_SOURCES.ntsg.title}</AccordionTrigger>
                            <AccordionContent>
                                <p className="mb-2">{DATA_SOURCES.ntsg.description}</p>
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">90/60 Replication Logic:</p>
                                    <CodeBlock code={DATA_SOURCES.ntsg.code!} />
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="gold">
                            <AccordionTrigger>{DATA_SOURCES.gold.title}</AccordionTrigger>
                            <AccordionContent>
                                <p className="mb-2">{DATA_SOURCES.gold.description}</p>
                                <a href={DATA_SOURCES.gold.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline break-all">
                                    {DATA_SOURCES.gold.url}
                                </a>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="eur-bonds">
                            <AccordionTrigger>{DATA_SOURCES.eurBonds.title}</AccordionTrigger>
                            <AccordionContent>
                                <p className="mb-2">{DATA_SOURCES.eurBonds.description}</p>
                                <div className="flex flex-col gap-1 mb-2">
                                    <a href={DATA_SOURCES.eurBonds.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline break-all">
                                        {DATA_SOURCES.eurBonds.url} (Yield Data)
                                    </a>
                                    <a href={DATA_SOURCES.eurBonds.url2} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline break-all">
                                        {DATA_SOURCES.eurBonds.url2} (ETF Data)
                                    </a>
                                </div>
                                <p className="mt-2 text-xs text-muted-foreground italic mb-2">{DATA_SOURCES.eurBonds.details}</p>
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Return Calculation:</p>
                                    <CodeBlock code={DATA_SOURCES.eurBonds.code!} />
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="us-assets">
                            <AccordionTrigger>{DATA_SOURCES.usAssets.title}</AccordionTrigger>
                            <AccordionContent>
                                <p className="mb-2">{DATA_SOURCES.usAssets.description}</p>
                                <div className="space-y-2 mt-2">
                                    {DATA_SOURCES.usAssets.items.map((item) => (
                                        <div key={item.ticker} className="flex flex-col">
                                            <span className="text-xs font-semibold">{item.name} ({item.ticker})</span>
                                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline break-all">
                                                {item.url}
                                            </a>
                                        </div>
                                    ))}
                                </div>
                                <p className="mt-2 text-xs text-muted-foreground italic">{DATA_SOURCES.usAssets.details}</p>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="cash">
                            <AccordionTrigger>{DATA_SOURCES.cash.title}</AccordionTrigger>
                            <AccordionContent>
                                <p className="mb-2">{DATA_SOURCES.cash.description}</p>
                                <div className="flex flex-col gap-1">
                                    <a href={DATA_SOURCES.cash.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline break-all">
                                        {DATA_SOURCES.cash.url}
                                    </a>
                                    <a href={DATA_SOURCES.cash.url2} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline break-all">
                                        {DATA_SOURCES.cash.url2}
                                    </a>
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="commodities">
                            <AccordionTrigger>{DATA_SOURCES.commodities.title}</AccordionTrigger>
                            <AccordionContent>
                                <p className="mb-2">{DATA_SOURCES.commodities.description}</p>
                                <div className="space-y-3 mb-4 mt-2">
                                    {DATA_SOURCES.commodities.items.map((item, idx) => (
                                        <div key={idx} className="flex flex-col">
                                            <span className="text-xs font-semibold">{item.name} {item.ticker ? `(${item.ticker})` : ""}</span>
                                            {item.url && (
                                                <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline break-all">
                                                    {item.url}
                                                </a>
                                            )}
                                            {item.details && (
                                                <p className="text-[10px] text-muted-foreground italic">{item.details}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Replication & Enhancement Logic:</p>
                                    <CodeBlock code={DATA_SOURCES.commodities.code!} />
                                </div>
                                <div className="mt-4">
                                    <Accordion type="single" collapsible className="w-full border rounded-md px-3 bg-muted/30">
                                        <AccordionItem value="full-scripts" className="border-b-0">
                                            <AccordionTrigger className="py-2 text-[10px] uppercase font-bold text-muted-foreground hover:no-underline">
                                                Show Full Scripts
                                            </AccordionTrigger>
                                            <AccordionContent className="pt-2 pb-4 space-y-4">
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-bold">L&G Multi-Strategy Full Script:</p>
                                                    <CodeBlock code={DATA_SOURCES.commodities.fullCodeLG!} />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-bold">WisdomTree Enhanced Full Script:</p>
                                                    <CodeBlock code={DATA_SOURCES.commodities.fullCodeWT!} />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-bold">Bloomberg Roll Select Full Script:</p>
                                                    <CodeBlock code={DATA_SOURCES.commodities.fullCodeRollSelect!} />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-bold">UBS CMCI Composite Full Script:</p>
                                                    <CodeBlock code={DATA_SOURCES.commodities.fullCodeUBS!} />
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    </Accordion>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
            </Card>
        </div>
    );
}
