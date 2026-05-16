import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Pencil, Globe } from "lucide-react";

const STATUS_COLORS = {
    active: "bg-green-100 text-green-800",
    draft: "bg-yellow-100 text-yellow-800",
    archived: "bg-gray-100 text-gray-500",
};

export default function GeneratorsTable({ generators, pageCounts, onDelete }) {
    const navigate = useNavigate();
    return (
        <div className="rounded-lg border border-host-border overflow-hidden" data-testid="generators-table">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-host-secondary/60 border-b border-host-border">
                        <th className="text-left px-4 py-3 font-medium text-host-foreground/70">Name</th>
                        <th className="text-left px-4 py-3 font-medium text-host-foreground/70">Type</th>
                        <th className="text-left px-4 py-3 font-medium text-host-foreground/70">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-host-foreground/70">Pages</th>
                        <th className="px-4 py-3"></th>
                    </tr>
                </thead>
                <tbody>
                    {generators.map((g) => (
                        <tr
                            key={g.id}
                            className="border-b border-host-border last:border-0 hover:bg-host-secondary/30 cursor-pointer transition-colors"
                            onClick={() => navigate(`/dev-settings/page-generator/${g.id}`)}
                            data-testid={`generator-row-${g.id}`}
                        >
                            <td className="px-4 py-3 font-medium text-host-foreground">{g.name}</td>
                            <td className="px-4 py-3 text-host-foreground/60">{g.type}</td>
                            <td className="px-4 py-3">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[g.status] || STATUS_COLORS.draft}`}>
                                    {g.status || "draft"}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-host-foreground/60">
                                <span className="flex items-center gap-1">
                                    <Globe className="h-3.5 w-3.5" />
                                    {pageCounts?.[g.id] != null ? pageCounts[g.id].toLocaleString() : "—"}
                                </span>
                            </td>
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-1 justify-end">
                                    <Button
                                        variant="ghost" size="icon"
                                        className="h-7 w-7 text-host-foreground/40 hover:text-host-foreground"
                                        onClick={(e) => { e.stopPropagation(); navigate(`/dev-settings/page-generator/${g.id}`); }}
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost" size="icon"
                                        className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                                        onClick={(e) => { e.stopPropagation(); onDelete?.(g); }}
                                        data-testid={`table-delete-${g.id}`}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
