"""Industry-agnostic HTML template renderer for generated location pages."""
from __future__ import annotations

from typing import Optional
from jinja2 import Environment, BaseLoader, select_autoescape

from .theme_inheritance import theme_style_block, PREFERS_COLOR_SCHEME_SCRIPT
from .state_facts import get_state_facts
from .content_variation import (
    pick_variant,
    expand_tokens,
    build_token_ctx,
    load_library,
    render_section,
    build_faqs,
)


STARTER_TEMPLATE = """<!DOCTYPE html>
<html lang="en"{{ html_theme_attr | safe }}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- HOST_ANALYTICS -->
  {{ theme_auto_script | safe }}
  <title>{{ title }}</title>
  <meta name="description" content="{{ meta_description }}">
  <link rel="canonical" href="/locations/{{ slug }}">
  <script src="https://cdn.tailwindcss.com"></script>
  {{ theme_style_block | safe }}
  <style>
    body {
      background: var(--host-background);
      color: var(--host-foreground);
      font-family: var(--host-font-sans);
    }
    .host-primary-bg { background: var(--host-primary); color: var(--host-primary-foreground); }
    .host-accent { color: var(--host-accent); }
    .host-secondary-bg { background: var(--host-secondary); }
    .host-border { border-color: var(--host-border); }
  </style>
</head>
<body class="min-h-screen">
  <header class="host-secondary-bg border-b host-border">
    <div class="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        {% if logo_url %}
        <img src="{{ logo_url }}" alt="{{ company_name }}" class="h-10 w-auto object-contain">
        {% else %}
        <div class="h-9 w-9 rounded-md host-primary-bg flex items-center justify-center font-bold">
          {{ company_name[:1] | upper }}
        </div>
        {% endif %}
        <div>
          <div class="text-sm font-semibold">{{ company_name }}</div>
          <div class="text-xs opacity-60">{{ state_name }}{% if city %} · {{ city }}{% elif county %} · {{ county }}{% endif %}</div>
        </div>
      </div>
      <a href="tel:{{ company_phone | replace(' ', '') | replace('(', '') | replace(')', '') | replace('-', '') }}"
         class="text-sm font-medium host-accent hover:underline">{{ company_phone }}</a>
    </div>
  </header>

  <main class="max-w-6xl mx-auto px-6 py-16">
    <section class="mb-14">
      <p class="text-xs uppercase tracking-[0.2em] opacity-60 mb-3">{{ product_label }}</p>
      <h1 class="text-4xl sm:text-5xl font-semibold leading-tight">
        {{ headline }}
      </h1>
      <p class="mt-5 text-base opacity-80 max-w-2xl">
        {{ intro }}
      </p>
      {% if keywords %}
      <div class="mt-6 flex flex-wrap gap-2">
        {% for kw in keywords %}
        <span class="text-xs font-medium px-3 py-1 rounded-full border"
              style="background: rgb(var(--host-primary-rgb) / 0.10); color: var(--host-primary); border-color: rgb(var(--host-primary-rgb) / 0.30);">
          {{ kw }}
        </span>
        {% endfor %}
      </div>
      {% endif %}
    </section>

    <section class="grid sm:grid-cols-3 gap-4 mb-14">
      <div class="rounded-lg border host-border host-secondary-bg p-5">
        <div class="text-xs uppercase tracking-widest opacity-60">Coverage</div>
        <div class="mt-2 text-lg font-semibold">{{ state_name }}</div>
        <p class="text-xs opacity-60 mt-1">Serving customers across the state.</p>
      </div>
      <div class="rounded-lg border host-border host-secondary-bg p-5">
        <div class="text-xs uppercase tracking-widest opacity-60">Service</div>
        <div class="mt-2 text-lg font-semibold">{{ product_label }}</div>
        <p class="text-xs opacity-60 mt-1">Tailored to local demand.</p>
      </div>
      <div class="rounded-lg border host-border host-secondary-bg p-5">
        <div class="text-xs uppercase tracking-widest opacity-60">Talk to us</div>
        <div class="mt-2 text-lg font-semibold host-accent">{{ company_phone }}</div>
        <p class="text-xs opacity-60 mt-1">Quick questions, no commitment.</p>
      </div>
    </section>

    <section class="rounded-xl border host-border host-secondary-bg p-8 sm:p-10 text-center">
      <h2 class="text-2xl sm:text-3xl font-semibold">{{ cta_heading }}</h2>
      <p class="mt-2 opacity-80 text-sm max-w-xl mx-auto">{{ cta_body }}</p>
      <a href="#" data-cta="get-started"
         class="inline-flex items-center mt-6 px-6 py-2.5 rounded-md host-primary-bg font-medium hover:opacity-90">
        {{ cta }}
      </a>
    </section>
  </main>

  <footer class="border-t host-border mt-12">
    <div class="max-w-6xl mx-auto px-6 py-6 text-xs opacity-60 flex flex-col sm:flex-row sm:justify-between gap-2">
      <div>&copy; {{ company_name }} · {{ state_name }}</div>
      <div>{{ company_address }}</div>
    </div>
  </footer>
</body>
</html>
"""


