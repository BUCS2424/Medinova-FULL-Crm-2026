"""Phase 4a render pipeline — build full HTML from structured page.content
at request time, applying current site_settings + generator config.

For pages with structured `content`, this replaces the bake-then-overlay approach.
For legacy pages (only `html` field set), routes still use apply_live_overlay.
"""
from __future__ import annotations

import html as html_lib
import json
from typing import Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from .render_overlay import apply_live_overlay
from .theme_inheritance import theme_style_block, PREFERS_COLOR_SCHEME_SCRIPT
from . import seo_jsonld as _jsonld
from services.component_namespace import loc_prefix


# ---- Module renderers (data dict -> HTML string) ----

def _esc(v) -> str:
    return html_lib.escape("" if v is None else str(v))


def _render_hero(data: dict) -> str:
    pills = ""
    keywords = data.get("keywords") or []
    if keywords:
        pills_html = "".join(
            f'<span class="text-xs font-medium px-3 py-1 rounded-full border" '
            f'style="background: rgb(var(--host-primary-rgb) / 0.10); color: var(--host-primary); '
            f'border-color: rgb(var(--host-primary-rgb) / 0.30);">{_esc(k)}</span>'
            for k in keywords
        )
        pills = f'<div class="mt-6 flex flex-wrap gap-2">{pills_html}</div>'

    return (
        '<section class="mb-14">'
        f'<p class="text-xs uppercase tracking-[0.2em] opacity-60 mb-3">{_esc(data.get("eyebrow"))}</p>'
        f'<h1 class="text-4xl sm:text-5xl font-semibold leading-tight">{_esc(data.get("h1"))}</h1>'
        f'<p class="mt-5 text-base opacity-80 max-w-2xl">{_esc(data.get("intro"))}</p>'
        f'{pills}'
        '</section>'
    )


def _render_services(data: dict, phone: str = "") -> str:
    items = list(data.get("items") or [])
    if phone:
        items = items + [
            {"label": "Talk to us", "value": phone, "note": "Quick questions, no commitment.", "is_phone": True}
        ]
    if not items:
        return ""
    cards = "".join(
        f'<div class="rounded-lg border host-border host-secondary-bg p-5">'
        f'<div class="text-xs uppercase tracking-widest opacity-60">{_esc(it.get("label"))}</div>'
        f'<div class="mt-2 text-lg font-semibold{" host-accent" if it.get("is_phone") else ""}">{_esc(it.get("value"))}</div>'
        f'<p class="text-xs opacity-60 mt-1">{_esc(it.get("note"))}</p>'
        '</div>'
        for it in items
    )
    cols = min(max(len(items), 1), 3)
    lead = data.get("lead") or ""
    lead_html = (
        f'<p class="text-sm opacity-80 max-w-2xl mb-5">{_esc(lead)}</p>' if lead else ""
    )
    return f'<section class="mb-14">{lead_html}<div class="grid sm:grid-cols-{cols} gap-4">{cards}</div></section>'


def _render_location_info(data: dict) -> str:
    parts = []
    if data.get("city"):
        parts.append(f'City: <span class="font-medium">{_esc(data.get("city"))}</span>')
    if data.get("county"):
        parts.append(f'County: <span class="font-medium">{_esc(data.get("county"))}</span>')
    if data.get("state"):
        parts.append(f'State: <span class="font-medium">{_esc(data.get("state"))}</span>')
    blurb = data.get("blurb") or ""
    trust = data.get("trust") or ""
    blurb_html = f'<p class="text-sm opacity-90 mt-3">{_esc(blurb)}</p>' if blurb else ""
    trust_html = f'<p class="text-sm opacity-70 mt-3">{_esc(trust)}</p>' if trust else ""
    chip_row = (
        f'<div class="flex flex-wrap gap-x-6 gap-y-1 text-sm opacity-80">{"".join("<span>" + p + "</span>" for p in parts)}</div>'
        if parts else ""
    )
    if not (parts or blurb or trust):
        return ""
    return (
        '<section class="mb-14 rounded-lg border host-border host-secondary-bg p-5">'
        '<div class="text-xs uppercase tracking-widest opacity-60 mb-2">Service area</div>'
        f'{chip_row}{blurb_html}{trust_html}'
        '</section>'
    )


