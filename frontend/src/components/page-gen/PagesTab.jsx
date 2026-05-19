import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ExternalLink, Search, Globe, ChevronLeft, ChevronRight, Trash2, Loader2 } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";

const PAGE_SIZE = 20;

export default function PagesTab({ generator }) {
    const [pages, setPages] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(0);
    const [level, setLevel] = useState("all");
    const [deleteAllOpen, setDeleteAllOpen] = useState(false);
    const [deletingAll, setDeletingAll] = useState(false);
    const genId = generator?.id;

    const load = useCallback(async () => {
        if (!genId) return;
        setLoading(true);
        try {
            const params = { offset: page * PAGE_SIZE, limit: PAGE_SIZE };
            if (search.trim()) params.q = search.trim();
            if (level !== "all") params.level = level;
            const { data } = await api.get(`/page-generators/${genId}/pages`, { params });
            setPages(data.items || []);
            setTotal(data.total || 0);
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || err.message);
        } finally {
            setLoading(false);
        }
    }, [genId, page, search, level]);

    useEffect(() => { load(); }, [load]);

    const handleSearch = (e) => { e.preventDefault(); setPage(0); load(); };

    const handleDeleteAll = async () => {
        setDeletingAll(true);
        try {
            const { data } = await api.delete(`/page-generators/${genId}/pages/all`);
            toast.success(`Deleted ${data?.deleted ?? 0} pages. Generator config preserved.`);
            setPages([]);
            setTotal(0);
            setDeleteAllOpen(false);
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || err.message);
        } finally {
            setDeletingAll(false);
        }
    };

    const totalPages = Math.ceil(total / PAGE_SIZE);
    const publicPrefix = generator?.public_prefix || "coverage-areas";

    return (
        <div className="space-y-4" data-testid="pages-tab">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <form onSubmit={handleSearch} className="flex-1 flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-host-foreground/40" />
                        <Input
                            placeholder="Search pages…"
                            className="pl-9"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            data-testid="pages-search"
                        />
                    </div>
                    <Button type="submit" variant="outline" className="shrink-0">Search</Button>
                </form>
                <div className="flex gap-1">
                    {["all", "state", "county", "city"].map((lv) => (
                        <button
                            key={lv}
                            type="button"
                            onClick={() => { setLevel(lv); setPage(0); }}
                            className={[
                                "text-xs px-2.5 py-1 rounded-full border transition-colors",
                                level === lv
                                    ? "border-transparent text-white"
                                    : "bg-host-secondary text-host-foreground/60 border-host-border hover:border-host-primary",
                            ].join(" ")}
                            style={level === lv ? { background: "var(--host-primary)" } : {}}
                            data-testid={`level-filter-${lv}`}
                        >
                            {lv.charAt(0).toUpperCase() + lv.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex items-center justify-between">
                <p className="text-xs text-host-foreground/50">{total.toLocaleString()} pages total</p>
                {total > 0 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300 hover:bg-red-950/40 h-7 text-xs"
                        onClick={() => setDeleteAllOpen(true)}
                        data-testid="delete-all-pages-btn"
                    >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete All {total.toLocaleString()} Pages
                    </Button>
                )}
            </div>

            {loading ? (
                <p className="text-sm text-host-foreground/50 py-8 text-center">Loading…</p>
            ) : pages.length === 0 ? (
                <div className="rounded-lg border border-dashed border-host-border p-12 text-center">
                    <Globe className="h-8 w-8 mx-auto mb-3 text-host-foreground/20" />
                    <p className="text-sm text-host-foreground/50">No pages yet. Use Bulk Generate to create them.</p>
                </div>
            ) : (
                <div className="rounded-lg border border-host-border overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-host-secondary/60 border-b border-host-border">
                                <th className="text-left px-4 py-2.5 font-medium text-host-foreground/70">Slug</th>
                                <th className="text-left px-4 py-2.5 font-medium text-host-foreground/70 hidden sm:table-cell">Level</th>
                                <th className="text-left px-4 py-2.5 font-medium text-host-foreground/70 hidden md:table-cell">Location</th>
                                <th className="px-4 py-2.5"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {pages.map((p) => (
                                <tr key={p.id || p.slug} className="border-b border-host-border last:border-0 hover:bg-host-secondary/30">
                                    <td className="px-4 py-2 font-mono text-xs text-host-foreground/80 max-w-[200px] truncate">{p.slug}</td>
                                    <td className="px-4 py-2 text-xs text-host-foreground/60 hidden sm:table-cell capitalize">{p.level}</td>
                                    <td className="px-4 py-2 text-xs text-host-foreground/60 hidden md:table-cell">{p.location_label || p.city || p.county || p.state_name}</td>
                                    <td className="px-4 py-2">
                                        <a
                                            href={`/${publicPrefix}/${generator?.type}/${p.slug}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-host-foreground/40 hover:text-host-foreground transition-colors"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <ExternalLink className="h-3.5 w-3.5" />
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {totalPages > 1 && (
                <div className="flex items-center justify-between text-sm">
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-host-foreground/60">Page {page + 1} of {totalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            )}

            <AlertDialog open={deleteAllOpen} onOpenChange={(o) => !deletingAll && setDeleteAllOpen(o)}>
                <AlertDialogContent className="bg-host-background border-host-secondary text-host-foreground" data-testid="delete-all-pages-dialog">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-host-foreground">
                            Delete all {total.toLocaleString()} pages?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-host-foreground/60">
                            This permanently removes every generated page for <strong>{generator?.name}</strong>. The generator configuration and settings are kept intact — you can regenerate pages for any states at any time.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            className="bg-host-secondary border-host-foreground/20 text-host-foreground hover:bg-host-foreground/10"
                            disabled={deletingAll}
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteAll}
                            disabled={deletingAll}
                            className="bg-red-700 text-white hover:bg-red-600"
                            data-testid="delete-all-pages-confirm"
                        >
                            {deletingAll ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deleting…</> : "Yes, delete all pages"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
