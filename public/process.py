import pandas as pd
import glob
import os
import pandas_datareader as pdr
import yfinance as yf
import numpy as np
import requests
from io import StringIO
from datetime import datetime

# Configuration for additional YFinance assets
YF_ASSETS = {
    "sp500_tr_usd": "^SP500TR",   # S&P 500 Total Return
    "brk_b_usd": "BRK-B",         # Berkshire Hathaway
    "nasdaq_tr_usd": "QQQ",         # Nasdaq TR Proxy
    "dgeix_usd": "DGEIX",         # Dimensional US Core Equity I
    "dfemx_usd": "DFEMX",         # DFA Emerging Markets
}

# Annual TER for MSCI Indexes (deducted from monthly returns)
TER_MAPPING = {
    "japan": 0.0058,
    "pacific": 0.0020,
    "switzerland": 0.0020,
    "uk": 0.0033,
    "us_small_cap_value": 0.0030,
    "world_acwi": 0.0020,
    "world_acwi_imi": 0.0017,
    "world_imi": 0.0017,
    "world_min_vol": 0.0030,
    "world_momentum": 0.0025,
    "world_quality": 0.0025,
    "world_small_cap_value": 0.0039,
    "world_value": 0.0025,
    "world": 0.0020,
    "emerging_market_imi": 0.0018,
    "dbmf": 0.0075,
    "dgeix": 0.0026,
    "dfemx": 0.0036,
    "cash": 0.0010,
    "eur_government_bonds_10y": 0.0015,
    "ntsg": 0.0025,
    "gold": 0.0012,
    "nasdaq_tr": 0.0030,
    "sp500_tr": 0.0007,
}

# Embedded SG CTA Index Data (Proxy for DBMF)
# https://www.rcmalternatives.com/fund/sg-cta-index-societe-generale-newedge-uk-limited/
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

def get_fred_series_raw(series_id, name):
    """Fetch series from St. Louis Fed (FRED) as CSV."""
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}"
    try:
        response = requests.get(url)
        if response.status_code == 200:
            df = pd.read_csv(StringIO(response.text), index_col=0, parse_dates=True)
            df = df.apply(pd.to_numeric, errors='coerce').dropna()
            df.columns = [name]
            return df
    except Exception:
        pass
    return pd.DataFrame()

def get_monthly_yf_data(ticker, start_date="1970-01-01"):
    """Downloads and formats yfinance monthly data."""
    print(f"Downloading {ticker} from {start_date}...")
    try:
        df = yf.download(ticker, start=start_date, interval="1mo", auto_adjust=True, progress=False)
        if df.empty:
            return pd.Series(dtype='float64')
        if isinstance(df.columns, pd.MultiIndex):
            if 'Close' in df.columns.get_level_values(0):
                series = df['Close'][ticker]
            else:
                series = df.iloc[:, 0]
        else:
            series = df['Close'] if 'Close' in df.columns else df.iloc[:, 0]
        if series.index.tz is not None:
            series.index = series.index.tz_localize(None)
        series = series.resample("ME").last().ffill()  # Ensure no internal gaps after resampling
        return series.dropna()  # Remove leading/trailing NaNs
    except Exception as e:
        print(f"Error downloading {ticker}: {e}")
        return pd.Series(dtype='float64')



def get_ntsg_portfolio(start_date="1999-01-01"):
    """NTSG (WisdomTree Global Efficient Core) Proxy: 90/60 Strategy using local World data."""
    print("Calculating NTSG (Global Efficient Core) portfolio...")
    
    # 1. Load MSCI World from local source file
    source_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "source")
    excel_path = os.path.join(source_dir, "world.xlsx")
    
    try:
        # Use column 0 (Date) and column 1 (Index Value)
        msci_world = pd.read_excel(excel_path, skiprows=5).iloc[:, [0, 1]]
        msci_world.columns = ['Date', 'Index']
        msci_world['Date'] = pd.to_datetime(msci_world['Date'])
        msci_world.set_index('Date', inplace=True)
        # Resample to monthly end
        world_m = msci_world['Index'].resample('ME').last().ffill()
        equity_ret = world_m.pct_change().fillna(0)
    except Exception as e:
        print(f"Error loading World data for NTSG: {e}")
        return pd.Series(dtype='float64')

    # 2. Bonds & Rates
    treasury = get_fred_series_raw("DGS10", "Yield") / 100
    tbill = get_fred_series_raw("DFF", "Rate") / 100
    
    if treasury.empty or tbill.empty:
        return pd.Series(dtype='float64')
        
    combined = pd.DataFrame({'equity_ret': equity_ret, 'yield': treasury['Yield'], 'rate': tbill['Rate']}).dropna()
    
    # Bond Return (Duration ~7.0)
    yield_chg = combined['yield'].diff().fillna(0)
    bond_ret = -7.0 * yield_chg + (combined['yield'].shift(1).fillna(combined['yield']) / 12)
    
    # Cash/Borrowing Cost
    cash_cost = combined['rate'] / 12
    
    # NTSG: 90% Equity + 60% Bonds - 50% Borrowing Cost
    ntsg_ret = (0.90 * combined['equity_ret'] + 
                0.60 * bond_ret - 
                0.50 * cash_cost)
    
    ntsg_index = 100 * (1 + ntsg_ret).cumprod()
    return ntsg_index.rename('ntsg_usd')


