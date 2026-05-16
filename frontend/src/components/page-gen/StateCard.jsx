import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCircle2, ExternalLink, Trash2, Loader2, Sparkles } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useNamespace } from "@/context/NamespaceContext";
import { toast } from "sonner";

export default function StateCard({ stateMeta, pageCount, generatorId, onChanged }) {
    const [generating, setGenerating] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const { public_prefix } = useNamespace();

    const hasPages = (pageCount || 0) > 0;

    const onGenerate = async () => {
        setGenerating(true);
        try {
            const { data } = await api.post(
                `/page-generators/${generatorId}/bulk-generate`,
                { state_codes: [stateMeta.code] }
            );
            const newCount = (data?.created || 0) + (data?.updated || 0);
            toast.success(`Generated ${newCount} pages for ${stateMeta.name}.`);
            await onChanged?.();
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || err.message);
        } finally {
            setGenerating(false);
        }
    };

    const onDelete = async () => {
        setDeleting(true);
        try {
            const { data } = await api.delete(
                `/page-generators/${generatorId}/pages`,
                { params: { state_code: stateMeta.code } }
            );
            toast.success(`Deleted ${data?.deleted ?? 0} pages for ${stateMeta.name}.`);
            await onChanged?.();
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || err.message);
        } finally {
            setDeleting(false);
            setConfirmOpen(false);
        }
    };

    const onView = () => {
        // TODO(Phase 4+): support filtering the public index by ?state= once supported.
        const url = `/coverage-areas`;
        window.open(url, "_blank", "noopener,noreferrer");
    };

    const cardClasses = hasPages
        ? "rounded-lg border border-host-primary/30 bg-host-primary/5"
        : "rounded-lg border border-host-secondary bg-host-secondary/40 hover:border-host-foreground/20 transition";

    return (
        <div className={`p-4 ${cardClasses}`} data-testid={`state-card-${stateMeta.code}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-host-foreground/60">{stateMeta.code}</span>
                        <h3 className="text-base font-semibold text-host-foreground truncate">
                            {stateMeta.name}
                        </h3>
                    </div>
                    <p className="text-xs text-host-foreground/60 mt-1">
                        {stateMeta.counties} counties · {stateMeta.cities} cities
                    </p>
                    {hasPages && (
                        <p
                            className="text-sm font-semibold mt-2 text-host-primary"
                            data-testid={`state-pagecount-${stateMeta.code}`}
                        >
                            {pageCount.toLocaleString()} pages
                        </p>
                    )}
                </div>
                {hasPages && (
                    <CheckCircle2
                        className="h-5 w-5 shrink-0 text-host-primary"
                        data-testid={`state-check-${stateMeta.code}`}
                    />
                )}
            </div>

            <div className="mt-4">
                {hasPages ? (
                    <div className="flex items-center gap-1">
                        <Button
                            size="sm"
                            variant="ghost"
                            className="text-host-foreground/70 hover:text-host-foreground hover:bg-host-foreground/10 h-8"
                            onClick={onView}
                            data-testid={`state-view-${stateMeta.code}`}
                            title="View"
                        >
                            <ExternalLink className="h-4 w-4 mr-1.5" /> View
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-400 hover:text-red-300 hover:bg-red-950/40 h-8"
                            onClick={() => setConfirmOpen(true)}
                            disabled={deleting}
                            data-testid={`state-delete-${stateMeta.code}`}
                            title="Delete pages for this state"
                        >
                            <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                        </Button>
                    </div>
                ) : (
                    <Button
                        type="button"
                        onClick={onGenerate}
                        disabled={generating}
                        className="w-full h-9 font-medium bg-host-primary text-host-primary-foreground hover:bg-host-primary/90"
                        data-testid={`state-generate-${stateMeta.code}`}
                    >
                        {generating ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-4 w-4 mr-2" /> Generate
                            </>
                        )}
                    </Button>
                )}
            </div>

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent
                    className="bg-host-background border-host-secondary text-host-foreground"
                    data-testid={`state-delete-dialog-${stateMeta.code}`}
                >
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-host-foreground">
                            Delete {pageCount} pages for {stateMeta.name}?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-host-foreground/60">
                            This permanently removes every generated page in this state for this generator. It cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            className="bg-host-secondary border-host-foreground/20 text-host-foreground hover:bg-host-foreground/10"
                            disabled={deleting}
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={onDelete}
                            disabled={deleting}
                            className="bg-red-700 text-white hover:bg-red-600"
                            data-testid={`state-delete-confirm-${stateMeta.code}`}
                        >
                            {deleting ? "Deleting…" : "Delete pages"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
