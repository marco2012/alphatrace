import pandas as pd
import glob
import os
import pandas_datareader as pdr
import pandas_datareader.data as web
import yfinance as yf
import numpy as np
import requests
import logging
import sys
from io import StringIO
from datetime import datetime

# ---------------------------------------------------------
# Logging Configuration
# ---------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('process.log')
    ]
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------
# Configuration
# ---------------------------------------------------------
# Configuration for additional YFinance assets
YF_ASSETS = {
    "sp500_tr_usd": "^SP500TR",   # S&P 500 Total Return
    "brk_b_usd": "BRK-B",         # Berkshire Hathaway
    "nasdaq_tr_usd": "QQQ",       # Nasdaq TR Proxy
    "dgeix_usd": "DGEIX",         # Dimensional US Core Equity I
    "dfemx_usd": "DFEMX",         # DFA Emerging Markets
    "commodity_usd": "^BCOM",     # Bloomberg Commodity Index
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
    "degc": 0.0026,
    "xeon": 0.0010,
    "eur_government_bonds_10y": 0.0015,
    "ntsg": 0.0025,
    "gold": 0.0012,
    "nasdaq_tr": 0.0030,
    "sp500_tr": 0.0007,
    "commodity": 0.0030,
    "commodity_enhanced": 0.0070,
    "lg_commodity": 0.0030,
    "roll_select_commodity": 0.0028,
    "ubs_commodity": 0.0034,
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
    """Fetch series from St. Louis Fed (FRED). Tries pandas_datareader first, then direct CSV."""
    # Method 1: pandas_datareader
    try:
        # Defaults to last 30 years if not specified
        df = web.DataReader(series_id, 'fred', start="1990-01-01")
        df.columns = [name]
        return df
    except Exception as e:
        logger.warning(f"pandas_datareader failed for {series_id}: {e}. Retrying with direct CSV download.")

    # Method 2: Direct CSV
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}"
    try:
        response = requests.get(url)
        if response.status_code == 200:
            df = pd.read_csv(StringIO(response.text), index_col=0, parse_dates=True)
            df = df.apply(pd.to_numeric, errors='coerce').dropna()
            df.columns = [name]
            return df
        else:
             logger.error(f"Failed to fetch {series_id} via CSV. Status: {response.status_code}")
    except Exception as e:
        logger.error(f"Error fetching {series_id} via CSV: {e}")
    
    return pd.DataFrame()

def get_monthly_yf_data(ticker, start_date="1970-01-01"):
    """Downloads and formats yfinance monthly data."""
    logger.info(f"Downloading {ticker} from {start_date}...")
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
        logger.error(f"Error downloading {ticker}: {e}")
        return pd.Series(dtype='float64')

def get_degc_portfolio(start_date="1999-01-01"):
    """
    Dimensional Global Core Equity (DEGC) Proxy:
    50% DFUSX (US Core)
    30% DFIVX (Intl Value)
    20% DFISX (Intl Small)
    """
    logger.info("Calculating Dimensional Global Core Equity (DEGC) portfolio...")
    
    funds = {
        "DFUSX": 0.50,
        "DFIVX": 0.30,
        "DFISX": 0.20
    }
    
    data_frames = []
    for ticker in funds.keys():
        series = get_monthly_yf_data(ticker, start_date=start_date)
        if series.empty:
            logger.error(f"Missing data for {ticker}")
            return pd.Series(dtype='float64')
        # Normalize to 1.0 at start
        series = series / series.iloc[0]
        data_frames.append(series.rename(ticker))
        
    combined = pd.concat(data_frames, axis=1).dropna()
    
    # Calculate weighted returns
    # Portfolio Value = sum(weight * norm_price)
    port_val = (combined['DFUSX'] * funds['DFUSX'] + 
                combined['DFIVX'] * funds['DFIVX'] + 
                combined['DFISX'] * funds['DFISX'])
    
    # Normalize to 100
    port_val = (port_val / port_val.iloc[0]) * 100
    
    return port_val.rename('degc_usd')