def _render_cta(data: dict) -> str:
    closing = data.get("closing") or ""
    closing_html = f'<p class="mt-6 text-xs opacity-60 max-w-xl mx-auto">{_esc(closing)}</p>' if closing else ""
    return (
        '<section class="rounded-xl border host-border host-secondary-bg p-8 sm:p-10 text-center">'
        f'<h2 class="text-2xl sm:text-3xl font-semibold">{_esc(data.get("heading"))}</h2>'
        f'<p class="mt-2 opacity-80 text-sm max-w-xl mx-auto">{_esc(data.get("body"))}</p>'
        '<a href="#" data-cta="get-started" '
        'class="inline-flex items-center mt-6 px-6 py-2.5 rounded-md host-primary-bg font-medium hover:opacity-90">'
        f'{_esc(data.get("button_label"))}'
        '</a>'
        f'{closing_html}'
        '</section>'
    )


def _render_index_listing(data: dict) -> str:
    sections = data.get("sections") or []
    if not sections:
        return '<p class="text-host-foreground/60">No pages have been generated yet.</p>'
    out = []
    for sec in sections:
        # Optional level breakdown row
        breakdown_html = ""
        breakdown = sec.get("breakdown") or {}
        if breakdown:
            chips = []
            for lv in ("state", "county", "city"):
                n = breakdown.get(lv) or 0
                if n:
                    chips.append(
                        f'<span class="text-[11px] px-2 py-0.5 rounded-full border host-border opacity-80">'
                        f'{n} {lv}{"" if n == 1 else "s"}</span>'
                    )
            if chips:
                breakdown_html = (
                    f'<div class="flex flex-wrap gap-2 mt-2 mb-3">{"".join(chips)}</div>'
                )
        cards = "".join(
            f'<a class="block rounded-md border host-border host-secondary-bg p-4 hover:opacity-90" '
            f'href="{loc_prefix()}/{_esc(it["slug"])}">'
            f'<div class="text-sm font-medium">{_esc(it.get("title") or it["slug"])}</div>'
            f'<div class="text-xs opacity-60 mt-1">'
            f'{_esc(it.get("subtitle"))}'
            + (
                f'<span class="ml-2 inline-block text-[10px] uppercase tracking-widest opacity-70 px-1.5 py-0.5 '
                f'rounded border host-border">{_esc(it.get("level"))}</span>'
                if it.get("level") else ""
            )
            + '</div></a>'
            for it in sec.get("items", [])[:200]
        )
        out.append(
            '<section class="mb-10">'
            f'<h2 class="text-xl font-semibold mb-1">{_esc(sec.get("name"))}</h2>'
            f'<p class="text-xs opacity-60">{_esc(sec.get("subtitle"))}</p>'
            f'{breakdown_html}'
            f'<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{cards}</div>'
            '</section>'
        )
    return "".join(out)


# ---- Phase 4b: cross-link modules ----

def _render_breadcrumbs(data: dict) -> str:
    crumbs = data.get("crumbs") or []
    if not crumbs:
        return ""
    parts = []
    for i, c in enumerate(crumbs):
        sep = '<span class="opacity-40 mx-2">/</span>' if i > 0 else ""
        if c.get("href"):
            parts.append(
                f'{sep}<a class="hover:underline opacity-80 hover:opacity-100" '
                f'href="{_esc(c["href"])}">{_esc(c.get("label"))}</a>'
            )
        else:
            parts.append(f'{sep}<span class="opacity-60">{_esc(c.get("label"))}</span>')
    return (
        '<nav aria-label="Breadcrumb" class="text-xs mb-6" data-module="breadcrumbs">'
        f'<div class="flex flex-wrap items-center">{"".join(parts)}</div>'
        '</nav>'
    )


