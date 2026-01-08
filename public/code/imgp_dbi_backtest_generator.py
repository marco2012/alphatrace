#!/usr/bin/env python3
"""
iMGP DBi Managed Futures - Complete Backtest Generator
Standalone script with embedded SG CTA Index data + auto-fetch DBMF from Yahoo Finance
Output: Date, USD (base 100), EUR (base 100)
"""

import pandas as pd
import numpy as np
import requests
from io import StringIO
import json

# ============================================================================
# EMBEDDED DATA: SG CTA Index (1999-2023)
# ============================================================================
SG_CTA_INDEX_DATA = [
    {"date": "1999-12-31", "value": 100000.0},
    {"date": "2000-01-31", "value": 102340.0},
    {"date": "2000-02-29", "value": 101542.0},
    {"date": "2000-03-31", "value": 99633.0},
    {"date": "2000-04-30", "value": 98188.0},
    {"date": "2000-05-31", "value": 98316.0},
    {"date": "2000-06-30", "value": 96497.0},
    {"date": "2000-07-31", "value": 94982.0},
    {"date": "2000-08-31", "value": 95770.0},
    {"date": "2000-09-30", "value": 92667.0},
    {"date": "2000-10-31", "value": 94280.0},
    {"date": "2000-11-30", "value": 100644.0},
    {"date": "2000-12-31", "value": 109551.0},
    {"date": "2001-01-31", "value": 110372.0},
    {"date": "2001-02-28", "value": 110516.0},
    {"date": "2001-03-31", "value": 116417.0},
    {"date": "2001-04-30", "value": 111446.0},
    {"date": "2001-05-31", "value": 112616.0},
    {"date": "2001-06-30", "value": 111276.0},
    {"date": "2001-07-31", "value": 110464.0},
    {"date": "2001-08-31", "value": 112485.0},
    {"date": "2001-09-30", "value": 114285.0},
    {"date": "2001-10-31", "value": 118514.0},
    {"date": "2001-11-30", "value": 109459.0},
    {"date": "2001-12-31", "value": 112272.0},
    {"date": "2002-01-31", "value": 111701.0},
    {"date": "2002-02-28", "value": 109330.0},
    {"date": "2002-03-31", "value": 109434.0},
    {"date": "2002-04-30", "value": 107755.0},
    {"date": "2002-05-31", "value": 111753.0},
    {"date": "2002-06-30", "value": 119822.0},
    {"date": "2002-07-31", "value": 123074.0},
    {"date": "2002-08-31", "value": 125683.0},
    {"date": "2002-09-30", "value": 128337.0},
    {"date": "2002-10-31", "value": 124047.0},
    {"date": "2002-11-30", "value": 121172.0},
    {"date": "2002-12-31", "value": 126762.0},
    {"date": "2003-01-31", "value": 132997.0},
    {"date": "2003-02-28", "value": 139229.0},
    {"date": "2003-03-31", "value": 131520.0},
    {"date": "2003-04-30", "value": 133649.0},
    {"date": "2003-05-31", "value": 140872.0},
    {"date": "2003-06-30", "value": 138867.0},
    {"date": "2003-07-31", "value": 137076.0},
    {"date": "2003-08-31", "value": 139991.0},
    {"date": "2003-09-30", "value": 139230.0},
    {"date": "2003-10-31", "value": 142348.0},
    {"date": "2003-11-30", "value": 142060.0},
    {"date": "2003-12-31", "value": 146730.0},
    {"date": "2004-01-31", "value": 148167.0},
    {"date": "2004-02-29", "value": 154173.0},
    {"date": "2004-03-31", "value": 152757.0},
    {"date": "2004-04-30", "value": 146797.0},
    {"date": "2004-05-31", "value": 144598.0},
    {"date": "2004-06-30", "value": 141026.0},
    {"date": "2004-07-31", "value": 140087.0},
    {"date": "2004-08-31", "value": 138289.0},
    {"date": "2004-09-30", "value": 138787.0},
    {"date": "2004-10-31", "value": 142801.0},
    {"date": "2004-11-30", "value": 148254.0},
    {"date": "2004-12-31", "value": 148879.0},
    {"date": "2005-01-31", "value": 144960.0},
    {"date": "2005-02-28", "value": 146453.0},
    {"date": "2005-03-31", "value": 146918.0},
    {"date": "2005-04-30", "value": 143970.0},
    {"date": "2005-05-31", "value": 146067.0},
    {"date": "2005-06-30", "value": 148874.0},
    {"date": "2005-07-31", "value": 148667.0},
    {"date": "2005-08-31", "value": 148714.0},
    {"date": "2005-09-30", "value": 151129.0},
    {"date": "2005-10-31", "value": 151369.0},
    {"date": "2005-11-30", "value": 155440.0},
    {"date": "2005-12-31", "value": 153641.0},
    {"date": "2006-01-31", "value": 155029.0},
    {"date": "2006-02-28", "value": 154090.0},
    {"date": "2006-03-31", "value": 157537.0},
    {"date": "2006-04-30", "value": 161345.0},
    {"date": "2006-05-31", "value": 158875.0},
    {"date": "2006-06-30", "value": 156686.0},
    {"date": "2006-07-31", "value": 153537.0},
    {"date": "2006-08-31", "value": 153414.0},
    {"date": "2006-09-30", "value": 152592.0},
    {"date": "2006-10-31", "value": 154651.0},
    {"date": "2006-11-30", "value": 158325.0},
    {"date": "2006-12-31", "value": 162478.0},
    {"date": "2007-01-31", "value": 164328.0},
    {"date": "2007-02-28", "value": 161458.0},
    {"date": "2007-03-31", "value": 159196.0},
    {"date": "2007-04-30", "value": 164668.0},
    {"date": "2007-05-31", "value": 169994.0},
    {"date": "2007-06-30", "value": 173982.0},
    {"date": "2007-07-31", "value": 169473.0},
    {"date": "2007-08-31", "value": 162578.0},
    {"date": "2007-09-30", "value": 169558.0},
    {"date": "2007-10-31", "value": 175562.0},
    {"date": "2007-11-30", "value": 174071.0},
    {"date": "2007-12-31", "value": 175560.0},
    {"date": "2008-01-31", "value": 178509.0},
    {"date": "2008-02-29", "value": 186717.0},
    {"date": "2008-03-31", "value": 186348.0},
    {"date": "2008-04-30", "value": 182673.0},
    {"date": "2008-05-31", "value": 185855.0},
    {"date": "2008-06-30", "value": 190137.0},
    {"date": "2008-07-31", "value": 184956.0},
    {"date": "2008-08-31", "value": 181623.0},
    {"date": "2008-09-30", "value": 182230.0},
    {"date": "2008-10-31", "value": 191303.0},
    {"date": "2008-11-30", "value": 195293.0},
    {"date": "2008-12-31", "value": 198505.0},
    {"date": "2009-01-31", "value": 198864.0},
    {"date": "2009-02-28", "value": 199190.0},
    {"date": "2009-03-31", "value": 194286.0},
    {"date": "2009-04-30", "value": 190466.0},
    {"date": "2009-05-31", "value": 192966.0},
    {"date": "2009-06-30", "value": 189538.0},
    {"date": "2009-07-31", "value": 188884.0},
    {"date": "2009-08-31", "value": 190549.0},
    {"date": "2009-09-30", "value": 194679.0},
    {"date": "2009-10-31", "value": 191178.0},
    {"date": "2009-11-30", "value": 196350.0},
    {"date": "2009-12-31", "value": 189971.0},
    {"date": "2010-01-31", "value": 186132.0},
    {"date": "2010-02-28", "value": 188542.0},
    {"date": "2010-03-31", "value": 193577.0},
    {"date": "2010-04-30", "value": 196262.0},
    {"date": "2010-05-31", "value": 193486.0},
    {"date": "2010-06-30", "value": 193030.0},
    {"date": "2010-07-31", "value": 192128.0},
    {"date": "2010-08-31", "value": 198796.0},
    {"date": "2010-09-30", "value": 201351.0},
    {"date": "2010-10-31", "value": 206721.0},
    {"date": "2010-11-30", "value": 200882.0},
    {"date": "2010-12-31", "value": 207561.0},
    {"date": "2011-01-31", "value": 204553.0},
    {"date": "2011-02-28", "value": 206980.0},
    {"date": "2011-03-31", "value": 204795.0},
    {"date": "2011-04-30", "value": 212152.0},
    {"date": "2011-05-31", "value": 202643.0},
    {"date": "2011-06-30", "value": 199272.0},
    {"date": "2011-07-31", "value": 205784.0},
    {"date": "2011-08-31", "value": 202872.0},
    {"date": "2011-09-30", "value": 204384.0},
    {"date": "2011-10-31", "value": 196721.0},
    {"date": "2011-11-30", "value": 197013.0},
    {"date": "2011-12-31", "value": 198325.0},
    {"date": "2012-01-31", "value": 199717.0},
    {"date": "2012-02-29", "value": 201594.0},
    {"date": "2012-03-31", "value": 197518.0},
    {"date": "2012-04-30", "value": 197682.0},
    {"date": "2012-05-31", "value": 203672.0},
    {"date": "2012-06-30", "value": 196964.0},
    {"date": "2012-07-31", "value": 202780.0},
    {"date": "2012-08-31", "value": 200389.0},
    {"date": "2012-09-30", "value": 198762.0},
    {"date": "2012-10-31", "value": 192779.0},
    {"date": "2012-11-30", "value": 192535.0},
    {"date": "2012-12-31", "value": 192642.0},
    {"date": "2013-01-31", "value": 195445.0},
    {"date": "2013-02-28", "value": 195659.0},
    {"date": "2013-03-31", "value": 198156.0},
    {"date": "2013-04-30", "value": 201020.0},
    {"date": "2013-05-31", "value": 197561.0},
    {"date": "2013-06-30", "value": 194588.0},
    {"date": "2013-07-31", "value": 192674.0},
    {"date": "2013-08-31", "value": 189309.0},
    {"date": "2013-09-30", "value": 187476.0},
    {"date": "2013-10-31", "value": 189744.0},
    {"date": "2013-11-30", "value": 192946.0},
    {"date": "2013-12-31", "value": 194044.0},
    {"date": "2014-01-31", "value": 189521.0},
    {"date": "2014-02-28", "value": 190614.0},
    {"date": "2014-03-31", "value": 190023.0},
    {"date": "2014-04-30", "value": 190817.0},
    {"date": "2014-05-31", "value": 195229.0},
    {"date": "2014-06-30", "value": 196190.0},
    {"date": "2014-07-31", "value": 194289.0},
    {"date": "2014-08-31", "value": 201971.0},
    {"date": "2014-09-30", "value": 205861.0},
    {"date": "2014-10-31", "value": 209241.0},
    {"date": "2014-11-30", "value": 220987.0},
    {"date": "2014-12-31", "value": 224445.0},
    {"date": "2015-01-31", "value": 234137.0},
    {"date": "2015-02-28", "value": 233434.0},
    {"date": "2015-03-31", "value": 237409.0},
    {"date": "2015-04-30", "value": 229883.0},
    {"date": "2015-05-31", "value": 228962.0},
    {"date": "2015-06-30", "value": 219280.0},
    {"date": "2015-07-31", "value": 226045.0},
    {"date": "2015-08-31", "value": 221784.0},
    {"date": "2015-09-30", "value": 224369.0},
    {"date": "2015-10-31", "value": 221686.0},
    {"date": "2015-11-30", "value": 227572.0},
    {"date": "2015-12-31", "value": 224502.0},
    {"date": "2016-01-31", "value": 233883.0},
    {"date": "2016-02-29", "value": 240823.0},
    {"date": "2016-03-31", "value": 233594.0},
    {"date": "2016-04-30", "value": 228399.0},
    {"date": "2016-05-31", "value": 223729.0},
    {"date": "2016-06-30", "value": 233849.0},
    {"date": "2016-07-31", "value": 236760.0},
    {"date": "2016-08-31", "value": 229379.0},
    {"date": "2016-09-30", "value": 226627.0},
    {"date": "2016-10-31", "value": 220727.0},
    {"date": "2016-11-30", "value": 216732.0},
    {"date": "2016-12-31", "value": 218016.0},
    {"date": "2017-01-31", "value": 215562.0},
    {"date": "2017-02-28", "value": 220382.0},
    {"date": "2017-03-31", "value": 218161.0},
    {"date": "2017-04-30", "value": 217883.0},
    {"date": "2017-05-31", "value": 217966.0},
    {"date": "2017-06-30", "value": 210480.0},
    {"date": "2017-07-31", "value": 212086.0},
    {"date": "2017-08-31", "value": 216521.0},
    {"date": "2017-09-30", "value": 211991.0},
    {"date": "2017-10-31", "value": 221203.0},
    {"date": "2017-11-30", "value": 221879.0},
    {"date": "2017-12-31", "value": 223431.0},
    {"date": "2018-01-31", "value": 232159.0},
    {"date": "2018-02-28", "value": 217442.0},
    {"date": "2018-03-31", "value": 217153.0},
    {"date": "2018-04-30", "value": 217319.0},
    {"date": "2018-05-31", "value": 211839.0},
    {"date": "2018-06-30", "value": 212983.0},
    {"date": "2018-07-31", "value": 211486.0},
    {"date": "2018-08-31", "value": 217079.0},
    {"date": "2018-09-30", "value": 215706.0},
    {"date": "2018-10-31", "value": 209689.0},
    {"date": "2018-11-30", "value": 207409.0},
    {"date": "2018-12-31", "value": 210405.0},
    {"date": "2019-01-31", "value": 206445.0},
    {"date": "2019-02-28", "value": 207294.0},
    {"date": "2019-03-31", "value": 214441.0},
    {"date": "2019-04-30", "value": 220320.0}
]

