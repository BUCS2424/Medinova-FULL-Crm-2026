"""Phase 4c-2: sitemap.xml + robots.txt + paginated state-cities index.

Mounted on the FastAPI `app` (at root) and mirrored under `/api/public` so
platform ingress rules that route only `/api/*` to backend can still reach
them. Plain text / XML responses, public.

Sitemap notes:
  - Served at /sitemap.xml (root-level) AND /api/sitemap.xml
  - /api/sitemap.xml is the production-reliable path: Kubernetes ingress routes
    /api/* to FastAPI so Google can always reach it.
  - robots.txt Sitemap: directive always points to the /api/sitemap.xml URL
    so Google follows it regardless of React SPA catch-all rules.
  - All URLs in the sitemap use site_domain from site_settings (live domain,
    never dev/preview URLs).
"""
from __future__ import annotations

from datetime import datetime, timezone
from xml.sax.saxutils import escape as xml_escape

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse, PlainTextResponse, Response

from services.render_pipeline import render_full_page
from services.component_namespace import coll, get_namespace, get_public_prefix, loc_prefix, loc_api_prefix, sitemap_path, sitemap_root_path, robots_root_enabled, robots_snippet_path, api_ns_segment


_PRIORITY_BY_LEVEL = {"state": "0.8", "county": "0.6", "city": "0.5"}
_CHANGEFREQ = "weekly"
_PAGE_SIZE = 100


def _now_iso_date() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _iso_date(value) -> str:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, str) and value:
        return value[:10]
    return _now_iso_date()


async def _site_settings(db) -> dict:
    return await db[coll("site_settings")].find_one({"_id": "default"}) or {}