def _render_cross_links_down(data: dict) -> str:
    product_slug = data.get("product_slug") or ""
    href_base = f"{loc_prefix()}/{product_slug}" if product_slug else loc_prefix()

    counties = data.get("counties") or []
    cities = data.get("cities") or []
    state_total_cities = data.get("state_total_cities") or len(cities)
    truncated = len(cities) < state_total_cities

    blocks = []
    if counties:
        county_cards = "".join(
            f'<a class="block rounded-md border host-border host-secondary-bg p-3 hover:opacity-90 text-sm" '
            f'href="{href_base}/{_esc(c["slug"])}">'
            f'<div class="font-medium">{_esc(c.get("label"))}</div>'
            f'<div class="text-[11px] opacity-60 mt-0.5">County</div>'
            f'</a>'
            for c in counties
        )
        blocks.append(
            '<div class="mb-10" data-section="counties">'
            f'<h2 class="text-xl font-semibold mb-3">Counties ({len(counties)})</h2>'
            f'<div class="grid sm:grid-cols-2 md:grid-cols-3 gap-3">{county_cards}</div>'
            '</div>'
        )

    if cities:
        city_cards = "".join(
            f'<a class="block rounded-md border host-border host-secondary-bg p-3 hover:opacity-90 text-sm" '
            f'href="{href_base}/{_esc(c["slug"])}">'
            f'<div class="font-medium">{_esc(c.get("label"))}</div>'
            f'<div class="text-[11px] opacity-60 mt-0.5">City</div>'
            f'</a>'
            for c in cities
        )
        title = data.get("cities_heading") or "Cities"
        more_link = ""
        if truncated:
            view_all_url = data.get("view_all_url") or loc_prefix()
            more_link = (
                f'<a class="ml-3 text-xs opacity-70 hover:opacity-100 hover:underline" '
                f'href="{_esc(view_all_url)}">View all {state_total_cities} cities →</a>'
            )
        blocks.append(
            '<div class="mb-10" data-section="cities">'
            f'<h2 class="text-xl font-semibold mb-3">{_esc(title)} ({len(cities)}){more_link}</h2>'
            f'<div class="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">{city_cards}</div>'
            '</div>'
        )

    if not blocks:
        return ""
    return f'<section class="mb-14" data-module="cross-links-down">{"".join(blocks)}</section>'


def _render_cross_links_siblings(data: dict) -> str:
    product_slug = data.get("product_slug") or ""
    href_base = f"{loc_prefix()}/{product_slug}" if product_slug else loc_prefix()

    items = data.get("items") or []
    label = data.get("label") or "Nearby pages"
    if not items:
        return ""
    pills = "".join(
        f'<a class="inline-block px-3 py-1.5 rounded-full text-xs border host-border host-secondary-bg '
        f'hover:opacity-90 mr-2 mb-2" href="{href_base}/{_esc(it["slug"])}">{_esc(it.get("label"))}</a>'
        for it in items
    )
    return (
        '<section class="mb-14" data-module="cross-links-siblings">'
        f'<h2 class="text-base font-semibold mb-3 opacity-90">{_esc(label)}</h2>'
        f'<div class="flex flex-wrap">{pills}</div>'
        '</section>'
    )


def _render_faq(data: dict) -> str:
    qa = data.get("qa") or []
    if not qa:
        return ""
    items = "".join(
        '<details class="rounded-md border host-border host-secondary-bg p-4 mb-2 group">'
        f'<summary class="cursor-pointer font-medium text-sm flex items-center justify-between">'
        f'<span>{_esc(q.get("question"))}</span>'
        '<span class="opacity-50 ml-3 transition-transform group-open:rotate-180">▾</span>'
        '</summary>'
        f'<p class="text-sm opacity-80 mt-3 leading-relaxed">{_esc(q.get("answer"))}</p>'
        '</details>'
        for q in qa
    )
    return (
        '<section class="mb-14" data-module="faq">'
        '<h2 class="text-xl font-semibold mb-4">Frequently Asked Questions</h2>'
        f'<div>{items}</div>'
        '</section>'
    )


_MODULE_RENDERERS = {
    "hero": lambda d, ctx: _render_hero(d),
    "services": lambda d, ctx: _render_services(d, phone=ctx.get("company_phone", "")),
    "location_info": lambda d, ctx: _render_location_info(d),
    "cta": lambda d, ctx: _render_cta(d),
    "index_listing": lambda d, ctx: _render_index_listing(d),
    "breadcrumbs": lambda d, ctx: _render_breadcrumbs(d),
    "cross_links_down": lambda d, ctx: _render_cross_links_down(d),
    "cross_links_siblings": lambda d, ctx: _render_cross_links_siblings(d),
    "faq": lambda d, ctx: _render_faq(d),
}


def _render_modules(modules: list, ctx: dict) -> str:
    parts = []
    for m in modules or []:
        renderer = _MODULE_RENDERERS.get(m.get("type"))
        if renderer:
            parts.append(renderer(m.get("data") or {}, ctx))
    return "".join(parts)


# ---- Page shell construction ----

_TAILWIND_CDN = '<script src="https://cdn.tailwindcss.com"></script>'

