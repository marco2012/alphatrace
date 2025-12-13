"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
    Settings,
    BarChart3,
    PieChart,
    Menu,
    Briefcase
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { ScrollArea } from "@/components/ui/scroll-area";

// Updated items: "Portfolios" is now the home/builder. "Analysis" remains. "Dashboard" is removed.
const sidebarItems = [
    {
        title: "Portfolios",
        href: "/portfolios",
        icon: Briefcase,
    },
    {
        title: "Analysis",
        href: "/analysis",
        icon: BarChart3,
    },
    {
        title: "Settings",
        href: "/settings",
        icon: Settings,
    },
];

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const pathname = usePathname();

    return (
        <div className="flex min-h-screen bg-background text-foreground">
            {/* Sidebar */}
            <aside className="hidden w-64 border-r border-border bg-card/50 backdrop-blur-sm lg:flex lg:flex-col lg:fixed lg:inset-y-0 text-card-foreground">
                <div className="flex h-14 items-center border-b border-border px-6">
                    <Link href="/portfolios" className="flex items-center gap-2 font-bold text-lg">
                        <PieChart className="h-6 w-6 text-primary" />
                        <span>Alphatrace</span>
                    </Link>
                </div>
                <ScrollArea className="flex-1 py-4">
                    <nav className="space-y-1 px-2">
                        {sidebarItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                                    pathname.startsWith(item.href) ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                                )}
                            >
                                <item.icon className="h-4 w-4" />
                                {item.title}
                            </Link>
                        ))}
                    </nav>
                </ScrollArea>
                <div className="border-t border-border p-4">
                    <ModeToggle />
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 lg:pl-64">
                {/* Mobile Header */}
                <div className="flex items-center justify-between border-b border-border p-4 lg:hidden">
                    <Link href="/portfolios" className="flex items-center gap-2 font-bold text-lg">
                        <PieChart className="h-6 w-6 text-primary" />
                        <span>Alphatrace</span>
                    </Link>
                    <Button variant="ghost" size="icon">
                        <Menu className="h-6 w-6" />
                    </Button>
                </div>

                {/* Page Content */}
                <div className="container mx-auto p-4 md:p-8 max-w-7xl">
                    {children}
                </div>
            </main>
        </div>
    );
}
