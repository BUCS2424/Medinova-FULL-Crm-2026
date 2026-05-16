import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Save, Wand2, ArrowLeft, RotateCcw } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";

import KeywordTagsInput from "@/components/page-gen/KeywordTagsInput";
import SlugPatternEditor from "@/components/page-gen/SlugPatternEditor";
import StatesPicker from "@/components/page-gen/StatesPicker";
import BulkGenerateDialog from "@/components/page-gen/BulkGenerateDialog";
import PagesTab from "@/components/page-gen/PagesTab";
import ByStateTab from "@/components/page-gen/ByStateTab";
import PageSelector from "@/components/page-gen/PageSelector";
import { ALL_STATE_CODES } from "@/lib/states";
import { STARTER_TEMPLATE } from "@/lib/starterTemplate";

const STATUSES = [
    { value: "draft", label: "Draft" },
    { value: "active", label: "Active" },
    { value: "archived", label: "Archived" },
];

const EMPTY_FORM = {
    name: "",
    type: "",
    keywords: [],
    slug_pattern_state: "{product}-{state}",
    slug_pattern_county: "{product}-{county}-county-{state}",
    slug_pattern_city: "{product}-{city}-{state}",
    levels: { state: true, county: true, city: true },
    states_enabled: ALL_STATE_CODES,
    template_html: STARTER_TEMPLATE,
    status: "draft",
    get_started_url: "",
    clone_source_url: "",
    use_ai_content: false,
};

