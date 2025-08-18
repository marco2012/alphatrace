# AlphaTrace - Portfolio Backtesting Tool

A browser-based portfolio backtesting tool for testing investment strategies using historical data. Built with React and Recharts.

## 🚀 Features

-   **Investment Strategies**: Lump sum, recurring monthly, or hybrid investments
-   **Portfolio Analysis**: CAGR, Sharpe ratio, volatility, drawdowns, and inflation-adjusted returns
-   **Portfolio Management**: Save and compare multiple portfolio configurations
-   **Data Import**: Upload Excel/CSV files with automatic data processing
-   **Interactive Charts**: Visualize performance, drawdowns, and rolling returns
-   **Privacy-First**: All data processed locally in your browser

## 🛠️ Installation

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## 📖 Quick Start

1. **Upload Data**: Click ⚙️ and upload a CSV/Excel file with Date column + asset price columns
2. **Set Weights**: Configure asset allocation percentages
3. **Choose Strategy**: Select lump sum, recurring, or hybrid investment mode
4. **Analyze**: View metrics and charts
5. **Save & Compare**: Use 💼 to save portfolios and 📊 to compare performance

## 📁 Data Format

```csv
Date,MSCI World,Gold,Bonds
2020-01-01,100,100,100
2020-02-01,95,105,101
```

**Data Sources**: [Curvo fund database](https://curvo.eu/backtest/en/funds), Yahoo Finance, or any financial data provider.

## 🔧 Built With

-   React 18 + Vite
-   Recharts for visualization
-   Tailwind CSS for styling
-   XLSX for file parsing

## 🎯 Use Cases

-   Compare asset allocation strategies
-   Test lump sum vs dollar-cost averaging
-   Analyze historical portfolio performance
-   Educational tool for investment concepts

## 🔒 Privacy

All data is processed locally in your browser. No data is sent to external servers.

---

**AlphaTrace** - Data-driven portfolio analysis made simple.
