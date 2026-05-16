"""Public render endpoints — mounted on FastAPI `app` (no /api prefix).

Phase 4a: prefer structured `content` + render_pipeline. Fall back to
apply_live_overlay on legacy `html` field for older pages.

Phase 4b: fetches `_xlinks` (breadcrumbs / down-links / sibling-links) for
hierarchical pages before rendering, so the pipeline can splice cross-link
modules in at request time without any baked link state.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse

from services.render_overlay import apply_live_overlay
from services.render_pipeline import render_full_page, build_index_page_object
from services.component_namespace import coll, get_namespace, get_public_prefix, loc_prefix, loc_api_prefix, sitemap_path, sitemap_root_path, robots_root_enabled, robots_snippet_path, api_ns_segment


CITY_LIST_CAP = 100  # truncate big-state city list (Phase 4c will paginate)
SIBLING_CAP = 10


async def _get_default_site_settings(db) -> dict:
    doc = await db[coll("site_settings")].find_one({"_id": "default"})
    result = dict(doc or {})
    result.pop("_id", None)

    # If logo_url not set in v2_site_settings, inherit from the main app's branding
    # (stored in site_settings collection with {"type": "site"})
    if not result.get("logo_url"):
        main = await db["site_settings"].find_one({"type": "site"}, {"_id": 0})
        if main:
            logo = main.get("logo_url") or main.get("dashboard_logo_url")
            if logo:
                result["logo_url"] = logo

    return result


async def _resolve_xlinks(db, page: dict) -> dict:
    """Phase 4b: build the cross-link payload for a content page.

    Returns:
      {
        "breadcrumbs": [{label, href}, ...],
        "down": {"counties": [...], "cities": [...], "state_total_cities": N,
                 "cities_heading": "...", "product_slug": "..."},
        "siblings": {"label": "...", "items": [{slug, label}], "product_slug": "..."}
      }
    Only the keys relevant for the page's level will be populated.
    """
    gen_id = page.get("generator_id")
    level = page.get("level") or "city"
    parent_slug = page.get("parent_slug")
    page_slug = page.get("slug")

    out: dict = {"breadcrumbs": None, "down": None, "siblings": None}
    if not gen_id:
        return out

    # Resolve product_slug for building correct public URLs
    # Each page stores its own product_slug; fall back to querying the generator
    product_slug = page.get("product_slug") or ""
    if not product_slug:
        from services.slug_engine import slugify as _slugify
        gen_doc = await db[coll("page_generators")].find_one(
            {"id": gen_id}, {"_id": 0, "type": 1}
        )
        if gen_doc:
            product_slug = _slugify(gen_doc.get("type") or "service")

    def _page_url(slug: str) -> str:
        """Build the full public URL for a generated page slug."""
        if product_slug:
            return f"{loc_prefix()}/{product_slug}/{slug}"
        return f"{loc_prefix()}/{slug}"

    # ---- Breadcrumbs ----
    crumbs = [{"label": "All locations", "href": loc_prefix()}]
    if product_slug:
        crumbs.append({"label": product_slug.replace("-", " ").title(), "href": f"{loc_prefix()}/{product_slug}"})

    if level == "county" and parent_slug:
        state_doc = await db[coll("generated_pages")].find_one(
            {"generator_id": gen_id, "level": "state", "slug": parent_slug},
            {"_id": 0, "slug": 1, "state_name": 1},
        )
        if state_doc:
            crumbs.append({
                "label": state_doc.get("state_name") or parent_slug,
                "href": _page_url(state_doc["slug"]),
            })
    elif level == "city" and parent_slug:
        parent_doc = await db[coll("generated_pages")].find_one(
            {"generator_id": gen_id, "slug": parent_slug},
            {"_id": 0, "slug": 1, "level": 1, "parent_slug": 1, "state_name": 1, "county": 1},
        )
        if parent_doc and parent_doc.get("level") == "county":
            grandparent_slug = parent_doc.get("parent_slug")
            if grandparent_slug:
                state_doc = await db[coll("generated_pages")].find_one(
                    {"generator_id": gen_id, "level": "state", "slug": grandparent_slug},
                    {"_id": 0, "slug": 1, "state_name": 1},
                )
                if state_doc:
                    crumbs.append({
                        "label": state_doc.get("state_name") or grandparent_slug,
                        "href": _page_url(state_doc["slug"]),
                    })
            crumbs.append({
                "label": (parent_doc.get("county") or parent_doc["slug"]) + " County",
                "href": _page_url(parent_doc["slug"]),
            })
        elif parent_doc and parent_doc.get("level") == "state":
            crumbs.append({
                "label": parent_doc.get("state_name") or parent_slug,
                "href": _page_url(parent_doc["slug"]),
            })
    # Page itself (no link)
    label = (
        page.get("city")
        or (f'{page.get("county")} County' if page.get("county") else None)
        or page.get("state_name")
        or page_slug
    )
    crumbs.append({"label": label or "", "href": None})
    out["breadcrumbs"] = crumbs

    # ---- Down-links (state → counties + cities; county → cities) ----
    if level == "state":
        counties = await db[coll("generated_pages")].find(
            {"generator_id": gen_id, "level": "county", "parent_slug": page_slug},
            {"_id": 0, "slug": 1, "county": 1, "state_name": 1},
        ).sort("county", 1).to_list(length=10000)
        cities = await db[coll("generated_pages")].find(
            {"generator_id": gen_id, "level": "city", "state_code": page.get("state_code")},
            {"_id": 0, "slug": 1, "city": 1, "state_name": 1},
        ).sort("city", 1).to_list(length=10000)
        total_cities = len(cities)
        truncated = cities[:CITY_LIST_CAP]
        out["down"] = {
            "product_slug": product_slug,
            "counties": [
                {"slug": c["slug"], "label": c.get("county") or c["slug"]}
                for c in counties
            ],
            "cities": [
                {"slug": c["slug"], "label": c.get("city") or c["slug"]}
                for c in truncated
            ],
            "state_total_cities": total_cities,
            "cities_heading": "Cities",
            "view_all_url": f"{_page_url(page_slug)}/cities",
        }
    elif level == "county":
        cities = await db[coll("generated_pages")].find(
            {"generator_id": gen_id, "level": "city", "parent_slug": page_slug},
            {"_id": 0, "slug": 1, "city": 1},
        ).sort("city", 1).to_list(length=10000)
        total_cities = len(cities)
        out["down"] = {
            "product_slug": product_slug,
            "counties": [],
            "cities": [
                {"slug": c["slug"], "label": c.get("city") or c["slug"]}
                for c in cities[:CITY_LIST_CAP]
            ],
            "state_total_cities": total_cities,
            "cities_heading": "Cities in this county",
        }

    # ---- Siblings ----
    if level == "city":
        siblings = await db[coll("generated_pages")].find(
            {
                "generator_id": gen_id,
                "level": "city",
                "parent_slug": parent_slug,
                "slug": {"$ne": page_slug},
            },
            {"_id": 0, "slug": 1, "city": 1},
        ).sort("city", 1).limit(SIBLING_CAP).to_list(length=SIBLING_CAP)
        out["siblings"] = {
            "product_slug": product_slug,
            "label": "Other cities nearby",
            "items": [{"slug": s["slug"], "label": s.get("city") or s["slug"]} for s in siblings],
        }
    elif level == "county":
        siblings = await db[coll("generated_pages")].find(
            {
                "generator_id": gen_id,
                "level": "county",
                "parent_slug": parent_slug,
                "slug": {"$ne": page_slug},
            },
            {"_id": 0, "slug": 1, "county": 1},
        ).sort("county", 1).to_list(length=10000)
        out["siblings"] = {
            "product_slug": product_slug,
            "label": "Other counties in this state",
            "items": [
                {"slug": s["slug"], "label": (s.get("county") or s["slug"]) + " County"}
                for s in siblings
            ],
        }

    return out


def build_public_router(db) -> APIRouter:
    router = APIRouter()
    _LOC = loc_prefix()

    def _build_branded_html(title: str, content_html: str, site: dict) -> str:
        """Helper to build branded HTML with MEDVera styling"""
        company_name = site.get('company_name', 'MEDVera')
        company_phone = site.get('company_phone', '(844) 438-4571')
        logo_url = site.get('logo_url', '')
        
        # Build logo HTML - use image if available, otherwise fallback to text
        if logo_url:
            logo_html = f'<a href="/" class="logo-link"><img src="{logo_url}" alt="{company_name}" class="logo-img"/></a>'
        else:
            logo_html = '<a href="/" class="logo">MED<span>Vera</span></a>'
        
        return f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <meta name="theme-color" content="#3d6b5a"/>
    <title>{title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ 
            font-family: 'Inter', system-ui, -apple-system, sans-serif; 
            background: #fafaf9; 
            color: #1e293b;
            line-height: 1.6;
        }}
        .header {{
            background: white;
            border-bottom: 1px solid #e2e8f0;
            padding: 1rem 0;
            position: sticky;
            top: 0;
            z-index: 100;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }}
        .header-content {{
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}
        .logo {{
            font-size: 1.5rem;
            font-weight: 700;
            color: #0f172a;
            text-decoration: none;
        }}
        .logo span {{ color: #3d6b5a; }}
        .logo-link {{
            display: flex;
            align-items: center;
        }}
        .logo-img {{
            height: 40px;
            width: auto;
            object-fit: contain;
        }}
        .phone {{
            color: #3d6b5a;
            text-decoration: none;
            font-weight: 600;
            font-size: 1.1rem;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            padding: 3rem 2rem;
        }}
        .hero {{
            text-align: center;
            margin-bottom: 3rem;
        }}
        .hero h1 {{
            font-size: 2.5rem;
            font-weight: 800;
            color: #0f172a;
            margin-bottom: 0.75rem;
        }}
        .hero p {{
            font-size: 1.125rem;
            color: #64748b;
        }}
        .card {{
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 2rem;
            margin-bottom: 1.5rem;
            transition: all 0.2s;
        }}
        .card:hover {{
            box-shadow: 0 10px 25px rgba(0,0,0,0.08);
            border-color: #3d6b5a;
        }}
        .card h2 {{
            font-size: 1.5rem;
            font-weight: 700;
            margin-bottom: 0.75rem;
        }}
        .card h2 a {{
            color: #3d6b5a;
            text-decoration: none;
        }}
        .card h2 a:hover {{
            color: #2d5446;
        }}
        .card p {{
            color: #64748b;
            margin-bottom: 1rem;
        }}
        .btn {{
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            background: #3d6b5a;
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            transition: all 0.2s;
        }}
        .btn:hover {{
            background: #2d5446;
        }}
        .footer {{
            background: #0f172a;
            color: #94a3b8;
            padding: 2rem 0;
            margin-top: 4rem;
            text-align: center;
        }}
        .footer p {{
            font-size: 0.875rem;
        }}
        .states-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 1rem;
            margin-top: 2rem;
        }}
        .state-link {{
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 1rem 1.25rem;
            text-decoration: none;
            color: #1e293b;
            font-weight: 500;
            transition: all 0.2s;
            display: block;
        }}
        .state-link:hover {{
            border-color: #3d6b5a;
            color: #3d6b5a;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }}
    </style>
</head>
<body>
    <header class="header">
        <div class="header-content">
            {logo_html}
            <a href="tel:{company_phone.replace(' ', '').replace('(', '').replace(')', '').replace('-', '')}" class="phone">{company_phone}</a>
        </div>
    </header>
    
    <main class="container">
        {content_html}
    </main>
    
    <footer class="footer">
        <p>© {company_name} · Licensed Healthcare Provider · HIPAA Compliant</p>
    </footer>
</body>
</html>'''

    @router.get(_LOC, response_class=HTMLResponse, include_in_schema=False)
    async def public_locations_index() -> HTMLResponse:
        """Main /coverage-areas index — one card per product/topic generator."""
        site = await _get_default_site_settings(db)
        company_name = site.get('company_name', 'MEDVera')
        company_phone = site.get('company_phone', '')
        logo_url = site.get('logo_url', '')

        from services.slug_engine import slugify
        gens = await db[coll("page_generators")].find(
            {"status": {"$ne": "archived"}}, {"_id": 0}
        ).sort("name", 1).to_list(length=1000)

        products: dict = {}
        for gen in gens:
            product_slug = slugify(gen.get("type") or "service")
            if product_slug not in products:
                products[product_slug] = {
                    "slug": product_slug,
                    "name": gen.get("type") or "Service",
                    "page_count": 0,
                    "state_count": 0,
                }

        for product_slug, prod in products.items():
            prod["page_count"] = await db[coll("generated_pages")].count_documents({"product_slug": product_slug})
            prod["state_count"] = await db[coll("generated_pages")].count_documents({"product_slug": product_slug, "level": "state"})

        cards_html = ""
        for prod in products.values():
            page_count = prod["page_count"]
            state_count = prod["state_count"]
            status_text = f"{page_count:,} pages across {state_count} state{'s' if state_count != 1 else ''}" if page_count else "Coming soon"
            cards_html += f'''
            <a href="{_LOC}/{prod["slug"]}" class="product-card" data-testid="coverage-product-{prod["slug"]}">
                <div class="product-card-inner">
                    <div class="product-icon">{prod["name"][:1].upper()}</div>
                    <div class="product-info">
                        <h2 class="product-name">{prod["name"]}</h2>
                        <p class="product-meta">{status_text}</p>
                    </div>
                    <div class="product-arrow">→</div>
                </div>
            </a>'''

        if not cards_html:
            cards_html = '<div class="empty-state"><p>No coverage areas have been generated yet.</p></div>'

        phone_clean = company_phone.replace(' ', '').replace('(', '').replace(')', '').replace('-', '')
        logo_html = f'<a href="/"><img src="{logo_url}" alt="{company_name}" style="height:40px;width:auto;object-fit:contain;"/></a>' if logo_url else f'<a href="/" style="font-size:1.5rem;font-weight:700;color:#0f172a;text-decoration:none;">{company_name}</a>'

        html = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>Coverage Areas | {company_name}</title>
    <meta name="description" content="Find {company_name} services in your area. Browse all coverage areas by topic."/>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
    <style>
        *{{margin:0;padding:0;box-sizing:border-box;}}
        body{{font-family:"Inter",system-ui,sans-serif;background:#f8fafc;color:#1e293b;line-height:1.6;}}
        .header{{background:white;border-bottom:1px solid #e2e8f0;padding:1rem 0;position:sticky;top:0;z-index:100;box-shadow:0 1px 3px rgba(0,0,0,0.05);}}
        .header-inner{{max-width:1200px;margin:0 auto;padding:0 2rem;display:flex;justify-content:space-between;align-items:center;}}
        .phone{{color:#3d6b5a;text-decoration:none;font-weight:600;font-size:1rem;}}
        .hero{{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);color:white;padding:5rem 2rem;text-align:center;}}
        .hero h1{{font-size:3rem;font-weight:800;margin-bottom:1rem;letter-spacing:-0.02em;}}
        .hero p{{font-size:1.125rem;opacity:0.8;max-width:600px;margin:0 auto;}}
        .content{{max-width:900px;margin:3rem auto;padding:0 2rem;}}
        .section-title{{font-size:1.25rem;font-weight:700;color:#0f172a;margin-bottom:1.5rem;padding-bottom:0.75rem;border-bottom:2px solid #e2e8f0;}}
        .product-card{{display:block;text-decoration:none;color:inherit;background:white;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:1rem;transition:all 0.2s;overflow:hidden;}}
        .product-card:hover{{border-color:#3d6b5a;box-shadow:0 4px 20px rgba(61,107,90,0.12);transform:translateY(-1px);}}
        .product-card-inner{{display:flex;align-items:center;gap:1.25rem;padding:1.5rem 2rem;}}
        .product-icon{{width:48px;height:48px;background:#0f172a;color:white;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.25rem;font-weight:800;flex-shrink:0;}}
        .product-info{{flex:1;min-width:0;}}
        .product-name{{font-size:1.125rem;font-weight:700;color:#0f172a;margin-bottom:0.25rem;}}
        .product-meta{{font-size:0.875rem;color:#64748b;}}
        .product-arrow{{font-size:1.25rem;color:#3d6b5a;font-weight:600;flex-shrink:0;}}
        .empty-state{{text-align:center;padding:4rem;color:#64748b;background:white;border-radius:12px;border:1px dashed #e2e8f0;}}
        .footer{{background:#0f172a;color:#94a3b8;padding:2rem;text-align:center;font-size:0.875rem;margin-top:4rem;}}
    </style>
</head>
<body>
    <header class="header">
        <div class="header-inner">
            {logo_html}
            <a href="tel:{phone_clean}" class="phone">{company_phone}</a>
        </div>
    </header>
    <div class="hero">
        <h1>Coverage Areas</h1>
        <p>Browse all {company_name} service topics. Click any category to see locations nationwide.</p>
    </div>
    <div class="content">
        <div class="section-title">All Topics & Services</div>
        {cards_html}
    </div>
    <footer class="footer">© {company_name} · All Rights Reserved</footer>
</body>
</html>'''
        return HTMLResponse(content=html, status_code=200)

    @router.get(_LOC + "/{product_slug}", response_class=HTMLResponse, include_in_schema=False)
    async def public_product_landing(product_slug: str) -> HTMLResponse:
        """Product landing page — uses cloned template if generator has one, with state cards appended."""
        site = await _get_default_site_settings(db)
        company_name = site.get('company_name', 'MEDVera')
        company_phone = site.get('company_phone', '')
        logo_url = site.get('logo_url', '')

        # Get state-level pages for this product
        pages = await db[coll("generated_pages")].find(
            {"product_slug": product_slug, "level": "state"},
            {"_id": 0, "slug": 1, "state_name": 1, "state_code": 1, "generator_id": 1, "title": 1},
        ).sort("state_name", 1).to_list(length=200)

        # Legacy fallback: find generator by type slug then query by generator_id
        if not pages:
            from services.slug_engine import slugify as _sf
            all_gens = await db[coll("page_generators")].find(
                {"status": {"$ne": "archived"}}, {"_id": 0, "id": 1, "type": 1}
            ).to_list(50)
            for g in all_gens:
                if _sf(g.get("type") or "") == product_slug:
                    pages = await db[coll("generated_pages")].find(
                        {"generator_id": g["id"], "level": "state"},
                        {"_id": 0, "slug": 1, "state_name": 1, "state_code": 1, "generator_id": 1, "title": 1},
                    ).sort("state_name", 1).to_list(length=200)
                    if pages:
                        break

        if not pages:
            raise HTTPException(status_code=404, detail=f"No coverage areas found for: {product_slug}")

        # Get generator (for cloned template + product name)
        gen = await db[coll("page_generators")].find_one(
            {"id": pages[0]["generator_id"]}, {"_id": 0}
        )
        if gen:
            gen.pop("_id", None)
        product_name = (gen or {}).get("type", product_slug.replace("-", " ").title()) or product_slug.replace("-", " ").title()

        # Get county/city counts per state — single aggregation
        gen_id = pages[0].get("generator_id", "")
        state_counts: dict = {}
        async for row in db[coll("generated_pages")].aggregate([
            {"$match": {"generator_id": gen_id, "level": {"$in": ["county", "city"]}}},
            {"$group": {"_id": {"state_code": "$state_code", "level": "$level"}, "count": {"$sum": 1}}},
        ]):
            sc = (row["_id"].get("state_code") or "").upper()
            lv = row["_id"].get("level")
            if sc not in state_counts:
                state_counts[sc] = {"counties": 0, "cities": 0}
            if lv == "county":
                state_counts[sc]["counties"] = row["count"]
            elif lv == "city":
                state_counts[sc]["cities"] = row["count"]

        # Product landing page always uses the clean state-listing design.
        # The cloned template is only used on individual location pages (state/county/city).
        phone_clean = company_phone.replace(' ', '').replace('(', '').replace(')', '').replace('-', '')
        logo_html = f'<a href="/"><img src="{logo_url}" alt="{company_name}" style="height:40px;width:auto;object-fit:contain;"/></a>' if logo_url else f'<a href="/" style="font-size:1.5rem;font-weight:700;color:#0f172a;text-decoration:none;">{company_name}</a>'

        state_cards = ""
        for p in pages:
            slug = p.get("slug", "")
            state_name = p.get("state_name", "")
            sc = p.get("state_code", "")
            counts = state_counts.get(sc, {"counties": 0, "cities": 0})
            sub = ""
            if counts["counties"] or counts["cities"]:
                parts = []
                if counts["counties"]:
                    parts.append(f'{counts["counties"]} counties')
                if counts["cities"]:
                    parts.append(f'{counts["cities"]} cities')
                sub = f'<span class="state-sub">{" · ".join(parts)}</span>'
            state_cards += f'''
            <a href="{_LOC}/{product_slug}/{slug}" class="state-card" data-testid="state-card-{sc}">
                <span class="state-code">{sc}</span>
                <span class="state-name">{state_name}</span>
                {sub}
                <span class="state-arrow">→</span>
            </a>'''

        html = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>{product_name} Coverage Areas | {company_name}</title>
    <meta name="description" content="Find {product_name} services near you. Browse all states and locations covered by {company_name}."/>
    <link rel="canonical" href="{_LOC}/{product_slug}"/>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
    <style>
        *{{margin:0;padding:0;box-sizing:border-box;}}
        body{{font-family:"Inter",system-ui,sans-serif;background:#f8fafc;color:#1e293b;line-height:1.6;}}
        .header{{background:white;border-bottom:1px solid #e2e8f0;padding:1rem 0;position:sticky;top:0;z-index:100;box-shadow:0 1px 3px rgba(0,0,0,0.05);}}
        .header-inner{{max-width:1200px;margin:0 auto;padding:0 2rem;display:flex;justify-content:space-between;align-items:center;}}
        .phone{{color:#3d6b5a;text-decoration:none;font-weight:600;}}
        .breadcrumb{{max-width:1200px;margin:1.5rem auto 0;padding:0 2rem;font-size:0.8rem;color:#64748b;}}
        .breadcrumb a{{color:#3d6b5a;text-decoration:none;}}
        .breadcrumb a:hover{{text-decoration:underline;}}
        .hero{{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);color:white;padding:4rem 2rem;}}
        .hero-inner{{max-width:1200px;margin:0 auto;}}
        .hero h1{{font-size:2.5rem;font-weight:800;margin-bottom:0.75rem;letter-spacing:-0.02em;}}
        .hero p{{font-size:1rem;opacity:0.75;max-width:600px;}}
        .hero-meta{{margin-top:1rem;font-size:0.875rem;opacity:0.6;}}
        .content{{max-width:1200px;margin:2.5rem auto;padding:0 2rem;}}
        .section-label{{font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;margin-bottom:1.25rem;}}
        .states-grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:0.875rem;}}
        .state-card{{display:flex;align-items:center;gap:0.875rem;background:white;border:1px solid #e2e8f0;border-radius:10px;padding:1.125rem 1.25rem;text-decoration:none;color:inherit;transition:all 0.15s;}}
        .state-card:hover{{border-color:#3d6b5a;background:#f0fdf4;box-shadow:0 2px 12px rgba(61,107,90,0.1);}}
        .state-code{{font-size:0.75rem;font-weight:700;font-family:monospace;color:#94a3b8;background:#f1f5f9;padding:0.2rem 0.5rem;border-radius:4px;flex-shrink:0;}}
        .state-name{{font-weight:600;color:#0f172a;flex:1;}}
        .state-sub{{font-size:0.75rem;color:#64748b;display:block;margin-top:0.125rem;}}
        .state-arrow{{color:#3d6b5a;font-weight:700;margin-left:auto;flex-shrink:0;}}
        .footer{{background:#0f172a;color:#94a3b8;padding:2rem;text-align:center;font-size:0.875rem;margin-top:4rem;}}
        .back-link{{display:inline-flex;align-items:center;gap:0.4rem;color:#64748b;text-decoration:none;font-size:0.875rem;margin-bottom:1.5rem;}}
        .back-link:hover{{color:#0f172a;}}
        @media(max-width:640px){{.hero h1{{font-size:1.75rem;}}.states-grid{{grid-template-columns:1fr;}}}}
    </style>
</head>
<body>
    <header class="header">
        <div class="header-inner">
            {logo_html}
            <a href="tel:{phone_clean}" class="phone">{company_phone}</a>
        </div>
    </header>
    <div class="hero">
        <div class="hero-inner">
            <p style="font-size:0.8rem;opacity:0.5;margin-bottom:0.75rem;"><a href="{_LOC}" style="color:rgba(255,255,255,0.6);text-decoration:none;">Coverage Areas</a> → {product_name}</p>
            <h1>{product_name}</h1>
            <p>Select your state to view all available {product_name.lower()} locations, counties, and cities.</p>
            <p class="hero-meta">{len(pages)} state{"s" if len(pages) != 1 else ""} covered nationwide</p>
        </div>
    </div>
    <div class="content">
        <a href="{_LOC}" class="back-link">← All Coverage Areas</a>
        <div class="section-label">Select a State</div>
        <div class="states-grid" data-testid="states-grid">
            {state_cards}
        </div>
    </div>
    <footer class="footer">© {company_name} · All Rights Reserved</footer>
</body>
</html>'''
        return HTMLResponse(content=html, status_code=200)

    @router.get(_LOC + "/{product_slug}/{slug}", response_class=HTMLResponse, include_in_schema=False)
    async def public_location_detail(product_slug: str, slug: str, format: str = "html") -> HTMLResponse:
        """Individual location page"""
        # Primary lookup: by product_slug + slug
        doc = await db[coll("generated_pages")].find_one(
            {"product_slug": product_slug, "slug": slug}, {"_id": 0}
        )
        if not doc:
            # Fallback: legacy pages that were generated before product_slug was stored
            doc = await db[coll("generated_pages")].find_one(
                {"slug": slug}, {"_id": 0}
            )
        if not doc:
            raise HTTPException(status_code=404, detail="Page not found")

        # JSON format for React frontend
        if format == "json":
            gen = await db[coll("page_generators")].find_one(
                {"id": doc.get("generator_id")}, {"_id": 0, "password_hash": 0}
            )
            # Enrich with cross-links
            counties = await db[coll("generated_pages")].find(
                {"state_code": doc.get("state_code"), "level": "county",
                 "generator_id": doc.get("generator_id")},
                {"_id": 0, "slug": 1, "county": 1, "title": 1}
            ).sort("county", 1).to_list(200)
            cities = await db[coll("generated_pages")].find(
                {"state_code": doc.get("state_code"), "level": "city",
                 "generator_id": doc.get("generator_id")},
                {"_id": 0, "slug": 1, "city": 1, "title": 1}
            ).sort("city", 1).limit(200).to_list(200)
            from fastapi.responses import JSONResponse
            return JSONResponse({
                **{k: v for k, v in doc.items()},
                "generator_type": gen.get("type", "") if gen else "",
                "keywords": gen.get("keywords", []) if gen else [],
                "counties": counties,
                "cities": cities,
            })

        site = await _get_default_site_settings(db)
        
        # Fetch the generator that owns this page
        gen = await db[coll("page_generators")].find_one(
            {"id": doc.get("generator_id")}
        )
        if gen:
            gen.pop("_id", None)

        # ── Resolve cloned template (stable, product-scoped lookup) ──────
        # The page's owning generator may not have a cloned template (e.g. it
        # was generated by a different generator of the same product type, then
        # reassigned). Always find the best cloned template for this product.
        # Also guard against React shells (<15KB) saved from failed Playwright clones.
        MIN_CLONE_SIZE = 15_000

        def _is_valid_clone(ct) -> bool:
            if not ct or not isinstance(ct, dict):
                return False
            fph = ct.get("full_page_html") or ct.get("body_html") or ""
            return len(fph) >= MIN_CLONE_SIZE

        cloned_template = (gen or {}).get("cloned_template") if gen else None

        if not _is_valid_clone(cloned_template):
            # Fall back to any non-archived generator of the same product slug
            page_product_slug = doc.get("product_slug") or ""
            if page_product_slug:
                from services.slug_engine import slugify as _sf
                async for candidate in db[coll("page_generators")].find(
                    {"status": {"$ne": "archived"}, "cloned_template": {"$exists": True}},
                    {"_id": 0, "id": 1, "type": 1, "cloned_template": 1, "keywords": 1},
                ):
                    if _sf(candidate.get("type") or "") == page_product_slug:
                        ct = candidate.get("cloned_template")
                        if _is_valid_clone(ct):
                            cloned_template = ct
                            if gen is None:
                                gen = candidate
                            else:
                                gen = {**gen, "cloned_template": ct}
                            break

        # ── Render with cloned template if found and large enough ────────
        if _is_valid_clone(cloned_template):
            full_page_html = (cloned_template.get("full_page_html") or cloned_template.get("body_html") or "")
            if full_page_html:
                xlinks = await _resolve_xlinks(db, doc)
                # Fetch fresh catalog products so location pages never show stale products
                page_product_slug = doc.get("product_slug") or ""
                fresh_products = []
                if page_product_slug:
                    # Map product_slug back to category name for catalog lookup
                    _cat_map = {
                        "weight-loss-treatments": "weight-loss",
                        "weight-loss": "weight-loss",
                        "sexual-health": "sexual-health",
                        "hair-skin": "hair-skin",
                        "womens-health": "womens-health",
                        "mens-health": "mens-health",
                        "longevity": "longevity",
                        "longevity-nutrition": "longevity",
                    }
                    cat = _cat_map.get(page_product_slug, page_product_slug)
                    fresh_products = await db.catalog_products.find(
                        {"categories": cat, "is_active": True},
                        {"_id": 0}
                    ).sort("sort_order", 1).to_list(20)
                from services.template_renderer import render_cloned_page
                rendered = render_cloned_page(
                    full_page_html=full_page_html,
                    generator=gen or {},
                    location_ctx=doc,
                    site_settings=site,
                    xlinks=xlinks,
                    fresh_products=fresh_products,
                )
                return HTMLResponse(content=rendered, status_code=200)

        if doc.get("content"):
            # ── Category template fallback (no clone needed) ──────────────
            # Map product_slug → category for the built-in template system
            _CAT_MAP = {
                "weight-loss-treatments": "weight-loss",
                "weight-loss": "weight-loss",
                "sexual-health-treatments": "sexual-health",
                "sexual-health": "sexual-health",
                "hair-skin-treatments": "hair-skin",
                "hair-skin": "hair-skin",
                "womens-health-treatments": "womens-health",
                "womens-health": "womens-health",
                "mens-health-treatments": "mens-health",
                "mens-health": "mens-health",
                "longevity-treatments": "longevity",
                "longevity": "longevity",
                "longevity-nutrition": "longevity",
            }
            page_product_slug = doc.get("product_slug") or ""
            category_key = _CAT_MAP.get(page_product_slug)

            if category_key:
                from services.category_templates import CATEGORY_CONFIG, build_category_location_page
                if category_key in CATEGORY_CONFIG:
                    xlinks = await _resolve_xlinks(db, doc)
                    cat = _CAT_MAP.get(page_product_slug, page_product_slug)
                    fresh_products = await db.catalog_products.find(
                        {"categories": cat, "is_active": True}, {"_id": 0}
                    ).sort("sort_order", 1).to_list(20)

                    gen_type = (gen or {}).get("type") or page_product_slug.replace("-", " ").title()
                    location_label = (
                        doc.get("city") or
                        (f'{doc.get("county")} County' if doc.get("county") else None) or
                        doc.get("state_name") or ""
                    )

                    rendered = build_category_location_page(
                        category_slug=category_key,
                        product_label=gen_type,
                        product_slug=page_product_slug,
                        location_label=location_label,
                        level=doc.get("level") or "state",
                        site_settings=site,
                        fresh_products=fresh_products,
                        xlinks=xlinks,
                        page_doc=doc,
                    )
                    return HTMLResponse(content=rendered, status_code=200)

            # Starter template fallback
            doc["_xlinks"] = await _resolve_xlinks(db, doc)
            rendered = render_full_page(
                generator=gen,
                page=doc,
                site_settings=site,
                is_index=False,
            )
            return HTMLResponse(content=rendered, status_code=200)

        legacy = doc.get("html") or doc.get("legacy_html") or ""
        if not legacy:
            raise HTTPException(status_code=404, detail="Page has no renderable content")

        rendered = apply_live_overlay(
            legacy, site, generator=gen or {}, page=doc, is_index=False,
        )
        return HTMLResponse(content=rendered, status_code=200)

    return router