def get_ntsg_portfolio(start_date="1999-01-01"):
    """
    NTSG Proxy: 90% MSCI World + 60% Global Bond Futures (implied financing).
    Global Basket: ~70% US, 15% EUR, 8% JPY, 7% GBP.
    """
    logger.info("Calculating NTSG (Global Efficient Core) portfolio with Global Data...")

    # ---------------------------------------------------------
    # 1. Load MSCI World (Equity Component)
    # ---------------------------------------------------------
    source_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "source")
    excel_path = os.path.join(source_dir, "world.xlsx")
    
    try:
        # ENSURE this Excel contains "Net Total Return" or "Gross Total Return", not Price Index
        msci_world = pd.read_excel(excel_path, skiprows=5).iloc[:, [0, 1]]
        msci_world.columns = ['Date', 'Index']
        msci_world['Date'] = pd.to_datetime(msci_world['Date'])
        msci_world.set_index('Date', inplace=True)
        # Resample to monthly end
        world_m = msci_world['Index'].resample('ME').last().ffill()
        equity_ret = world_m.pct_change().fillna(0)
    except Exception as e:
        logger.error(f"Error loading World data: {e}")
        return pd.Series(dtype='float64')

    # ---------------------------------------------------------
    # 2. Define Global Weights (Approx. Currency Weights)
    # ---------------------------------------------------------
    # NTSG targets currency weights of MSCI World. Approx historical averages:
    w = {
        'US': 0.68,  # USD
        'EU': 0.16,  # EUR (Germany Proxy)
        'JP': 0.09,  # JPY
        'UK': 0.07   # GBP
    }

    # ---------------------------------------------------------
    # 3. Fetch Global Data (Yields & Rates) from FRED
    # ---------------------------------------------------------
    # Tickers: 10Y Govt Yields (Monthly) & Immediate Rates (Monthly)
    tickers = {
        # United States
        'US_Yield': 'IRLTLT01USM156N', 'US_Rate': 'FEDFUNDS',
        # Germany (Euro Proxy)
        'EU_Yield': 'IRLTLT01DEM156N', 'EU_Rate': 'IRSTCI01EZM156N',
        # Japan
        'JP_Yield': 'IRLTLT01JPM156N', 'JP_Rate': 'IRSTCI01JPM156N',
        # United Kingdom
        'UK_Yield': 'IRLTLT01GBM156N', 'UK_Rate': 'IRSTCI01GBM156N',
    }
    
    data_frames = []
    for name, ticker in tickers.items():
        df = get_fred_series_raw(ticker, name)
        # Resample to monthly end to match equity dates
        df = df.resample('ME').last() 
        data_frames.append(df)
        
    if not data_frames:
        return pd.Series(dtype='float64')

    # Combine and Forward Fill missing data
    macro_data = pd.concat(data_frames, axis=1).ffill().dropna()
    
    # ---------------------------------------------------------
    # 4. Construct Composite Yield & Borrowing Cost
    # ---------------------------------------------------------
    # Global 10Y Yield Composite
    macro_data['Global_Yield'] = (
        w['US'] * macro_data['US_Yield'] +
        w['EU'] * macro_data['EU_Yield'] +
        w['JP'] * macro_data['JP_Yield'] +
        w['UK'] * macro_data['UK_Yield']
    ) / 100  # Convert to decimal

    # Global Cash Rate Composite (Cost of Leverage)
    macro_data['Global_Rate'] = (
        w['US'] * macro_data['US_Rate'] +
        w['EU'] * macro_data['EU_Rate'] +
        w['JP'] * macro_data['JP_Rate'] +
        w['UK'] * macro_data['UK_Rate']
    ) / 100  # Convert to decimal

    # Align with Equity Data
    combined = pd.concat([equity_ret, macro_data], axis=1).dropna()
    combined.rename(columns={'Index': 'equity_ret'}, inplace=True)

    # ---------------------------------------------------------
    # 5. Calculate Returns
    # ---------------------------------------------------------
    # Global Bond Return (Target Duration ~7.0)
    # Bond Ret ~= Yield / 12 - Duration * Change_in_Yield
    yield_chg = combined['Global_Yield'].diff().fillna(0)
    bond_ret = (combined['Global_Yield'].shift(1).fillna(combined['Global_Yield']) / 12) - (7.0 * yield_chg)
    
    # Cash/Borrowing Cost (Weighted average of local risk-free rates)
    cash_cost = combined['Global_Rate'] / 12
    
    # NTSG Formula: 90% Equity + 60% Bond Futures (Excess Return)
    # Excess Return = (Bond_Ret - Cash_Cost)
    # Portfolio = 0.90 * Equity + 0.10 * Cash + 0.60 * Excess_Bond
    # Mathematically simplifies to:
    ntsg_ret = (0.90 * combined['equity_ret'] + 
                0.60 * bond_ret - 
                0.50 * cash_cost)
    
    ntsg_index = 100 * (1 + ntsg_ret).cumprod()
    return ntsg_index.rename('ntsg_usd')

