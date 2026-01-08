#!/usr/bin/env python3
"""
NTSG Proxy Backtest (1999-Present)
Replicates WisdomTree Global Efficient Core Methodology
- Equity: 90% MSCI World (direct from local Excel data - developed markets only)
- Bonds: 60% global treasury proxy (US 10Y as dominant/correlating component)
"""

import pandas as pd
import numpy as np
import urllib.request
import ssl
import warnings
warnings.filterwarnings('ignore')

print("Running NTSG (Global Efficient Core) Proxy Backtest...")

# =============================================================================
# 1. LOAD MSCI WORLD DATA FROM LOCAL EXCEL
# =============================================================================
# User-provided file: MSCI World index levels (MSCI World Index)
# Data starts at row 6 (header: Date, MSCI World Index)
# Adjust path if needed (e.g., './source/world.xlsx' or full path)

excel_path = '../source/world.xlsx'  # Change if your file is elsewhere

print("1. Loading MSCI World data from local Excel...")
try:
    # Skip first 5 rows → header in row 6 becomes column names
    msci_world = pd.read_excel(excel_path, skiprows=5)
    
    # Clean column names (in case of extra spaces)
    msci_world.columns = msci_world.columns.str.strip()
    
    # Ensure correct columns
    if not {'Date', 'MSCI World Index'}.issubset(msci_world.columns):
        raise ValueError("Excel must have columns 'Date' and 'MSCI World Index'")
    
    # Parse date and set index
    msci_world['Date'] = pd.to_datetime(msci_world['Date'])
    msci_world.set_index('Date', inplace=True)
    msci_world = msci_world[['MSCI World Index']].sort_index()
    
    # Forward fill any missing prices, then drop remaining NaN
    msci_world = msci_world.ffill().dropna()
    
    print(f"   ✓ MSCI World Data: {len(msci_world)} days (from {msci_world.index[0].date()} to {msci_world.index[-1].date()})")
    
    # Resample to monthly end for clean rebalancing (handles daily or monthly input)
    world_m = msci_world.resample('ME').last()
    
    # Monthly returns
    global_equity_ret = world_m['MSCI World Index'].pct_change()
    
except Exception as e:
    print(f"Error loading Excel file: {e}")
    print("   Check path and file structure (header in row 6: Date, MSCI World Index)")
    exit(1)

# =============================================================================
# 2. DOWNLOAD BOND & RATES DATA (US PROXY)
# =============================================================================
print("2. Downloading Bond & Rate Data (FRED)...")
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

def download_fred(series_id):
    url = f'https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}'
    with urllib.request.urlopen(url, context=ssl_context) as response:
        df = pd.read_csv(response, parse_dates=[0], index_col=0)
        df.iloc[:, 0] = pd.to_numeric(df.iloc[:, 0], errors='coerce')
        return df.resample('ME').last()

try:
    treasury = download_fred('DGS10')  # 10Y Treasury Yield
    tbill = download_fred('DFF')       # Fed Funds Rate (borrowing cost proxy)
    usdeur = download_fred('DEXUSEU')  # USD per EUR (for EUR view)
except Exception as e:
    print(f"Error downloading FRED data: {e}")
    exit(1)

# =============================================================================
# 3. CALCULATE STRATEGY
# =============================================================================
print("3. Calculating 90/60 Strategy...")

# Align all data to monthly
data = pd.concat([global_equity_ret, treasury, tbill, usdeur], axis=1).dropna()
data.columns = ['equity', 'yield', 'rate', 'fx']

# Bond Returns ≈ price return from yield change + income
# Duration ~7.0 for 10Y Treasury
yield_chg = data['yield'].diff() / 100
bond_ret = -7.0 * yield_chg + (data['yield'].shift(1) / 100 / 12)

# Borrowing cost
cash_cost = data['rate'] / 100 / 12

# NTSG: 90% equity + 60% bonds - 50% borrowing cost (150% total exposure)
ntsg_ret = (0.90 * data['equity'] + 
            0.60 * bond_ret - 
            0.50 * cash_cost)

# =============================================================================
# 4. EXPORT
# =============================================================================
print("4. Exporting Results...")

results = pd.DataFrame(index=data.index)
results['90_60_USD'] = 100 * (1 + ntsg_ret).cumprod()
results['90_60_EUR'] = results['90_60_USD'] / data['fx']  # USD asset value in EUR

# Clean output
output = results[['90_60_USD', '90_60_EUR']].dropna()
output.index.name = 'Date'
output.to_csv('backtest_ntsg_proxy.csv')

print(f"\n✓ Done! Saved to: backtest_ntsg_proxy.csv")
print(f"  Proxy: 90% MSCI World (direct from Excel) + 60% US Treasuries (global proxy) - 50% cash cost")
print("         Clean developed markets only")
print("\nRecent Performance (Monthly):")
print(output.tail(5).to_string())