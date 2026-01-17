import yfinance as yf
import pandas as pd
import matplotlib.pyplot as plt

def fetch_data(ticker, start_date):
    """Fetches historical data for a given ticker."""
    try:
        t = yf.Ticker(ticker)
        # Fetch data
        df = t.history(start=start_date, auto_adjust=True)
        # Return only Close price if data exists
        if not df.empty:
            return df['Close']
        return pd.Series(dtype='float64')
    except Exception as e:
        print(f"Error fetching {ticker}: {e}")
        return pd.Series(dtype='float64')

def run_synthetic_backtest():
    start_date = "1991-01-01"
    print("Fetching data sources...")

    # 1. Primary ETF (Best data, but shortest history)
    # UC14.L = UBS CMCI Composite SF UCITS ETF (USD)
    etf_ticker = "UC14.L"
    etf_data = fetch_data(etf_ticker, start_date)
    
    # 2. Strategic Index (Medium history, matches strategy)
    # ^CMCIER = UBS Bloomberg CMCI Composite Excess Return
    index_ticker = "^CMCIER"
    index_data = fetch_data(index_ticker, start_date)

    # 3. Long-term Proxy (Longest history, generic commodity exposure)
    # ^SPGSCI = S&P GSCI Index (Standard commodity benchmark)
    proxy_ticker = "^SPGSCI"
    proxy_data = fetch_data(proxy_ticker, start_date)

    if proxy_data.empty:
        print("Critical: Could not fetch proxy data (^SPGSCI). Check internet connection.")
        return

    # --- Splicing Logic ---
    print("\nConstructing synthetic history...")
    
    # Calculate daily returns for all series first
    proxy_returns = proxy_data.pct_change()
    index_returns = index_data.pct_change() if not index_data.empty else pd.Series(dtype='float64')
    etf_returns = etf_data.pct_change() if not etf_data.empty else pd.Series(dtype='float64')

    # Start with the Proxy returns as the base
    # We use the proxy's index as the master timeline
    combined_returns = proxy_returns.copy()
    
    # Overwrite with Index data where available (likely 2007+)
    if not index_returns.empty:
        # Update only overlapping dates
        common_dates = combined_returns.index.intersection(index_returns.index)
        combined_returns.loc[common_dates] = index_returns.loc[common_dates]
        print(f"  - Spliced UBS CMCI Index data starting {index_data.index[0].date()}")
    
    # Overwrite with Actual ETF data where available (2010+)
    if not etf_returns.empty:
        common_dates = combined_returns.index.intersection(etf_returns.index)
        combined_returns.loc[common_dates] = etf_returns.loc[common_dates]
        print(f"  - Spliced actual ETF data starting {etf_data.index[0].date()}")

    # Clean up (drop NaN at start)
    combined_returns = combined_returns.dropna()
    
    # --- Calculations ---
    # Construct a Daily Price Series (starting at 100)
    # We use 100 as a base for easier reading, effectively "Rebasing" the index
    price_series = 100 * (1 + combined_returns).cumprod()
    
    # Resample to Monthly (Taking the last price of each month)
    monthly_prices = price_series.resample('ME').last()

    # --- Output to Console/CSV Format ---
    print("\n--- Monthly Price Data (Date, Price USD) ---")
    
    # Create DataFrame for clean display
    output_df = pd.DataFrame({
        'Date': monthly_prices.index,
        'Price_USD': monthly_prices.values
    })
    
    # Format Date to string (YYYY-MM-DD)
    output_df['Date'] = output_df['Date'].dt.strftime('%Y-%m-%d')
    output_df['Price_USD'] = output_df['Price_USD'].round(2)
    
    # Print first 10 and last 10 rows
    print(output_df.head(10).to_string(index=False))
    print("...")
    print(output_df.tail(10).to_string(index=False))
    
    # Optional: Save to CSV file
    # output_df.to_csv("ubs_cmci_monthly_prices.csv", index=False)
    # print("\nData saved to ubs_cmci_monthly_prices.csv")

    # --- Plotting (Optional Visualization) ---
    plt.figure(figsize=(12, 6))
    plt.plot(monthly_prices.index, monthly_prices, color='blue', label='Synthetic CMCI (Monthly)')
    plt.title('Synthetic Monthly Prices: UBS CMCI Strategy (1991-Present)', fontsize=14)
    plt.ylabel('Price (Base 100)')
    plt.grid(True, alpha=0.3)
    plt.legend()
    plt.tight_layout()
    plt.show()

if __name__ == "__main__":
    run_synthetic_backtest()