def get_eur_bonds_10y_portfolio(start_date="1980-01-01"):
    """Backtests the EUR Government Bonds 10y portfolio."""
    logger.info("Calculating EUR Government Bonds 10y portfolio...")
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

def get_xeon_portfolio(start_date="1999-01-04"):
    """
    Backtests LU0290358497 (XEON) in EUR and USD.
    EUR Synthetic (1999-2007): EONIA/€STR+8.5bps minus 0.10% fees.
    EUR Actual (2007-Present): XEON.DE Adjusted Close.
    """
    logger.info("Calculating Xtrackers II EUR Overnight Rate Swap (XEON) portfolio...")
    
    # 1. Fetch EUR Rates
    # IRSTCI01EZM156N: Euro Area Interbank Rate (EONIA proxy)
    # ECBESTRVOLWGTTRMDMNRT: Euro Short-Term Rate (€STR)
    eonia_hist = get_fred_series_raw("IRSTCI01EZM156N", "Rate")
    estr_curr = get_fred_series_raw("ECBESTRVOLWGTTRMDMNRT", "Rate")
    
    if eonia_hist.empty or estr_curr.empty:
        logger.warning("Failed to fetch XEON reference rates.")
        return pd.DataFrame()

    # Adjust €STR to match EONIA methodology (€STR + 8.5 bps fixed spread)
    estr_curr['Rate'] = estr_curr['Rate'] + 0.085
    rates = eonia_hist.loc[:'2019-09-30'].combine_first(estr_curr).ffill()
    
    # 2. Calculate Synthetic EUR NAV
    daily_rates = rates.resample('D').ffill().loc[start_date:]
    TER = 0.0010  # 0.10% Expense Ratio
    daily_rates['Daily_Ret'] = (daily_rates['Rate'] / 100 - TER) / 360
    synthetic_eur = 100 * (1 + daily_rates['Daily_Ret'].fillna(0)).cumprod()

    # 3. Splice with Actual ETF Data (XEON.DE)
    xeon_eur = synthetic_eur
    try:
        etf_ticker = "XEON.DE"
        etf_data = yf.download(etf_ticker, start="2007-01-01", progress=False, auto_adjust=True)
        if not etf_data.empty:
            if isinstance(etf_data.columns, pd.MultiIndex):
                etf_close = etf_data['Close'].iloc[:, 0]
            else:
                etf_close = etf_data['Close']
            
            splice_date = etf_close.first_valid_index()
            if splice_date and splice_date in synthetic_eur.index:
                scale_factor = etf_close.loc[splice_date] / synthetic_eur.loc[splice_date]
                synthetic_scaled = synthetic_eur.loc[:splice_date] * scale_factor
                xeon_eur = pd.concat([synthetic_scaled[:-1], etf_close.loc[splice_date:]])
    except Exception as e:
        logger.error(f"Error fetching XEON ETF data: {e}")

    # 4. Fetch USD Exchange Rate for unhedged USD version
    fx_rates = get_fred_series_raw("DEXUSEU", "Rate")
    if not fx_rates.empty:
        aligned_fx = fx_rates['Rate'].reindex(xeon_eur.index).ffill()
        xeon_usd = xeon_eur * aligned_fx
    else:
        xeon_usd = pd.Series(dtype=float)

    res = pd.DataFrame()
    res['xeon_eur'] = xeon_eur.resample('ME').last()
    if not xeon_usd.empty:
        res['xeon_usd'] = xeon_usd.resample('ME').last()
        
    return res

