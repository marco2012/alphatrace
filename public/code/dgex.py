import yfinance as yf
import pandas as pd
from datetime import datetime

def download_scaled_proxy():
    # 1. Define Tickers
    # DGEIX: US Proxy for Global Core Equity (starts Dec 2003)
    # EURUSD=X: Exchange rate to convert USD assets to EUR
    fund_ticker = "DGEIX"      
    currency_ticker = "EURUSD=X"
    
    start_date = "1990-01-01" # Note: Data will effectively start in 2003 due to fund inception
    current_date = datetime.now().strftime("%Y-%m-%d")

    print(f"Downloading data for {fund_ticker} and {currency_ticker}...")

    # 2. Download Data
    # auto_adjust=True gets the Total Return (dividends reinvested)
    fund_data = yf.download(fund_ticker, start=start_date, end=current_date, interval="1mo", auto_adjust=True)
    curr_data = yf.download(currency_ticker, start=start_date, end=current_date, interval="1mo", auto_adjust=False)

    if fund_data.empty or curr_data.empty:
        print("Error: Could not download data. Check tickers or internet connection.")
        return

    # 3. Prepare DataFrames
    # Extract 'Close' column
    df_fund = fund_data[['Close']].dropna()
    df_fund.columns = ['Price_USD']
    
    # Resample currency to Month End to align with fund data
    df_curr = curr_data[['Close']].resample('M').last().dropna()
    df_curr.columns = ['USD_per_EUR']

    # 4. Align Dates
    # Force index to be Timestamp at month-end for clean merging
    df_fund.index = df_fund.index.to_period('M').to_timestamp('M')
    df_curr.index = df_curr.index.to_period('M').to_timestamp('M')

    merged = pd.merge(df_fund, df_curr, left_index=True, right_index=True, how='inner')

    # 5. Calculate EUR Price and Scale
    # Convert USD Price to EUR: Price(USD) / Rate(USD/EUR)
    merged['Price_EUR'] = merged['Price_USD'] / merged['USD_per_EUR']

    # Scale both to start at 100
    base_usd = merged['Price_USD'].iloc[0]
    base_eur = merged['Price_EUR'].iloc[0]

    merged['Scaled_USD'] = (merged['Price_USD'] / base_usd) * 100
    merged['Scaled_EUR'] = (merged['Price_EUR'] / base_eur) * 100

    # 6. Select ONLY Scaled Columns
    final_output = merged[['Scaled_USD', 'Scaled_EUR']]

    # 7. Output
    print(f"\nProcessing complete. {len(final_output)} records.")
    print(f"Data range: {final_output.index[0].date()} to {final_output.index[-1].date()}")
    print("\nFirst 5 rows:")
    print(final_output.head())

    filename = "DGEIX_scaled_USD_EUR.csv"
    final_output.to_csv(filename)
    print(f"\nSaved scaled data to {filename}")

if __name__ == "__main__":
    download_scaled_proxy()