_jinja_env = Environment(
    loader=BaseLoader(),
    autoescape=select_autoescape(["html", "xml"]),
    trim_blocks=False,
    lstrip_blocks=False,
)


def get_starter_template() -> str:
    return STARTER_TEMPLATE


def _build_render_ctx(generator: dict, location_ctx: dict, site_settings: dict) -> dict:
    product_label = (generator.get("type") or "Service").title()
    
    # Generate product_slug for URL construction
    from .slug_engine import slugify
    product_slug = slugify(generator.get("type") or "service")
    
    state_name = location_ctx.get("state_name") or ""
    city = location_ctx.get("city")
    county = location_ctx.get("county")
    keyword = location_ctx.get("keyword")
    keywords = list(generator.get("keywords") or [])
    level = location_ctx.get("level") or ("city" if city else "county" if county else "state")

    # Resolve theme mode for public render (light | dark | auto). Default: auto.
    theme_mode = (site_settings.get("theme_mode") or "auto").lower()
    if theme_mode not in {"light", "dark", "auto"}:
        theme_mode = "auto"
    if theme_mode == "auto":
        html_theme_attr = ""
        theme_auto_script = PREFERS_COLOR_SCHEME_SCRIPT
    else:
        html_theme_attr = f' data-theme="{theme_mode}"'
        theme_auto_script = ""

    if level == "state":
        location_label = state_name
        primary_phrase = state_name
    elif level == "county":
        location_label = f"{county} County" if county else state_name
        primary_phrase = f"{location_label}, {state_name}"
    else:  # city
        location_label = city or state_name
        primary_phrase = f"{location_label}, {state_name}" if location_label and location_label != state_name else state_name

    headline_subject = keyword or product_label
    headline = f"{headline_subject} in {primary_phrase}"

    intro = (
        f"{site_settings.get('company_name', 'DemoCo')} delivers {product_label.lower()} "
        f"to {location_label}{', ' + state_name if location_label != state_name else ''}. "
        f"Reach our team to learn more about {keyword or product_label.lower()} options near you."
    )

    cta = site_settings.get("default_cta") or "Talk to us"
    cta_heading = f"Ready to get started in {location_label}?"
    cta_body = f"Call {site_settings.get('company_phone', '')} or send us a message — we respond within one business day."

    title_subject = keyword.title() if keyword else product_label
    title = f"{title_subject} in {primary_phrase} | {site_settings.get('company_name', 'DemoCo')}"
    meta_description = (
        f"{title_subject} services in {primary_phrase}. "
        f"Get in touch with {site_settings.get('company_name', 'DemoCo')}."
    )[:155]

    return {
        "title": title,
        "meta_description": meta_description,
        "headline": headline,
        "intro": intro,
        "product_label": product_label,
        "product_slug": product_slug,
        "company_name": site_settings.get("company_name") or "DemoCo",
        "company_phone": site_settings.get("company_phone") or "",
        "company_address": site_settings.get("company_address") or "",
        "state_name": state_name,
        "city": city,
        "county": county,
        "keyword": keyword,
        "keywords": keywords,
        "level": level,
        "primary_phrase": primary_phrase,
        "location_label": location_label,
        "cta": cta,
        "cta_heading": cta_heading,
        "cta_body": cta_body,
        "slug": location_ctx.get("slug", ""),
        "logo_url": site_settings.get("logo_url", ""),
        "theme_style_block": theme_style_block(),
        "html_theme_attr": html_theme_attr,
        "theme_auto_script": theme_auto_script,
    }


def render_page(
    generator: dict,
    location_ctx: dict,
    site_settings: dict,
    template_html: Optional[str] = None,
) -> dict:
    """Legacy renderer: returns full HTML string. DEPRECATED for new pages.

    Phase 4a: prefer build_content() + render_pipeline.render_full_page().
    Kept only so legacy generated_pages with the `html` field continue to render.
    """
    tmpl_src = template_html or generator.get("template_html") or STARTER_TEMPLATE
    tmpl = _jinja_env.from_string(tmpl_src)
    ctx = _build_render_ctx(generator, location_ctx, site_settings)
    html = tmpl.render(**ctx)
    return {
        "title": ctx["title"],
        "meta_description": ctx["meta_description"],
        "html": html,
    }


