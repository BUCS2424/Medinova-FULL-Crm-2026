import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Building2, Globe, FileText, Sparkles, Pencil } from "lucide-react";
import StatCard from "./StatCard";
import StateCard from "./StateCard";
import PreviewSampleDialog from "./PreviewSampleDialog";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function ByStateTab({ generator, onSwitchToConfig }) {
    const [stats, setStats] = useState(null);
    const [meta, setMeta] = useState({});
    const [loading, setLoading] = useState(true);
    const [previewOpen, setPreviewOpen] = useState(false);

    const enabled = useMemo(
        () => (generator?.states_enabled || []).map((c) => c.toUpperCase()),
        [generator]
    );

    const load = useCallback(async () => {
        if (!generator?.id) return;
        setLoading(true);
        try {
            const [statsRes, metaRes] = await Promise.all([
                api.get(`/page-generators/${generator.id}/stats`),
                api.get(`/locations-meta`),
            ]);
            setStats(statsRes.data);
            const m = {};
            for (const it of metaRes.data?.items || []) m[it.code] = it;
            setMeta(m);
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || err.message);
        } finally {
            setLoading(false);
        }
    }, [generator?.id]);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <div className="space-y-6" data-testid="by-state-tab">
            {/* Top stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    icon={MapPin}
                    label="States scoped"
                    value={stats?.states_scoped}
                    loading={loading}
                />
                <StatCard
                    icon={Building2}
                    label="Counties scoped"
                    value={stats?.counties_scoped}
                    loading={loading}
                />
                <StatCard
                    icon={Globe}
                    label="Cities scoped"
                    value={stats?.cities_scoped}
                    loading={loading}
                />
                <StatCard
                    icon={FileText}
                    label="Pages generated"
                    value={stats?.pages_generated}
                    loading={loading}
                    accent
                />
            </div>

            {/* Pattern toolbar */}
            <Card className="bg-host-secondary/40 border-host-secondary">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-host-foreground/60 mb-1">
                            Patterns
                        </div>
                        <div className="space-y-1">
                            {[
                                ["state", generator?.slug_pattern_state],
                                ["county", generator?.slug_pattern_county],
                                ["city", generator?.slug_pattern_city],
                            ].filter(([k]) => generator?.levels?.[k]).map(([k, p]) => (
                                <div key={k} className="flex items-baseline gap-2">
                                    <span className="text-[10px] uppercase tracking-widest text-host-foreground/50 w-12">{k}</span>
                                    <code className="font-mono text-xs truncate text-host-primary" data-testid={`bystate-pattern-${k}`}>{p}</code>
                                </div>
                            ))}
                            {!Object.values(generator?.levels || {}).some(Boolean) && (
                                <span className="text-xs text-host-foreground/50">No levels enabled</span>
                            )}
                        </div>
                        <div className="mt-2">
                            <Button
                                size="sm"
                                variant="ghost"
                                className="text-host-foreground/70 hover:text-host-foreground hover:bg-host-foreground/10 h-7"
                                onClick={onSwitchToConfig}
                                data-testid="bystate-edit-pattern-btn"
                            >
                                <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                            </Button>
                        </div>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        className="border-host-foreground/20 text-host-foreground/90 hover:bg-host-foreground/10"
                        onClick={() => setPreviewOpen(true)}
                        data-testid="bystate-preview-btn"
                    >
                        <Sparkles className="h-4 w-4 mr-2 text-host-primary" />
                        Preview Sample
                    </Button>
                </CardContent>
            </Card>

            {/* US States grid */}
            <div>
                <div className="flex items-end justify-between mb-3">
                    <div>
                        <h2 className="text-lg font-semibold text-host-foreground">US States</h2>
                        <p className="text-xs text-host-foreground/60 mt-0.5" data-testid="bystate-enabled-count">
                            {enabled.length} of 52 enabled
                        </p>
                    </div>
                </div>

                {enabled.length === 0 ? (
                    <Card className="bg-host-secondary/40 border-host-secondary border-dashed">
                        <CardContent className="p-12 text-center" data-testid="bystate-empty">
                            <p className="text-host-foreground font-medium">No states enabled.</p>
                            <p className="text-xs text-host-foreground/60 mt-1">
                                Go to the <span className="text-host-foreground/90">Configuration</span> tab to enable states.
                            </p>
                            <Button
                                onClick={onSwitchToConfig}
                                className="mt-5 bg-host-primary text-host-primary-foreground hover:bg-host-primary/90"
                                data-testid="bystate-empty-config-btn"
                            >
                                Open Configuration
                            </Button>
                        </CardContent>
                    </Card>
                ) : loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div
                                key={i}
                                className="rounded-lg border border-host-secondary bg-host-secondary/40 p-4 h-40 animate-pulse"
                            />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4" data-testid="bystate-grid">
                        {enabled.map((code) => {
                            const m = meta[code];
                            if (!m) return null;
                            return (
                                <StateCard
                                    key={code}
                                    stateMeta={m}
                                    pageCount={stats?.per_state?.[code] || 0}
                                    generatorId={generator.id}
                                    onChanged={load}
                                />
                            );
                        })}
                    </div>
                )}
            </div>

            <PreviewSampleDialog
                open={previewOpen}
                onOpenChange={setPreviewOpen}
                generatorId={generator?.id}
            />
        </div>
    );
}