# ============================================================================
# YAHOO FINANCE DATA FETCHER
# ============================================================================

def fetch_yahoo_finance_data(ticker='DBMF', start_date='2019-05-08'):
    """Fetch historical data from Yahoo Finance API"""
    try:
        start_ts = int(pd.to_datetime(start_date).timestamp())
        end_ts = int(pd.to_datetime('today').timestamp())

        url = f"https://query2.finance.yahoo.com/v8/finance/chart/{ticker}"
        params = {
            'period1': start_ts,
            'period2': end_ts,
            'interval': '1d',
            'events': 'history',
            'includeAdjustedClose': 'true'
        }
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }

        response = requests.get(url, params=params, headers=headers, timeout=30)

        if response.status_code == 200:
            data = response.json()
            chart = data['chart']['result'][0]

            df = pd.DataFrame({
                'Date': pd.to_datetime(chart['timestamp'], unit='s'),
                'Adj Close': chart['indicators']['adjclose'][0]['adjclose']
            })

            return df.dropna()
        else:
            return None

    except Exception as e:
        print(f"✗ Yahoo Finance error: {e}")
        return None

# ============================================================================
# MAIN GENERATOR FUNCTION
# ============================================================================

def generate_backtest_data(output_file='imgp_dbi_base100.csv'):
    """
    Generate complete backtest dataset with embedded SG CTA + auto-fetched DBMF
    Output: Date, USD (base 100), EUR (base 100)
    """

    print("="*80)
    print("iMGP DBi Managed Futures - Backtest Data Generator")
    print("="*80)

    # Step 1: Load embedded SG CTA proxy data
    print("\n[1/4] Loading embedded SG CTA Index data...")

    df_proxy = pd.DataFrame(SG_CTA_INDEX_DATA)
    df_proxy['Date'] = pd.to_datetime(df_proxy['date'])
    df_proxy['Index_Value_USD'] = df_proxy['value']

    # Filter to pre-DBMF launch
    dbmf_launch = pd.to_datetime('2019-05-08')
    df_proxy = df_proxy[df_proxy['Date'] < dbmf_launch].copy()

    print(f"  ✓ {len(df_proxy)} months: {df_proxy['Date'].min().date()} to {df_proxy['Date'].max().date()}")

    # Step 2: Auto-fetch DBMF from Yahoo Finance
    print("\n[2/4] Fetching DBMF data from Yahoo Finance...")

    df_dbmf_raw = fetch_yahoo_finance_data('DBMF', '2019-05-08')

    if df_dbmf_raw is not None:
        print(f"  ✓ Fetched {len(df_dbmf_raw)} daily records")
        print(f"  ✓ Period: {df_dbmf_raw['Date'].min().date()} to {df_dbmf_raw['Date'].max().date()}")

        # Convert to monthly
        df_dbmf_raw['YearMonth'] = df_dbmf_raw['Date'].dt.to_period('M')
        df_dbmf_monthly = df_dbmf_raw.groupby('YearMonth').agg({
            'Date': 'last',
            'Adj Close': 'last'
        }).reset_index(drop=True)

        # Scale to match proxy
        scaling = df_proxy.iloc[-1]['Index_Value_USD'] / df_dbmf_monthly.iloc[0]['Adj Close']
        df_dbmf_monthly['Index_Value_USD'] = df_dbmf_monthly['Adj Close'] * scaling
        df_dbmf = df_dbmf_monthly[['Date', 'Index_Value_USD']]

        years = (df_dbmf['Date'].max() - df_dbmf['Date'].min()).days / 365.25
        print(f"  ✓ {len(df_dbmf)} monthly records ({years:.1f} years of actual data)")

        # Combine
        df_combined = pd.concat([
            df_proxy[['Date', 'Index_Value_USD']], 
            df_dbmf
        ], ignore_index=True)

        print(f"  ✓ Combined: {len(df_combined)} months total")

    else:
        print("  ⚠ DBMF fetch failed, using proxy only")
        df_combined = df_proxy[['Date', 'Index_Value_USD']].copy()

    df_combined = df_combined.sort_values('Date').reset_index(drop=True)

    # Step 3: Fetch EUR/USD rates from ECB
    print("\n[3/4] Fetching EUR/USD exchange rates from ECB...")

    try:
        start_date = df_combined['Date'].min().strftime('%Y-%m-%d')
        end_date = df_combined['Date'].max().strftime('%Y-%m-%d')

        ecb_url = "https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A"
        response = requests.get(ecb_url, params={
            'startPeriod': start_date,
            'endPeriod': end_date,
            'format': 'csvdata'
        }, timeout=30)

        ecb_data = pd.read_csv(StringIO(response.text))
        ecb_clean = ecb_data[['TIME_PERIOD', 'OBS_VALUE']].copy()
        ecb_clean.columns = ['Date', 'USDEUR_Rate']
        ecb_clean['Date'] = pd.to_datetime(ecb_clean['Date'])
        ecb_clean['USDEUR_Rate'] = pd.to_numeric(ecb_clean['USDEUR_Rate'], errors='coerce')
        ecb_clean = ecb_clean.dropna()

        df_combined = df_combined.merge(ecb_clean, on='Date', how='left')
        df_combined['USDEUR_Rate'] = df_combined['USDEUR_Rate'].ffill().bfill()
        df_combined['Index_Value_EUR'] = df_combined['Index_Value_USD'] / df_combined['USDEUR_Rate']

        print("  ✓ EUR conversion complete")

    except Exception as e:
        print(f"  ✗ FX error: {e}")
        df_combined['Index_Value_EUR'] = np.nan

    # Step 4: Rebase to 100 and save
    print("\n[4/4] Rebasing to 100 and saving...")

    first_usd = df_combined.iloc[0]['Index_Value_USD']
    first_eur = df_combined.iloc[0]['Index_Value_EUR']

    output_df = pd.DataFrame({
        'Date': df_combined['Date'].dt.strftime('%Y-%m-%d'),
        'USD': (df_combined['Index_Value_USD'] / first_usd * 100).round(2),
        'EUR': (df_combined['Index_Value_EUR'] / first_eur * 100).round(2)
    })

    output_df.to_csv(output_file, index=False)

    # Summary
    years = (pd.to_datetime(output_df['Date'].iloc[-1]) - 
             pd.to_datetime(output_df['Date'].iloc[0])).days / 365.25

    print(f"\n{'='*80}")
    print(f"✓ Saved to: {output_file}")
    print(f"✓ Records: {len(output_df)} months ({years:.1f} years)")
    print(f"✓ Period: {output_df['Date'].iloc[0]} to {output_df['Date'].iloc[-1]}")

    usd_ret = output_df['USD'].pct_change().dropna() * 100
    eur_ret = output_df['EUR'].pct_change().dropna() * 100

    print(f"\n📊 Performance:")
    print(f"   USD: 100 → {output_df['USD'].iloc[-1]:.2f} ({usd_ret.mean()*12:.2f}% ann.)")
    print(f"   EUR: 100 → {output_df['EUR'].iloc[-1]:.2f} ({eur_ret.mean()*12:.2f}% ann.)")
    print(f"{'='*80}\n")

    return output_df

# ============================================================================
# EXECUTE
# ============================================================================

if __name__ == "__main__":
    result = generate_backtest_data()

    print("\nFirst 10 rows:")
    print(result.head(10).to_string(index=False))

    print("\n\nLast 10 rows:")
    print(result.tail(10).to_string(index=False))
