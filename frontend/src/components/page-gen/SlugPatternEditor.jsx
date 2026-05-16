import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useNamespace } from "@/context/NamespaceContext";

const TOKENS_BY_LEVEL = {
    state: ["{product}", "{state}", "{state_abbr}", "{keyword}", "{keywords}"],
    county: ["{product}", "{state}", "{state_abbr}", "{county}", "{keyword}", "{keywords}"],
    city: ["{product}", "{state}", "{state_abbr}", "{county}", "{city}", "{keyword}", "{keywords}"],
};
const TOKENS = TOKENS_BY_LEVEL.city;

const SAMPLE_CTX = {
    "{state}": "texas",
    "{state_abbr}": "tx",
    "{city}": "houston",
    "{county}": "harris",
};

function clientSidePreview(pattern, productSlug, keywords) {
    if (!pattern) return [];
    const cities = ["houston", "austin", "dallas"];
    const counties = ["harris", "travis", "dallas"];
    const states = [
        { name: "texas", abbr: "tx" },
        { name: "california", abbr: "ca" },
        { name: "new-york", abbr: "ny" },
    ];
    const out = [];
    for (let i = 0; i < 3; i++) {
        const s = states[i % states.length];
        const ctx = {
            "{state}": s.name,
            "{state_abbr}": s.abbr,
            "{city}": cities[i % cities.length],
            "{county}": counties[i % counties.length],
            "{product}": productSlug || "product",
            "{keyword}": (keywords && keywords[i % keywords.length]) ? slugify(keywords[i % keywords.length]) : "",
            "{keywords}": (keywords || []).map(slugify).join("-and-"),
        };
        let s2 = pattern;
        for (const t of TOKENS) s2 = s2.split(t).join(ctx[t] || "");
        out.push(slugify(s2));
    }
    return out;
}

function slugify(v) {
    return String(v || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-+|-+$/g, "");
}

export default function SlugPatternEditor({
    value,
    onChange,
    generatorId,
    productLabel,
    keywords,
    error,
    level,
}) {
    const inputRef = useRef(null);
    const [preview, setPreview] = useState([]);
    const [previewSource, setPreviewSource] = useState("client");
    const debounceRef = useRef(null);
    const tokens = TOKENS_BY_LEVEL[level] || TOKENS;
    const { public_prefix } = useNamespace();

    const insertToken = (token) => {
        const el = inputRef.current;
        if (!el) {
            onChange((value || "") + token);
            return;
        }
        const start = el.selectionStart ?? value.length;
        const end = el.selectionEnd ?? value.length;
        const next = value.slice(0, start) + token + value.slice(end);
        onChange(next);
        // restore cursor
        setTimeout(() => {
            el.focus();
            const pos = start + token.length;
            el.setSelectionRange(pos, pos);
        }, 0);
    };

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            // If editing existing generator, use server preview
            if (generatorId && value) {
                try {
                    const body = { limit: 3 };
                    if (level) body.level = level;
                    const { data } = await api.post(
                        `/page-generators/${generatorId}/preview-slugs`,
                        body
                    );
                    setPreview((data?.items || []).map((it) => it.slug));
                    setPreviewSource("server");
                    return;
                } catch (_) {
                    // fall through to client preview
                }
            }
            setPreview(clientSidePreview(value, slugify(productLabel), keywords));
            setPreviewSource("client");
        }, 500);
        return () => debounceRef.current && clearTimeout(debounceRef.current);
    }, [value, generatorId, productLabel, JSON.stringify(keywords), level]); // eslint-disable-line

    return (
        <div className="space-y-2" data-testid={`slug-pattern-editor${level ? `-${level}` : ""}`}>
            <div className="flex flex-wrap gap-1.5">
                {tokens.map((t) => (
                    <button
                        key={t}
                        type="button"
                        onClick={() => insertToken(t)}
                        className="px-2 py-1 rounded text-[11px] font-mono border border-host-border bg-host-secondary hover:bg-host-foreground/10 hover:border-host-foreground/30 text-host-foreground/90"
                        data-testid={`slug-token-${level || "any"}-${t.replace(/[{}]/g, "")}`}
                    >
                        {t}
                    </button>
                ))}
            </div>
            <Input
                ref={inputRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={
                    level === "state" ? "{product}-{state}" :
                    level === "county" ? "{product}-{county}-county-{state}" :
                    level === "city" ? "{product}-{city}-{state}" :
                    "e.g. buy-{product}-in-{city}-{state}"
                }
                className="bg-host-muted border-host-border text-host-foreground font-mono text-sm"
                data-testid={`slug-pattern-input${level ? `-${level}` : ""}`}
            />
            {error && (
                <div className="text-xs text-red-300" data-testid="slug-pattern-error">
                    {error}
                </div>
            )}
            <div className="rounded-md border border-host-border bg-host-muted p-3" data-testid="slug-preview">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] uppercase tracking-widest text-host-foreground/60">
                        Live preview
                    </span>
                    <Badge variant="outline" className="border-host-border text-[10px] text-host-foreground/60">
                        {previewSource}
                    </Badge>
                </div>
                {preview.length === 0 ? (
                    <div className="text-xs text-host-foreground/50">Type a slug pattern to see examples.</div>
                ) : (
                    <ul className="space-y-1 text-xs font-mono text-host-foreground/80">
                        {preview.map((s, i) => (
                            <li key={i} data-testid={`slug-preview-${i}`}>
                                <span className="text-host-foreground/50">/{public_prefix}/</span>
                                <span style={{ color: "var(--host-primary)" }}>{s || "(empty)"}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
