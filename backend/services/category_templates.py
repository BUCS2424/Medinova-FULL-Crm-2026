"""
Category templates for location pages.
One clean HTML template per category — video hero, correct branding, treatments section.
No cloning, no Playwright, no subprocesses.
"""
from __future__ import annotations
import os

MEDIA_BASE = "/api/media"


CATEGORY_CONFIG = {
    "weight-loss": {
        "label": "Weight Loss",
        "video": f"{MEDIA_BASE}/videos/weightloss-bg.mp4",
        "hero_bg": "#0a1510",
        "accent": "#3d6b5a",
        "accent_light": "#84cc16",
        "hero_headline": "Lose the weight.<br><span style='color:#84cc16'>Keep the life.</span>",
        "hero_sub": "FDA-approved GLP-1 medications. Board-certified providers. Free discreet delivery.",
        "cta_text": "See If You Qualify",
        "trust_items": ["FDA-approved GLP-1 medications", "Board-certified providers", "Free discreet shipping", "Insurance Not Required"],
        "get_started": "/get-started/weight-loss",
    },
    "sexual-health": {
        "label": "Sexual Health",
        "video": f"{MEDIA_BASE}/videos/sexual-health-bg.mp4",
        "hero_bg": "#120a1a",
        "accent": "#7c3aed",
        "accent_light": "#c084fc",
        "hero_headline": "Your best performance.<br><span style='color:#c084fc'>Starts here.</span>",
        "hero_sub": "Clinician-prescribed treatments for ED, Low-T, and more. Discreet delivery nationwide.",
        "cta_text": "Start Private Assessment",
        "trust_items": ["Clinician-prescribed medications", "100% discreet delivery", "Board-certified providers", "Insurance Not Required"],
        "get_started": "/get-started/sexual-health",
    },
    "hair-skin": {
        "label": "Hair & Skin",
        "video": f"{MEDIA_BASE}/videos/hair-skin-bg.mp4",
        "hero_bg": "#1a1008",
        "accent": "#d97706",
        "accent_light": "#fbbf24",
        "hero_headline": "Healthier hair.<br><span style='color:#fbbf24'>Clearer skin.</span>",
        "hero_sub": "Clinician-prescribed dermatology — hair regrowth, acne, anti-aging, and more.",
        "cta_text": "Get Your Custom Treatment",
        "trust_items": ["Clinician-prescribed formulas", "Hair & skin specialists", "Custom compounded", "Insurance Not Required"],
        "get_started": "/get-started/hair-skin",
    },
    "womens-health": {
        "label": "Women's Health",
        "video": f"{MEDIA_BASE}/videos/womens-health-bg.mp4",
        "hero_bg": "#1a0812",
        "accent": "#db2777",
        "accent_light": "#f472b6",
        "hero_headline": "Your health.<br><span style='color:#f472b6'>Your terms.</span>",
        "hero_sub": "Hormone therapy, PCOS, menopause, and women's wellness — board-certified care at home.",
        "cta_text": "Start Your Assessment",
        "trust_items": ["Women's health specialists", "Hormonal balance experts", "Board-certified providers", "Insurance Not Required"],
        "get_started": "/get-started/womens-health",
    },
    "mens-health": {
        "label": "Men's Health",
        "video": f"{MEDIA_BASE}/videos/mens-health-bg.mp4",
        "hero_bg": "#080e1a",
        "accent": "#2563eb",
        "accent_light": "#60a5fa",
        "hero_headline": "Perform better.<br><span style='color:#60a5fa'>Live stronger.</span>",
        "hero_sub": "Testosterone optimization, prostate health, and men's wellness — clinician-supervised.",
        "cta_text": "Start Free Assessment",
        "trust_items": ["Testosterone specialists", "Men's health providers", "Board-certified care", "Insurance Not Required"],
        "get_started": "/get-started/mens-health",
    },
    "longevity": {
        "label": "Longevity & Wellness",
        "video": f"{MEDIA_BASE}/videos/longevity-bg.mp4",
        "hero_bg": "#081510",
        "accent": "#3d6b5a",
        "accent_light": "#34d399",
        "hero_headline": "Age better.<br><span style='color:#34d399'>Live longer.</span>",
        "hero_sub": "NAD+, peptides, and longevity protocols — clinician-supervised preventive care.",
        "cta_text": "Start Your Assessment",
        "trust_items": ["NAD+ & peptide specialists", "Anti-aging protocols", "Board-certified providers", "Insurance Not Required"],
        "get_started": "/get-started/longevity",
    },
}