def build_seo_router(db) -> APIRouter:
    router = APIRouter()
    _LOC = loc_prefix()
    _SITEMAP = sitemap_path()
    _SITEMAP_ROOT = sitemap_root_path()
    _ROBOTS_ROOT_ON = robots_root_enabled()
    _ROBOTS_SNIPPET = robots_snippet_path()

    async def _build_sitemap_xml() -> Response:
        site = await _site_settings(db)
        # ALWAYS use live site_domain — never dev/preview URLs
        site_domain = (site.get("site_domain") or "").rstrip("/")

        # Active + draft generators (exclude archived)
        active_gens = await db[coll("page_generators")].find(
            {"status": {"$ne": "archived"}}, {"_id": 0, "id": 1, "type": 1}
        ).to_list(length=10000)
        gen_ids = [g["id"] for g in active_gens]

        url_entries: list[str] = []
        today = _now_iso_date()

        def _entry(path: str, priority: str, lastmod: str = today, freq: str = _CHANGEFREQ) -> str:
            full = f"{site_domain}{path}" if site_domain else path
            return (
                "  <url>"
                f"<loc>{xml_escape(full)}</loc>"
                f"<lastmod>{xml_escape(lastmod)}</lastmod>"
                f"<changefreq>{freq}</changefreq>"
                f"<priority>{priority}</priority>"
                "</url>"
            )

        # ── Main coverage-areas index page ───────────────────────────────
        url_entries.append(_entry(f"{_LOC}", "1.0", freq="daily"))

        # ── Per-product topic landing pages ──────────────────────────────
        # Deduplicate by product_slug
        product_slugs_seen: set[str] = set()
        if gen_ids:
            async for pg in db[coll("generated_pages")].aggregate([
                {"$match": {"generator_id": {"$in": gen_ids}, "product_slug": {"$exists": True, "$ne": ""}}},
                {"$group": {"_id": "$product_slug", "lastmod": {"$max": "$updated_at"}}},
            ]):
                ps = pg.get("_id") or ""
                if ps and ps not in product_slugs_seen:
                    product_slugs_seen.add(ps)
                    url_entries.append(_entry(
                        f"{_LOC}/{ps}", "0.9",
                        lastmod=_iso_date(pg.get("lastmod")),
                        freq="daily",
                    ))

        if not gen_ids:
            xml = (
                '<?xml version="1.0" encoding="UTF-8"?>\n'
                '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                + "\n".join(url_entries)
                + "\n</urlset>\n"
            )
            return Response(content=xml, media_type="application/xml; charset=utf-8")

        # ── Individual location pages (state / county / city) ─────────────
        cursor = db[coll("generated_pages")].find(
            {"generator_id": {"$in": gen_ids}},
            {"_id": 0, "slug": 1, "product_slug": 1, "level": 1, "updated_at": 1},
        ).sort([("product_slug", 1), ("level", 1), ("slug", 1)])
        pages = await cursor.to_list(length=500000)

        for p in pages:
            slug = p.get("slug")
            product_slug = p.get("product_slug") or ""
            if not slug:
                continue
            # Build the correct public URL: /coverage-areas/{product_slug}/{slug}
            if product_slug:
                loc_path = f"{_LOC}/{product_slug}/{slug}"
            else:
                loc_path = f"{_LOC}/{slug}"
            lastmod = _iso_date(p.get("updated_at"))
            priority = _PRIORITY_BY_LEVEL.get(p.get("level") or "city", "0.5")
            url_entries.append(_entry(loc_path, priority, lastmod))

        xml = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            + "\n".join(url_entries)
            + "\n</urlset>\n"
        )
        return Response(content=xml, media_type="application/xml; charset=utf-8")

    # ── Sitemap routes ────────────────────────────────────────────────────
    # Serve at the component's canonical path (e.g. /coverage-areas-sitemap.xml)
    @router.get(_SITEMAP, include_in_schema=False)
    async def sitemap_xml() -> Response:
        return await _build_sitemap_xml()

    # Always serve at /sitemap.xml root (for direct navigation and SEO tools)
    if _SITEMAP_ROOT and _SITEMAP_ROOT != _SITEMAP:
        @router.get(_SITEMAP_ROOT, include_in_schema=False)
        async def sitemap_xml_root() -> Response:
            return await _build_sitemap_xml()
    else:
        # Namespace=v2 or non-default prefix: still expose /sitemap.xml
        @router.get("/sitemap.xml", include_in_schema=False)
        async def sitemap_xml_root_always() -> Response:
            return await _build_sitemap_xml()

    # ── robots.txt ────────────────────────────────────────────────────────
    async def _build_robots(site_domain: str) -> str:
        # Always use /api/sitemap.xml — this is the production-reliable path
        # since Kubernetes routes /api/* to FastAPI (bypasses React SPA).
        if site_domain:
            sitemap_url = f"{site_domain}/api/sitemap.xml"
        else:
            sitemap_url = "/api/sitemap.xml"
        return (
            "User-agent: *\n"
            "Allow: /\n"
            f"\nSitemap: {sitemap_url}\n"
        )

    if _ROBOTS_ROOT_ON:
        @router.get("/robots.txt", include_in_schema=False)
        async def robots_txt() -> PlainTextResponse:
            site = await _site_settings(db)
            site_domain = (site.get("site_domain") or "").rstrip("/")
            return PlainTextResponse(await _build_robots(site_domain))
    else:
        # Namespace=v2: still serve /robots.txt
        @router.get("/robots.txt", include_in_schema=False)
        async def robots_txt_always() -> PlainTextResponse:
            site = await _site_settings(db)
            site_domain = (site.get("site_domain") or "").rstrip("/")
            return PlainTextResponse(await _build_robots(site_domain))

    @router.get(_ROBOTS_SNIPPET, include_in_schema=False)
    async def robots_snippet() -> PlainTextResponse:
        site = await _site_settings(db)
        site_domain = (site.get("site_domain") or "").rstrip("/")
        sitemap_url = f"{site_domain}/api/sitemap.xml" if site_domain else "https://YOUR-DOMAIN/api/sitemap.xml"
        body = (
            "# Append these lines to your root /robots.txt:\n"
            f"\nSitemap: {sitemap_url}\n"
        )
        return PlainTextResponse(body)

    @router.get(
        _LOC + "/{state_slug}/cities",
        response_class=HTMLResponse,
        include_in_schema=False,
    )
    async def state_cities_page(
        state_slug: str,
        page: int = Query(1, ge=1, le=10000),
    ) -> HTMLResponse:
        # Load the state page to pick up the generator + state info.
        state_doc = await db[coll("generated_pages")].find_one(
            {"slug": state_slug, "level": "state"}, {"_id": 0}
        )
        if not state_doc:
            raise HTTPException(status_code=404, detail="State page not found")

        gen = await db[coll("page_generators")].find_one(
            {"id": state_doc.get("generator_id")}, {"_id": 0}
        )

        # Order by population if state_facts available, else alphabetical.
        from services.state_facts import get_state_facts
        facts = get_state_facts(state_doc.get("state_code") or "") or {}
        biggest_order = {c.lower(): i for i, c in enumerate(facts.get("biggest_cities") or [])}

        cities = await db[coll("generated_pages")].find(
            {
                "generator_id": state_doc.get("generator_id"),
                "level": "city",
                "state_code": state_doc.get("state_code"),
            },
            {"_id": 0, "slug": 1, "city": 1},
        ).to_list(length=200000)

        def _sort_key(c):
            return (biggest_order.get((c.get("city") or "").lower(), 9999), c.get("city") or c["slug"])

        cities.sort(key=_sort_key)

        total = len(cities)
        max_page = max(1, (total + _PAGE_SIZE - 1) // _PAGE_SIZE)
        if page > max_page:
            raise HTTPException(status_code=404, detail="Page out of range")
        offset = (page - 1) * _PAGE_SIZE
        page_cities = cities[offset : offset + _PAGE_SIZE]

        items = [
            {"slug": c["slug"], "title": c.get("city") or c["slug"], "subtitle": "City", "level": "city"}
            for c in page_cities
        ]

        nav_links = []
        if page > 1:
            nav_links.append(
                f'<a class="px-3 py-1 rounded border host-border hover:bg-host-foreground/10 text-sm" '
                f'href="{_LOC}/{state_slug}/cities?page={page - 1}">← Prev</a>'
            )
        nav_links.append(
            f'<span class="text-xs opacity-60 mx-3">Page {page} / {max_page}</span>'
        )
        if page < max_page:
            nav_links.append(
                f'<a class="px-3 py-1 rounded border host-border hover:bg-host-foreground/10 text-sm" '
                f'href="{_LOC}/{state_slug}/cities?page={page + 1}">Next →</a>'
            )
        pagination_html = (
            f'<div class="flex items-center justify-center mt-8 mb-2">{"".join(nav_links)}</div>'
            if max_page > 1 else ""
        )

        state_name = state_doc.get("state_name") or state_slug
        gen_type = (gen or {}).get("type") or ""
        synthetic_page = {
            "slug": f"{state_slug}/cities/page/{page}",
            "level": "state",
            "state_code": state_doc.get("state_code"),
            "state_name": state_name,
            "content": {
                "title": f"All cities in {state_name} for {gen_type} | Page {page}",
                "meta_description": f"Browse all cities in {state_name} where {gen_type} is available.",
                "h1": f"All cities in {state_name}",
                "intro_paragraph": f"Showing {len(page_cities)} of {total} cities.",
                "modules": [
                    {
                        "type": "hero",
                        "data": {
                            "eyebrow": gen_type.title() if gen_type else "Cities",
                            "h1": f"All cities in {state_name}",
                            "intro": f"Showing {len(page_cities)} of {total} cities. Page {page} of {max_page}.",
                            "keywords": [],
                        },
                    },
                    {
                        "type": "index_listing",
                        "data": {"sections": [{"name": gen_type.title(), "subtitle": f"{total} cities", "items": items}]},
                    },
                ],
                "schema_data": {
                    "level": "state",
                    "state": state_name,
                    "state_abbr": (state_doc.get("state_code") or "").upper(),
                    "city": "",
                    "county": "",
                    "location_label": state_name,
                },
            },
            "_xlinks": {"breadcrumbs": None, "down": None, "siblings": None},
        }

        site = await _site_settings(db)
        rendered = render_full_page(generator=gen, page=synthetic_page, site_settings=site, is_index=False)
        # Inject pagination nav before </body>
        if pagination_html:
            rendered = rendered.replace("</body>", pagination_html + "</body>", 1)
        return HTMLResponse(content=rendered, status_code=200)

    return router
