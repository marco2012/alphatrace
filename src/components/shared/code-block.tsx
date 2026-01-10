"use client";

import * as React from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
    code: string;
    language?: string;
}

export function CodeBlock({ code, language = "python" }: CodeBlockProps) {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const isLong = code.split('\n').length > 15;

    return (
        <div className="relative rounded-md overflow-hidden text-xs my-2 border">
            <div
                className={cn(
                    "transition-[max-height] duration-300 ease-in-out",
                    isExpanded ? "max-h-full" : "max-h-[300px]"
                )}
            >
                <SyntaxHighlighter
                    language={language}
                    style={vscDarkPlus}
                    customStyle={{
                        margin: 0,
                        padding: "1rem",
                        fontSize: "0.75rem",
                        lineHeight: "1.25rem",
                    }}
                >
                    {code}
                </SyntaxHighlighter>
            </div>

            {isLong && !isExpanded && (
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-center pb-2">
                    <button
                        onClick={() => setIsExpanded(true)}
                        className="text-[10px] uppercase font-bold text-white bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full backdrop-blur-sm transition-colors"
                    >
                        Show Full Code
                    </button>
                </div>
            )}

            {isExpanded && (
                <div className="bg-[#1e1e1e] border-t border-white/10 p-2 flex justify-center">
                    <button
                        onClick={() => setIsExpanded(false)}
                        className="text-[10px] uppercase font-bold text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Show Less
                    </button>
                </div>
            )}
        </div>
    );
}