def _product_cards_html(products: list, cfg: dict) -> str:
    if not products:
        return ""
    accent = cfg["accent"]
    cards = ""
    for p in products[:8]:
        img = p.get("image_url") or ""
        name = p.get("name") or ""
        desc = (p.get("description") or "")[:90]
        price = p.get("price_text") or ""
        badge = p.get("badge_text") or ""
        badge_color = p.get("badge_color") or accent
        slug = p.get("slug") or ""
        cta = p.get("get_started_url") or cfg["get_started"]

        img_html = f'<img src="{img}" alt="{name}" style="width:100%;height:160px;object-fit:cover;display:block">' if img else f'<div style="width:100%;height:160px;background:{accent}22;display:flex;align-items:center;justify-content:center;color:{accent};font-weight:700;font-size:0.9rem">{name[:20]}</div>'
        badge_html = f'<span style="position:absolute;top:8px;left:8px;background:{badge_color};color:white;font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px">{badge}</span>' if badge else ""
        price_html = f'<span style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,0.65);color:white;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px">{price}</span>' if price else ""

        cards += f'''<div style="background:white;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;display:flex;flex-direction:column">
  <div style="position:relative">{img_html}{badge_html}{price_html}</div>
  <div style="padding:0.875rem;flex:1;display:flex;flex-direction:column;gap:0.4rem">
    <div style="font-weight:700;color:#0f172a;font-size:0.875rem;line-height:1.3">{name}</div>
    <div style="color:#64748b;font-size:0.75rem;flex:1;line-height:1.4">{desc}{"..." if len(p.get("description",""))>90 else ""}</div>
    <div style="display:flex;gap:0.4rem;margin-top:0.4rem">
      <a href="{cta}" style="flex:1;text-align:center;background:{badge_color};color:white;padding:0.45rem 0.5rem;border-radius:20px;text-decoration:none;font-size:0.75rem;font-weight:700">Get Started</a>
      <a href="/treatments/{slug}" style="flex:1;text-align:center;border:1px solid #e2e8f0;color:#475569;padding:0.45rem 0.5rem;border-radius:20px;text-decoration:none;font-size:0.75rem">Learn More</a>
    </div>
  </div>
</div>'''

    return f'''<section style="background:white;padding:3rem 1.5rem;border-top:1px solid #f1f5f9">
  <div style="max-width:1100px;margin:0 auto">
    <p style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:{accent};margin:0 0 0.4rem">Our Treatments</p>
    <h2 style="font-size:1.4rem;font-weight:800;color:#0f172a;margin:0 0 1.25rem">{cfg["label"]} Options</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:0.875rem">{cards}</div>
  </div>
</section>'''


def _location_section_html(location_label: str, product_label: str, product_slug: str,
                            level: str, xlinks: dict | None, cfg: dict) -> str:
    accent = cfg["accent"]
    _LOC = "/coverage-areas"
    prefix = f"{_LOC}/{product_slug}"

    counties = (xlinks or {}).get("down", {}).get("counties", []) if xlinks else []
    cities = (xlinks or {}).get("down", {}).get("cities", []) if xlinks else []

    county_html = ""
    if counties:
        items = "".join(
            f'<a href="{prefix}/{c["slug"]}" style="display:block;padding:0.65rem 0.875rem;background:white;border:1px solid #e2e8f0;border-radius:8px;text-decoration:none;color:#1e293b;font-size:0.8rem">{c.get("label","")}&nbsp;County</a>'
            for c in counties
        )
        county_html = f'<div style="margin-bottom:2rem"><h3 style="font-size:1rem;font-weight:700;color:#1e293b;margin:0 0 0.75rem">Counties ({len(counties)})</h3><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:0.5rem">{items}</div></div>'

    city_html = ""
    if cities:
        items = "".join(
            f'<a href="{prefix}/{c["slug"]}" style="display:block;padding:0.65rem 0.875rem;background:white;border:1px solid #e2e8f0;border-radius:8px;text-decoration:none;color:#1e293b;font-size:0.8rem">{c.get("label","")}</a>'
            for c in cities
        )
        total = (xlinks or {}).get("down", {}).get("state_total_cities", len(cities))
        city_html = f'<div><h3 style="font-size:1rem;font-weight:700;color:#1e293b;margin:0 0 0.75rem">Cities ({total}{"+" if total > len(cities) else ""})</h3><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:0.5rem">{items}</div></div>'

    return f'''<section id="location-coverage" style="background:#f8fafc;padding:3rem 1.5rem;border-top:1px solid #e2e8f0">
  <div style="max-width:1100px;margin:0 auto">
    <p style="font-size:0.75rem;color:#94a3b8;margin:0 0 1rem">
      <a href="/coverage-areas" style="color:{accent};text-decoration:none">Coverage Areas</a> →
      <a href="{prefix}" style="color:{accent};text-decoration:none"> {product_label}</a> → {location_label}
    </p>
    <h2 style="font-size:1.75rem;font-weight:800;color:#0f172a;margin:0 0 1.5rem;line-height:1.2">{product_label} in {location_label}</h2>
    {county_html}{city_html}
  </div>
</section>'''