def get_eur_bonds_10y_portfolio(start_date="1980-01-01"):
    """Backtests the EUR Government Bonds 10y portfolio."""
    print("Calculating EUR Government Bonds 10y portfolio...")
    etf_ticker = "SXRQ.DE"
    duration = 8.2
    
    # 1. Synthetic Bond (Yield-Derived)
    yields = get_fred_series_raw("IRLTLT01DEM156N", "Yield")
    if yields.empty:
        return pd.Series(dtype='float64')
    
    yields = yields[yields.index >= start_date] / 100
    yields_m = yields.resample('ME').last()
    total_return = (yields_m.shift(1) / 12) + (-duration * yields_m.diff())
    total_return.iloc[0] = 0
    syn_index = 100 * (1 + total_return).cumprod()
    syn_index.columns = ['Synthetic_TR']
    
    # 2. Actual ETF Data
    try:
        etf_data = yf.download(etf_ticker, period="max", auto_adjust=True, progress=False)
        etf_close = etf_data['Close']
        if isinstance(etf_close, pd.DataFrame): etf_close = etf_close.iloc[:, 0]
        etf_m = etf_close.resample('ME').last()
        etf_m.name = 'ETF_TR'
        
        splice_date = etf_m.first_valid_index()
        if splice_date:
            ratio = etf_m.loc[splice_date] / syn_index.loc[splice_date, 'Synthetic_TR']
            history_eur = syn_index['Synthetic_TR'] * ratio
            history_eur = etf_m.combine_first(history_eur)
        else:
            history_eur = syn_index['Synthetic_TR']
    except Exception:
        history_eur = syn_index['Synthetic_TR']
        
    return history_eur.rename('eur_government_bonds_10y_eur')

def get_cash_portfolio(start_date="1999-01-04"):
    """Backtests the CASH portfolio (Euribor for EUR, T-Bill for USD)."""
    print("Calculating CASH portfolio (Local Market rates)...")
    credit_spread = 0.0050 # 50 bps
    
    # 1. EUR Cash (Euribor 3M + spread) spliced with ETF
    eur_rates = get_fred_series_raw("IR3TIB01EZM156N", "Rate")
    if not eur_rates.empty:
        eur_rates = eur_rates.resample('D').ffill()
        daily_ret_eur = (eur_rates['Rate'] / 100 + credit_spread) / 360
        nav_eur = 100 * (1 + daily_ret_eur.fillna(0)).cumprod()
        # Splicing with ERNE.AS
        try:
            etf = yf.download("ERNE.AS", start="2013-11-01", auto_adjust=True, progress=False)['Close']
            if isinstance(etf, pd.DataFrame): etf = etf.iloc[:, 0]
            splice_date = etf.first_valid_index()
            if splice_date:
                ratio = etf.loc[splice_date] / nav_eur.loc[splice_date]
                nav_eur = (nav_eur * ratio).combine_first(etf)
        except: pass
        cash_eur = nav_eur.resample('ME').last()
    
    # 2. USD Cash (3M T-Bill + spread)
    usd_rates = get_fred_series_raw("DTB3", "Rate")
    if not usd_rates.empty:
        usd_rates = usd_rates.resample('D').ffill()
        daily_ret_usd = (usd_rates['Rate'] / 100 + credit_spread) / 360
        nav_usd = 100 * (1 + daily_ret_usd.fillna(0)).cumprod()
        cash_usd = nav_usd.resample('ME').last()
        
    res = pd.DataFrame()
    if 'cash_eur' in locals(): res['cash_eur'] = cash_eur
    if 'cash_usd' in locals(): res['cash_usd'] = cash_usd
    return res

