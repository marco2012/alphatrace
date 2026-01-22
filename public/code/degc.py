import yfinance as yf
import pandas as pd
from datetime import datetime

def generate_simple_backtest():
    # 1. Configuration
    start_date = "1999-01-01"
    current_date = datetime.now().strftime("%Y-%m-%d")
    
    # Tickers
    funds = ["DFUSX", "DFIVX", "DFISX"]
    currency = "EURUSD=X"
    
    # Initial Weights (1999) - Drifting Buy & Hold
    weights = {
        "DFUSX": 0.50,   # US Core
        "DFIVX": 0.30,   # Intl Value
        "DFISX": 0.20    # Intl Small
    }
    
    print(f"Downloading data from {start_date}...")
    
    # 2. Download Data (Robust Batch Download)
    # auto_adjust=True ensures Total Return (Dividends Reinvested)
    fund_data = yf.download(funds, start=start_date, end=current_date, 
                           interval="1mo", auto_adjust=True, progress=False)
    
    curr_data = yf.download(currency, start=start_date, end=current_date, 
                           interval="1mo", auto_adjust=False, progress=False)

    # 3. Fix for yfinance MultiIndex Issue
    # If downloading multiple tickers, yf returns (Price, Ticker). We need just Close.
    if isinstance(fund_data.columns, pd.MultiIndex):
        prices = fund_data['Close']
    else:
        prices = fund_data # Fallback for single ticker or flat structure

    # Handle Currency separately to avoid index mismatches
    if isinstance(curr_data.columns, pd.MultiIndex):
        try:
            usd_eur = curr_data['Close'][currency]
        except KeyError:
            usd_eur = curr_data['Close'] # Fallback
    else:
        usd_eur = curr_data['Close']
        
    # 4. Alignment
    # Force Month-End timestamps for clean merging
    prices.index = prices.index.to_period('M').to_timestamp('M')
    usd_eur.index = usd_eur.index.to_period('M').to_timestamp('M')
    usd_eur.name = 'Rate'
    
    # Merge
    merged = pd.merge(prices, usd_eur, left_index=True, right_index=True, how='inner')
    merged = merged.ffill()
    
    # 5. Portfolio Construction
    # Normalize funds to start at 1.0
    norm_funds = merged[funds] / merged[funds].iloc[0]
    
    # Calculate Weighted Value (Buy & Hold approach)
    us_val = norm_funds['DFUSX'] * weights['DFUSX']
    intl_val_v = norm_funds['DFIVX'] * weights['DFIVX']
    intl_val_s = norm_funds['DFISX'] * weights['DFISX']
    
    # Portfolio Value USD (Total Return, Base 100)
    port_val_usd = (us_val + intl_val_v + intl_val_s) * 100
    
    # Portfolio Value EUR (Total Return, Base 100)
    # Convert USD Value to EUR: Value_USD / Rate
    raw_eur_val = port_val_usd / merged['Rate']
    port_val_eur = (raw_eur_val / raw_eur_val.iloc[0]) * 100
    
    # 6. Output
    output = pd.DataFrame({
        'Price_USD': port_val_usd,
        'Price_EUR': port_val_eur
    })
    
    output = output.round(2)
    output.index.name = 'Date'
    
    filename = "DFA_Global_Core_Simple_1999.csv"
    output.to_csv(filename)
    
    print(f"\nSuccess! Saved to {filename}")
    print(output.tail())

if __name__ == "__main__":
    generate_simple_backtest()