async def build_content(generator: dict, location_ctx: dict, site_settings: dict) -> dict:
    """Phase 4a: build a structured per-page content snapshot — pure data, no HTML.

    The returned dict is stored on generated_pages.content and is the input
    to render_pipeline.render_full_page() at request time.

    Site-wide text values are stored as placeholder tokens so that changes
    to site_settings (company_name, phone, address, default_cta) take effect
    at render time without re-baking pages. The substitution happens in
    render_pipeline._substitute_site_settings.
    
    If AI content generation is enabled (via use_ai_content flag), this will
    generate unique content using OpenAI for each location page.
    """
    import logging
    log = logging.getLogger(__name__)
    
    # Swap site_settings text fields for placeholder tokens before building ctx.
    placeholder_settings = {
        **site_settings,
        "company_name": "__SITE_COMPANY_NAME__",
        "company_phone": "__SITE_COMPANY_PHONE__",
        "company_address": "__SITE_COMPANY_ADDRESS__",
        "default_cta": "__SITE_DEFAULT_CTA__",
    }
    ctx = _build_render_ctx(generator, location_ctx, placeholder_settings)

    state_name = ctx["state_name"]
    city = ctx["city"]
    county = ctx["county"]
    keyword = ctx["keyword"]
    keywords = ctx["keywords"]
    product_label = ctx["product_label"]
    level = ctx["level"]
    location_label = ctx["location_label"]

    # Phase 4c-1: deterministic content variation per slug.
    slug = location_ctx.get("slug") or ""
    library = load_library()
    state_code = (location_ctx.get("state_abbr") or "").upper()
    facts = get_state_facts(state_code) or {}
    token_ctx = build_token_ctx(
        keyword=keyword or product_label,
        product=product_label,
        state_name=state_name,
        state_abbr=state_code,
        city=city,
        county=county,
        location_label=location_label,
        state_facts=facts,
    )
    
    # Try AI content generation if enabled
    use_ai = generator.get("use_ai_content", False)
    ai_content = None
    
    if use_ai:
        try:
            from .ai_content_generator import generate_location_content
            log.info(f"Generating AI content for {location_label}, {state_name} ({level} level)")
            
            ai_content = await generate_location_content(
                product_type=product_label,
                location_name=location_label,
                state_name=state_name,
                level=level,
                keywords=keywords,
                company_name=site_settings.get("company_name") or "MEDVera"
            )
            log.info(f"Successfully generated AI content for {location_label}")
        except Exception as e:
            log.warning(f"AI content generation failed for {location_label}: {str(e)}. Falling back to template content.")
            ai_content = None
    
    # Use AI content if available, otherwise fall back to template-based content
    if ai_content:
        intro_paragraph = ai_content["intro"]
        cta_headline = ai_content["headline"]
        cta_subline = ai_content["content_body"][:200] + "..."  # Use first part for CTA subline
        # Override context values with AI-generated content
        ctx["headline"] = ai_content["headline"]
        ctx["title"] = ai_content["title"]
        ctx["meta_description"] = ai_content["meta_description"]
    else:
        intro_paragraph = render_section("intro", slug, token_ctx, library=library) or ctx["intro"]
        cta_headline = render_section("cta_headline", slug, token_ctx, library=library) or ctx["cta_heading"]
        cta_subline = render_section("cta_subline", slug, token_ctx, library=library) or ctx["cta_body"]
    
    # These sections always use template-based content
    services_lead = render_section("services_lead", slug, token_ctx, library=library)
    blurb_key = f"location_blurb_{level}"
    location_blurb = render_section(blurb_key, slug, token_ctx, library=library)
    trust_paragraph = render_section("trust_paragraph", slug, token_ctx, library=library)
    closing_paragraph = render_section("closing_paragraph", slug, token_ctx, library=library)

    schema_data = {
        "city": city or "",
        "county": county or "",
        "state": state_name or "",
        "state_abbr": state_code,
        "keyword": keyword or "",
        "product_label": product_label,
        "location_label": location_label,
        "level": level,
        "region": facts.get("region") or "",
        "rank_by_population": facts.get("rank_by_population"),
        "biggest_cities": list(facts.get("biggest_cities") or [])[:5],
        "neighboring_states": list(facts.get("neighboring_states") or []),
        "nickname": facts.get("nickname") or "",
    }

    modules = [
        {
            "type": "hero",
            "data": {
                "eyebrow": product_label,
                "h1": ctx["headline"],
                "intro": intro_paragraph,
                "keywords": keywords,
            },
        },
        {
            "type": "services",
            "data": {
                "lead": services_lead,
                "items": [
                    {"label": "Coverage", "value": state_name, "note": "Statewide service area."},
                    {"label": "Service", "value": product_label, "note": "Tailored to local demand."},
                ],
            },
        },
        {
            "type": "location_info",
            "data": {
                "city": city or "",
                "county": county or "",
                "state": state_name or "",
                "label": location_label,
                "level": level,
                "blurb": location_blurb,
                "trust": trust_paragraph,
            },
        },
        {
            "type": "cta",
            "data": {
                "heading": cta_headline,
                "body": cta_subline,
                "button_label": ctx["cta"],
                "closing": closing_paragraph,
            },
        },
    ]

    # Phase 4c-2: FAQ module — 5 deterministic Q&A pairs per page
    faqs = build_faqs(slug, token_ctx, count=5, library=library)
    if faqs:
        # Insert FAQ before CTA (CTA is the last entry above).
        cta_module = modules.pop()
        modules.append({"type": "faq", "data": {"qa": faqs}})
        modules.append(cta_module)

    return {
        "title": ctx["title"],
        "meta_description": ctx["meta_description"],
        "h1": ctx["headline"],
        "intro_paragraph": ctx["intro"],
        "modules": modules,
        "schema_data": schema_data,
    }