def get_dbmf_portfolio():
    """Proxy for iMGP DBi Managed Futures using SG CTA Index and actual DBMF data."""
    print("Calculating DBMF portfolio (SG CTA Index + DBMF)...")
    
    # 1. Load SG CTA proxy data
    df_proxy = pd.DataFrame(SG_CTA_INDEX_DATA)
    df_proxy['Date'] = pd.to_datetime(df_proxy['date'])
    df_proxy = df_proxy.set_index('Date')['value']
    
    # Filter to pre-DBMF launch
    dbmf_launch = pd.to_datetime('2019-05-08')
    df_proxy = df_proxy[df_proxy.index < dbmf_launch]
    
    # 2. Fetch DBMF data
    dbmf_actual = get_monthly_yf_data("DBMF", start_date="2019-05-08")
    
    if dbmf_actual.empty:
        return df_proxy.rename('dbmf_usd')
        
    # Scaling to match proxy (Scale DBMF starting at the last proxy value)
    last_proxy_val = df_proxy.iloc[-1]
    first_dbmf_val = dbmf_actual.iloc[0]
    scaling = last_proxy_val / first_dbmf_val
    dbmf_scaled = dbmf_actual * scaling
    
    # Combine (Concat and drop overlap if any)
    dbmf_combined = pd.concat([df_proxy, dbmf_scaled])
    dbmf_combined = dbmf_combined[~dbmf_combined.index.duplicated(keep='last')]
    
    return dbmf_combined.rename('dbmf_usd')