_BASE_BODY_STYLE = """<style>
  body { background: var(--host-background); color: var(--host-foreground); font-family: var(--host-font-sans); }
  .host-primary-bg { background: var(--host-primary); color: var(--host-primary-foreground); }
  .host-accent { color: var(--host-accent); }
  .host-secondary-bg { background: var(--host-secondary); }
  .host-border { border-color: var(--host-border); }
</style>"""


def _starter_header_html(site_settings: dict, location_label: str = "", state_name: str = "") -> str:
    """Header shell — emits placeholder tokens for site_settings text values.
    The single substitution step in render_full_page() resolves them at the end."""
    crumb = ""
    if state_name:
        crumb = state_name + (f" · {location_label}" if location_label and location_label != state_name else "")
    
    # Check if logo_url is available
    logo_url = site_settings.get("logo_url", "")
    if logo_url:
        logo_html = f'<img src="{logo_url}" alt="__SITE_COMPANY_NAME__" class="h-10 w-auto object-contain">'
    else:
        logo_html = ('<div class="h-9 w-9 rounded-md host-primary-bg flex items-center justify-center font-bold">'
                    '__SITE_COMPANY_INITIAL__</div>')
    
    return (
        '<header class="host-secondary-bg border-b host-border">'
        '<div class="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">'
        '<div class="flex items-center gap-3">'
        + logo_html +
        '<div><div class="text-sm font-semibold">__SITE_COMPANY_NAME__</div>'
        f'<div class="text-xs opacity-60">{_esc(crumb)}</div></div></div>'
        '<a href="tel:__SITE_COMPANY_PHONE__" class="text-sm font-medium host-accent hover:underline">'
        '__SITE_COMPANY_PHONE__</a>'
        '</div></header>'
    )


def _starter_footer_html(site_settings: dict, state_name: str = "") -> str:
    """Footer shell — emits placeholder tokens (resolved by substitution step)."""
    return (
        '<footer class="border-t host-border mt-12">'
        '<div class="max-w-6xl mx-auto px-6 py-6 text-xs opacity-60 flex flex-col sm:flex-row sm:justify-between gap-2">'
        f'<div>&copy; __SITE_COMPANY_NAME__{" · " + _esc(state_name) if state_name else ""}</div>'
        '<div>__SITE_COMPANY_ADDRESS__</div>'
        '</div></footer>'
    )


def _resolve_theme_attrs(site_settings: dict) -> tuple[str, str]:
    """Returns (html_attr_string, head_extra_script). For 'auto' mode the
    overlay later strips data-theme; we still emit prefers-color-scheme script."""
    mode = (site_settings.get("theme_mode") or "auto").lower()
    if mode in {"light", "dark"}:
        return f' data-theme="{mode}"', ""
    return "", PREFERS_COLOR_SCHEME_SCRIPT


def _absolutize_clone_links(stylesheets: list[str], source_url: str) -> list[str]:
    out = []
    for s in stylesheets or []:
        try:
            out.append(urljoin(source_url, s))
        except Exception:
            out.append(s)
    return out


def _wrap_with_clone(
    cloned: dict,
    body_modules_html: str,
) -> tuple[str, str]:
    """Return (cloned_head_extra_html, cloned_body_html) with body modules injected.

    cloned_head_extra_html: <link rel="stylesheet"> tags re-emitted.
    cloned_body_html: header_html + body_modules + footer_html (or full body wrap
    with marker substitution).
    """
    stylesheets = cloned.get("stylesheets") or []
    head_links = "".join(
        f'<link rel="stylesheet" href="{_esc(s)}">' for s in stylesheets
    )

    header = cloned.get("header_html") or ""
    footer = cloned.get("footer_html") or ""
    full_body = cloned.get("body_html") or ""

    if full_body and "<!-- BODY_INJECTION_POINT -->" in full_body:
        body_html = full_body.replace("<!-- BODY_INJECTION_POINT -->", body_modules_html, 1)
    else:
        body_html = (
            (header or "")
            + '<main class="max-w-6xl mx-auto px-6 py-16">'
            + body_modules_html
            + "</main>"
            + (footer or "")
        )

    return head_links, body_html