def _apply_cloned_base_transforms(soup, site_settings: dict, title: str, meta_description: str, canonical_url: str) -> None:
    """Shared transforms applied to any cloned page: metadata, mobile CSS, branding."""
    from bs4 import BeautifulSoup

    head_tag = soup.find('head')

    # Mobile video-stripping CSS
    if head_tag:
        mobile_style = soup.new_tag('style')
        mobile_style.string = (
            '@media(max-width:768px){'
            'video,video source{display:none!important}'
            'iframe[src*="youtube"],iframe[src*="youtu.be"],'
            'iframe[src*="vimeo"],iframe[src*="loom"]{display:none!important}'
            '}'
        )
        head_tag.append(mobile_style)

    # <title>
    title_tag = soup.find('title')
    if title_tag:
        title_tag.string = title
    elif head_tag:
        t = soup.new_tag('title')
        t.string = title
        head_tag.insert(0, t)

    # meta description
    meta_desc = soup.find('meta', attrs={'name': 'description'})
    if meta_desc:
        meta_desc['content'] = meta_description
    elif head_tag:
        m = soup.new_tag('meta', attrs={'name': 'description', 'content': meta_description})
        head_tag.append(m)

    # canonical
    existing_canonical = soup.find('link', attrs={'rel': 'canonical'})
    if existing_canonical:
        existing_canonical['href'] = canonical_url
    elif head_tag:
        c = soup.new_tag('link', attrs={'rel': 'canonical', 'href': canonical_url})
        head_tag.append(c)

    # Live branding — phone
    company_phone = site_settings.get('company_phone') or ''
    if company_phone:
        clean_phone = ''.join(ch for ch in company_phone if ch.isdigit() or ch == '+')
        for phone_link in soup.find_all('a', href=lambda x: x and x.startswith('tel:')):
            phone_link['href'] = f'tel:{clean_phone}'
            if phone_link.string:
                phone_link.string = company_phone

    # Live branding — logo: replace ALL logo images on the page, not just the first
    logo_url = site_settings.get('logo_url') or ''
    company_name = site_settings.get('company_name') or ''
    if logo_url:
        replaced = False
        # Try header/nav first
        for container in (soup.find('header'), soup.find('nav')):
            if container:
                logo_img = container.find('img')
                if logo_img:
                    logo_img['src'] = logo_url
                    if company_name:
                        logo_img['alt'] = company_name
                    replaced = True
                    break
        # Fallback: find any img with alt containing company name or "logo"
        if not replaced:
            for img in soup.find_all('img'):
                alt = (img.get('alt') or '').lower()
                src = (img.get('src') or '').lower()
                if 'logo' in alt or 'medvera' in alt or 'logo' in src:
                    img['src'] = logo_url
                    if company_name:
                        img['alt'] = company_name
                    break


def _inject_before_footer(soup, html_snippet: str) -> None:
    """Insert an HTML snippet just before <footer>, or append to <body>."""
    from bs4 import BeautifulSoup
    snippet_soup = BeautifulSoup(html_snippet, 'html.parser')
    footer = soup.find('footer')
    if footer:
        footer.insert_before(snippet_soup)
    else:
        body = soup.find('body')
        if body:
            body.append(snippet_soup)


