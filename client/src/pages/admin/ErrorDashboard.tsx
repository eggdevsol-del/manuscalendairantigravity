import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { tokens } from "@/ui/tokens";
import { useAuth } from "@/_core/hooks/useAuth";
import {
    ChevronLeft,
    ChevronDown,
    ChevronRight,
    Check,
    Trash2,
    Clock,
    AlertCircle,
    Filter,
} from "lucide-react";
import { useLocation } from "wouter";

type FilterMode = "unresolved" | "resolved" | "all";

export default function ErrorDashboard() {
    const { user } = useAuth();
    const [, setLocation] = useLocation();
    const [filter, setFilter] = useState<FilterMode>("unresolved");
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 50;

    // Admin guard
    if (user?.role !== "admin") {
        return (
            <div
                className="flex items-center justify-center min-h-screen"
                style={{ color: "#e8e6f0" }}
            >
                <p>Access denied. Admin role required.</p>
            </div>
        );
    }

    const resolvedParam =
        filter === "unresolved" ? false : filter === "resolved" ? true : undefined;

    const { data, isLoading, refetch } = trpc.errorLog.list.useQuery(
        { limit: PAGE_SIZE, offset: page * PAGE_SIZE, resolved: resolvedParam },
        { refetchOnWindowFocus: false }
    );

    const resolveMutation = trpc.errorLog.resolve.useMutation({
        onSuccess: () => refetch(),
    });

    const clearResolvedMutation = trpc.errorLog.clearResolved.useMutation({
        onSuccess: () => refetch(),
    });

    const purgeOldMutation = trpc.errorLog.purgeOld.useMutation({
        onSuccess: () => refetch(),
    });

    const errors = data?.errors || [];
    const total = data?.total || 0;
    const totalPages = Math.ceil(total / PAGE_SIZE);

    const formatTime = (date: string | Date) => {
        const d = new Date(date);
        return d.toLocaleString("en-AU", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        });
    };

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-white/5">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setLocation("/dashboard")}
                            className="p-2 -ml-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-lg font-bold">Error Monitor</h1>
                            <p className="text-xs text-muted-foreground">
                                {total} error{total !== 1 ? "s" : ""} • {filter}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {filter === "resolved" && (
                            <button
                                onClick={() => clearResolvedMutation.mutate()}
                                disabled={clearResolvedMutation.isPending}
                                className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                            >
                                <Trash2 className="w-3 h-3 inline mr-1" />
                                Clear Resolved
                            </button>
                        )}
                        <button
                            onClick={() => purgeOldMutation.mutate()}
                            disabled={purgeOldMutation.isPending}
                            className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-muted-foreground hover:bg-white/10 transition-colors"
                        >
                            Purge 30d+
                        </button>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="max-w-4xl mx-auto px-4 pb-3 flex gap-1">
                    {(["unresolved", "resolved", "all"] as FilterMode[]).map((f) => (
                        <button
                            key={f}
                            onClick={() => {
                                setFilter(f);
                                setPage(0);
                            }}
                            className={cn(
                                "text-xs px-3 py-1.5 rounded-full transition-colors capitalize",
                                filter === f
                                    ? "bg-primary/20 text-primary font-semibold"
                                    : "bg-white/5 text-muted-foreground hover:bg-white/10"
                            )}
                        >
                            <Filter className="w-3 h-3 inline mr-1" />
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Error List */}
            <div className="max-w-4xl mx-auto px-4 py-4 space-y-2">
                {isLoading ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">
                        Loading errors...
                    </div>
                ) : errors.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-4xl mb-3">✨</div>
                        <p className="text-sm text-muted-foreground">
                            No {filter === "all" ? "" : filter + " "}errors
                        </p>
                    </div>
                ) : (
                    errors.map((err) => (
                        <div
                            key={err.id}
                            className={cn(
                                tokens.card.base,
                                "border-0 p-0 overflow-hidden transition-colors",
                                !err.resolved && "border-l-2 border-l-red-500/50"
                            )}
                            style={{ background: "rgba(255,255,255,0.03)" }}
                        >
                            {/* Row summary */}
                            <button
                                onClick={() =>
                                    setExpandedId(expandedId === err.id ? null : err.id)
                                }
                                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
                            >
                                <AlertCircle
                                    className={cn(
                                        "w-4 h-4 shrink-0",
                                        err.resolved ? "text-emerald-400" : "text-red-400"
                                    )}
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                        {err.message}
                                    </p>
                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                        <span className="flex items-center gap-0.5">
                                            <Clock className="w-2.5 h-2.5" />
                                            {formatTime(err.createdAt)}
                                        </span>
                                        {err.boundary && (
                                            <span className="px-1.5 py-0.5 rounded bg-white/5">
                                                {err.boundary}
                                            </span>
                                        )}
                                        {err.userRole && (
                                            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                                {err.userRole}
                                            </span>
                                        )}
                                        {err.appVersion && (
                                            <span>v{err.appVersion}</span>
                                        )}
                                    </div>
                                </div>
                                {expandedId === err.id ? (
                                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                                ) : (
                                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                                )}
                            </button>

                            {/* Expanded details */}
                            {expandedId === err.id && (
                                <div className="px-4 pb-4 space-y-3 border-t border-white/5">
                                    <div className="grid grid-cols-2 gap-2 pt-3 text-xs">
                                        <div>
                                            <span className="text-muted-foreground">URL: </span>
                                            <span className="text-foreground break-all">
                                                {err.url || "—"}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">User ID: </span>
                                            <span className="text-foreground">
                                                {err.userId || "—"}
                                            </span>
                                        </div>
                                        <div className="col-span-2">
                                            <span className="text-muted-foreground">
                                                User Agent:{" "}
                                            </span>
                                            <span className="text-foreground text-[10px] break-all">
                                                {err.userAgent || "—"}
                                            </span>
                                        </div>
                                    </div>

                                    {err.stack && (
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">
                                                Stack Trace
                                            </p>
                                            <pre className="text-[11px] text-red-300/80 bg-black/30 rounded-lg p-3 overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
                                                {err.stack}
                                            </pre>
                                        </div>
                                    )}

                                    {err.componentStack && (
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">
                                                Component Stack
                                            </p>
                                            <pre className="text-[11px] text-amber-300/80 bg-black/30 rounded-lg p-3 overflow-x-auto max-h-32 whitespace-pre-wrap break-all">
                                                {err.componentStack}
                                            </pre>
                                        </div>
                                    )}

                                    {!err.resolved && (
                                        <button
                                            onClick={() => resolveMutation.mutate({ id: err.id })}
                                            disabled={resolveMutation.isPending}
                                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                        >
                                            <Check className="w-3 h-3" />
                                            Mark Resolved
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-3 pt-4">
                        <button
                            onClick={() => setPage(Math.max(0, page - 1))}
                            disabled={page === 0}
                            className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-muted-foreground hover:bg-white/10 disabled:opacity-40 transition-colors"
                        >
                            ← Prev
                        </button>
                        <span className="text-xs text-muted-foreground">
                            {page + 1} / {totalPages}
                        </span>
                        <button
                            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                            disabled={page >= totalPages - 1}
                            className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-muted-foreground hover:bg-white/10 disabled:opacity-40 transition-colors"
                        >
                            Next →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