def _substitute_site_settings(html: str, site_settings: dict) -> str:
    """The ONLY place site_settings text values are applied to rendered HTML.

    All renderers (build_content, _starter_header_html, _starter_footer_html,
    _render_services) emit `__SITE_*__` placeholder tokens; this single pass
    resolves them at request time so changes to site_settings take effect
    without re-running bulk-generate.
    """
    if not html:
        return html
    company_name = site_settings.get("company_name") or "DemoCo"
    company_phone = site_settings.get("company_phone") or ""
    company_address = site_settings.get("company_address") or ""
    default_cta = site_settings.get("default_cta") or "Get Started"
    initial = (company_name[:1] or "D").upper()
    site_domain = (site_settings.get("site_domain") or "").rstrip("/")

    return (
        html.replace("__SITE_COMPANY_INITIAL__", html_lib.escape(initial))
            .replace("__SITE_COMPANY_NAME__", html_lib.escape(company_name))
            .replace("__SITE_COMPANY_PHONE__", html_lib.escape(company_phone))
            .replace("__SITE_COMPANY_ADDRESS__", html_lib.escape(company_address))
            .replace("__SITE_DEFAULT_CTA__", html_lib.escape(default_cta))
            # Phase 4c-2: canonical/og:url base. Empty when no site_domain →
            # renders root-relative URLs (e.g. "/locations/foo").
            .replace("__SITE_CANONICAL_BASE__", html_lib.escape(site_domain))
    )


