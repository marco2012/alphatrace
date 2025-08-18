# AlphaTrace - Portfolio Backtesting Tool

AlphaTrace is a comprehensive portfolio backtesting and analysis tool that allows you to test different investment strategies using historical data. Built with React and Recharts, it provides professional-grade portfolio analysis capabilities entirely in your browser.

## 🚀 Features

### 📊 **Portfolio Analysis**

-   **Multiple Investment Strategies**: Lump sum, recurring monthly investments, or hybrid approach
-   **Comprehensive Metrics**: CAGR, Sharpe ratio, Sortino ratio, volatility, and maximum drawdown
-   **Real vs Nominal Returns**: Inflation-adjusted analysis using Italian CPI data
-   **Risk-Adjusted Performance**: Customizable risk-free rate for Sharpe/Sortino calculations

### 💼 **Portfolio Management**

-   **Save Portfolios**: Store multiple portfolio configurations with custom names
-   **Portfolio Library**: Manage saved portfolios with metadata (creation date, investment mode, assets)
-   **Quick Loading**: Instantly switch between different portfolio configurations
-   **Local Storage**: All data saved locally in your browser for privacy

### 📈 **Portfolio Comparison**

-   **Side-by-Side Analysis**: Compare multiple portfolios simultaneously
-   **Performance Visualization**: Interactive charts showing relative performance
-   **Metrics Comparison**: Detailed table comparing CAGR, volatility, Sharpe ratios, and more
-   **Strategy Testing**: Test different asset allocations and investment approaches

### 📋 **Data Management**

-   **File Upload Support**: Import Excel (.xlsx, .xls) or CSV files
-   **Flexible Data Format**: Automatic date parsing and data normalization
-   **Data Interpolation**: Smart handling of missing data points
-   **Export Functionality**: Download results as CSV files

### ⚙️ **Advanced Features**

-   **Rebalancing Options**: Monthly, quarterly, or annual portfolio rebalancing
-   **Rolling Returns Analysis**: Analyze performance over different time periods
-   **Drawdown Analysis**: Identify worst-performing periods
-   **Annual Returns Breakdown**: Year-by-year performance analysis

## 🛠️ Installation

### Prerequisites

-   Node.js (version 14 or higher)
-   npm or yarn package manager

### Setup

1. **Clone or download the project**

    ```bash
    git clone <repository-url>
    cd alphatrace_nomonth
    ```

2. **Install dependencies**

    ```bash
    npm install
    ```

3. **Start the development server**

    ```bash
    npm run dev
    ```

4. **Open in browser**
   Navigate to `http://localhost:5173` (or the port shown in terminal)

## 📖 How to Use

### 1. **Data Upload**

-   Click the ⚙️ settings button to access the data upload section
-   Upload an Excel (.xlsx, .xls) or CSV file with your historical data
-   Ensure your file has a "Date" column and columns for each asset
-   The tool automatically normalizes and interpolates missing data

### 2. **Configure Portfolio**

-   Set asset weights using percentage values (e.g., 35 = 35%)
-   Choose your investment strategy:
    -   **Lump Sum Only**: One-time investment
    -   **Monthly Recurring Only**: Dollar-cost averaging
    -   **Lump Sum + Monthly**: Hybrid approach
-   Adjust rebalancing frequency and risk-free rate as needed

### 3. **Analyze Results**

-   View comprehensive portfolio metrics in the summary section
-   Examine performance charts showing nominal vs real returns
-   Analyze drawdowns and rolling returns over different periods
-   Review annual performance breakdown

### 4. **Save and Compare**

-   Use the 💼 Portfolio Manager to save your current configuration
-   Enable 📊 Compare Mode to select multiple saved portfolios
-   View side-by-side performance comparison with detailed metrics
-   Make data-driven decisions based on historical performance

## 📁 Data Format

### Required Format

Your data file should include:

-   **Date column**: Any recognizable date format
-   **Asset columns**: Historical prices or index values for each asset

