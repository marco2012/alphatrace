import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime

def backtest_bloomberg_roll_select():
    print("=" * 60)
    print("Bloomberg Roll Select Commodity Index Backtest (1991-Present)")
    print("=" * 60)
    
    # Configuration
    # Three-phase proxy approach:
    ticker_early = '^SPGSCI'    # 1991-2012: S&P GSCI (Standard Index)
    ticker_mid = '^BCOM'        # 2012-2018: Bloomberg Commodity Index (Pre-ETF era)
    ticker_modern = 'CMDY'      # 2018-Present: Actual Roll Select ETF
    ticker_fx = 'EURUSD=X'      # Currency conversion
    
    # Switch dates
    switch_date_1 = '2012-06-01'  # When Bloomberg Roll Select was introduced
    switch_date_2 = '2018-04-03'  # CMDY launch date
    
    start_date = '1991-01-01'
    end_date = datetime.now().strftime('%Y-%m-%d')
    
    # Download data
    print(f"\nDownloading data for: {[ticker_early, ticker_mid, ticker_modern, ticker_fx]}")
    try:
        data = yf.download(
            [ticker_early, ticker_mid, ticker_modern, ticker_fx], 
            start=start_date, 
            end=end_date, 
            auto_adjust=False,
            progress=True
        )
        
        # Handle column structure
        if isinstance(data.columns, pd.MultiIndex):
            if 'Adj Close' in data.columns.get_level_values(0):
                df = data['Adj Close']
            else:
                df = data['Close']
        else:
            df = data
            
    except Exception as e:
        print(f"Error downloading data: {e}")
        return
    
    # Clean data
    print("Processing data...")
    
    # Forward fill FX gaps
    df[ticker_fx] = df[ticker_fx].fillna(method='ffill')
    
    # Calculate returns
    returns = df.pct_change()
    
    # Build synthetic strategy using 3-phase splicing
    # Phase 1: Before 2012 -> Use GSCI
    # Phase 2: 2012-2018 -> Use Bloomberg Commodity Index
    # Phase 3: After 2018 -> Use CMDY (actual Roll Select ETF)
    
    conditions = [
        returns.index < switch_date_1,
        (returns.index >= switch_date_1) & (returns.index < switch_date_2),
        returns.index >= switch_date_2
    ]
    
    choices = [
        returns[ticker_early],
        returns[ticker_mid],
        returns[ticker_modern]
    ]
    
    synthetic_returns = np.select(conditions, choices, default=0)
    
    # Create series and handle NaN
    strat_series = pd.Series(synthetic_returns, index=returns.index)
    strat_series = strat_series.fillna(0)
    
    # Build USD Index (Base 100)
    usd_index = 100 * (1 + strat_series).cumprod()
    
    # Build EUR Index
    eur_rate = df[ticker_fx]
    eur_index_raw = usd_index / eur_rate
    
    # Rebase EUR to 100 at first valid date
    first_valid_eur = eur_index_raw.first_valid_index()
    if first_valid_eur:
        eur_index = 100 * (eur_index_raw / eur_index_raw.loc[first_valid_eur])
    else:
        eur_index = eur_index_raw
    
    # Combine into DataFrame
    output = pd.DataFrame({
        'USD_Price': usd_index,
        'EUR_Price': eur_index
    })
    
    # Resample to monthly (last day of month)
    try:
        monthly = output.resample('ME').last()  # Pandas 2.2+
    except:
        monthly = output.resample('M').last()   # Older pandas
    
    monthly = monthly.round(2)
    
    # Calculate performance metrics
    total_years = (monthly.index[-1] - monthly.index[0]).days / 365.25
    final_usd = monthly['USD_Price'].iloc[-1]
    cagr_usd = (final_usd / 100) ** (1 / total_years) - 1
    
    # Output
    filename = 'bloomberg_roll_select_backtest.csv'
    monthly.to_csv(filename)
    
    print("\n" + "=" * 60)
    print("BACKTEST SUMMARY")
    print("=" * 60)
    print(f"Period:           {monthly.index[0].date()} to {monthly.index[-1].date()}")
    print(f"Strategy:         Bloomberg Roll Select (Synthetic)")
    print(f"Components:       {ticker_early} (1991-2012)")
    print(f"                  {ticker_mid} (2012-2018)")
    print(f"                  {ticker_modern} (2018-Present)")
    print("-" * 60)
    print(f"Starting Value:   $100.00")
    print(f"Final Value USD:  ${final_usd:.2f}")
    print(f"CAGR:             {cagr_usd:.2%}")
    print("=" * 60)
    
    print("\nFirst 5 months:")
    print(monthly.head())
    print("\nLast 5 months:")
    print(monthly.tail())
    print(f"\nData saved to: {filename}")
    print("\nNote: EUR prices show NaN before ~1999 (Euro did not exist)")
    print("      Pre-2018 data is synthetic (index proxies, not actual Roll Select)")

if __name__ == "__main__":
    backtest_bloomberg_roll_select()