def get_dbmf_portfolio():
    """Proxy for iMGP DBi Managed Futures using SG CTA Index and actual DBMF data."""
    logger.info("Calculating DBMF portfolio (SG CTA Index + DBMF)...")
    
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

def get_enhanced_commodity_portfolio(start_year=1991):
    """
    Constructs the WisdomTree Enhanced Commodity portfolio.
    Uses BCOM proxy (enhanced by 1.5% alpha) spliced with WCOA.L ETF.
    """
    logger.info("Calculating WisdomTree Enhanced Commodity portfolio...")
    
    # 1. Get Proxy Data (BCOM)
    proxy_rets = pd.Series(dtype='float64')
    try:
        # Try downloading first
        df = yf.download("^BCOM", start=f"{start_year}-01-01", interval="1mo", progress=False)
        if not df.empty:
            if isinstance(df.columns, pd.MultiIndex):
                prices = df['Close'].iloc[:, 0]
            else:
                prices = df['Close']
            
            # Resample to month end to match other data
            prices = prices.resample('ME').last()
            monthly_rets = prices.pct_change().dropna()
            
            # Use synthetic if download is too short (e.g. starts after 1992)
            if monthly_rets.empty or monthly_rets.index[0].year > start_year + 1:
                logger.warning(f"  > BCOM download short. Using synthetic history.")
                proxy_rets = generate_synthetic_monthly_history(start_year)
            else:
                proxy_rets = monthly_rets
        else:
            proxy_rets = generate_synthetic_monthly_history(start_year)
    except Exception as e:
        logger.warning(f"  > BCOM download failed ({e}). Using synthetic history.")
        proxy_rets = generate_synthetic_monthly_history(start_year)

    if proxy_rets.empty:
        return pd.Series(dtype='float64')

    # 2. Get ETF Data (WCOA.L)
    etf_rets = pd.Series(dtype='float64')
    try:
        df_etf = yf.download("WCOA.L", start="2016-05-01", interval="1mo", progress=False)
        if not df_etf.empty:
            if isinstance(df_etf.columns, pd.MultiIndex):
                prices_etf = df_etf['Close'].iloc[:, 0]
            else:
                prices_etf = df_etf['Close']
            
            prices_etf = prices_etf.resample('ME').last()
            etf_rets = prices_etf.pct_change().dropna()
    except Exception as e:
        logger.error(f"  > WCOA.L download failed: {e}")

    # 3. Apply Enhancement to Proxy (1991-2016)
    # 1.5% Annual Alpha -> ~0.124% Monthly
    monthly_alpha = (1.015)**(1/12) - 1
    proxy_rets_enhanced = proxy_rets + monthly_alpha
    
    # 4. Stitch Returns
    if not etf_rets.empty:
        etf_start_date = etf_rets.index[0]
        proxy_rets_enhanced = proxy_rets_enhanced[proxy_rets_enhanced.index < etf_start_date]
        combined_rets = pd.concat([proxy_rets_enhanced, etf_rets])
    else:
        combined_rets = proxy_rets_enhanced

    # 5. Construct Index
    # Start at 100
    commodity_index = 100 * (1 + combined_rets).cumprod()
    return commodity_index.rename('commodity_enhanced_usd')

