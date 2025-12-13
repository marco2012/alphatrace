export const PREFERRED_ORDER = [
    "MSCI World Minimum Volatility (USD)",
    "MSCI World Momentum",
    "MSCI USA Small Cap Value Weighted",
    "Gold spot price",
    "FTSE World Government Bond - Developed Markets (Hedged EUR)",
    "Solactive STR 8.5 Daily",
    "MSCI World Sector Neutral Quality",
];

export const DEFAULT_WEIGHTS: Record<string, number> = {
    "MSCI World Minimum Volatility (USD)": 0.35,
    "MSCI World Momentum": 0.25,
    "MSCI USA Small Cap Value Weighted": 0.10,
    "Gold spot price": 0.10,
    "FTSE World Government Bond - Developed Markets (Hedged EUR)": 0.10,
    "Solactive STR 8.5 Daily": 0.10,
    "MSCI World Sector Neutral Quality": 0.00,
};

export const ASSET_CATEGORY_OVERRIDES: Record<string, string> = {
    "MSCI World Minimum Volatility (USD)": "stocks",
    "MSCI World Momentum": "stocks",
    "MSCI USA Small Cap Value Weighted": "stocks",
    "MSCI World Sector Neutral Quality": "stocks",
    "FTSE World Government Bond - Developed Markets (Hedged EUR)": "bonds",
    "Solactive STR 8.5 Daily": "cash",
    "Gold spot price": "gold",
};

export const IT_ANNUAL_CPI: Record<number, number> = {
    1994: 4.05, 1995: 5.23, 1996: 4.00, 1997: 2.04, 1998: 1.95, 1999: 1.66, 2000: 2.53,
    2001: 2.78, 2002: 2.46, 2003: 2.67, 2004: 2.20, 2005: 1.98, 2006: 2.09, 2007: 1.82,
    2008: 3.34, 2009: 0.77, 2010: 1.52, 2011: 2.78, 2012: 3.04, 2013: 1.21, 2014: 0.24,
    2015: 0.03, 2016: -0.09, 2017: 1.22, 2018: 1.13, 2019: 0.61, 2020: -0.13, 2021: 1.87,
    2022: 8.20, 2023: 5.62, 2024: 0.98, 2025: 1.8,
};
