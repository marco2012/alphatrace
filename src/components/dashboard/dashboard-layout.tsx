"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
    Settings,
    PieChart,
    Menu,
    Briefcase
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SettingsPanel } from "@/components/dashboard/settings-panel";

const sidebarAnchors = [
    {
        title: "Saved Portfolios",
        href: "/portfolios#saved-portfolios",
        icon: Briefcase,
        hash: "#saved-portfolios",
    },
    {
        title: "Asset Allocation",
        href: "/portfolios#asset-allocation",
        icon: Briefcase,
        hash: "#asset-allocation",
    },
    {
        title: "Analysis",
        href: "/portfolios#analysis",
        icon: Briefcase,
        hash: "#analysis",
    },
];

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [activeHash, setActiveHash] = useState<string>("");
    const [settingsOpen, setSettingsOpen] = useState(false);

    useEffect(() => {
        const updateHash = () => {
            if (typeof window === "undefined") return;
            setActiveHash(window.location.hash || "");
        };
        updateHash();
        window.addEventListener("hashchange", updateHash);
        return () => window.removeEventListener("hashchange", updateHash);
    }, []);

    useEffect(() => {
        if (searchParams.get("settings") === "1") {
            setSettingsOpen(true);
        }
    }, [searchParams]);

    const onSettingsOpenChange = (open: boolean) => {
        setSettingsOpen(open);
        if (!open && pathname.startsWith("/portfolios")) {
            const hash = typeof window !== "undefined" ? window.location.hash : "";
            router.replace(`/portfolios${hash}`);
        }
    };

    return (
        <Sheet open={settingsOpen} onOpenChange={onSettingsOpenChange}>
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
                        {sidebarAnchors.map((item) => {
                            const isActive = pathname.startsWith("/portfolios")
                                ? (activeHash ? activeHash === item.hash : item.hash === "#saved-portfolios")
                                : false;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                                        isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                                    )}
                                >
                                    <item.icon className="h-4 w-4" />
                                    {item.title}
                                </Link>
                            );
                        })}

                        <SheetTrigger asChild>
                            <button
                                type="button"
                                className={cn(
                                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                                    settingsOpen ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                                )}
                            >
                                <Settings className="h-4 w-4" />
                                Settings
                            </button>
                        </SheetTrigger>
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

            <SheetContent side="right" className="w-[90vw] sm:max-w-xl overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>Settings</SheetTitle>
                    <SheetDescription>Manage application preferences.</SheetDescription>
                </SheetHeader>
                <div className="mt-6">
                    <SettingsPanel />
                </div>
            </SheetContent>
        </Sheet>
    );
}