def get_lg_multistrategy_portfolio(start_date='1991-01-01'):
    """
    Constructs the L&G Multi-Strategy Enhanced Commodities portfolio.
    Uses ^SPGSCI (S&P GSCI) before 2006-02-06, and DBC (Invesco DB Commodity Index) afterwards.
    Calculates on daily data then resamples to monthly.
    """
    logger.info("Calculating L&G Multi-Strategy Enhanced Commodities portfolio...")
    tickers = ['^SPGSCI', 'DBC']
    switch_date = '2006-02-06'
    
    try:
        # Download daily data
        data = yf.download(tickers, start=start_date, interval="1d", auto_adjust=True, progress=False)
        
        # Handle MultiIndex columns
        if isinstance(data.columns, pd.MultiIndex):
            if 'Close' in data.columns.get_level_values(0):
                df = data['Close']
            else:
                df = data.iloc[:, 0] # Fallback
        else:
            df = data['Close'] if 'Close' in data.columns else data

        # Check if we have both columns
        if '^SPGSCI' not in df.columns or 'DBC' not in df.columns:
            logger.warning("  > Missing ticker data for LG Strategy.")
            return pd.Series(dtype='float64')

        # Calculate daily returns
        returns = df.pct_change()
        
        # Splicing Logic
        cond_early = returns.index < switch_date
        strat_ret = np.where(
            cond_early,
            returns['^SPGSCI'],
            returns['DBC']
        )
        
        strat_series = pd.Series(strat_ret, index=returns.index).fillna(0)
        
        # Build Index (Base 100)
        usd_index = 100 * (1 + strat_series).cumprod()
        
        # Resample to Monthly End
        usd_index_m = usd_index.resample('ME').last()
        
        return usd_index_m.rename('lg_commodity_usd')

    except Exception as e:
        logger.error(f"  > Error calculating LG Strategy: {e}")
        return pd.Series(dtype='float64')

def get_bloomberg_roll_select_portfolio(start_date='1991-01-01'):
    """
    Constructs the Bloomberg Roll Select Commodity portfolio.
    3-Phase Splicing:
      - 1991-2012: S&P GSCI (^SPGSCI)
      - 2012-2018: Bloomberg Commodity Index (^BCOM)
      - 2018-Pres: iShares Bloomberg Roll Select Commodity Strategy ETF (CMDY)
    """
    logger.info("Calculating Bloomberg Roll Select Commodity portfolio...")
    
    ticker_early = '^SPGSCI'
    ticker_mid = '^BCOM'
    ticker_modern = 'CMDY'
    
    switch_date_1 = '2012-06-01'
    switch_date_2 = '2018-04-03'
    
    tickers = [ticker_early, ticker_mid, ticker_modern]
    
    try:
        data = yf.download(tickers, start=start_date, interval="1d", auto_adjust=True, progress=False)
        
        # Handle columns
        if isinstance(data.columns, pd.MultiIndex):
            if 'Close' in data.columns.get_level_values(0):
                df = data['Close']
            else:
                df = data.iloc[:, 0]
        else:
            df = data['Close'] if 'Close' in data.columns else data

        # Calculate returns
        returns = df.pct_change()
        
        # Splicing Logic
        conditions = [
            returns.index < switch_date_1,
            (returns.index >= switch_date_1) & (returns.index < switch_date_2),
            returns.index >= switch_date_2
        ]
        
        # Ensure we have the columns
        c1 = returns[ticker_early] if ticker_early in returns.columns else pd.Series(0, index=returns.index)
        c2 = returns[ticker_mid] if ticker_mid in returns.columns else pd.Series(0, index=returns.index)
        c3 = returns[ticker_modern] if ticker_modern in returns.columns else pd.Series(0, index=returns.index)
        
        choices = [c1, c2, c3]
        
        synthetic_returns = np.select(conditions, choices, default=0)
        strat_series = pd.Series(synthetic_returns, index=returns.index).fillna(0)
        
        # Build Index
        usd_index = 100 * (1 + strat_series).cumprod()
        
        # Resample
        usd_index_m = usd_index.resample('ME').last()
        return usd_index_m.rename('roll_select_commodity_usd')

    except Exception as e:
        logger.error(f"  > Error calculating Bloomberg Roll Select: {e}")
        return pd.Series(dtype='float64')

