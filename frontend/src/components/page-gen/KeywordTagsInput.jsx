import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function KeywordTagsInput({ value = [], onChange, label = "Keywords", id }) {
    const [input, setInput] = useState("");

    const addTag = (raw) => {
        const tags = raw.split(",").map((s) => s.trim()).filter(Boolean);
        const next = [...new Set([...value, ...tags])];
        onChange(next);
        setInput("");
    };

    const removeTag = (tag) => onChange(value.filter((t) => t !== tag));

    return (
        <div className="space-y-2">
            {label && <Label htmlFor={id}>{label}</Label>}
            <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 rounded-md border border-host-border bg-host-background focus-within:ring-1 focus-within:ring-host-primary">
                {value.map((tag) => (
                    <span
                        key={tag}
                        className="flex items-center gap-1 bg-host-secondary text-host-foreground text-xs px-2 py-0.5 rounded-full border border-host-border"
                    >
                        {tag}
                        <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="text-host-foreground/40 hover:text-red-500 transition-colors"
                            aria-label={`Remove ${tag}`}
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                ))}
                <input
                    id={id}
                    type="text"
                    className="flex-1 min-w-[120px] text-sm bg-transparent outline-none placeholder:text-host-foreground/40"
                    placeholder={value.length === 0 ? "Type keyword, press Enter or comma" : "Add more…"}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                            e.preventDefault();
                            if (input.trim()) addTag(input);
                        } else if (e.key === "Backspace" && !input && value.length > 0) {
                            removeTag(value[value.length - 1]);
                        }
                    }}
                    onBlur={() => { if (input.trim()) addTag(input); }}
                    data-testid="keyword-input"
                />
            </div>
            <p className="text-xs text-host-foreground/50">Press Enter or comma to add. Backspace removes last.</p>
        </div>
    );
}