export default function PageGeneratorEditor() {
    const { id: rawId } = useParams();
    const id = (rawId === "new") ? undefined : rawId;
    const isNew = !id;
    const navigate = useNavigate();

    const [form, setForm] = useState(EMPTY_FORM);
    const [originalGenerator, setOriginalGenerator] = useState(null);
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [activeTab, setActiveTab] = useState(isNew ? "config" : "bystate");
    const [statesOpen, setStatesOpen] = useState(false);
    const [pageCount, setPageCount] = useState(null);
    const [errors, setErrors] = useState({}); // field-level
    const [clonedTemplate, setClonedTemplate] = useState(null);
    const [refetching, setRefetching] = useState(false);

    useEffect(() => {
        if (isNew) return;
        let cancel = false;
        (async () => {
            setLoading(true);
            try {
                const { data } = await api.get(`/page-generators/${id}`);
                if (cancel) return;
                setOriginalGenerator(data);
                setForm({
                    name: data.name || "",
                    type: data.type || "",
                    keywords: data.keywords || [],
                    slug_pattern_state: data.slug_pattern_state || "{product}-{state}",
                    slug_pattern_county: data.slug_pattern_county || "{product}-{county}-county-{state}",
                    slug_pattern_city: data.slug_pattern_city || "{product}-{city}-{state}",
                    levels: data.levels || { state: true, county: true, city: true },
                    states_enabled: data.states_enabled || ALL_STATE_CODES,
                    template_html: data.template_html || STARTER_TEMPLATE,
                    status: data.status || "draft",
                    get_started_url: data.get_started_url || "",
                    clone_source_url: data.clone_source_url || "",
                    use_ai_content: data.use_ai_content || false,
                });
                setClonedTemplate(data.cloned_template || null);
            } catch (err) {
                toast.error(formatApiError(err.response?.data?.detail) || err.message);
                navigate("/dev-settings/page-generator", { replace: true });
            } finally {
                setLoading(false);
            }
        })();
        return () => { cancel = true; };
    }, [id, isNew, navigate]);

    const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const refetchTemplate = async () => {
        if (isNew) {
            toast.error("Please save the generator first before cloning a template.");
            return;
        }
        if (!form.clone_source_url.trim()) {
            toast.error("Please select a page to clone first.");
            return;
        }
        
        setRefetching(true);
        try {
            // Save current form state first
            const payload = {
                name: form.name.trim(),
                type: form.type.trim(),
                keywords: form.keywords,
                slug_pattern_state: form.slug_pattern_state.trim(),
                slug_pattern_county: form.slug_pattern_county.trim(),
                slug_pattern_city: form.slug_pattern_city.trim(),
                levels: form.levels,
                states_enabled: form.states_enabled,
                template_html: form.template_html,
                status: form.status,
                get_started_url: form.get_started_url.trim() || null,
                clone_source_url: form.clone_source_url.trim() || null,
                use_ai_content: form.use_ai_content || false,
            };
            await api.patch(`/page-generators/${id}`, payload);
            
            // Start background clone — returns immediately
            await api.post(`/page-generators/${id}/refetch-template`);
            toast.success("Cloning started — this takes 15–30 seconds. Checking status...");

            // Poll for completion every 4 seconds (max 3 minutes)
            let attempts = 0;
            const poll = async () => {
                attempts++;
                try {
                    const { data } = await api.get(`/page-generators/${id}/clone-status`);
                    if (data.status === 'done' && data.has_template) {
                        const genRes = await api.get(`/page-generators/${id}`);
                        setClonedTemplate(genRes.data.cloned_template || null);
                        setRefetching(false);
                        toast.success(`Template cloned! (${Math.round((data.size_bytes||0)/1024)}KB via ${data.fetch_method})`);
                        return;
                    } else if (data.status === 'error') {
                        setRefetching(false);
                        toast.error(`Clone failed: ${data.error}`);
                        return;
                    }
                } catch (e) { /* ignore poll errors */ }
                if (attempts < 45) {
                    setTimeout(poll, 4000);
                } else {
                    // Final check — clone may have just finished
                    try {
                        const { data } = await api.get(`/page-generators/${id}/clone-status`);
                        if (data.has_template) {
                            const genRes = await api.get(`/page-generators/${id}`);
                            setClonedTemplate(genRes.data.cloned_template || null);
                            setRefetching(false);
                            toast.success(`Template cloned! (${Math.round((data.size_bytes||0)/1024)}KB)`);
                            return;
                        }
                    } catch (e) {}
                    setRefetching(false);
                    toast.error("Clone is taking longer than expected — check back in a moment and refresh the page.");
                }
            };
            setTimeout(poll, 4000);

        } catch (err) {
            const detail = err.response?.data?.detail;
            toast.error(formatApiError(detail) || err.message || "Failed to start clone");
            setRefetching(false);
        }
    };

    const validateLocal = () => {
        const e = {};
        if (!form.name.trim()) e.name = "Name is required";
        if (!form.type.trim()) e.type = "Type is required";
        const enabledLevels = Object.keys(form.levels || {}).filter((k) => form.levels[k]);
        if (enabledLevels.length === 0)
            e.levels = "Enable at least one page level";
        for (const lv of enabledLevels) {
            const key = `slug_pattern_${lv}`;
            if (!form[key] || !form[key].trim())
                e[key] = `${lv[0].toUpperCase() + lv.slice(1)} slug pattern is required`;
        }
        if ((form.states_enabled || []).length === 0)
            e.states_enabled = "Pick at least one state";
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const save = async ({ andBulkGenerate = false } = {}) => {
        if (!validateLocal()) return null;
        setSaving(true);
        setErrors({});
        try {
            let result;
            if (isNew) {
                const payload = {
                    name: form.name.trim(),
                    type: form.type.trim(),
                    keywords: form.keywords,
                    slug_pattern_state: form.slug_pattern_state.trim(),
                    slug_pattern_county: form.slug_pattern_county.trim(),
                    slug_pattern_city: form.slug_pattern_city.trim(),
                    levels: form.levels,
                    states_enabled: form.states_enabled,
                    get_started_url: form.get_started_url.trim() || null,
                    clone_source_url: form.clone_source_url.trim() || null,
                    use_ai_content: form.use_ai_content || false,
                };
                const { data } = await api.post("/page-generators", payload);
                result = data;
                toast.success("Generator created");
                if (andBulkGenerate) {
                    navigate(`/dev-settings/page-generator/${data.id}`, { replace: true, state: { openBulk: true } });
                } else {
                    navigate(`/dev-settings/page-generator/${data.id}`, { replace: true });
                }
            } else {
                const payload = {
                    name: form.name.trim(),
                    type: form.type.trim(),
                    keywords: form.keywords,
                    slug_pattern_state: form.slug_pattern_state.trim(),
                    slug_pattern_county: form.slug_pattern_county.trim(),
                    slug_pattern_city: form.slug_pattern_city.trim(),
                    levels: form.levels,
                    states_enabled: form.states_enabled,
                    template_html: form.template_html,
                    status: form.status,
                    get_started_url: form.get_started_url.trim() || null,
                    clone_source_url: form.clone_source_url.trim() || null,
                    use_ai_content: form.use_ai_content || false,
                };
                const { data } = await api.patch(`/page-generators/${id}`, payload);
                result = data;
                setOriginalGenerator(data);
                setClonedTemplate(data.cloned_template || null);
                toast.success("Saved");
                if (andBulkGenerate) setBulkOpen(true);
            }
            return result;
        } catch (err) {
            const detail = err.response?.data?.detail;
            const msg = formatApiError(detail) || err.message;
            // Surface slug-pattern errors inline
            if (typeof detail === "string" && /pattern/i.test(detail)) {
                setErrors((p) => ({ ...p, slug_pattern: detail }));
            }
            toast.error(msg);
            return null;
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-5xl">
                <div className="text-sm text-host-foreground/50">Loading generator…</div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl" data-testid="page-generator-editor">
            <div className="flex items-center gap-3 mb-3">
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-host-foreground/60 hover:text-white hover:bg-host-foreground/10 -ml-2"
                    onClick={() => navigate("/dev-settings/page-generator")}
                    data-testid="editor-back"
                >
                    <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
                </Button>
            </div>
            <h1 className="text-3xl font-semibold mb-1">
                {isNew ? "New generator" : form.name || "Untitled generator"}
            </h1>
            <p className="text-sm text-host-foreground/60 mb-6">
                {isNew
                    ? "Configure a new multi-level page generator."
                    : `Editing • levels: ${Object.entries(form.levels || {}).filter(([,v])=>v).map(([k])=>k).join(" + ") || "none"} • ${(form.states_enabled || []).length} states enabled`}
            </p>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-host-secondary border border-host-border">
                    {!isNew && (
                        <TabsTrigger value="bystate" data-testid="tab-bystate">
                            By State
                        </TabsTrigger>
                    )}
                    <TabsTrigger value="config" data-testid="tab-config">
                        Configuration
                    </TabsTrigger>
                    {!isNew && (
                        <TabsTrigger value="pages" data-testid="tab-pages">
                            Generated Pages {pageCount !== null && (
                                <span className="ml-2 text-xs text-host-foreground/60">({pageCount})</span>
                            )}
                        </TabsTrigger>
                    )}
                </TabsList>

                {!isNew && (
                    <TabsContent value="bystate" className="mt-6">
                        <ByStateTab
                            generator={originalGenerator || form}
                            onSwitchToConfig={() => setActiveTab("config")}
                        />
                    </TabsContent>
                )}

                <TabsContent value="config" className="mt-6 space-y-5">
                    <Card className="bg-host-secondary/60 border-host-border">
                        <CardContent className="p-6 space-y-5">
                            <div>
                                <Label className="text-xs text-host-foreground/80">Name</Label>
                                <Input
                                    value={form.name}
                                    onChange={(e) => setField("name", e.target.value)}
                                    placeholder="e.g. Auto Sales US"
                                    className="bg-host-muted border-host-border text-host-foreground mt-1.5"
                                    data-testid="field-name"
                                />
                                {errors.name && <p className="text-xs text-red-300 mt-1">{errors.name}</p>}
                            </div>

                            <div>
                                <Label className="text-xs text-host-foreground/80">Type / Product</Label>
                                <Input
                                    value={form.type}
                                    onChange={(e) => setField("type", e.target.value)}
                                    placeholder="e.g. Auto Sales, Peptides, ACA Healthcare"
                                    className="bg-host-muted border-host-border text-host-foreground mt-1.5"
                                    data-testid="field-type"
                                />
                                {errors.type && <p className="text-xs text-red-300 mt-1">{errors.type}</p>}
                            </div>

                            <div>
                                <Label className="text-xs text-host-foreground/80">Keywords</Label>
                                <div className="mt-1.5">
                                    <KeywordTagsInput
                                        value={form.keywords}
                                        onChange={(v) => setField("keywords", v)}
                                        label={false}
                                    />
                                </div>
                            </div>

                            <div className="rounded-md border border-host-border bg-host-muted/40 p-4">
                                <label className="flex items-center justify-between gap-3 cursor-pointer" data-testid="ai-content-toggle">
                                    <div>
                                        <div className="text-sm font-medium text-host-foreground">🤖 AI Content Generation</div>
                                        <div className="text-[11px] text-host-foreground/60 mt-1">
                                            Generate unique, SEO-optimized content for each location page using OpenAI. 
                                            When enabled, AI will write custom intro paragraphs tying the product to the specific location.
                                        </div>
                                    </div>
                                    <Switch
                                        checked={!!form.use_ai_content}
                                        onCheckedChange={(v) => setField("use_ai_content", !!v)}
                                        data-testid="switch-ai-content"
                                    />
                                </label>
                            </div>

                            <div>
                                <Label className="text-xs text-host-foreground/80 uppercase tracking-widest">
                                    Page Levels to Generate
                                </Label>
                                <p className="text-[11px] text-host-foreground/50 mt-1 mb-2">
                                    Each enabled level produces its own page per state. State pages list all
                                    counties + cities; county pages list cities; city pages link to siblings.
                                </p>
                                <div className="grid sm:grid-cols-3 gap-2">
                                    {[
                                        { key: "state", label: "State pages", note: "1 per state" },
                                        { key: "county", label: "County pages", note: "N per state" },
                                        { key: "city", label: "City pages", note: "M per state" },
                                    ].map((lv) => (
                                        <label
                                            key={lv.key}
                                            className="flex items-center justify-between gap-3 rounded-md border border-host-border bg-host-muted/40 px-3 py-2 cursor-pointer"
                                            data-testid={`level-toggle-${lv.key}`}
                                        >
                                            <div>
                                                <div className="text-xs font-medium text-host-foreground">{lv.label}</div>
                                                <div className="text-[10px] text-host-foreground/50">{lv.note}</div>
                                            </div>
                                            <Switch
                                                checked={!!form.levels?.[lv.key]}
                                                onCheckedChange={(v) =>
                                                    setField("levels", { ...form.levels, [lv.key]: !!v })
                                                }
                                                data-testid={`switch-level-${lv.key}`}
                                            />
                                        </label>
                                    ))}
                                </div>
                                {errors.levels && (
                                    <p className="text-xs text-red-300 mt-1">{errors.levels}</p>
                                )}
                            </div>

                            {form.levels?.state && (
                                <div>
                                    <Label className="text-xs text-host-foreground/80">State Slug Pattern</Label>
                                    <div className="mt-1.5">
                                        <SlugPatternEditor
                                            level="state"
                                            value={form.slug_pattern_state}
                                            onChange={(v) => setField("slug_pattern_state", v)}
                                            generatorId={isNew ? null : id}
                                            productLabel={form.type}
                                            keywords={form.keywords}
                                            error={errors.slug_pattern_state}
                                        />
                                    </div>
                                    {errors.slug_pattern_state && (
                                        <p className="text-xs text-red-300 mt-1">{errors.slug_pattern_state}</p>
                                    )}
                                </div>
                            )}

                            {form.levels?.county && (
                                <div>
                                    <Label className="text-xs text-host-foreground/80">County Slug Pattern</Label>
                                    <div className="mt-1.5">
                                        <SlugPatternEditor
                                            level="county"
                                            value={form.slug_pattern_county}
                                            onChange={(v) => setField("slug_pattern_county", v)}
                                            generatorId={isNew ? null : id}
                                            productLabel={form.type}
                                            keywords={form.keywords}
                                            error={errors.slug_pattern_county}
                                        />
                                    </div>
                                    {errors.slug_pattern_county && (
                                        <p className="text-xs text-red-300 mt-1">{errors.slug_pattern_county}</p>
                                    )}
                                </div>
                            )}

                            {form.levels?.city && (
                                <div>
                                    <Label className="text-xs text-host-foreground/80">City Slug Pattern</Label>
                                    <div className="mt-1.5">
                                        <SlugPatternEditor
                                            level="city"
                                            value={form.slug_pattern_city}
                                            onChange={(v) => setField("slug_pattern_city", v)}
                                            generatorId={isNew ? null : id}
                                            productLabel={form.type}
                                            keywords={form.keywords}
                                            error={errors.slug_pattern_city}
                                        />
                                    </div>
                                    {errors.slug_pattern_city && (
                                        <p className="text-xs text-red-300 mt-1">{errors.slug_pattern_city}</p>
                                    )}
                                </div>
                            )}

                            <div>
                                <Label className="text-xs text-host-foreground/80">Get Started URL</Label>
                                <Input
                                    type="url"
                                    value={form.get_started_url}
                                    onChange={(e) => setField("get_started_url", e.target.value)}
                                    placeholder="https://yoursite.com/get-started"
                                    className="bg-host-muted border-host-border text-host-foreground mt-1.5"
                                    data-testid="field-get-started-url"
                                />
                                <p className="text-[11px] text-host-foreground/50 mt-1">
                                    URL of your single shared Get Started form page. Every location page's CTA will link
                                    here with <code>?ref={"{slug}"}</code> so the form knows which landing page sent the lead.
                                    Leave blank to default to <code>{"{site_domain}/get-started"}</code>.
                                </p>
                                {errors.get_started_url && (
                                    <p className="text-xs text-red-300 mt-1">{errors.get_started_url}</p>
                                )}
                            </div>

                            <div className="rounded-md border border-host-border bg-host-muted/40 p-4 space-y-3">
                                <div>
                                    <Label className="text-xs text-host-foreground/80 uppercase tracking-widest">
                                        Template Source
                                    </Label>
                                    <p className="text-[11px] text-host-foreground/50 mt-1">
                                        Select a page from your live site to clone its design and layout. This template will be used for all generated location pages.
                                    </p>
                                </div>

                                <PageSelector
                                    value={form.clone_source_url}
                                    onChange={(url) => setField("clone_source_url", url)}
                                    onRefetch={!isNew ? refetchTemplate : null}
                                    refetching={refetching}
                                />

                                {!isNew && clonedTemplate && (
                                    <div className="pt-2" data-testid="clone-template-status">
                                        {(() => {
                                            const sizeBytes = typeof clonedTemplate.raw_size_bytes === "number" ? clonedTemplate.raw_size_bytes : 0;
                                            const sizeKB = Math.round(sizeBytes / 1024);
                                            const isGoodClone = sizeBytes >= 15000;
                                            return (
                                                <div className={`rounded-md px-3 py-2 text-[11px] ${isGoodClone ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
                                                    {isGoodClone ? '✓ Clone successful' : '✗ Clone failed — only got React shell (no rendered content)'}
                                                    {' · '}
                                                    <span className="font-medium">{sizeKB} KB</span>
                                                    {' via '}
                                                    <span className="font-medium">{clonedTemplate.fetch_method}</span>
                                                    {' · '}
                                                    {new Date(clonedTemplate.fetched_at).toLocaleString()}
                                                    {!isGoodClone && (
                                                        <div className="mt-1 text-amber-400/90">
                                                            The server could not render the page (Playwright unreachable). Contact support or try cloning a different source URL.
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                {clonedTemplate?.fetch_warnings?.length > 0 && (
                                    <ul
                                        className="text-[11px] text-amber-400/90 space-y-0.5 list-disc pl-4"
                                        data-testid="clone-template-warnings"
                                    >
                                        {clonedTemplate.fetch_warnings.map((w, i) => (
                                            <li key={i}>{w}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <div className="grid sm:grid-cols-2 gap-5">
                                {!isNew && (
                                    <div>
                                        <Label className="text-xs text-host-foreground/80">Status</Label>
                                        <Select value={form.status} onValueChange={(v) => setField("status", v)}>
                                            <SelectTrigger
                                                className="bg-host-muted border-host-border text-host-foreground mt-1.5"
                                                data-testid="field-status"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-host-secondary border-host-border text-host-foreground">
                                                {STATUSES.map((s) => (
                                                    <SelectItem key={s.value} value={s.value}>
                                                        {s.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>

                            <Collapsible open={statesOpen} onOpenChange={setStatesOpen}>
                                <CollapsibleTrigger asChild>
                                    <button
                                        type="button"
                                        className="w-full flex items-center justify-between text-sm rounded-md border border-host-border bg-host-muted px-4 py-3 hover:border-host-border"
                                        data-testid="states-toggle"
                                    >
                                        <span>
                                            <span className="text-host-foreground/80">States</span>{" "}
                                            <span className="text-host-foreground/50">
                                                ({(form.states_enabled || []).length} of 52 selected)
                                            </span>
                                        </span>
                                        {statesOpen ? (
                                            <ChevronUp className="h-4 w-4 text-host-foreground/60" />
                                        ) : (
                                            <ChevronDown className="h-4 w-4 text-host-foreground/60" />
                                        )}
                                    </button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="pt-4">
                                    <StatesPicker
                                        value={form.states_enabled}
                                        onChange={(v) => setField("states_enabled", v)}
                                    />
                                    {errors.states_enabled && (
                                        <p className="text-xs text-red-300 mt-2">{errors.states_enabled}</p>
                                    )}
                                </CollapsibleContent>
                            </Collapsible>

                            {!isNew && (
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <Label className="text-xs text-host-foreground/80">HTML Template</Label>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs text-host-foreground/60 hover:text-white hover:bg-host-foreground/10"
                                            onClick={() => setField("template_html", STARTER_TEMPLATE)}
                                            data-testid="reset-template-btn"
                                        >
                                            <RotateCcw className="h-3 w-3 mr-1.5" /> Reset to starter template
                                        </Button>
                                    </div>
                                    <Textarea
                                        value={form.template_html}
                                        onChange={(e) => setField("template_html", e.target.value)}
                                        rows={14}
                                        className="bg-host-muted border-host-border text-host-foreground font-mono text-xs"
                                        data-testid="field-template"
                                    />
                                    <p className="text-[11px] text-host-foreground/50 mt-1.5">
                                        Available tokens: <code>{"{{title}}"}</code>, <code>{"{{meta_description}}"}</code>, <code>{"{{theme_style_block}}"}</code>, <code>{"{{company_name}}"}</code>, <code>{"{{company_phone}}"}</code>, <code>{"{{state_name}}"}</code>, <code>{"{{city}}"}</code>, <code>{"{{county}}"}</code>, <code>{"{{product_label}}"}</code>, <code>{"{{keywords}}"}</code>, <code>{"{{cta}}"}</code>
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="flex flex-col sm:flex-row gap-2 sticky bottom-4">
                        <Button
                            type="button"
                            variant="outline"
                            className="border-host-border text-host-foreground/80 hover:bg-host-foreground/10"
                            onClick={() => navigate("/dev-settings/page-generator")}
                            disabled={saving}
                            data-testid="cancel-btn"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={() => save()}
                            disabled={saving}
                            style={{ background: "var(--host-primary)", color: "var(--host-primary-foreground)" }}
                            data-testid="save-btn"
                        >
                            <Save className="h-4 w-4 mr-2" />
                            {saving ? "Saving…" : "Save"}
                        </Button>
                        {!isNew && (
                            <Button
                                type="button"
                                onClick={() => save({ andBulkGenerate: true })}
                                disabled={saving}
                                variant="outline"
                                className="border-[color:var(--host-primary)]/50 text-[color:var(--host-primary)] hover:bg-[color:var(--host-primary)]/10"
                                data-testid="save-and-generate-btn"
                            >
                                <Wand2 className="h-4 w-4 mr-2" />
                                Save & Bulk generate
                            </Button>
                        )}
                    </div>
                </TabsContent>

                {!isNew && (
                    <TabsContent value="pages" className="mt-6">
                        <PagesTab
                            generator={originalGenerator || form}
                            onCounts={(n) => setPageCount(n)}
                        />
                    </TabsContent>
                )}
            </Tabs>

            {!isNew && (
                <BulkGenerateDialog
                    open={bulkOpen}
                    onOpenChange={setBulkOpen}
                    generator={originalGenerator}
                    onComplete={() => {
                        setActiveTab("pages");
                    }}
                />
            )}
        </div>
    );
}