def get_ubs_cmci_portfolio(start_date='1991-01-01'):
    """
    Constructs the UBS CMCI Composite Commodity portfolio.
    Splicing Logic (Daily):
      1. Primary ETF: UC14.L (UBS CMCI Composite SF UCITS ETF)
      2. Strategic Index: ^CMCIER (UBS Bloomberg CMCI Composite Excess Return)
      3. Long-term Proxy: ^SPGSCI (S&P GSCI Index)
    Returns overwrite in that priority order.
    """
    logger.info("Calculating UBS CMCI Composite Commodity portfolio...")
    
    ticker_etf = "UC14.L"
    ticker_index = "^CMCIER"
    ticker_proxy = "^SPGSCI"
    
    try:
        # Download all at once
        tickers = [ticker_etf, ticker_index, ticker_proxy]
        data = yf.download(tickers, start=start_date, interval="1d", auto_adjust=True, progress=False)
        
        # Handle columns
        if isinstance(data.columns, pd.MultiIndex):
            if 'Close' in data.columns.get_level_values(0):
                df = data['Close']
            else:
                df = data.iloc[:, 0]
        else:
            df = data['Close'] if 'Close' in data.columns else data

        # Calculate daily returns
        returns = df.pct_change()
        
        # Ensure we have the columns
        c_etf = returns[ticker_etf] if ticker_etf in returns.columns else pd.Series(dtype='float64')
        c_index = returns[ticker_index] if ticker_index in returns.columns else pd.Series(dtype='float64')
        c_proxy = returns[ticker_proxy] if ticker_proxy in returns.columns else pd.Series(dtype='float64')

        if c_proxy.empty:
            logger.warning("  > Missing proxy ^SPGSCI for UBS CMCI.")
            return pd.Series(dtype='float64')

        # Splicing: Start with Proxy, overwrite with Index, then ETF
        combined_returns = c_proxy.copy()
        
        if not c_index.empty:
            common = combined_returns.index.intersection(c_index.dropna().index)
            combined_returns.loc[common] = c_index.loc[common]
            
        if not c_etf.empty:
            common = combined_returns.index.intersection(c_etf.dropna().index)
            combined_returns.loc[common] = c_etf.loc[common]
            
        combined_returns = combined_returns.fillna(0) # Handle remaining NaNs
        
        # Build Index
        usd_index = 100 * (1 + combined_returns).cumprod()
        
        # Resample to Monthly
        usd_index_m = usd_index.resample('ME').last()
        return usd_index_m.rename('ubs_commodity_usd')

    except Exception as e:
        logger.error(f"  > Error calculating UBS CMCI: {e}")
        return pd.Series(dtype='float64')