def render_cloned_product_landing(
    full_page_html: str,
    product_name: str,
    product_slug: str,
    pages: list,
    state_counts: dict,
    site_settings: dict,
) -> str:
    """Render the product-level landing page using the cloned template design.

    Keeps the full original page design (video hero, nav, all sections) intact,
    then appends a "Locations by State" grid section before the footer.

    Args:
        full_page_html: Complete HTML from template_cloner.
        product_name: Human-readable product name, e.g. "Weight Loss Treatments".
        product_slug: URL slug, e.g. "weight-loss-treatments".
        pages: List of state-level page docs from DB (slug, state_name, state_code).
        state_counts: {state_code: {counties: N, cities: M}} counts per state.
        site_settings: Site-wide settings.

    Returns:
        Full HTML string ready to serve.
    """
    from bs4 import BeautifulSoup
    from services.component_namespace import loc_prefix as _loc_prefix
    import json as _json

    _LOC = _loc_prefix()
    company_name = site_settings.get('company_name') or 'MEDVera'
    site_domain = (site_settings.get('site_domain') or '').rstrip('/')
    canonical_url = f"{site_domain}{_LOC}/{product_slug}" if site_domain else f"{_LOC}/{product_slug}"
    title = f"{product_name} Coverage Areas | {company_name}"
    meta_desc = f"Find {product_name} services near you. Browse all states covered by {company_name}."

    soup = BeautifulSoup(full_page_html, 'html.parser')
    _apply_cloned_base_transforms(soup, site_settings, title, meta_desc, canonical_url)

    # JSON-LD
    head_tag = soup.find('head')
    if head_tag:
        ld = {
            "@context": "https://schema.org",
            "@type": "MedicalBusiness",
            "name": company_name,
            "description": meta_desc,
            "url": canonical_url,
        }
        ld_script = soup.new_tag('script', type='application/ld+json')
        ld_script.string = _json.dumps(ld, ensure_ascii=False)
        head_tag.append(ld_script)

    # Build the state grid section
    state_cards_html = ''
    for p in pages:
        slug = p.get('slug', '')
        state_name = p.get('state_name', '')
        sc = p.get('state_code', '')
        counts = state_counts.get(sc, {'counties': 0, 'cities': 0})
        sub_parts = []
        if counts.get('counties'):
            sub_parts.append(f"{counts['counties']} counties")
        if counts.get('cities'):
            sub_parts.append(f"{counts['cities']} cities")
        sub_text = ' · '.join(sub_parts) if sub_parts else ''
        sub_html = f'<span style="font-size:0.75rem;color:#64748b;display:block;margin-top:0.2rem;">{sub_text}</span>' if sub_text else ''
        state_cards_html += f'''
        <a href="{_LOC}/{product_slug}/{slug}"
           style="display:flex;align-items:center;gap:0.75rem;padding:1rem 1.25rem;
                  background:white;border:1px solid #e2e8f0;border-radius:10px;
                  text-decoration:none;color:#1e293b;transition:all 0.15s;"
           onmouseover="this.style.borderColor='#3d6b5a';this.style.background='#f0fdf4';"
           onmouseout="this.style.borderColor='#e2e8f0';this.style.background='white';"
           data-testid="state-card-{sc}">
          <span style="font-size:0.7rem;font-weight:700;font-family:monospace;
                       color:#94a3b8;background:#f1f5f9;padding:0.2rem 0.4rem;
                       border-radius:4px;flex-shrink:0;">{sc}</span>
          <span style="flex:1;">
            <span style="font-weight:600;font-size:0.95rem;">{state_name}</span>
            {sub_html}
          </span>
          <span style="color:#3d6b5a;font-weight:700;">→</span>
        </a>'''

    state_section = f'''
<section style="background:#f8fafc;padding:4rem 1.5rem;margin-top:0;" id="coverage-states">
  <div style="max-width:1100px;margin:0 auto;">
    <div style="margin-bottom:2rem;">
      <p style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;margin-bottom:0.5rem;">
        <a href="{_LOC}" style="color:#3d6b5a;text-decoration:none;">Coverage Areas</a> → {product_name}
      </p>
      <h2 style="font-size:2rem;font-weight:800;color:#0f172a;margin:0 0 0.5rem;line-height:1.2;">
        {product_name} — All States
      </h2>
      <p style="color:#64748b;font-size:0.95rem;margin:0;">
        {len(pages)} state{"s" if len(pages) != 1 else ""} covered nationwide. Select yours to see all locations.
      </p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:0.75rem;">
      {state_cards_html}
    </div>
  </div>
</section>'''

    _inject_before_footer(soup, state_section)
    return str(soup)


