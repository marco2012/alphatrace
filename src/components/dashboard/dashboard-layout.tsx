"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
    Settings,
    PieChart,
    Menu,
    X,
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
        href: "/#saved-portfolios",
        icon: Briefcase,
        hash: "#saved-portfolios",
    },
    {
        title: "Asset Allocation",
        href: "/#asset-allocation",
        icon: Briefcase,
        hash: "#asset-allocation",
    },
    {
        title: "Analysis",
        href: "/#analysis",
        icon: Briefcase,
        hash: "#analysis",
    },
];

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [activeHash, setActiveHash] = useState<string>("");
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
        if (typeof window === "undefined") return;
        const params = new URLSearchParams(window.location.search);
        if (params.get("settings") === "1") {
            setSettingsOpen(true);
        }
    }, [pathname]);

    const onSettingsOpenChange = (open: boolean) => {
        setSettingsOpen(open);
        if (!open && pathname === "/") {
            const hash = typeof window !== "undefined" ? window.location.hash : "";
            router.replace(`/${hash}`);
        }
    };

    return (
        <Sheet open={settingsOpen} onOpenChange={onSettingsOpenChange}>
            <div className="flex min-h-screen bg-background text-foreground overflow-x-hidden max-w-full">
                {/* Sidebar Overlay for mobile */}
                {isSidebarOpen && (
                    <div
                        className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                )}

                {/* Sidebar */}
                <aside className={cn(
                    "fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-card/50 backdrop-blur-sm transition-transform duration-300 ease-in-out text-card-foreground flex flex-col",
                    isSidebarOpen ? "translate-x-0" : "-translate-x-full"
                )}>
                    <div className="flex h-14 items-center border-b border-border px-6">
                        <Link href="/" className="flex items-center gap-2 font-bold text-lg" onClick={() => setIsSidebarOpen(false)}>
                            <PieChart className="h-6 w-6 text-primary" />
                            <span>AlphaTrace</span>
                        </Link>
                        <Button variant="ghost" size="icon" className="ml-auto lg:hidden" onClick={() => setIsSidebarOpen(false)}>
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                    <ScrollArea className="flex-1 py-4">
                        <nav className="space-y-1 px-2">
                            {sidebarAnchors.map((item) => {
                                const isActive = pathname === "/"
                                    ? (activeHash ? activeHash === item.hash : item.hash === "#saved-portfolios")
                                    : false;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => {
                                            if (window.innerWidth < 1024) setIsSidebarOpen(false);
                                        }}
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
                <main className={cn(
                    "flex-1 transition-all duration-300 ease-in-out w-full overflow-x-hidden",
                    isSidebarOpen ? "lg:pl-64" : "lg:pl-0"
                )}>
                    {/* Header */}
                    <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/50 backdrop-blur-sm px-4 md:px-6">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                                <Menu className="h-5 w-5" />
                            </Button>
                            {!isSidebarOpen && (
                                <Link href="/" className="flex items-center gap-2 font-bold text-lg">
                                    <PieChart className="h-6 w-6 text-primary" />
                                    <span>AlphaTrace</span>
                                </Link>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <Settings className="h-5 w-5" />
                                </Button>
                            </SheetTrigger>
                            <ModeToggle />
                        </div>
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