def build_category_location_page(
    category_slug: str,
    product_label: str,
    product_slug: str,
    location_label: str,
    level: str,
    site_settings: dict,
    fresh_products: list,
    xlinks: dict | None,
    page_doc: dict,
) -> str:
    """Build a full location page for a category — no cloning required."""

    cfg = CATEGORY_CONFIG.get(category_slug) or CATEGORY_CONFIG.get("weight-loss")
    accent = cfg["accent"]
    accent_light = cfg["accent_light"]
    hero_bg = cfg["hero_bg"]

    company_name = site_settings.get("company_name") or "MEDVera"
    company_phone = site_settings.get("company_phone") or ""
    logo_url = site_settings.get("logo_url") or ""
    site_domain = (site_settings.get("site_domain") or "https://medvera.io").rstrip("/")
    phone_clean = "".join(c for c in company_phone if c.isdigit() or c == "+")

    page_title = f"{product_label} in {location_label} | {company_name}"
    meta_desc = f"Find clinician-prescribed {product_label.lower()} services in {location_label}. Board-certified providers, discreet delivery. {company_name}."
    canonical = f"{site_domain}/coverage-areas/{product_slug}/{page_doc.get('slug','')}"

    logo_html = (
        f'<a href="/"><img src="{logo_url}" alt="{company_name}" style="height:38px;width:auto;object-fit:contain;max-width:180px"></a>'
        if logo_url else
        f'<a href="/" style="font-weight:800;font-size:1.2rem;color:white;text-decoration:none">{company_name}</a>'
    )

    trust_pills = "".join(
        f'<span style="display:inline-flex;align-items:center;gap:6px;color:rgba(255,255,255,0.75);font-size:0.72rem;white-space:nowrap"><span style="color:{accent_light}">✓</span>{item}</span>'
        for item in cfg["trust_items"]
    )

    nav_links = [
        ("Weight Loss", "/weight-loss"),
        ("Sexual Health", "/sexual-health"),
        ("Hair & Skin", "/hair-skin"),
        ("Women's Health", "/womens-health"),
        ("Men's Health", "/mens-health"),
        ("Longevity", "/longevity-nutrition"),
    ]
    nav_html = "".join(
        f'<a href="{href}" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:0.8rem;font-weight:500;white-space:nowrap;hover:color:white">{label}</a>'
        for label, href in nav_links
    )

    products_html = _product_cards_html(fresh_products, cfg)
    location_html = _location_section_html(location_label, product_label, product_slug, level, xlinks, cfg)

    # ── JSON-LD Structured Data ──────────────────────────────────────────────
    import json as _json

    state_name = page_doc.get("state_name") or location_label
    county_name = page_doc.get("county") or ""
    city_name = page_doc.get("city") or ""

    area_served: dict = {"@type": "State", "name": state_name}
    if city_name:
        area_served = {"@type": "City", "name": city_name, "containedInPlace": {"@type": "State", "name": state_name}}
    elif county_name:
        area_served = {"@type": "AdministrativeArea", "name": f"{county_name} County", "containedInPlace": {"@type": "State", "name": state_name}}

    medical_specialty_map = {
        "weight-loss": "Bariatric Medicine",
        "sexual-health": "Urology",
        "hair-skin": "Dermatology",
        "womens-health": "Obstetrics and Gynecology",
        "mens-health": "Urology",
        "longevity": "Preventive Medicine",
    }

    breadcrumb_items = [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": site_domain},
        {"@type": "ListItem", "position": 2, "name": "Coverage Areas", "item": f"{site_domain}/coverage-areas"},
        {"@type": "ListItem", "position": 3, "name": product_label, "item": f"{site_domain}/coverage-areas/{product_slug}"},
        {"@type": "ListItem", "position": 4, "name": location_label, "item": canonical},
    ]

    faq_items = [
        {"@type": "Question", "name": f"What {product_label} services are available in {location_label}?",
         "acceptedAnswer": {"@type": "Answer", "text": f"{company_name} provides clinician-prescribed {product_label.lower()} services in {location_label}. Board-certified providers review your case and ship medication directly to you."}},
        {"@type": "Question", "name": f"Do I need insurance for {product_label} in {location_label}?",
         "acceptedAnswer": {"@type": "Answer", "text": f"No insurance is required. {company_name} offers transparent cash-pay pricing for {product_label.lower()} services in {location_label}. Some insurance plans may cover the cost."}},
        {"@type": "Question", "name": f"How fast can I get {product_label} delivered in {location_label}?",
         "acceptedAnswer": {"@type": "Answer", "text": f"Most orders are shipped within 24-48 hours of provider approval and arrive in 2-3 business days in {location_label}. Delivery is discreet in plain packaging."}},
        {"@type": "Question", "name": f"Is {company_name} available in {location_label}?",
         "acceptedAnswer": {"@type": "Answer", "text": f"Yes. {company_name} serves patients in {location_label} and all surrounding areas with clinician-prescribed {product_label.lower()} services. No in-person visit required."}},
    ]

    schemas = [
        {
            "@context": "https://schema.org",
            "@type": ["MedicalBusiness", "LocalBusiness"],
            "name": f"{company_name} {product_label} — {location_label}",
            "description": meta_desc,
            "url": canonical,
            "telephone": company_phone,
            "logo": logo_url or "",
            "priceRange": "$$",
            "areaServed": area_served,
            "medicalSpecialty": medical_specialty_map.get(category_slug, "General Practice"),
            "availableService": {"@type": "MedicalTherapy", "name": product_label},
            "openingHoursSpecification": {"@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"], "opens": "09:00", "closes": "17:00"},
            "sameAs": [site_domain],
        },
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": breadcrumb_items,
        },
        {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": faq_items,
        },
        {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": page_title,
            "description": meta_desc,
            "url": canonical,
            "isPartOf": {"@type": "WebSite", "name": company_name, "url": site_domain},
            "breadcrumb": {"@type": "BreadcrumbList", "itemListElement": breadcrumb_items},
            "speakable": {"@type": "SpeakableSpecification", "cssSelector": ["h1", "#location-coverage h2"]},
        },
    ]

    schema_html = "\n".join(
        f'<script type="application/ld+json">{_json.dumps(s, ensure_ascii=False)}</script>'
        for s in schemas
    )

    # OG image — must be a real HTTP URL, not a base64 data URI
    # Use the iDrive CDN if available, otherwise a fallback
    _cdn = os.environ.get("IDRIVE_CDN_BASE", "").rstrip("/")
    if logo_url and not logo_url.startswith("data:") and logo_url.startswith("http"):
        og_image = logo_url
    elif _cdn:
        og_image = f"{_cdn}/images/medvera-og.jpg"
    else:
        og_image = f"{site_domain}/api/media/images/medvera-og.jpg"

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{page_title}</title>
  <meta name="description" content="{meta_desc}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <link rel="canonical" href="{canonical}">
  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="{page_title}">
  <meta property="og:description" content="{meta_desc}">
  <meta property="og:url" content="{canonical}">
  <meta property="og:image" content="{og_image}">
  <meta property="og:site_name" content="{company_name}">
  <meta property="og:locale" content="en_US">
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{page_title}">
  <meta name="twitter:description" content="{meta_desc}">
  <meta name="twitter:image" content="{og_image}">
  <!-- Structured Data -->
  {schema_html}
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    *{{margin:0;padding:0;box-sizing:border-box}}
    body{{font-family:'Inter',system-ui,sans-serif;line-height:1.6;color:#1e293b;background:white}}
    @media(max-width:768px){{
      video{{display:none!important}}
      .hero-mobile-bg{{display:block!important}}
      .nav-links{{display:none}}
    }}
  </style>
</head>
<body>

<!-- PROMO BAR -->
<div style="background:{accent};padding:0.5rem 1rem;text-align:center">
  <p style="color:white;font-size:0.72rem;font-weight:600;margin:0">FDA-approved treatments at their lowest prices. <a href="{cfg['get_started']}" style="color:white;text-decoration:underline">See if you qualify →</a></p>
</div>

<!-- NAV -->
<header style="background:rgba(10,10,10,0.92);backdrop-filter:blur(12px);position:sticky;top:0;z-index:100;border-bottom:1px solid rgba(255,255,255,0.08)">
  <div style="max-width:1200px;margin:0 auto;padding:0.875rem 1.5rem;display:flex;align-items:center;justify-content:space-between;gap:1rem">
    {logo_html}
    <nav class="nav-links" style="display:flex;align-items:center;gap:1.25rem;flex:1;justify-content:center;flex-wrap:wrap">
      {nav_html}
    </nav>
    <div style="display:flex;align-items:center;gap:1rem;flex-shrink:0">
      {f'<a href="tel:{phone_clean}" style="color:{accent_light};text-decoration:none;font-size:0.8rem;font-weight:600">{company_phone}</a>' if company_phone else ''}
      <a href="{cfg['get_started']}" style="background:{accent};color:white;padding:0.5rem 1.125rem;border-radius:9999px;text-decoration:none;font-size:0.8rem;font-weight:700;white-space:nowrap">Start Assessment</a>
    </div>
  </div>
</header>

<!-- HERO -->
<section style="position:relative;min-height:520px;max-height:720px;overflow:hidden;background:{hero_bg};display:flex;align-items:center">
  <video autoplay loop muted playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.5">
    <source src="{cfg['video']}" type="video/mp4">
  </video>
  <div class="hero-mobile-bg" style="display:none;position:absolute;inset:0;background:linear-gradient(135deg,{hero_bg} 0%,{accent}33 100%)"></div>
  <div style="position:absolute;inset:0;background:linear-gradient(105deg,rgba(5,5,5,0.88) 0%,rgba(5,5,5,0.5) 60%,rgba(5,5,5,0.2) 100%)"></div>
  <div style="position:relative;z-index:10;max-width:1200px;margin:0 auto;padding:4rem 1.5rem">
    <p style="color:{accent_light};font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:0.875rem">{company_name} {cfg["label"]}</p>
    <h1 style="font-size:clamp(2rem,5vw,3.5rem);font-weight:900;color:white;line-height:1.1;margin-bottom:1rem;max-width:620px">
      {product_label} in {location_label}
    </h1>
    <p style="color:rgba(255,255,255,0.72);font-size:1rem;max-width:520px;margin-bottom:1.75rem;line-height:1.65">{cfg['hero_sub']}</p>
    <div style="display:flex;flex-wrap:wrap;gap:0.625rem;margin-bottom:2rem">
      {trust_pills}
    </div>
    <div style="display:flex;gap:0.875rem;flex-wrap:wrap">
      <a href="{cfg['get_started']}" style="background:{accent};color:white;padding:0.875rem 2rem;border-radius:9999px;text-decoration:none;font-size:0.95rem;font-weight:700;display:inline-flex;align-items:center;gap:6px">
        {cfg['cta_text']} →
      </a>
      <a href="{canonical.replace(site_domain,'')}" style="background:rgba(255,255,255,0.1);color:white;padding:0.875rem 2rem;border-radius:9999px;text-decoration:none;font-size:0.95rem;font-weight:600;border:1px solid rgba(255,255,255,0.2)">
        View {location_label} Locations
      </a>
    </div>
  </div>
</section>

<!-- FRESH CATALOG PRODUCTS -->
{products_html}

<!-- STATS BAR -->
<section style="padding:3rem 1.5rem;background:#f8fafc;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:repeat(4,1fr);gap:1.5rem;text-align:center">
    <div><p style="font-size:2.25rem;font-weight:900;color:{accent};margin:0">50,000+</p><p style="font-size:0.8rem;color:#64748b;margin:0.25rem 0 0">Patients treated</p></div>
    <div><p style="font-size:2.25rem;font-weight:900;color:{accent};margin:0">95%</p><p style="font-size:0.8rem;color:#64748b;margin:0.25rem 0 0">Member satisfaction</p></div>
    <div><p style="font-size:2.25rem;font-weight:900;color:{accent};margin:0">48 hrs</p><p style="font-size:0.8rem;color:#64748b;margin:0.25rem 0 0">Avg time to first visit</p></div>
    <div><p style="font-size:2.25rem;font-weight:900;color:{accent};margin:0">50 States</p><p style="font-size:0.8rem;color:#64748b;margin:0.25rem 0 0">Licensed nationwide</p></div>
  </div>
</section>

<!-- HOW IT WORKS -->
<section style="padding:5rem 1.5rem;background:white">
  <div style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:3rem">
      <p style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:{accent};margin:0 0 0.5rem">Simple Steps</p>
      <h2 style="font-size:2rem;font-weight:900;color:#0f172a;margin:0 0 0.75rem">How It Works</h2>
      <p style="color:#64748b;font-size:0.95rem;max-width:520px;margin:0 auto">Simple steps to personalized clinical care designed for real, lasting results.</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem">
      <div style="background:#f8fafc;border-radius:16px;padding:2rem">
        <p style="font-size:3rem;font-weight:900;opacity:0.15;color:{accent};margin:0 0 0.75rem;line-height:1">01</p>
        <h3 style="font-size:1.1rem;font-weight:700;color:#0f172a;margin:0 0 0.75rem">Complete Your Assessment</h3>
        <p style="color:#64748b;font-size:0.875rem;margin:0;line-height:1.6">Answer a quick health questionnaire online — no waiting rooms, no in-person visits required.</p>
      </div>
      <div style="background:#f8fafc;border-radius:16px;padding:2rem">
        <p style="font-size:3rem;font-weight:900;opacity:0.15;color:{accent};margin:0 0 0.75rem;line-height:1">02</p>
        <h3 style="font-size:1.1rem;font-weight:700;color:#0f172a;margin:0 0 0.75rem">Provider Reviews Your Case</h3>
        <p style="color:#64748b;font-size:0.875rem;margin:0;line-height:1.6">A board-certified provider reviews your health history within 24 hours and creates a personalized plan.</p>
      </div>
      <div style="background:#f8fafc;border-radius:16px;padding:2rem">
        <p style="font-size:3rem;font-weight:900;opacity:0.15;color:{accent};margin:0 0 0.75rem;line-height:1">03</p>
        <h3 style="font-size:1.1rem;font-weight:700;color:#0f172a;margin:0 0 0.75rem">Receive Your Treatment</h3>
        <p style="color:#64748b;font-size:0.875rem;margin:0;line-height:1.6">Your clinician-prescribed medication is shipped discreetly to your door in 2–3 business days.</p>
      </div>
    </div>
  </div>
</section>

<!-- WHY MEDVERA -->
<section style="padding:5rem 1.5rem;background:linear-gradient(135deg,{hero_bg} 0%,{accent}22 100%)">
  <div style="max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:4rem;align-items:center">
    <div>
      <p style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:{accent_light};margin:0 0 0.75rem">Why MEDVera</p>
      <h2 style="font-size:1.875rem;font-weight:900;color:white;margin:0 0 1rem;line-height:1.2">Clinician-guided,<br>every step of the way</h2>
      <p style="color:rgba(255,255,255,0.7);font-size:0.9rem;margin:0 0 2rem;line-height:1.7">All treatments are prescribed and monitored by licensed, board-certified medical providers in {location_label}.</p>
      <div style="display:flex;flex-direction:column;gap:1.25rem">
        <div style="display:flex;gap:1rem;align-items:flex-start"><span style="font-size:1.25rem">🩺</span><div><p style="color:white;font-weight:700;font-size:0.875rem;margin:0 0 0.25rem">Board-Certified Providers</p><p style="color:rgba(255,255,255,0.6);font-size:0.8rem;margin:0">Every plan reviewed by licensed healthcare professionals.</p></div></div>
        <div style="display:flex;gap:1rem;align-items:flex-start"><span style="font-size:1.25rem">✅</span><div><p style="color:white;font-weight:700;font-size:0.875rem;margin:0 0 0.25rem">FDA-Approved Treatments</p><p style="color:rgba(255,255,255,0.6);font-size:0.8rem;margin:0">Safe, clinically validated medications backed by research.</p></div></div>
        <div style="display:flex;gap:1rem;align-items:flex-start"><span style="font-size:1.25rem">🔒</span><div><p style="color:white;font-weight:700;font-size:0.875rem;margin:0 0 0.25rem">HIPAA-Compliant &amp; Private</p><p style="color:rgba(255,255,255,0.6);font-size:0.8rem;margin:0">Your health information is always protected.</p></div></div>
        <div style="display:flex;gap:1rem;align-items:flex-start"><span style="font-size:1.25rem">🚚</span><div><p style="color:white;font-weight:700;font-size:0.875rem;margin:0 0 0.25rem">Fast Discreet Delivery</p><p style="color:rgba(255,255,255,0.6);font-size:0.8rem;margin:0">Plain packaging, shipped quickly and reliably nationwide.</p></div></div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
      <div style="background:rgba(255,255,255,0.08);border-radius:16px;padding:1.5rem;text-align:center"><p style="font-size:2rem;font-weight:900;color:{accent_light};margin:0 0 0.25rem">50,000+</p><p style="font-size:0.75rem;color:rgba(255,255,255,0.6);margin:0">Patients treated</p></div>
      <div style="background:rgba(255,255,255,0.08);border-radius:16px;padding:1.5rem;text-align:center"><p style="font-size:2rem;font-weight:900;color:{accent_light};margin:0 0 0.25rem">95%</p><p style="font-size:0.75rem;color:rgba(255,255,255,0.6);margin:0">Satisfaction rate</p></div>
      <div style="background:rgba(255,255,255,0.08);border-radius:16px;padding:1.5rem;text-align:center"><p style="font-size:2rem;font-weight:900;color:{accent_light};margin:0 0 0.25rem">48 hrs</p><p style="font-size:0.75rem;color:rgba(255,255,255,0.6);margin:0">To first visit</p></div>
      <div style="background:rgba(255,255,255,0.08);border-radius:16px;padding:1.5rem;text-align:center"><p style="font-size:2rem;font-weight:900;color:{accent_light};margin:0 0 0.25rem">50</p><p style="font-size:0.75rem;color:rgba(255,255,255,0.6);margin:0">States covered</p></div>
    </div>
  </div>
</section>

<!-- TESTIMONIALS -->
<section style="padding:5rem 1.5rem;background:white">
  <div style="max-width:1100px;margin:0 auto">
    <div style="text-align:center;margin-bottom:3rem">
      <p style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:{accent};margin:0 0 0.5rem">Real Results</p>
      <h2 style="font-size:2rem;font-weight:900;color:#0f172a;margin:0">What Our Members Say</h2>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem">
      <div style="background:#f8fafc;border-radius:16px;padding:2rem">
        <div style="display:flex;gap:2px;margin-bottom:1rem">{"⭐"*5}</div>
        <p style="color:#475569;font-size:0.875rem;font-style:italic;margin:0 0 1.5rem;line-height:1.7">"MEDVera made the whole process so easy. My provider was thorough and genuinely invested in my results."</p>
        <div style="display:flex;align-items:center;justify-content:space-between"><div><p style="font-weight:700;color:#0f172a;font-size:0.875rem;margin:0">Sarah M., 34</p><p style="font-size:0.75rem;color:#94a3b8;margin:0.125rem 0 0">Verified MEDVera Member</p></div><span style="background:{accent}18;color:{accent};font-size:0.7rem;font-weight:700;padding:0.25rem 0.625rem;border-radius:20px">Real Results</span></div>
      </div>
      <div style="background:#f8fafc;border-radius:16px;padding:2rem">
        <div style="display:flex;gap:2px;margin-bottom:1rem">{"⭐"*5}</div>
        <p style="color:#475569;font-size:0.875rem;font-style:italic;margin:0 0 1.5rem;line-height:1.7">"I was skeptical about telehealth but MEDVera completely changed my mind. The care is exceptional."</p>
        <div style="display:flex;align-items:center;justify-content:space-between"><div><p style="font-weight:700;color:#0f172a;font-size:0.875rem;margin:0">James T., 41</p><p style="font-size:0.75rem;color:#94a3b8;margin:0.125rem 0 0">Verified MEDVera Member</p></div><span style="background:{accent}18;color:{accent};font-size:0.7rem;font-weight:700;padding:0.25rem 0.625rem;border-radius:20px">Highly Satisfied</span></div>
      </div>
      <div style="background:#f8fafc;border-radius:16px;padding:2rem">
        <div style="display:flex;gap:2px;margin-bottom:1rem">{"⭐"*5}</div>
        <p style="color:#475569;font-size:0.875rem;font-style:italic;margin:0 0 1.5rem;line-height:1.7">"Finally a healthcare team that actually cares. Everything handled in one place, fast delivery."</p>
        <div style="display:flex;align-items:center;justify-content:space-between"><div><p style="font-weight:700;color:#0f172a;font-size:0.875rem;margin:0">Michelle R., 29</p><p style="font-size:0.75rem;color:#94a3b8;margin:0.125rem 0 0">Verified MEDVera Member</p></div><span style="background:{accent}18;color:{accent};font-size:0.7rem;font-weight:700;padding:0.25rem 0.625rem;border-radius:20px">Achieved Goals</span></div>
      </div>
    </div>
  </div>
</section>

<!-- LOCATION DATA (counties/cities) -->
{location_html}

<!-- FAQ -->
<section style="padding:5rem 1.5rem;background:white">
  <div style="max-width:780px;margin:0 auto">
    <div style="text-align:center;margin-bottom:3rem">
      <p style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:{accent};margin:0 0 0.5rem">FAQ</p>
      <h2 style="font-size:2rem;font-weight:900;color:#0f172a;margin:0">Frequently Asked Questions</h2>
    </div>
    <div style="display:flex;flex-direction:column;gap:0.75rem">
      <details style="background:#f8fafc;border-radius:12px;padding:1.25rem 1.5rem;cursor:pointer"><summary style="font-weight:700;color:#0f172a;font-size:0.9rem;list-style:none;display:flex;justify-content:space-between">What {product_label} services are available in {location_label}? <span>+</span></summary><p style="color:#64748b;font-size:0.875rem;margin:0.75rem 0 0;line-height:1.7">{company_name} provides clinician-prescribed {product_label.lower()} services in {location_label} with board-certified providers and free discreet delivery.</p></details>
      <details style="background:#f8fafc;border-radius:12px;padding:1.25rem 1.5rem;cursor:pointer"><summary style="font-weight:700;color:#0f172a;font-size:0.9rem;list-style:none;display:flex;justify-content:space-between">Do I need insurance? <span>+</span></summary><p style="color:#64748b;font-size:0.875rem;margin:0.75rem 0 0;line-height:1.7">No insurance required. {company_name} offers transparent cash-pay pricing. Some plans may cover the cost.</p></details>
      <details style="background:#f8fafc;border-radius:12px;padding:1.25rem 1.5rem;cursor:pointer"><summary style="font-weight:700;color:#0f172a;font-size:0.9rem;list-style:none;display:flex;justify-content:space-between">How fast is delivery in {location_label}? <span>+</span></summary><p style="color:#64748b;font-size:0.875rem;margin:0.75rem 0 0;line-height:1.7">Most orders ship within 24-48 hours of provider approval and arrive in 2-3 business days in {location_label}.</p></details>
      <details style="background:#f8fafc;border-radius:12px;padding:1.25rem 1.5rem;cursor:pointer"><summary style="font-weight:700;color:#0f172a;font-size:0.9rem;list-style:none;display:flex;justify-content:space-between">Is my health information private? <span>+</span></summary><p style="color:#64748b;font-size:0.875rem;margin:0.75rem 0 0;line-height:1.7">Yes. {company_name} is fully HIPAA-compliant. Your health information is encrypted and never shared without your consent.</p></details>
    </div>
  </div>
</section>

<!-- FINAL CTA -->
<section style="padding:5rem 1.5rem;background:{accent};text-align:center">
  <div style="max-width:680px;margin:0 auto">
    <h2 style="font-size:2rem;font-weight:900;color:white;margin:0 0 1rem;line-height:1.2">Ready to get started in {location_label}?</h2>
    <p style="color:rgba(255,255,255,0.8);font-size:1rem;margin:0 0 2rem;line-height:1.7">Complete a free eligibility assessment. A board-certified provider will review your information and reach out within 24 hours.</p>
    <a href="{cfg['get_started']}" style="background:white;color:{accent};padding:1rem 2.5rem;border-radius:9999px;text-decoration:none;font-size:1rem;font-weight:800;display:inline-block">{cfg['cta_text']} →</a>
    <p style="color:rgba(255,255,255,0.6);font-size:0.75rem;margin:1rem 0 0">Free eligibility check · No commitment required · Insurance Not Required</p>
  </div>
</section>

<!-- FOOTER -->
<footer style="background:#0f172a;color:#94a3b8;padding:3rem 1.5rem;margin-top:0">
  <div style="max-width:1200px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:2rem">
    <div>
      {logo_html}
      <p style="margin-top:0.875rem;font-size:0.8rem;line-height:1.6;color:#64748b">FDA-approved telehealth treatments. Board-certified providers nationwide.</p>
    </div>
    <div>
      <p style="color:white;font-weight:600;font-size:0.8rem;margin-bottom:0.875rem">Treatments</p>
      {''.join(f'<div><a href="{href}" style="color:#64748b;text-decoration:none;font-size:0.78rem;display:block;margin-bottom:0.4rem">{label}</a></div>' for label, href in nav_links)}
    </div>
    <div>
      <p style="color:white;font-weight:600;font-size:0.8rem;margin-bottom:0.875rem">Coverage Areas</p>
      <a href="/coverage-areas" style="color:#64748b;text-decoration:none;font-size:0.78rem;display:block;margin-bottom:0.4rem">All Coverage Areas</a>
      <a href="/coverage-areas/{product_slug}" style="color:{accent_light};text-decoration:none;font-size:0.78rem;display:block">{product_label} — All States →</a>
    </div>
    <div>
      <p style="color:white;font-weight:600;font-size:0.8rem;margin-bottom:0.875rem">Company</p>
      <a href="/sitemap" style="color:#64748b;text-decoration:none;font-size:0.78rem;display:block;margin-bottom:0.4rem">Site Map</a>
      <a href="/legal/privacy-policy" style="color:#64748b;text-decoration:none;font-size:0.78rem;display:block;margin-bottom:0.4rem">Privacy Policy</a>
      <a href="/legal/hipaa" style="color:#64748b;text-decoration:none;font-size:0.78rem;display:block">HIPAA Notice</a>
      {f'<a href="tel:{phone_clean}" style="color:{accent_light};text-decoration:none;font-size:0.78rem;display:block;margin-top:0.875rem;font-weight:600">{company_phone}</a>' if company_phone else ''}
    </div>
  </div>
  <div style="max-width:1200px;margin:2rem auto 0;padding-top:1.5rem;border-top:1px solid #1e293b;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem">
    <p style="font-size:0.72rem;color:#475569">© {company_name}. All rights reserved. HIPAA Compliant.</p>
    <p style="font-size:0.72rem;color:#475569">FDA-approved medications · Board-certified providers · 50 states</p>
  </div>
</footer>

</body>
</html>'''
