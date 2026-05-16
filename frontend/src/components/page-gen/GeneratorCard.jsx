import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe, Trash2, ChevronRight, FileText } from "lucide-react";

const STATUS_COLORS = {
    active: "bg-green-100 text-green-800 border-green-200",
    draft: "bg-yellow-100 text-yellow-800 border-yellow-200",
    archived: "bg-gray-100 text-gray-500 border-gray-200",
};

export default function GeneratorCard({ generator, pageCount, onDelete }) {
    const navigate = useNavigate();
    const g = generator;
    const statusClass = STATUS_COLORS[g.status] || STATUS_COLORS.draft;

    return (
        <Card
            className="border-host-border bg-host-secondary/40 hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => navigate(`/dev-settings/page-generator/${g.id}`)}
            data-testid={`generator-card-${g.id}`}
        >
            <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                        <h3 className="font-semibold text-host-foreground truncate text-sm leading-snug">{g.name}</h3>
                        <p className="text-xs text-host-foreground/50 mt-0.5 truncate">{g.type}</p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusClass}`}>
                        {g.status || "draft"}
                    </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-host-foreground/60 mb-4">
                    <span className="flex items-center gap-1">
                        <Globe className="h-3.5 w-3.5" />
                        {pageCount != null ? pageCount.toLocaleString() : "—"} pages
                    </span>
                    <span className="flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        {g.keywords?.length || 0} keywords
                    </span>
                </div>

                <div className="flex items-center justify-between">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                        onClick={(e) => { e.stopPropagation(); onDelete?.(generator); }}
                        data-testid={`delete-generator-${g.id}`}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <ChevronRight className="h-4 w-4 text-host-foreground/30 group-hover:text-host-foreground/60 transition-colors" />
                </div>
            </CardContent>
        </Card>
    );
}
