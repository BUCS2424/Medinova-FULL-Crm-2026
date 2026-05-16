import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, CheckCheck, X } from "lucide-react";
import { US_STATES } from "@/lib/states";

const REGIONS = {
    Northeast: ["CT","DE","ME","MD","MA","NH","NJ","NY","PA","RI","VT"],
    South:     ["AL","AR","FL","GA","KY","LA","MS","NC","OK","SC","TN","TX","VA","WV"],
    Midwest:   ["IL","IN","IA","KS","MI","MN","MO","NE","ND","OH","SD","WI"],
    West:      ["AK","AZ","CA","CO","HI","ID","MT","NV","NM","OR","UT","WA","WY"],
};

export default function StatesPicker({ value = [], onChange, open, onOpenChange }) {
    const selected = new Set(value);

    const toggle = (code) => {
        const next = new Set(selected);
        if (next.has(code)) next.delete(code); else next.add(code);
        onChange([...next]);
    };

    const selectAll = () => onChange(US_STATES.map((s) => s.code));
    const clearAll = () => onChange([]);

    const toggleRegion = (codes) => {
        const allIn = codes.every((c) => selected.has(c));
        const next = new Set(selected);
        codes.forEach((c) => { if (allIn) next.delete(c); else next.add(c); });
        onChange([...next]);
    };

    if (!open) return null;

    return (
        <div className="rounded-lg border border-host-border bg-host-background shadow-lg p-4 space-y-4" data-testid="states-picker">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{selected.size} / {US_STATES.length} states selected</span>
                <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={selectAll} className="h-7 text-xs gap-1">
                        <CheckCheck className="h-3.5 w-3.5" /> All
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={clearAll} className="h-7 text-xs gap-1 text-red-500 hover:text-red-600">
                        <X className="h-3.5 w-3.5" /> None
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-7 text-xs">Done</Button>
                </div>
            </div>

            {Object.entries(REGIONS).map(([region, codes]) => (
                <div key={region}>
                    <button
                        type="button"
                        onClick={() => toggleRegion(codes)}
                        className="text-xs uppercase tracking-widest font-semibold text-host-foreground/50 mb-2 hover:text-host-foreground transition-colors"
                    >
                        {region} ({codes.filter((c) => selected.has(c)).length}/{codes.length})
                    </button>
                    <div className="flex flex-wrap gap-1.5">
                        {codes.map((code) => {
                            const st = US_STATES.find((s) => s.code === code);
                            const on = selected.has(code);
                            return (
                                <button
                                    key={code}
                                    type="button"
                                    onClick={() => toggle(code)}
                                    className={[
                                        "text-xs px-2.5 py-1 rounded-full border transition-colors",
                                        on
                                            ? "bg-host-primary text-white border-transparent"
                                            : "bg-host-secondary text-host-foreground border-host-border hover:border-host-primary",
                                    ].join(" ")}
                                    style={on ? { background: "var(--host-primary)", color: "#fff" } : {}}
                                    title={st?.name}
                                    data-testid={`state-toggle-${code}`}
                                >
                                    {code}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