def render_full_page(
    generator: Optional[dict],
    page: dict,
    site_settings: dict,
    is_index: bool = False,
) -> str:
    """Build the complete HTML for a page using its structured content.

    The returned HTML still passes through apply_live_overlay() for the final
    theme/analytics/CTA touches so behavior matches Phase 3.7 exactly.
    """
    content = page.get("content") or {}
    modules = list(content.get("modules") or [])
    title = content.get("title") or page.get("title") or "Service Areas"
    meta_description = content.get("meta_description") or page.get("meta_description") or ""

    schema = content.get("schema_data") or {}
    location_label = schema.get("location_label") or ""
    state_name = schema.get("state") or ""
    level = schema.get("level") or page.get("level") or ("city" if not is_index else "index")

    # Phase 4b/4c-2: weave in cross-link modules from page._xlinks. Order:
    # breadcrumbs → hero → services → location_info → cross_links_down →
    # cross_links_siblings → faq → cta.
    if not is_index:
        xlinks = page.get("_xlinks") or {}
        woven: list[dict] = []
        if xlinks.get("breadcrumbs"):
            woven.append({"type": "breadcrumbs", "data": {"crumbs": xlinks["breadcrumbs"]}})
        for m in modules:
            if m.get("type") in {"hero", "services", "location_info", "index_listing"}:
                woven.append(m)
        if level in {"state", "county"} and xlinks.get("down"):
            woven.append({"type": "cross_links_down", "data": xlinks["down"]})
        if level in {"county", "city"} and xlinks.get("siblings"):
            woven.append({"type": "cross_links_siblings", "data": xlinks["siblings"]})
        for m in modules:
            if m.get("type") == "faq":
                woven.append(m)
        for m in modules:
            if m.get("type") == "cta":
                woven.append(m)
        modules = woven

    body_ctx = {
        # Phone is rendered live via the substitution step so it stays in sync
        # with site_settings.company_phone without a regen.
        "company_phone": "__SITE_COMPANY_PHONE__",
    }
    body_modules_html = _render_modules(modules, body_ctx)

    html_theme_attr, theme_auto_script = _resolve_theme_attrs(site_settings)

    cloned = (generator or {}).get("cloned_template") if generator else None
    if cloned:
        head_extra_links, body_inner = _wrap_with_clone(cloned, body_modules_html)
        body_html = body_inner
    else:
        head_extra_links = ""
        if is_index:
            body_html = (
                _starter_header_html(site_settings)
                + '<main class="max-w-6xl mx-auto px-6 py-10">'
                + body_modules_html
                + "</main>"
                + _starter_footer_html(site_settings)
            )
        else:
            body_html = (
                _starter_header_html(site_settings, location_label=location_label, state_name=state_name)
                + '<main class="max-w-6xl mx-auto px-6 py-16">'
                + body_modules_html
                + "</main>"
                + _starter_footer_html(site_settings, state_name=state_name)
            )

    # ---- Phase 4c-2: full SEO meta head + JSON-LD blocks ----
    slug = page.get("slug", "") if not is_index else ""
    # Include product_slug in canonical path for correct URL structure
    product_slug_for_canonical = page.get("product_slug") or ""
    if not is_index and product_slug_for_canonical and slug:
        canonical_path = f"{loc_prefix()}/{product_slug_for_canonical}/{slug}"
    elif not is_index:
        canonical_path = f"{loc_prefix()}/{slug}"
    else:
        canonical_path = loc_prefix()
    # Use placeholder for site_domain so canonical/og:url stay live with PATCH.
    canonical_url = f"__SITE_CANONICAL_BASE__{canonical_path}"

    keyword_csv = ""
    if not is_index:
        kws = (generator or {}).get("keywords") or []
        if kws:
            keyword_csv = ", ".join(kws)
        elif schema.get("keyword"):
            keyword_csv = schema.get("keyword")

    og_image = (site_settings.get("og_image_url") or "").strip()
    twitter_handle = (site_settings.get("twitter_handle") or "").strip()
    locale = (site_settings.get("default_locale") or "en_US").strip() or "en_US"
    twitter_card = "summary_large_image" if og_image else "summary"

    seo_meta_parts = [
        '<meta name="robots" content="index,follow,max-image-preview:large">',
        f'<meta name="keywords" content="{_esc(keyword_csv)}">' if keyword_csv else "",
        '<meta name="author" content="__SITE_COMPANY_NAME__">',
        f'<link rel="canonical" href="{_esc(canonical_url)}">',
        f'<link rel="alternate" hreflang="en-us" href="{_esc(canonical_url)}">',
        f'<link rel="alternate" hreflang="x-default" href="{_esc(canonical_url)}">',
        '<meta property="og:type" content="website">',
        f'<meta property="og:title" content="{_esc(title)}">',
        f'<meta property="og:description" content="{_esc(meta_description)}">',
        f'<meta property="og:url" content="{_esc(canonical_url)}">',
        '<meta property="og:site_name" content="__SITE_COMPANY_NAME__">',
        f'<meta property="og:locale" content="{_esc(locale)}">',
        f'<meta property="og:image" content="{_esc(og_image)}">' if og_image else "",
        f'<meta name="twitter:card" content="{twitter_card}">',
        f'<meta name="twitter:title" content="{_esc(title)}">',
        f'<meta name="twitter:description" content="{_esc(meta_description)}">',
        f'<meta name="twitter:image" content="{_esc(og_image)}">' if og_image else "",
        f'<meta name="twitter:site" content="{_esc(twitter_handle)}">' if twitter_handle else "",
    ]
    seo_meta_html = "".join(p for p in seo_meta_parts if p)

    # JSON-LD blocks — raw site_settings values (rendered live each request)
    jsonld_html = ""
    raw_company_name = site_settings.get("company_name") or "DemoCo"
    raw_company_phone = site_settings.get("company_phone") or ""
    raw_company_address = site_settings.get("company_address") or ""
    raw_site_domain = (site_settings.get("site_domain") or "").rstrip("/")
    abs_canonical_url = f"{raw_site_domain}{canonical_path}" if raw_site_domain else canonical_path
    if not is_index:
        location_name = (
            schema.get("city")
            or (f"{schema.get('county')} County" if schema.get("county") else None)
            or schema.get("state")
            or ""
        )
        area_served_type = (
            "City" if level == "city"
            else "AdministrativeArea" if level == "county"
            else "State"
        )
        ld_blocks: list[dict] = []
        ld_blocks.append(_jsonld.build_local_business(
            company_name_token=raw_company_name,
            company_phone_token=raw_company_phone,
            company_address_token=raw_company_address,
            canonical_url=abs_canonical_url,
            location_name=location_name,
            state_abbr=schema.get("state_abbr") or "",
            address_locality=location_name,
            area_served_type=area_served_type,
        ))

        # BreadcrumbList for all page levels that have breadcrumbs.
        xlinks_for_ld = page.get("_xlinks") or {}
        crumbs = xlinks_for_ld.get("breadcrumbs") or []
        ld_crumbs = []
        for c in crumbs:
            if not c.get("label"):
                continue
            href = c.get("href") or ""
            if href.startswith("/"):
                url = f"{raw_site_domain}{href}" if raw_site_domain else href
            elif href:
                url = href
            else:
                url = abs_canonical_url
            ld_crumbs.append({"label": c["label"], "url": url})
        if ld_crumbs:
            bc = _jsonld.build_breadcrumb_list(ld_crumbs)
            if bc:
                ld_blocks.append(bc)

        ld_blocks.append(_jsonld.build_service(
            service_type=(generator or {}).get("type") or "",
            company_name_token=raw_company_name,
            location_name=location_name,
            name=schema.get("keyword") or schema.get("product_label") or title,
            description=meta_description,
        ))

        # FAQPage block — only when faq module is rendered. Substitute
        # company_name placeholder in question/answer text since this is JSON,
        # not HTML (no html-escape needed).
        for m in modules:
            if m.get("type") == "faq":
                faq_pairs = (m.get("data") or {}).get("qa") or []
                resolved_pairs = [
                    {
                        "question": (p.get("question") or "").replace("__SITE_COMPANY_NAME__", raw_company_name),
                        "answer": (p.get("answer") or "").replace("__SITE_COMPANY_NAME__", raw_company_name),
                    }
                    for p in faq_pairs
                ]
                faq_block = _jsonld.build_faq_page(resolved_pairs)
                if faq_block:
                    ld_blocks.append(faq_block)
                break

        jsonld_parts = [
            f'<script type="application/ld+json">{json.dumps(b, ensure_ascii=False)}</script>'
            for b in ld_blocks if b
        ]
        jsonld_html = "".join(jsonld_parts)

    full_html = (
        f'<!DOCTYPE html>'
        f'<html lang="en"{html_theme_attr}>'
        f'<head>'
        f'<meta charset="UTF-8">'
        f'<meta name="viewport" content="width=device-width, initial-scale=1.0">'
        f'<!-- HOST_ANALYTICS -->'
        f'{theme_auto_script}'
        f'<title>{_esc(title)}</title>'
        f'<meta name="description" content="{_esc(meta_description)}">'
        f'{seo_meta_html}'
        f'{_TAILWIND_CDN}'
        f'{theme_style_block()}'
        f'{head_extra_links}'
        f'{_BASE_BODY_STYLE}'
        f'{jsonld_html}'
        f'</head>'
        f'<body class="min-h-screen">'
        f'{body_html}'
        f'</body>'
        f'</html>'
    )

    # Run through Phase 3.7 overlay for analytics replace, theme attr enforcement,
    # and CTA href rewrite. Single source of truth for those three concerns.
    overlaid = apply_live_overlay(
        full_html,
        site_settings,
        generator=generator if not is_index else None,
        page=page if not is_index else None,
        is_index=is_index,
    )

    # FINAL step: resolve all `__SITE_*__` placeholder tokens. This is the ONLY
    # place site_settings text values land in rendered HTML — keeps them live.
    return _substitute_site_settings(overlaid, site_settings)