def render_cloned_page(
    full_page_html: str,
    generator: dict,
    location_ctx: dict,
    site_settings: dict,
    xlinks: Optional[dict] = None,
    fresh_products: list = None,
) -> str:
    """Render a cloned location page (state / county / city).

    Strategy — keeps the full original page design intact:
      • Only touch SEO metadata (<title>, meta desc, canonical, JSON-LD)
      • Sync live branding (phone, logo)
      • Append a location-specific content section BEFORE the footer:
          - Breadcrumb nav
          - Location heading and AI/template intro text
          - County / city cross-links grid
      • Inject mobile CSS to hide <video> on small screens

    Nothing in the original hero / nav / video is modified.
    """
    import logging
    import json as _json
    log = logging.getLogger(__name__)

    from bs4 import BeautifulSoup
    from services.component_namespace import loc_prefix as _loc_prefix

    ctx = _build_render_ctx(generator, location_ctx, site_settings)
    _LOC = _loc_prefix()
    product_slug = ctx.get('product_slug', '')
    page_slug = ctx.get('slug', '')
    product_label = ctx.get('product_label', '')
    location_label = ctx.get('location_label', '')
    level = ctx.get('level', 'state')
    company_name = ctx.get('company_name', '')
    company_phone = ctx.get('company_phone', '')

    site_domain = (site_settings.get('site_domain') or '').rstrip('/')
    canonical_path = f"{_LOC}/{product_slug}/{page_slug}" if product_slug else f"{_LOC}/{page_slug}"
    canonical_url = f"{site_domain}{canonical_path}" if site_domain else canonical_path

    soup = BeautifulSoup(full_page_html, 'html.parser')

    # ── 1. Metadata + branding ────────────────────────────────────────────
    _apply_cloned_base_transforms(
        soup, site_settings,
        title=ctx['title'],
        meta_description=ctx['meta_description'],
        canonical_url=canonical_url,
    )

    # ── 2. Update H1 to location-specific heading ─────────────────────────
    # Replace the generic marketing H1 with the location-specific SEO heading.
    # e.g. "Lose the weight. Keep the life." → "Weight Loss Treatments in Alabama"
    h1_tag = soup.find('h1')
    if h1_tag:
        # Clear all children and set new text
        for child in list(h1_tag.children):
            child.extract()
        if level == 'state':
            new_h1 = f"{product_label} in {location_label}"
        elif level == 'county':
            new_h1 = f"{product_label} in {location_label} County, {ctx.get('state_name', '')}"
        else:
            new_h1 = f"{product_label} in {location_label}, {ctx.get('state_name', '')}"
        h1_tag.append(new_h1)

    # ── 3. Replace "Get a quote" / "Get Quote" buttons → "Get Started" ────
    for tag in soup.find_all(['a', 'button', 'span']):
        if tag.string:
            lower = tag.string.lower().strip()
            if lower in ('get a quote', 'get quote', 'get a free quote'):
                tag.string = 'Get Started'

    # ── 2. Build location content section ────────────────────────────────
    # Fresh catalog products section (always current, never stale from clone)
    products_html = ""
    if fresh_products:
        cards = ""
        for p in fresh_products[:8]:
            price = p.get("price_text") or ""
            badge = p.get("badge_text") or ""
            badge_color = p.get("badge_color") or "#3d6b5a"
            img = p.get("image_url") or ""
            name = p.get("name") or ""
            desc = p.get("description") or ""
            slug = p.get("slug") or ""
            cta_url = p.get("get_started_url") or "/get-started"
            img_html = f'<img src="{img}" alt="{name}" style="width:100%;height:180px;object-fit:cover;display:block"/>' if img else ""
            badge_html = f'<span style="position:absolute;top:10px;left:10px;background:{badge_color};color:white;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px">{badge}</span>' if badge else ""
            price_html = f'<span style="position:absolute;bottom:10px;right:10px;background:rgba(0,0,0,0.6);color:white;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px">{price}</span>' if price else ""
            cards += f'''<div style="background:white;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;display:flex;flex-direction:column">
  <div style="position:relative">{img_html}{badge_html}{price_html}</div>
  <div style="padding:1rem;flex:1;display:flex;flex-direction:column;gap:0.5rem">
    <div style="font-weight:700;color:#0f172a;font-size:0.95rem">{name}</div>
    <div style="color:#64748b;font-size:0.8rem;flex:1">{desc[:80]}{"..." if len(desc)>80 else ""}</div>
    <div style="display:flex;gap:0.5rem;margin-top:0.5rem">
      <a href="{cta_url}" style="flex:1;text-align:center;background:{badge_color};color:white;padding:0.5rem;border-radius:20px;text-decoration:none;font-size:0.8rem;font-weight:700">Get Started</a>
      <a href="/treatments/{slug}" style="flex:1;text-align:center;border:1px solid #e2e8f0;color:#475569;padding:0.5rem;border-radius:20px;text-decoration:none;font-size:0.8rem">Learn More</a>
    </div>
  </div>
</div>'''
        products_html = f'''<div style="background:white;padding:3rem 1.5rem;border-top:1px solid #e2e8f0">
  <div style="max-width:1100px;margin:0 auto">
    <p style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#3d6b5a;margin-bottom:0.5rem">Our Treatments</p>
    <h2 style="font-size:1.5rem;font-weight:800;color:#0f172a;margin-bottom:1.5rem">{product_label} Options</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem">{cards}</div>
  </div>
</div>'''
    # Pull AI/template intro from stored page content
    page_content = location_ctx.get('content') or {}
    modules = page_content.get('modules') or []
    intro_text = ''
    for m in modules:
        if m.get('type') == 'hero':
            intro_text = (m.get('data') or {}).get('intro') or ''
            break
    if not intro_text:
        intro_text = page_content.get('intro_paragraph') or ctx.get('intro') or ''
    intro_text = (
        intro_text
        .replace('__SITE_COMPANY_NAME__', company_name)
        .replace('__SITE_COMPANY_PHONE__', company_phone)
    )

    # Breadcrumb nav
    breadcrumb_html = ''
    if product_slug:
        breadcrumb_html = f'''
        <p style="font-size:0.8rem;color:#94a3b8;margin-bottom:1.5rem;">
          <a href="{_LOC}" style="color:#3d6b5a;text-decoration:none;">Coverage Areas</a>
          →
          <a href="{_LOC}/{product_slug}" style="color:#3d6b5a;text-decoration:none;">{product_label}</a>
          → {location_label}
        </p>'''

    # Cross-links HTML (counties / cities)
    crosslinks_html = _build_crosslinks_section(xlinks, ctx) if xlinks else ''
    # Strip outer <section> wrapper since we're embedding inside our own section
    if crosslinks_html.startswith('<section'):
        crosslinks_html = crosslinks_html[crosslinks_html.find('>')+1:]
        if crosslinks_html.endswith('</section>'):
            crosslinks_html = crosslinks_html[:-len('</section>')]

    location_section = f'''
<section style="background:#f8fafc;padding:4rem 1.5rem;" id="location-coverage">
  <div style="max-width:900px;margin:0 auto;">
    {breadcrumb_html}
    <h2 style="font-size:2rem;font-weight:800;color:#0f172a;margin-bottom:1rem;line-height:1.2;">
      {product_label} in {location_label}
    </h2>
    {"" if not intro_text else f'<p style="font-size:1rem;color:#475569;line-height:1.75;max-width:720px;margin-bottom:2rem;">{intro_text}</p>'}
    {crosslinks_html}
  </div>
</section>
{products_html}'''

    # ── Full SEO schema suite injected as raw strings (avoids BS4 encoding issues) ──
    import json as _json_module

    state_name = location_ctx.get("state_name") or location_label
    county_name = location_ctx.get("county") or ""
    city_name = location_ctx.get("city") or ""
    _site_domain = (site_settings.get("site_domain") or "https://medvera.io").rstrip("/")

    area_served: dict = {"@type": "State", "name": state_name}
    if city_name:
        area_served = {"@type": "City", "name": city_name, "containedInPlace": {"@type": "State", "name": state_name}}
    elif county_name:
        area_served = {"@type": "AdministrativeArea", "name": f"{county_name} County", "containedInPlace": {"@type": "State", "name": state_name}}

    _bc = [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": _site_domain},
        {"@type": "ListItem", "position": 2, "name": "Coverage Areas", "item": f"{_site_domain}/coverage-areas"},
        {"@type": "ListItem", "position": 3, "name": product_label, "item": f"{_site_domain}/coverage-areas/{product_slug}"},
        {"@type": "ListItem", "position": 4, "name": location_label, "item": canonical_url},
    ]
    _faqs = [
        {"@type": "Question", "name": f"What {product_label} services are available in {location_label}?",
         "acceptedAnswer": {"@type": "Answer", "text": f"{company_name} provides clinician-prescribed {product_label.lower()} services in {location_label} with board-certified providers and discreet delivery."}},
        {"@type": "Question", "name": "Do I need insurance?",
         "acceptedAnswer": {"@type": "Answer", "text": f"No insurance is required. {company_name} offers transparent cash-pay pricing. Some insurance plans may cover the cost."}},
        {"@type": "Question", "name": f"How fast is delivery in {location_label}?",
         "acceptedAnswer": {"@type": "Answer", "text": f"Most orders ship within 24-48 hours of provider approval and arrive in 2-3 business days in {location_label}."}},
    ]
    _schemas = [
        {"@context": "https://schema.org", "@type": ["MedicalBusiness", "LocalBusiness"],
         "name": f"{company_name} — {product_label} in {location_label}",
         "description": f"Clinician-prescribed {product_label.lower()} services in {location_label}.",
         "url": canonical_url, "telephone": company_phone,
         "areaServed": area_served, "priceRange": "$$",
         "openingHoursSpecification": {"@type": "OpeningHoursSpecification",
           "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"], "opens": "09:00", "closes": "17:00"},
         "sameAs": [_site_domain]},
        {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": _bc},
        {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": _faqs},
        {"@context": "https://schema.org", "@type": "WebPage", "name": ctx.get('title', ''),
         "url": canonical_url, "description": f"Clinician-prescribed {product_label.lower()} in {location_label}.",
         "breadcrumb": {"@type": "BreadcrumbList", "itemListElement": _bc}},
    ]
    _schema_block = "\n".join(
        f'<script type="application/ld+json">{_json_module.dumps(s, ensure_ascii=False)}</script>'
        for s in _schemas
    )
    _og_img = site_settings.get("logo_url") or ""
    # Only include non-data-URL images in OG (data URLs are too large)
    if _og_img and _og_img.startswith("data:"):
        _og_img = ""
    _seo_meta = f'''
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
<link rel="canonical" href="{canonical_url}">
{f'<meta property="og:image" content="{_og_img}">' if _og_img else ''}
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
{f'<meta name="twitter:image" content="{_og_img}">' if _og_img else ''}
{_schema_block}'''

    _inject_before_footer(soup, location_section)
    log.info(f"render_cloned_page: appended location section for {location_label}")

    # Inject SEO tags as raw strings into </head> — avoids BS4 encoding issues
    final_html = str(soup)
    final_html = final_html.replace('</head>', f'{_seo_meta}\n</head>', 1)
    return final_html


def _build_crosslinks_section(xlinks: dict, ctx: dict) -> str:
    """Build HTML section for county/city cross-links injected into cloned templates."""
    from services.component_namespace import loc_prefix as _loc_prefix
    _LOC = _loc_prefix()

    level = ctx.get('level', 'state')
    state_name = ctx['state_name']
    product_label = ctx.get('product_label', 'Service')
    product_slug = ctx.get('product_slug', '')

    # Only show cross-links for state and county pages
    if level not in ('state', 'county'):
        return ""

    down = xlinks.get('down')
    if not down:
        return ""

    counties = down.get('counties', [])
    cities = down.get('cities', [])

    if not counties and not cities:
        return ""

    # Base href: /coverage-areas/{product_slug}
    href_base = f"{_LOC}/{product_slug}" if product_slug else _LOC

    html_parts = []
    html_parts.append('<section style="background: #f8f9fa; padding: 4rem 1.5rem; margin-top: 4rem;">')
    html_parts.append('  <div style="max-width: 72rem; margin: 0 auto;">')

    if level == 'state':
        html_parts.append(f'    <h2 style="font-size: 1.875rem; font-weight: 700; color: #1a202c; margin-bottom: 2rem; text-align: center;">{product_label} Locations in {state_name}</h2>')
    elif level == 'county':
        county_name = ctx.get('county', '')
        html_parts.append(f'    <h2 style="font-size: 1.875rem; font-weight: 700; color: #1a202c; margin-bottom: 2rem; text-align: center;">{product_label} in {county_name} County</h2>')

    # Counties section (state level only)
    if level == 'state' and counties:
        html_parts.append('    <div style="margin-bottom: 3rem;">')
        html_parts.append(f'      <h3 style="font-size: 1.25rem; font-weight: 600; color: #2d3748; margin-bottom: 1rem;">Counties in {state_name}</h3>')
        html_parts.append('      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem;">')
        for county in counties[:50]:
            slug = county.get('slug', '')
            label = county.get('label', '')
            html_parts.append(f'        <a href="{href_base}/{slug}" style="padding: 0.75rem 1rem; background: white; border: 1px solid #e2e8f0; border-radius: 0.5rem; text-decoration: none; color: #2d3748; font-size: 0.875rem; transition: all 0.2s; display: block;">{label} County</a>')
        html_parts.append('      </div>')
        html_parts.append('    </div>')

    # Cities section
    if cities:
        cities_heading = down.get('cities_heading', 'Cities')
        total_cities = down.get('state_total_cities', len(cities))
        html_parts.append('    <div>')
        html_parts.append(f'      <h3 style="font-size: 1.25rem; font-weight: 600; color: #2d3748; margin-bottom: 1rem;">{cities_heading} ({total_cities} total)</h3>')
        html_parts.append('      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem;">')
        for city in cities[:100]:
            slug = city.get('slug', '')
            label = city.get('label', '')
            html_parts.append(f'        <a href="{href_base}/{slug}" style="padding: 0.75rem 1rem; background: white; border: 1px solid #e2e8f0; border-radius: 0.5rem; text-decoration: none; color: #2d3748; font-size: 0.875rem; transition: all 0.2s; display: block;">{label}</a>')
        html_parts.append('      </div>')

        view_all_url = down.get('view_all_url')
        if total_cities > len(cities) and view_all_url:
            html_parts.append(f'      <div style="margin-top: 1.5rem; text-align: center;"><a href="{view_all_url}" style="color: #3b82f6; text-decoration: underline; font-weight: 500;">View All {total_cities} Cities</a></div>')

        html_parts.append('    </div>')

    html_parts.append('  </div>')
    html_parts.append('</section>')

    return '\n'.join(html_parts)