### Example CSV Structure

```csv
Date,MSCI World,Gold,Bonds,Real Estate
2020-01-01,100,100,100,100
2020-02-01,95,105,101,98
2020-03-01,85,120,102,85
...
```

### Data Sources

-   **Fund Data**: Download from [Curvo's fund database](https://curvo.eu/backtest/en/funds)
-   **Index Data**: Use any financial data provider (Yahoo Finance, Bloomberg, etc.)
-   **Custom Data**: Any time series data in the required format

## 🔧 Technical Details

### Built With

-   **React 18**: Modern React with hooks and functional components
-   **Recharts**: Professional charting library for data visualization
-   **Tailwind CSS**: Utility-first CSS framework for styling
-   **Vite**: Fast build tool and development server
-   **XLSX**: Excel file parsing library

### Key Calculations

-   **CAGR**: Compound Annual Growth Rate with support for recurring investments
-   **Volatility**: Annualized standard deviation of monthly returns
-   **Sharpe Ratio**: (Return - Risk Free Rate) / Volatility
-   **Sortino Ratio**: Similar to Sharpe but using downside deviation
-   **Maximum Drawdown**: Largest peak-to-trough decline

### Data Processing

-   **Normalization**: All assets normalized to base 100 at start date
-   **Interpolation**: Linear interpolation for missing data points
-   **Rebalancing**: Periodic rebalancing based on target weights
-   **Inflation Adjustment**: Real returns calculated using Italian CPI data

## 🎯 Use Cases

### Investment Strategy Testing

-   Compare different asset allocation strategies
-   Test the impact of rebalancing frequency
-   Analyze lump sum vs dollar-cost averaging approaches
-   Evaluate risk-adjusted performance across strategies

### Educational Purposes

-   Learn about portfolio theory and diversification
-   Understand the impact of fees and inflation on returns
-   Visualize the effects of different investment approaches
-   Explore historical market performance

### Financial Planning

-   Model different investment scenarios
-   Test portfolio resilience during market downturns
-   Plan retirement savings strategies
-   Optimize asset allocation for specific goals

## 🔒 Privacy & Security

-   **Local Storage**: All data processed and stored locally in your browser
-   **No Server**: No data transmitted to external servers
-   **Privacy First**: Your financial data never leaves your device
-   **Offline Capable**: Works without internet connection after initial load

## 📊 Performance Metrics Explained

### Return Metrics

-   **CAGR**: Average annual return over the entire period
-   **Real CAGR**: Inflation-adjusted annual return
-   **Rolling Returns**: Performance over moving time windows

### Risk Metrics

-   **Volatility**: Measure of return variability (higher = more risky)
-   **Maximum Drawdown**: Worst loss from peak to trough
-   **Sharpe Ratio**: Return per unit of risk (higher = better)
-   **Sortino Ratio**: Similar to Sharpe but focuses on downside risk

## 🤝 Contributing

This is an open-source project. Contributions are welcome! Areas for improvement:

-   Additional asset classes and data sources
-   More sophisticated rebalancing strategies
-   Additional risk metrics and visualizations
-   Performance optimizations
-   Mobile responsiveness improvements

## 📄 License

This project is open source. Please check the license file for details.

## 🆘 Support

If you encounter issues or have questions:

1. Check that your data file format matches the requirements
2. Ensure all required columns are present
3. Verify date formats are recognizable
4. Try with a smaller dataset to isolate issues

## 🔮 Future Enhancements

-   **Monte Carlo Simulations**: Probabilistic portfolio analysis
-   **Factor Analysis**: Decompose returns into risk factors
-   **Correlation Analysis**: Asset correlation matrices
-   **Tax-Adjusted Returns**: After-tax performance calculations
-   **Multi-Currency Support**: Support for different base currencies
-   **API Integration**: Direct data feeds from financial providers

---

**AlphaTrace** - Empowering data-driven investment decisions through comprehensive portfolio analysis.
