import yfinance as yf
import pandas as pd
import numpy as np

def get_monthly_proxy_data(start_year=1991):
    """
    Downloads monthly BCOM data. If missing/short, generates synthetic monthly
    returns from known annual history to ensure 1991 start.
    """
    print(f"Fetching monthly proxy data from {start_year}...")
    
    # 1. Try Yahoo Download (Monthly)
    try:
        df = yf.download("^BCOM", start=f"{start_year}-01-01", interval="1mo", progress=False)
        # Handle formatting (multi-index columns in recent yfinance versions)
        if isinstance(df.columns, pd.MultiIndex):
            prices = df['Close'].iloc[:, 0]
        else:
            prices = df['Close']
            
        # Calculate Returns
        monthly_rets = prices.pct_change().dropna()
        
        # Check if data actually goes back to start_year
        if monthly_rets.empty or monthly_rets.index[0].year > start_year + 1:
            print(f"  > Download too short (starts {monthly_rets.index[0].year}). Generating synthetic history for 1991-2016...")
            return generate_synthetic_monthly_history(start_year)
        
        return monthly_rets

    except Exception as e:
        print(f"  > Download failed ({e}). Using synthetic history.")
        return generate_synthetic_monthly_history(start_year)

def generate_synthetic_monthly_history(start_year):
    """
    Creates monthly returns based on BCOM annual historical performance.
    Used as fallback when direct download is unavailable for 90s.
    """
    # Annual BCOM Returns (1991-2015)
    annual_map = {
        1991: -0.057, 1992: 0.032, 1993: -0.019, 1994: 0.116, 1995: 0.058,
        1996: 0.233, 1997: -0.076, 1998: -0.270, 1999: 0.120, 2000: 0.318,
        2001: -0.195, 2002: 0.250, 2003: 0.239, 2004: 0.091, 2005: 0.214,
        2006: -0.151, 2007: 0.162, 2008: -0.356, 2009: 0.189, 2010: 0.168,
        2011: -0.133, 2012: -0.011, 2013: -0.095, 2014: -0.170, 2015: -0.247
    }
    
    dates = pd.date_range(start=f"{start_year}-01-01", end="2016-04-01", freq='MS')
    synthetic_rets = []
    
    for date in dates:
        year_ret = annual_map.get(date.year, 0.0)
        # Convert annual return to monthly geometric mean: (1+r)^(1/12) - 1
        monthly_ret = (1 + year_ret)**(1/12) - 1
        synthetic_rets.append(monthly_ret)
        
    return pd.Series(data=synthetic_rets, index=dates)

def get_etf_monthly():
    """Fetches actual ETF data (WCOA.L) 2016-Present"""
    print("Fetching ETF data (2016-Present)...")
    df = yf.download("WCOA.L", start="2016-05-01", interval="1mo", progress=False)
    
    if isinstance(df.columns, pd.MultiIndex):
        prices = df['Close'].iloc[:, 0]
    else:
        prices = df['Close']
        
    return prices.pct_change().dropna()

def get_fx_monthly(start_year):
    """Fetches EURUSD monthly rates"""
    print("Fetching EUR/USD exchange rates...")
    df = yf.download("EURUSD=X", start=f"{start_year}-01-01", interval="1mo", progress=False)
    
    if isinstance(df.columns, pd.MultiIndex):
        rates = df['Close'].iloc[:, 0]
    else:
        rates = df['Close']
        
    return rates

def run():
    start_year = 1991
    capital = 10000
    
    # 1. Get Data Streams
    proxy_rets = get_monthly_proxy_data(start_year)
    etf_rets = get_etf_monthly()
    fx_rates = get_fx_monthly(start_year)
    
    # 2. Apply Enhancement to Proxy (1991-2016)
    # 1.5% Annual Alpha -> ~0.124% Monthly
    monthly_alpha = (1.015)**(1/12) - 1
    proxy_rets_enhanced = proxy_rets + monthly_alpha
    
    # 3. Stitch Returns
    # Cut proxy at ETF start
    etf_start_date = etf_rets.index[0]
    proxy_rets_enhanced = proxy_rets_enhanced[proxy_rets_enhanced.index < etf_start_date]
    
    # Combine
    combined_rets = pd.concat([proxy_rets_enhanced, etf_rets])
    
    # 4. Calculate USD Value
    # (1 + r).cumprod()
    usd_curve = capital * (1 + combined_rets).cumprod()
    
    # 5. Create DataFrame & Convert to EUR
    df_out = pd.DataFrame(index=usd_curve.index)
    df_out['USD_Value'] = usd_curve
    
    # Align FX rates (resample/ffill to match portfolio dates)
    aligned_fx = fx_rates.reindex(df_out.index, method='ffill')
    
    # If FX data is missing for early 90s (possible), fill with a static estimate or backfill
    # 1991-1998 EUR didn't exist (use ECU proxy or backfilled ~1.1-1.3 range)
    # Yahoo often lacks EUR=X before 2003. We fill nan with 1.18 (long term avg) or backfill.
    if aligned_fx.isnull().any():
        print("  > Note: Backfilling missing FX rates for pre-Euro era (approximate).")
        aligned_fx = aligned_fx.fillna(method='bfill').fillna(1.18)

    # Convert: USD_Value / (USD per EUR) 
    # Ticker EURUSD=X is 1 EUR = x USD. So to get EUR: USD / Rate.
    df_out['EUR_Value'] = df_out['USD_Value'] / aligned_fx
    
    # 6. Save
    output_file = "monthly_data_1991.csv"
    
    # formatting for CSV (round to 2 decimals)
    df_out['USD_Value'] = df_out['USD_Value'].round(2)
    df_out['EUR_Value'] = df_out['EUR_Value'].round(2)
    
    df_out.to_csv(output_file)
    print("="*40)
    print(f"Done. Saved {len(df_out)} monthly rows to '{output_file}'")
    print(df_out.head())
    print("...")
    print(df_out.tail())

if __name__ == "__main__":
    run()