def process_files():
    logger.info("Starting Data Processing...")
    base_path = os.path.dirname(os.path.abspath(__file__))
    os.chdir(base_path)
    
    source_dir = os.path.join(base_path, "source")
    files = glob.glob(os.path.join(source_dir, "*.xlsx"))
    output_file = 'alphatrace_data.xlsx'
    files = [f for f in files if not os.path.basename(f).startswith('~$')]
    
    if not files:
        logger.warning(f"No Excel files found in {source_dir}.")
        return

    logger.info(f"Found {len(files)} MSCI files.")
    
    all_data = []
    for file_path in sorted(files):
        logger.info(f"Reading {os.path.basename(file_path)}...")
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
                logger.info(f"  Applied TER of {ter*100:.2f}% to {asset_name}")

            all_data.append(df)
        except Exception as e:
            logger.error(f"Error processing {os.path.basename(file_path)}: {e}")

    if not all_data: return

    combined = pd.concat(all_data, axis=1, join='outer')
    combined.sort_index(inplace=True)
    
    # 2. Add Additional YFinance Assets
    logger.info("Fetching additional YFinance assets...")
    for name, ticker in YF_ASSETS.items():
        series = get_monthly_yf_data(ticker)
        
        # Backfill DGEIX with World ACWI IMI
        if name == 'dgeix_usd' and not series.empty:
            try:
                proxy_path = os.path.join(source_dir, "world_acwi_imi.xlsx")
                if os.path.exists(proxy_path):
                    logger.info("  Backfilling DGEIX with World ACWI IMI...")
                    pdf = pd.read_excel(proxy_path, skiprows=5).iloc[:, [0, 1]]
                    pdf.columns = ['Date', 'Value']
                    pdf['Date'] = pd.to_datetime(pdf['Date'], errors='coerce')
                    pdf.set_index('Date', inplace=True)
                    # Resample to monthly end
                    p_series = pdf['Value'].resample('ME').last().ffill()
                    
                    start_date = series.first_valid_index()
                    if start_date:
                        # Calculate returns
                        p_rets = p_series.pct_change().dropna()
                        p_rets = p_rets[p_rets.index < start_date]
                        
                        d_rets = series.pct_change().dropna()
                        
                        # Combine
                        combined_rets = pd.concat([p_rets, d_rets])
                        
                        # Reconstruct Series (Base 100)
                        series = 100 * (1 + combined_rets).cumprod()
            except Exception as e:
                logger.error(f"Error backfilling DGEIX: {e}")

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
            logger.info(f"  Applied TER of {ter*100:.2f}% to {name}")
            
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
        logger.info(f"  Applied TER of {ter*100:.2f}% to dbmf")
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
        logger.info(f"  Applied TER of {ter*100:.2f}% to ntsg")
        combined = combined.join(df_ntsg, how='outer')

    # 4.5 Add DEGC Portfolio
    df_degc = get_degc_portfolio()
    if not df_degc.empty:
        ter = TER_MAPPING['degc']
        monthly_ter = ter / 12
        rets = df_degc.pct_change()
        adj_rets = rets - monthly_ter
        adj_rets.iloc[0] = 0
        df_degc = df_degc.iloc[0] * (1 + adj_rets).cumprod()
        logger.info(f"  Applied TER of {ter*100:.2f}% to degc")
        combined = combined.join(df_degc, how='outer')

    # 6. Add EUR Government Bonds 10y
    df_bonds = get_eur_bonds_10y_portfolio()
    if not df_bonds.empty:
        ter = TER_MAPPING['eur_government_bonds_10y']
        monthly_ter = ter / 12
        rets = df_bonds.pct_change()
        adj_rets = rets - monthly_ter
        adj_rets.iloc[0] = 0
        df_bonds = df_bonds.iloc[0] * (1 + adj_rets).cumprod()
        logger.info(f"  Applied TER of {ter*100:.2f}% to eur_government_bonds_10y")
        combined = combined.join(df_bonds.to_frame(), how='outer')

    # 5. Add Gold Portfolio from CSV
    # https://www.macrotrends.net/1333/historical-gold-prices-100-year-chart
    logger.info("Reading gold.csv...")
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
            logger.info(f"  Applied TER of {ter*100:.2f}% to gold_usd")
            combined = combined.join(df_gold.rename('gold_usd'), how='outer')
            combined['gold_usd'] = combined['gold_usd'].ffill()
        except Exception as e:
            logger.error(f"Error processing gold.csv: {e}")

    # 7. Add XEON Portfolio
    df_xeon = get_xeon_portfolio()
    if not df_xeon.empty:
        # Note: TER is already included in get_xeon_portfolio logic
        combined = combined.join(df_xeon, how='outer')

    # 8. Add Enhanced Commodity Portfolio
    df_comm_enh = get_enhanced_commodity_portfolio()
    if not df_comm_enh.empty:
        ter = TER_MAPPING['commodity_enhanced']
        monthly_ter = ter / 12
        rets = df_comm_enh.pct_change()
        adj_rets = rets - monthly_ter
        adj_rets.iloc[0] = 0
        df_comm_enh = df_comm_enh.iloc[0] * (1 + adj_rets).cumprod()
        logger.info(f"  Applied TER of {ter*100:.2f}% to commodity_enhanced_usd")
        combined = combined.join(df_comm_enh, how='outer')

    # 9. Add L&G Multi-Strategy Enhanced Commodities
    df_lg = get_lg_multistrategy_portfolio()
    if not df_lg.empty:
        ter = TER_MAPPING['lg_commodity']
        monthly_ter = ter / 12
        rets = df_lg.pct_change()
        adj_rets = rets - monthly_ter
        adj_rets.iloc[0] = 0
        df_lg = df_lg.iloc[0] * (1 + adj_rets).cumprod()
        logger.info(f"  Applied TER of {ter*100:.2f}% to lg_commodity_usd")
        combined = combined.join(df_lg, how='outer')

    # 10. Add Bloomberg Roll Select Commodity
    df_roll = get_bloomberg_roll_select_portfolio()
    if not df_roll.empty:
        ter = TER_MAPPING['roll_select_commodity']
        monthly_ter = ter / 12
        rets = df_roll.pct_change()
        adj_rets = rets - monthly_ter
        adj_rets.iloc[0] = 0
        df_roll = df_roll.iloc[0] * (1 + adj_rets).cumprod()
        logger.info(f"  Applied TER of {ter*100:.2f}% to roll_select_commodity_usd")
        combined = combined.join(df_roll, how='outer')

    # 12. Add UBS CMCI Composite Commodity
    df_ubs = get_ubs_cmci_portfolio()
    if not df_ubs.empty:
        ter = TER_MAPPING['ubs_commodity']
        monthly_ter = ter / 12
        rets = df_ubs.pct_change()
        adj_rets = rets - monthly_ter
        adj_rets.iloc[0] = 0
        df_ubs = df_ubs.iloc[0] * (1 + adj_rets).cumprod()
        logger.info(f"  Applied TER of {ter*100:.2f}% to ubs_commodity_usd")
        combined = combined.join(df_ubs, how='outer')

    # 13. Fetch Exchange Rates and convert columns
    logger.info("Fetching exchange rates (FRED + YFinance fallback)...")
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
        
        logger.info("Calculating cross-currency columns...")
        for col in list(combined.columns):
            if col in ['xeon_usd', 'xeon_eur']: continue # Skip local versions
            if col.endswith('_usd'):
                combined[col.replace('_usd', '_eur')] = combined[col] / fx_rates
            elif col.endswith('_eur'):
                combined[col.replace('_eur', '_usd')] = combined[col] * fx_rates
            else:
                combined[f"{col}_eur"] = combined[col] / fx_rates
    except Exception as e: logger.warning(f"Warning FX: {e}")

    norm_targets = ['eur_government_bonds_10y_usd', 'eur_government_bonds_10y_eur',
                    'xeon_usd', 'xeon_eur',
                    'dbmf_usd', 'dbmf_eur',
                    'ntsg_usd', 'ntsg_eur',
                    'degc_usd', 'degc_eur',
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
        "gold": "Gold",
        "sp500_tr": "S&P 500 Total Return",
        "brk_b": "Berkshire Hathaway",
        "nasdaq_tr": "Nasdaq Total Return",
        "dbmf": "Managed Futures (DBMFE)",
        "dgeix": "DFA Global Equity (DGEIX)",
        "dfemx": "DFA Emerging Markets",
        "degc": "Dimensional Global Core Equity (DEGC)",
        "ntsg": "WisdomTree Global Efficient Core (NTSG)",
        "eur_government_bonds_10y": "EUR Government Bonds 10y",
        "xeon": "Xtrackers II EUR Overnight Rate Swap (XEON)",
        "commodity": "Commodities (BCOM)",
        "commodity_enhanced": "WisdomTree Enhanced Commodity",
        "lg_commodity": "L&G Multi-Strategy Enhanced Commodities",
        "roll_select_commodity": "Bloomberg Roll Select Commodity",
        "ubs_commodity": "UBS CMCI Composite Commodity"
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
    logger.info(f"Success! Final Shape: {combined.shape}")

if __name__ == "__main__":
    process_files()