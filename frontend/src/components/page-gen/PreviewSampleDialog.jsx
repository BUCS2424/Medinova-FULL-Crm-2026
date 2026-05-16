import { useEffect, useState } from "react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";

export default function PreviewSampleDialog({ open, onOpenChange, generator }) {
    const [html, setHtml] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open || !generator?.id) return;
        setLoading(true);
        setHtml(null);
        api.get(`/page-generators/${generator.id}/preview-sample`)
            .then(({ data }) => setHtml(data?.html || "<p>No preview available.</p>"))
            .catch((err) => {
                toast.error(formatApiError(err.response?.data?.detail) || "Preview failed");
                setHtml("<p>Preview could not be loaded.</p>");
            })
            .finally(() => setLoading(false));
    }, [open, generator?.id]);

    const publicPrefix = "coverage-areas";
    const sampleUrl = generator
        ? `/${publicPrefix}/${generator.type}/${generator.type}-alabama`
        : null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        Preview Sample Page
                        {sampleUrl && (
                            <a
                                href={sampleUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-host-foreground/40 hover:text-host-foreground transition-colors"
                            >
                                <ExternalLink className="h-4 w-4" />
                            </a>
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        Sample render for <strong>{generator?.name}</strong> — Alabama
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-auto rounded-lg border border-host-border bg-white min-h-[400px]">
                    {loading ? (
                        <div className="p-8 text-center text-sm text-gray-400">Generating preview…</div>
                    ) : (
                        <iframe
                            srcDoc={html || ""}
                            className="w-full h-full min-h-[500px]"
                            title="Page preview"
                            sandbox="allow-same-origin"
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
