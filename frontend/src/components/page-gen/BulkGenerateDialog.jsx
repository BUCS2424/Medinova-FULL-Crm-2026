import { useEffect, useMemo, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { US_STATES } from "@/lib/states";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Wand2 } from "lucide-react";

export default function BulkGenerateDialog({ open, onOpenChange, generator, onComplete }) {
    const initial = useMemo(
        () => (generator?.states_enabled?.length ? generator.states_enabled : []),
        [generator]
    );
    const [selected, setSelected] = useState(initial);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open) setSelected(initial);
    }, [open, initial]);

    const toggle = (code) => {
        setSelected((prev) =>
            prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
        );
    };

    const submit = async () => {
        if (!generator?.id) return;
        if (selected.length === 0) {
            toast.error("Select at least one state");
            return;
        }
        setSubmitting(true);
        try {
            const { data } = await api.post(
                `/page-generators/${generator.id}/bulk-generate`,
                { state_codes: selected }
            );
            const total = (data.created || 0) + (data.updated || 0);
            toast.success(
                `Generated ${total} pages — ${data.created} new, ${data.updated} updated${data.skipped_collisions ? `, ${data.skipped_collisions} skipped` : ""}`
            );
            onOpenChange(false);
            onComplete?.(data);
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="bg-host-secondary border-host-border text-host-foreground max-w-2xl"
                data-testid="bulk-generate-dialog"
            >
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Wand2 className="h-4 w-4" style={{ color: "var(--host-primary)" }} />
                        Bulk generate pages
                    </DialogTitle>
                    <DialogDescription className="text-host-foreground/60">
                        Pick which states to generate pages for. Existing pages are updated in place.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center justify-between text-xs text-host-foreground/60">
                    <span>
                        <Badge
                            className="mr-2"
                            style={{ background: "var(--host-primary)", color: "var(--host-primary-foreground)" }}
                        >
                            {selected.length}
                        </Badge>
                        of 52 selected
                    </span>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-host-border text-host-foreground/80 hover:bg-host-foreground/10"
                            onClick={() => setSelected(US_STATES.map((s) => s.code))}
                        >
                            All
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-host-border text-host-foreground/80 hover:bg-host-foreground/10"
                            onClick={() => setSelected([])}
                        >
                            None
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-72 overflow-y-auto pr-1">
                    {US_STATES.map((s) => {
                        const checked = selected.includes(s.code);
                        return (
                            <label
                                key={s.code}
                                className={[
                                    "flex items-center gap-2 rounded px-2 py-1.5 text-xs cursor-pointer border",
                                    checked
                                        ? "border-[color:var(--host-primary)]/50 bg-[color:var(--host-primary)]/10"
                                        : "border-host-border bg-host-muted/60 hover:border-host-border",
                                ].join(" ")}
                                data-testid={`bulk-state-${s.code}`}
                            >
                                <Checkbox
                                    checked={checked}
                                    onCheckedChange={() => toggle(s.code)}
                                    className="data-[state=checked]:bg-[color:var(--host-primary)] data-[state=checked]:border-[color:var(--host-primary)]"
                                />
                                <span className="font-mono text-host-foreground/60 w-6">{s.code}</span>
                                <span className="truncate text-host-foreground/90">{s.name}</span>
                            </label>
                        );
                    })}
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        className="border-host-border text-host-foreground/80 hover:bg-host-foreground/10"
                        onClick={() => onOpenChange(false)}
                        disabled={submitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={submit}
                        disabled={submitting || selected.length === 0}
                        style={{ background: "var(--host-primary)", color: "var(--host-primary-foreground)" }}
                        data-testid="bulk-generate-submit"
                    >
                        {submitting ? "Generating…" : `Generate ${selected.length} state${selected.length === 1 ? "" : "s"}`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
