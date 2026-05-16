import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Globe, RefreshCw } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function PageSelector({ value, onChange, label = "Clone Source URL" }) {
    const [availablePages, setAvailablePages] = useState([]);
    const [loading, setLoading] = useState(false);

    const loadPages = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/available-pages");
            setAvailablePages(data?.pages || []);
        } catch {
            setAvailablePages([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadPages(); }, []);

    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-host-foreground/40" />
                    <Input
                        type="url"
                        placeholder="https://yoursite.com/weight-loss"
                        className="pl-9"
                        value={value || ""}
                        onChange={(e) => onChange(e.target.value)}
                        data-testid="clone-source-input"
                    />
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={loadPages}
                    disabled={loading}
                    title="Reload available pages"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
            </div>

            {availablePages.length > 0 && (
                <div className="text-xs text-host-foreground/50 mt-1">
                    Suggested pages:
                    <div className="flex flex-wrap gap-1 mt-1">
                        {availablePages.slice(0, 8).map((p) => (
                            <button
                                key={p.url || p.slug}
                                type="button"
                                onClick={() => onChange(p.url || p.slug)}
                                className="px-2 py-0.5 rounded-full border border-host-border bg-host-secondary hover:border-host-primary text-host-foreground/70 transition-colors"
                                data-testid={`quick-select-page-${p.slug}`}
                            >
                                {p.label || p.name || p.slug}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <p className="text-xs text-host-foreground/40">
                Paste any URL on your site. Playwright will capture the full rendered design.
            </p>
        </div>
    );
}
