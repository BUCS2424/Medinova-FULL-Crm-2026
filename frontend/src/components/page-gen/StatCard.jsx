export default function StatCard({ icon: Icon, label, value, loading = false }) {
    return (
        <div className="rounded-lg border border-host-border bg-host-secondary/50 p-4" data-testid={`stat-card-${label?.toLowerCase().replace(/\s+/g, "-")}`}>
            <div className="flex items-center gap-2 mb-2">
                {Icon && <Icon className="h-4 w-4 text-host-foreground/50" />}
                <span className="text-xs text-host-foreground/50 font-medium uppercase tracking-wider">{label}</span>
            </div>
            {loading ? (
                <div className="h-7 w-16 rounded bg-host-border animate-pulse" />
            ) : (
                <p className="text-2xl font-bold text-host-foreground">
                    {value != null ? value.toLocaleString() : "—"}
                </p>
            )}
        </div>
    );
}
