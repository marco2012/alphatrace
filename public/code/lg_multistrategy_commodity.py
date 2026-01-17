import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime

def run_long_term_backtest():
    print("--- Starting Long-Term Commodity Backtest (1991 - Present) ---")
    
    # 1. Configuration
    # ^SPGSCI: S&P GSCI Index (Standard proxy for 90s commodities)
    # DBC: Invesco DB Commodity Index (Smart-beta proxy for modern era)
    # EURUSD=X: Currency pair (Starts ~1999-2003 on Yahoo)
    tickers = ['^SPGSCI', 'DBC', 'EURUSD=X']
    
    start_date = '1991-01-01'
    end_date = datetime.now().strftime('%Y-%m-%d')
    switch_date = '2006-02-06' # Switch from raw Index to ETF
    
    print(f"Fetching data for {tickers}...")
    try:
        # Download data
        data = yf.download(tickers, start=start_date, end=end_date, auto_adjust=False, progress=True)
        
        # Handle MultiIndex columns (yfinance structure)
        if isinstance(data.columns, pd.MultiIndex):
            # Try getting 'Adj Close' first, then 'Close'
            if 'Adj Close' in data.columns.get_level_values(0):
                df = data['Adj Close']
            else:
                df = data['Close']
        else:
            df = data
            
    except Exception as e:
        print(f"Error fetching data: {e}")
        return

    # 2. Process Returns (Synthetic History)
    print("Processing synthetic history...")
    returns = df.pct_change()
    
    # Construct Strategy Returns
    # Logic: 
    # - If Date < 2006-02-06: Use ^SPGSCI (Index)
    # - If Date >= 2006-02-06: Use DBC (ETF)
    # - If ^SPGSCI is missing (some days), fill with 0 to prevent crashes
    
    # We use a loop or numpy select for clarity in splicing
    # Create condition mask
    cond_early = returns.index < switch_date
    
    # Select returns based on condition
    # Note: We must handle cases where ^SPGSCI might be NaN in the very early days if download failed for specific days
    strat_ret = np.where(
        cond_early,
        returns['^SPGSCI'],
        returns['DBC']
    )
    
    # Create a Series for calculation
    strat_series = pd.Series(strat_ret, index=returns.index)
    strat_series = strat_series.fillna(0)
    
    # 3. Build Price Indices
    # USD Price (Base 100)
    usd_index = 100 * (1 + strat_series).cumprod()
    
    # EUR Price
    # Note: Euro didn't exist before Jan 1999.
    # We will calculate it where EURUSD data exists.
    eur_rate = df['EURUSD=X']
    
    # EUR Value = USD Value / (USD per EUR rate)
    eur_index_raw = usd_index / eur_rate
    
    # Rebase EUR index: Find first valid EUR date and set to 100 relative to that
    first_valid_eur = eur_index_raw.first_valid_index()
    if first_valid_eur:
        scaling_factor = 100 / eur_index_raw.loc[first_valid_eur]
        eur_index = eur_index_raw * scaling_factor
    else:
        eur_index = eur_index_raw # All NaNs
    
    # 4. Resample to Monthly
    output_df = pd.DataFrame({
        'USD_Price': usd_index,
        'EUR_Price': eur_index
    })
    
    # Resample to Month End ('ME' for pandas > 2.0, 'M' for older)
    try:
        monthly_data = output_df.resample('ME').last()
    except:
        monthly_data = output_df.resample('M').last()
        
    monthly_data = monthly_data.round(2)
    
    # Drop rows where USD_Price is 100 (pre-start data if any) or NaN
    monthly_data = monthly_data[monthly_data['USD_Price'] != 100.00]
    
    # 5. Save to CSV
    filename = 'commodity_backtest_1991_2025.csv'
    monthly_data.to_csv(filename)
    
    print("-" * 30)
    print("PREVIEW (Start of Data)")
    print(monthly_data.head())
    print("-" * 30)
    print("PREVIEW (End of Data)")
    print(monthly_data.tail())
    print("-" * 30)
    print(f"Saved to: {filename}")
    print("Note: EUR prices will show NaN before 1999/2003 (Euro inception/data availability).")

if __name__ == "__main__":
    run_long_term_backtest()