def build_index_page_object(generated_pages: list[dict], generators_by_id: dict) -> dict:
    """Build a synthetic index page object grouped by generator with a
    per-level breakdown chip row (state / county / city)."""
    sections = []
    grouped: dict[str, list[dict]] = {gid: [] for gid in generators_by_id}
    for p in generated_pages:
        gid = p.get("generator_id")
        if gid in grouped:
            grouped[gid].append(p)

    level_order = {"state": 0, "county": 1, "city": 2, None: 3}

    for gid, items in grouped.items():
        gen = generators_by_id[gid]
        breakdown = {"state": 0, "county": 0, "city": 0}
        for it in items:
            lv = (it.get("level") or "city")
            if lv in breakdown:
                breakdown[lv] += 1
        # Sort: state first, then county, then city; alphabetical within
        items_sorted = sorted(
            items,
            key=lambda it: (level_order.get(it.get("level"), 3), it.get("slug", "")),
        )
        sections.append({
            "name": gen.get("name", ""),
            "subtitle": f'{(gen.get("type") or "").lower()} · {len(items)} pages',
            "breakdown": breakdown,
            "items": [
                {
                    "slug": it.get("slug", ""),
                    "title": it.get("title") or it.get("slug"),
                    "subtitle": it.get("city") or it.get("county") or it.get("state_name") or "",
                    "level": it.get("level") or "city",
                }
                for it in items_sorted
            ],
        })

    return {
        "slug": "_index",
        "content": {
            "title": "Service Areas",
            "meta_description": "Browse all generated location pages.",
            "h1": "Service Areas",
            "intro_paragraph": "Browse generated location pages.",
            "modules": [{"type": "index_listing", "data": {"sections": sections}}],
            "schema_data": {},
        },
    }