def process_files():
    base_path = os.path.dirname(os.path.abspath(__file__))
    os.chdir(base_path)
    
    source_dir = os.path.join(base_path, "source")
    files = glob.glob(os.path.join(source_dir, "*.xlsx"))
    output_file = 'alphatrace_data.xlsx'
    files = [f for f in files if not os.path.basename(f).startswith('~$')]
    
    if not files:
        print(f"No Excel files found in {source_dir}.")
        return

    print(f"Found {len(files)} MSCI files.")
    
    all_data = []
    for file_path in sorted(files):
        print(f"Reading {os.path.basename(file_path)}...")
        try:
            df = pd.read_excel(file_path, skiprows=5)
            df = df.iloc[:, [0, 1]]
            df.columns = ['Date', 'Value']
            df['Date'] = pd.to_datetime(df['Date'], errors='coerce')
            df = df.dropna(subset=['Date', 'Value'])
            asset_name = os.path.splitext(os.path.basename(file_path))[0]
            df = df.set_index('Date')
            df.columns = [asset_name]
            
            # Apply TER deduction if mapping exists
            if asset_name in TER_MAPPING:
                ter = TER_MAPPING[asset_name]
                monthly_ter = ter / 12
                # Calculate returns, deduct TER from second month onwards
                rets = df[asset_name].pct_change()
                adj_rets = rets - monthly_ter
                adj_rets.iloc[0] = 0  # No change for the very first data point
                # Reconstruct the index starting from first_val
                first_val = df[asset_name].iloc[0]
                df[asset_name] = first_val * (1 + adj_rets).cumprod()
                print(f"  Applied TER of {ter*100:.2f}% to {asset_name}")

            all_data.append(df)
        except Exception as e:
            print(f"Error processing {os.path.basename(file_path)}: {e}")

    if not all_data: return

    combined = pd.concat(all_data, axis=1, join='outer')
    combined.sort_index(inplace=True)
    
    # 1. Coletti Portfolio
    portfolio_assets = ['switzerland', 'pacific', 'japan', 'uk', 'world']
    available_portfolio_assets = [a for a in portfolio_assets if a in combined.columns]
    if len(available_portfolio_assets) == 5:
        combined['coletti_eq_usd'] = combined[available_portfolio_assets].mul(0.2).sum(axis=1, min_count=5)
    
    # 2. Add Additional YFinance Assets
    print("Fetching additional YFinance assets...")
    for name, ticker in YF_ASSETS.items():
        series = get_monthly_yf_data(ticker)
        if series.empty: continue
        
        # Apply TER if mapping exists
        asset_key = name.replace('_usd', '')
        if asset_key in TER_MAPPING:
            ter = TER_MAPPING[asset_key]
            monthly_ter = ter / 12
            # Compute returns on valid data
            rets = series.pct_change().fillna(0)
            adj_rets = rets - monthly_ter
            adj_rets.iloc[0] = 0
            # Reconstruct series
            series = series.iloc[0] * (1 + adj_rets).cumprod()
            print(f"  Applied TER of {ter*100:.2f}% to {name}")
            
        combined = combined.join(series.rename(name), how='outer')
        # Standardize joining: ffill from start of asset to end of combined index if needed
        # but only for these tracked indices/assets
        combined[name] = combined[name].ffill()

    # 3. Add DBMF Portfolio
    df_dbmf = get_dbmf_portfolio()
    if not df_dbmf.empty:
        col = 'dbmf_usd'
        ter = TER_MAPPING['dbmf']
        monthly_ter = ter / 12
        rets = df_dbmf.pct_change()
        adj_rets = rets - monthly_ter
        adj_rets.iloc[0] = 0
        df_dbmf = df_dbmf.iloc[0] * (1 + adj_rets).cumprod()
        print(f"  Applied TER of {ter*100:.2f}% to dbmf")
        combined = combined.join(df_dbmf, how='outer')

    # 4. Add NTSG Portfolio
    df_ntsg = get_ntsg_portfolio()
    if not df_ntsg.empty:
        ter = TER_MAPPING['ntsg']
        monthly_ter = ter / 12
        rets = df_ntsg.pct_change()
        adj_rets = rets - monthly_ter
        adj_rets.iloc[0] = 0
        df_ntsg = df_ntsg.iloc[0] * (1 + adj_rets).cumprod()
        print(f"  Applied TER of {ter*100:.2f}% to ntsg")
        combined = combined.join(df_ntsg, how='outer')

    # 6. Add EUR Government Bonds 10y
    df_bonds = get_eur_bonds_10y_portfolio()
    if not df_bonds.empty:
        ter = TER_MAPPING['eur_government_bonds_10y']
        monthly_ter = ter / 12
        rets = df_bonds.pct_change()
        adj_rets = rets - monthly_ter
        adj_rets.iloc[0] = 0
        df_bonds = df_bonds.iloc[0] * (1 + adj_rets).cumprod()
        print(f"  Applied TER of {ter*100:.2f}% to eur_government_bonds_10y")
        combined = combined.join(df_bonds.to_frame(), how='outer')

    # 5. Add Gold Portfolio from CSV
    # https://www.macrotrends.net/1333/historical-gold-prices-100-year-chart
    print("Reading gold.csv...")
    gold_csv_path = os.path.join(source_dir, "gold.csv")
    if os.path.exists(gold_csv_path):
        try:
            df_gold = pd.read_csv(gold_csv_path)
            # Ensure columns are Date, Value regardless of CSV header if possible, 
            # but here we saw it is "Date","Value"
            df_gold.columns = ['Date', 'Value']
            df_gold['Date'] = pd.to_datetime(df_gold['Date'])
            df_gold.set_index('Date', inplace=True)
            # Resample to month end
            df_gold = df_gold['Value'].resample('ME').last().ffill()
            
            ter = TER_MAPPING['gold']
            monthly_ter = ter / 12
            rets = df_gold.pct_change().fillna(0)
            adj_rets = rets - monthly_ter
            adj_rets.iloc[0] = 0
            df_gold = df_gold.iloc[0] * (1 + adj_rets).cumprod()
            print(f"  Applied TER of {ter*100:.2f}% to gold_usd")
            combined = combined.join(df_gold.rename('gold_usd'), how='outer')
            combined['gold_usd'] = combined['gold_usd'].ffill()
        except Exception as e:
            print(f"Error processing gold.csv: {e}")

    # 7. Add CASH Portfolio
    df_cash = get_cash_portfolio()
    if not df_cash.empty:
        ter = TER_MAPPING['cash']
        monthly_ter = ter / 12
        for col in df_cash.columns:
            rets = df_cash[col].pct_change()
            adj_rets = rets - monthly_ter
            adj_rets.iloc[0] = 0
            df_cash[col] = df_cash[col].iloc[0] * (1 + adj_rets).cumprod()
            print(f"  Applied TER of {ter*100:.2f}% to {col}")
        combined = combined.join(df_cash, how='outer')

    # 8. Fetch Exchange Rates and convert columns
    print("Fetching exchange rates (FRED + YFinance fallback)...")
    try:
        fx_fred = pdr.get_data_fred('DEXUSEU', start="1999-01-01")['DEXUSEU']
        dem_usd = get_fred_series_raw("EXGEUS", "Rate")
        if not dem_usd.empty:
            synthetic_eur_usd = 1.95583 / dem_usd['Rate']
            fx_fred = fx_fred.combine_first(synthetic_eur_usd)
            
        fx_yf = get_monthly_yf_data("EURUSD=X", start_date="2025-01-01")
        fx_rates = fx_fred.combine_first(fx_yf).ffill()
        full_idx = combined.index.union(fx_rates.index).sort_values()
        fx_rates = fx_rates.reindex(full_idx).ffill().reindex(combined.index)
        
        print("Calculating cross-currency columns...")
        for col in list(combined.columns):
            if col in ['cash_usd', 'cash_eur']: continue # Skip local cash versions
            if col.endswith('_usd'):
                combined[col.replace('_usd', '_eur')] = combined[col] / fx_rates
            elif col.endswith('_eur'):
                combined[col.replace('_eur', '_usd')] = combined[col] * fx_rates
            else:
                combined[f"{col}_eur"] = combined[col] / fx_rates
    except Exception as e: print(f"Warning FX: {e}")

    norm_targets = ['coletti_eq_usd', 'coletti_eq_eur', 
                    'eur_government_bonds_10y_usd', 'eur_government_bonds_10y_eur',
                    'cash_usd', 'cash_eur',
                    'dbmf_usd', 'dbmf_eur',
                    'ntsg_usd', 'ntsg_eur',
                    'dgeix_usd', 'dgeix_eur',
                    'dfemx_usd', 'dfemx_eur']
    for col in norm_targets:
        if col in combined.columns:
            f_idx = combined[col].first_valid_index()
            if f_idx is not None:
                fv = combined.loc[f_idx, col]
                if fv != 0: combined[col] = (combined[col] / fv) * 100

    # 9. Exclude component columns
    to_drop = ['japan', 'uk', 'pacific', 'switzerland', 'japan_eur', 'uk_eur', 'pacific_eur', 'switzerland_eur']
    combined = combined.drop(columns=[c for c in to_drop if c in combined.columns])

    # 10. Header Renaming
    base_mapping = {
        "us_small_cap_value": "US Small Cap Value",
        "world": "MSCI World",
        "world_acwi": "MSCI World ACWI",
        "world_acwi_imi": "MSCI World ACWI IMI",
        "world_imi": "MSCI World IMI",
        "world_min_vol": "MSCI World Minimum Volatility",
        "world_momentum": "MSCI World Momentum",
        "world_quality": "MSCI World Quality",
        "world_small_cap_value": "MSCI World Small Cap Value",
        "world_value": "MSCI World Value",
        "emerging_market_imi": "MSCI Emerging Markets IMI",
        "coletti_eq": "Coletti Equity",
        "gold": "Gold",
        "sp500_tr": "S&P 500 Total Return",
        "brk_b": "Berkshire Hathaway",
        "nasdaq_tr": "Nasdaq Total Return",
        "dbmf": "DBMF (Managed Futures)",
        "dgeix": "DFA Global Equity (DGEIX)",
        "dfemx": "DFA Emerging Markets",
        "ntsg": "WisdomTree Global Efficient Core (NTSG)",
        "eur_government_bonds_10y": "EUR Government Bonds 10y",
        "cash": "CASH"
    }
    
    rena = {}
    for col in combined.columns:
        if col == 'Date': continue
        found = False
        for k, v in base_mapping.items():
            if col == k or col == f"{k}_usd":
                rena[col] = f"{v} (USD)"; found = True; break
            elif col == f"{k}_eur":
                rena[col] = f"{v} (EUR)"; found = True; break
        if not found: rena[col] = col.replace('_', ' ').title()
    combined.rename(columns=rena, inplace=True)

    # 11. Final Formatting
    combined.index = combined.index + pd.offsets.MonthEnd(0)
    combined = combined.sort_index().groupby(combined.index).last()
    combined.reset_index(inplace=True)
    combined.rename(columns={'index': 'Date'}, inplace=True)
    combined['Date'] = combined['Date'].dt.strftime('%Y-%m-%d')
    
    writer = pd.ExcelWriter(output_file, engine='xlsxwriter')
    combined.to_excel(writer, index=False, sheet_name='Data')
    writer.sheets['Data'].freeze_panes(1, 1)
    writer.close()
    print(f"Success! Final Shape: {combined.shape}")

if __name__ == "__main__":
    process_files()
