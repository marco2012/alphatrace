import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { PortfolioProvider } from "@/context/portfolio-context";
import { Toaster } from "@/components/ui/sonner";

const font = Outfit({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Alphatrace",
  description: "Advanced Portfolio Backtesting",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={font.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <PortfolioProvider>
            {children}
            <Toaster />
          </PortfolioProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
