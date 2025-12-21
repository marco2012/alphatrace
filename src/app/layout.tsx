import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { PortfolioProvider } from "@/context/portfolio-context";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const font = Outfit({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AlphaTrace",
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
            <TooltipProvider>
              {children}
              <Toaster />
            </TooltipProvider>
          </PortfolioProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
