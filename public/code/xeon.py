import pandas as pd
import yfinance as yf
import pandas_datareader.data as web
import datetime
import os

def get_xeon_backtest_currency(start_date="1999-01-04", output_file="xeon_backtest.csv"):
    """
    Backtests LU0290358497 (XEON) in EUR and USD and saves to CSV.
    
    Methodology:
    1. EUR Synthetic (1999-2007): EONIA/€STR+8.5bps minus 0.10% fees.
    2. EUR Actual (2007-Present): XEON.DE Adjusted Close.
    3. USD Price: EUR Price * EURUSD Spot Rate (Unhedged).
    """
    print(f"Generating XEON backtest from {start_date}...")

    # --- 1. Fetch Data ---
    start = pd.to_datetime(start_date)
    
    # A. Reference Rates (EUR)
    # IRSTCI01EZM156N: Euro Area Interbank Rate (EONIA proxy for historical)
    # ECBESTRVOLWGTTRMDMNRT: Euro Short-Term Rate (€STR)
    try:
        eonia_hist = web.DataReader("IRSTCI01EZM156N", "fred", start)
        estr_curr = web.DataReader("ECBESTRVOLWGTTRMDMNRT", "fred", "2019-10-01")
        
        # Rename for consistency
        eonia_hist.columns = ['Rate']
        estr_curr.columns = ['Rate']
        
        # Adjust €STR to match EONIA methodology (€STR + 8.5 bps fixed spread)
        estr_curr['Rate'] = estr_curr['Rate'] + 0.085
        
        # Combine: Use EONIA up to Oct 2019, then adjusted €STR
        rates = eonia_hist.loc[:'2019-09-30'].combine_first(estr_curr)
        # Fix: Use ffill() instead of fillna(method='ffill')
        rates = rates.ffill() 
    except Exception as e:
        print(f"Error fetching FRED rates: {e}")
        return pd.DataFrame()

    # B. Currency Exchange Rate (EUR -> USD)
    try:
        fx_rates = web.DataReader("DEXUSEU", "fred", start)
        # Fix: Use ffill() instead of fillna(method='ffill')
        fx_rates = fx_rates.ffill()
    except Exception as e:
        print(f"Error fetching FX rates: {e}")
        return pd.DataFrame()

    # C. Actual ETF Data (XEON.DE)
    try:
        etf_ticker = "XEON.DE"
        # Download with auto_adjust=True for Total Return
        etf_data = yf.download(etf_ticker, start="2007-01-01", progress=False, auto_adjust=True)
        if isinstance(etf_data.columns, pd.MultiIndex):
            etf_close = etf_data['Close'].iloc[:, 0]
        else:
            etf_close = etf_data['Close']
    except Exception as e:
        print(f"Error fetching ETF data: {e}")
        etf_close = pd.Series(dtype=float)

    # --- 2. Calculate Synthetic EUR NAV ---
    # Resample to daily calendar days (Act/360 interest convention)
    daily_rates = rates.resample('D').ffill().loc[start:]
    
    TER = 0.0010  # 0.10% Expense Ratio
    
    # Daily Return = (AnnualRate - Fee) / 360
    daily_rates['Daily_Ret'] = (daily_rates['Rate'] / 100 - TER) / 360
    
    # Compute Index (Start at 100)
    synthetic_eur = 100 * (1 + daily_rates['Daily_Ret'].fillna(0)).cumprod()

    # --- 3. Splice Synthetic with Actual ETF ---
    if not etf_close.empty:
        splice_date = etf_close.first_valid_index()
        if splice_date and splice_date in synthetic_eur.index:
            # Scaling factor to match ETF price at inception
            scale_factor = etf_close.loc[splice_date] / synthetic_eur.loc[splice_date]
            synthetic_scaled = synthetic_eur.loc[:splice_date] * scale_factor
            
            # Combine
            xeon_eur = pd.concat([synthetic_scaled[:-1], etf_close.loc[splice_date:]])
        else:
            xeon_eur = synthetic_eur
    else:
        xeon_eur = synthetic_eur

    # --- 4. Calculate USD Value (Unhedged) ---
    aligned_fx = fx_rates['DEXUSEU'].reindex(xeon_eur.index).ffill()
    xeon_usd = xeon_eur * aligned_fx

    # --- 5. Formatting & Export ---
    result = pd.DataFrame({
        'net_price_eur': xeon_eur,
        'net_price_usd': xeon_usd
    })
    
    result = result.dropna().loc[start:]
    result.index.name = 'date'
    
    # Export to CSV
    try:
        result.to_csv(output_file)
        print(f"Successfully saved {len(result)} rows to {output_file}")
    except Exception as e:
        print(f"Error saving CSV: {e}")

    return result

# --- Execution ---
if __name__ == "__main__":
    df = get_xeon_backtest_currency()
    print("\nSample Output (Tail):")
    print(df.tail())
