import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Wrench, LayoutGrid, List as ListIcon } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import GeneratorCard from "@/components/page-gen/GeneratorCard";
import GeneratorsTable from "@/components/page-gen/GeneratorsTable";
import DeleteGeneratorDialog from "@/components/page-gen/DeleteGeneratorDialog";

const VIEW_KEY = "pg_view_mode";

export default function DevPageGenerator() {
    const navigate = useNavigate();
    const [siteSettings, setSiteSettings] = useState(null);
    const [generators, setGenerators] = useState([]);
    const [pageCounts, setPageCounts] = useState({});
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState(() => localStorage.getItem(VIEW_KEY) || "grid");
    const [deleteTarget, setDeleteTarget] = useState(null);

    useEffect(() => {
        localStorage.setItem(VIEW_KEY, view);
    }, [view]);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [siteRes, gensRes] = await Promise.all([
                api.get("/site-settings"),
                api.get("/page-generators", { params: { limit: 50 } }),
            ]);
            setSiteSettings(siteRes.data);
            const items = gensRes.data?.items || [];
            setGenerators(items);
            // Fetch page counts in parallel (limit=1 just to get total)
            const counts = await Promise.all(
                items.map((g) =>
                    api
                        .get(`/page-generators/${g.id}/pages`, { params: { limit: 1 } })
                        .then((r) => [g.id, r.data?.total || 0])
                        .catch(() => [g.id, 0])
                )
            );
            setPageCounts(Object.fromEntries(counts));
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAll();
    }, []);

    const isEmpty = !loading && generators.length === 0;

    return (
        <div className="max-w-7xl" data-testid="page-generator-dashboard">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
                <div>
                    <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-host-foreground/60">
                        <Wrench className="h-3.5 w-3.5" /> Dev Menu · Page Generator
                    </div>
                    <h1 className="text-3xl font-semibold mt-2">Page Generators</h1>
                    <p className="text-sm text-host-foreground/60 mt-2">
                        Generating pages for{" "}
                        <span style={{ color: "var(--host-primary)" }} className="font-semibold" data-testid="host-company-name">
                            {siteSettings?.company_name || "your site"}
                        </span>
                        .
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-md border border-host-border bg-host-secondary p-0.5">
                        <button
                            type="button"
                            className={[
                                "p-1.5 rounded",
                                view === "grid"
                                    ? "bg-host-secondary text-[color:var(--host-primary)]"
                                    : "text-host-foreground/60 hover:text-host-foreground",
                            ].join(" ")}
                            onClick={() => setView("grid")}
                            aria-label="Grid view"
                            data-testid="view-grid-btn"
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            className={[
                                "p-1.5 rounded",
                                view === "list"
                                    ? "bg-host-secondary text-[color:var(--host-primary)]"
                                    : "text-host-foreground/60 hover:text-host-foreground",
                            ].join(" ")}
                            onClick={() => setView("list")}
                            aria-label="Table view"
                            data-testid="view-list-btn"
                        >
                            <ListIcon className="h-4 w-4" />
                        </button>
                    </div>
                    <Button
                        onClick={() => navigate("/dev-settings/page-generator/new")}
                        style={{ background: "var(--host-primary)", color: "var(--host-primary-foreground)" }}
                        data-testid="new-generator-btn"
                    >
                        <Plus className="h-4 w-4 mr-2" /> New Generator
                    </Button>
                </div>
            </div>

            {loading ? (
                <Card className="bg-host-secondary/60 border-host-border">
                    <CardContent className="p-12 text-center text-sm text-host-foreground/50">Loading…</CardContent>
                </Card>
            ) : isEmpty ? (
                <Card className="bg-host-secondary/60 border-host-border border-dashed">
                    <CardContent className="p-16 text-center" data-testid="empty-state">
                        <div
                            className="mx-auto h-12 w-12 rounded-full flex items-center justify-center mb-4"
                            style={{ background: "var(--host-primary)" }}
                        >
                            <Wrench className="h-5 w-5 text-white" />
                        </div>
                        <h3 className="text-lg font-medium text-host-foreground">No generators yet</h3>
                        <p className="text-sm text-host-foreground/60 mt-1">
                            Create your first generator to start producing location pages.
                        </p>
                        <Button
                            onClick={() => navigate("/dev-settings/page-generator/new")}
                            className="mt-6"
                            style={{ background: "var(--host-primary)", color: "var(--host-primary-foreground)" }}
                            data-testid="empty-create-btn"
                        >
                            <Plus className="h-4 w-4 mr-2" /> Create your first generator
                        </Button>
                    </CardContent>
                </Card>
            ) : view === "grid" ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="generators-grid">
                    {generators.map((g) => (
                        <GeneratorCard
                            key={g.id}
                            generator={g}
                            pageCount={pageCounts[g.id]}
                            onDelete={(gen) => setDeleteTarget(gen)}
                        />
                    ))}
                </div>
            ) : (
                <GeneratorsTable
                    generators={generators}
                    pageCounts={pageCounts}
                    onDelete={(g) => setDeleteTarget(g)}
                />
            )}

            <DeleteGeneratorDialog
                open={!!deleteTarget}
                onOpenChange={(o) => !o && setDeleteTarget(null)}
                generator={deleteTarget}
                onDone={() => loadAll()}
            />
        </div>
    );
}
