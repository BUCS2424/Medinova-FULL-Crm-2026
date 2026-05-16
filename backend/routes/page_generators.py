"""Page generator + generated pages routes (Phase 2).

Exposes a `build_router(db, require_perm_dep, require_super_dep, get_user_dep)`
factory which returns a fully-wired APIRouter. All admin endpoints depend on
the `page_generator` permission. PATCH /site-settings additionally requires
the super_admin role.
"""
from __future__ import annotations

import csv
import io
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import Response
from pydantic import BaseModel, Field

from services import locations_data, slug_engine, template_renderer
from services.component_namespace import coll, get_namespace, loc_prefix, sitemap_path, api_ns_segment


# ---- Pydantic models ----

class GeneratorCreate(BaseModel):
    name: str
    type: str
    keywords: list[str] = Field(default_factory=list)
    # Phase 4b: per-level patterns + level toggles. Old single-pattern fields are
    # accepted by GeneratorPatch only for migration/backwards compat.
    slug_pattern_state: Optional[str] = None
    slug_pattern_county: Optional[str] = None
    slug_pattern_city: Optional[str] = None
    levels: Optional[dict] = None  # {"state":bool, "county":bool, "city":bool}
    states_enabled: Optional[list[str]] = None
    get_started_url: Optional[str] = None
    clone_source_url: Optional[str] = None
    use_ai_content: Optional[bool] = False  # Enable AI content generation


class GeneratorPatch(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    keywords: Optional[list[str]] = None
    slug_pattern_state: Optional[str] = None
    slug_pattern_county: Optional[str] = None
    slug_pattern_city: Optional[str] = None
    levels: Optional[dict] = None
    states_enabled: Optional[list[str]] = None
    template_html: Optional[str] = None
    status: Optional[str] = None
    get_started_url: Optional[str] = None
    clone_source_url: Optional[str] = None
    use_ai_content: Optional[bool] = None  # Enable AI content generation


class PreviewRequest(BaseModel):
    limit: int = 10
    level: Optional[str] = None  # state | county | city; None → first enabled level


class BulkGenerateRequest(BaseModel):
    state_codes: Optional[list[str]] = None


class GeneratedPagePatch(BaseModel):
    title: Optional[str] = None
    meta_description: Optional[str] = None
    html: Optional[str] = None


class SiteSettingsPatch(BaseModel):
    company_name: Optional[str] = None
    company_phone: Optional[str] = None
    company_address: Optional[str] = None
    default_cta: Optional[str] = None
    theme_mode: Optional[str] = None  # "light" | "dark" | "auto"
    analytics_script: Optional[str] = None
    site_domain: Optional[str] = None
    og_image_url: Optional[str] = None
    twitter_handle: Optional[str] = None
    default_locale: Optional[str] = None
    logo_url: Optional[str] = None  # Overrides main app branding for location pages


VALID_THEME_MODES = {"light", "dark", "auto"}


# ---- Constants ----

ARCHIVED = "archived"
DRAFT = "draft"
ACTIVE = "active"
VALID_STATUSES = {DRAFT, ACTIVE, ARCHIVED}
VALID_SCOPES = {"state", "county", "city"}

CSV_COLUMNS = [
    "slug", "state_code", "state_name", "county", "city", "title", "meta_description",
]


# ---- Helpers (pure) ----

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _strip_mongo(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


VALID_LEVELS = {"state", "county", "city"}
DEFAULT_LEVELS = {"state": True, "county": True, "city": True}


def _normalize_levels(levels: Optional[dict]) -> dict:
    if not isinstance(levels, dict):
        return dict(DEFAULT_LEVELS)
    out = dict(DEFAULT_LEVELS)
    for k in VALID_LEVELS:
        if k in levels:
            out[k] = bool(levels[k])
    return out


def _ensure_status(status: str) -> None:
    if status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"status must be one of {sorted(VALID_STATUSES)}")


def _validate_level_pattern_or_raise(pattern: str, level: str, has_keywords: bool) -> None:
    ok, err = slug_engine.validate_pattern_for_level(pattern, level, has_keywords)
    if not ok:
        raise HTTPException(status_code=400, detail=f"[{level}] {err}")


def _migrate_generator_doc(doc: dict) -> dict:
    """Backfill Phase 4b fields on a legacy generator doc.

    Mutates and returns the doc; returns a side-channel set of keys that need
    to be written back to Mongo (caller may persist).
    """
    if not doc:
        return doc
    doc.setdefault("slug_pattern_state", slug_engine.DEFAULT_PATTERNS["state"])
    doc.setdefault("slug_pattern_county", slug_engine.DEFAULT_PATTERNS["county"])

    if not doc.get("slug_pattern_city"):
        legacy = doc.get("slug_pattern") or doc.get("legacy_slug_pattern") or ""
        if legacy and "{city}" in legacy:
            doc["slug_pattern_city"] = legacy
        else:
            doc["slug_pattern_city"] = slug_engine.DEFAULT_PATTERNS["city"]

    if "levels" not in doc or not isinstance(doc.get("levels"), dict):
        legacy = doc.get("slug_pattern") or ""
        legacy_scope = doc.get("scope") or ""
        if legacy and "{city}" in legacy or legacy_scope == "city":
            doc["levels"] = {"state": False, "county": False, "city": True}
        elif legacy_scope == "county":
            doc["levels"] = {"state": False, "county": True, "city": False}
        elif legacy_scope == "state":
            doc["levels"] = {"state": True, "county": False, "city": False}
        else:
            doc["levels"] = dict(DEFAULT_LEVELS)
    else:
        doc["levels"] = _normalize_levels(doc["levels"])

    # Stash legacy pattern for safety; don't drop slug_pattern key entirely.
    if doc.get("slug_pattern") and not doc.get("legacy_slug_pattern"):
        doc["legacy_slug_pattern"] = doc["slug_pattern"]
    return doc


def build_router(db, require_perm_dep, require_super_dep, get_user_dep) -> APIRouter:
    router = APIRouter()

    perm_dep = Depends(require_perm_dep)
    super_dep = Depends(require_super_dep)
    user_dep = Depends(get_user_dep)

    # ---- DB-backed helpers (closures over `db`) ----
    async def _get_site_settings() -> dict:
        doc = await db[coll("site_settings")].find_one({"_id": "default"})
        default_analytics = (
            '<script data-host="https://a2ganalytics.com" data-dnt="false" '
            'src="https://a2ganalytics.com/js/script.js" id="ZwSg9rf6GA" async defer></script>'
        )
        if not doc:
            seed = {
                "_id": "default",
                "company_name": "MEDVera",
                "company_phone": "(844) 438-4571",
                "company_address": "",
                "default_cta": "Get Started",
                "theme_mode": "auto",
                "analytics_script": default_analytics,
                "site_domain": "https://medvera.io",
            }
            await db[coll("site_settings")].insert_one(seed)
            doc = seed
        # Backfill missing fields for pre-existing seeds
        backfill = {}
        if "theme_mode" not in doc:
            backfill["theme_mode"] = "auto"
        if "analytics_script" not in doc:
            backfill["analytics_script"] = default_analytics
        if "site_domain" not in doc:
            backfill["site_domain"] = None
        if "og_image_url" not in doc:
            backfill["og_image_url"] = None
        if "twitter_handle" not in doc:
            backfill["twitter_handle"] = None
        if "default_locale" not in doc:
            backfill["default_locale"] = "en_US"
        # Ensure default_cta is always "Get Started" (fix legacy "Get a quote")
        if not doc.get("default_cta") or doc.get("default_cta") in ("Get a quote", "Get Quote", "Get quote"):
            backfill["default_cta"] = "Get Started"
        if backfill:
            await db[coll("site_settings")].update_one({"_id": "default"}, {"$set": backfill})
            doc.update(backfill)

        # Inherit logo from main app branding if not set in v2_site_settings
        if not doc.get("logo_url"):
            main = await db["site_settings"].find_one({"type": "site"}, {"_id": 0})
            if main:
                logo = main.get("logo_url") or main.get("dashboard_logo_url")
                if logo:
                    doc["logo_url"] = logo

        return doc

    async def _load_generator(gen_id: str) -> dict:
        doc = await db[coll("page_generators")].find_one({"id": gen_id}, {"_id": 0})
        if not doc:
            raise HTTPException(status_code=404, detail="Generator not found")
        # Phase 4b: migrate legacy (slug_pattern / scope) → per-level patterns.
        before = (
            doc.get("slug_pattern_state"),
            doc.get("slug_pattern_county"),
            doc.get("slug_pattern_city"),
            doc.get("levels"),
            doc.get("legacy_slug_pattern"),
        )
        _migrate_generator_doc(doc)
        after = (
            doc.get("slug_pattern_state"),
            doc.get("slug_pattern_county"),
            doc.get("slug_pattern_city"),
            doc.get("levels"),
            doc.get("legacy_slug_pattern"),
        )
        if before != after:
            await db[coll("page_generators")].update_one(
                {"id": gen_id},
                {"$set": {
                    "slug_pattern_state": doc["slug_pattern_state"],
                    "slug_pattern_county": doc["slug_pattern_county"],
                    "slug_pattern_city": doc["slug_pattern_city"],
                    "levels": doc["levels"],
                    "legacy_slug_pattern": doc.get("legacy_slug_pattern"),
                }},
            )
        return doc

    # ---- Site settings ----

    @router.get("/site-settings", dependencies=[Depends(get_user_dep)])
    async def get_site_settings():
        return _strip_mongo(await _get_site_settings())

    @router.patch("/site-settings", dependencies=[super_dep])
    async def patch_site_settings(payload: SiteSettingsPatch):
        # exclude_unset preserves explicit nulls (e.g. clearing analytics_script)
        updates = payload.model_dump(exclude_unset=True)
        if "theme_mode" in updates and updates["theme_mode"] not in VALID_THEME_MODES:
            raise HTTPException(
                status_code=400,
                detail=f"theme_mode must be one of {sorted(VALID_THEME_MODES)}",
            )
        if updates:
            await db[coll("site_settings")].update_one({"_id": "default"}, {"$set": updates}, upsert=True)
        return _strip_mongo(await _get_site_settings())
    
    @router.post("/site-settings/reset-branding", dependencies=[super_dep])
    async def reset_branding():
        """Reset site settings to MEDVera branding"""
        updates = {
            "company_name": "MEDVera",
            "company_phone": "(844) 438-4571",
            "site_domain": "https://medvera.io",
        }
        await db[coll("site_settings")].update_one(
            {"_id": "default"}, 
            {"$set": updates}, 
            upsert=True
        )
        return {"success": True, "message": "Branding reset to MEDVera"}

    # ---- Phase 3.5: locations metadata (any authed user) ----

    @router.get("/locations-meta", dependencies=[Depends(get_user_dep)])
    async def get_locations_meta():
        out = []
        for st in locations_data.get_states():
            out.append({
                "code": st["code"],
                "name": st["name"],
                "counties": len(st.get("counties") or []),
                "cities": len(st.get("cities") or []),
            })
        return {"items": out, "total": len(out)}

    # ---- Generators (Level 2) ----

    @router.post("/page-generators", dependencies=[perm_dep])
    async def create_generator(payload: GeneratorCreate, user: dict = user_dep):
        has_kw = bool(payload.keywords)
        levels = _normalize_levels(payload.levels)

        sp_state = payload.slug_pattern_state or slug_engine.DEFAULT_PATTERNS["state"]
        sp_county = payload.slug_pattern_county or slug_engine.DEFAULT_PATTERNS["county"]
        sp_city = payload.slug_pattern_city or slug_engine.DEFAULT_PATTERNS["city"]
        for lv, pat in (("state", sp_state), ("county", sp_county), ("city", sp_city)):
            if levels.get(lv):
                _validate_level_pattern_or_raise(pat, lv, has_kw)

        existing = await db[coll("page_generators")].find_one({"name": payload.name})
        if existing:
            raise HTTPException(status_code=409, detail="A generator with that name already exists")

        states_enabled = payload.states_enabled or locations_data.get_all_state_codes()
        states_enabled = [c.upper() for c in states_enabled]

        doc = {
            "id": str(uuid.uuid4()),
            "name": payload.name,
            "type": payload.type,
            "keywords": list(payload.keywords or []),
            "slug_pattern_state": sp_state,
            "slug_pattern_county": sp_county,
            "slug_pattern_city": sp_city,
            "levels": levels,
            "template_html": template_renderer.get_starter_template(),
            "states_enabled": states_enabled,
            "status": DRAFT,
            "get_started_url": (payload.get_started_url or None),
            "clone_source_url": (payload.clone_source_url or None),
            "cloned_template": None,
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
            "created_by": (user or {}).get("id"),
        }
        await db[coll("page_generators")].insert_one(doc)
        return _strip_mongo(doc)

    @router.get("/page-generators", dependencies=[perm_dep])
    async def list_generators(skip: int = 0, limit: int = 50):
        if limit > 200:
            limit = 200
        cursor = db[coll("page_generators")].find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
        items = await cursor.to_list(length=limit)
        total = await db[coll("page_generators")].count_documents({})
        return {"items": items, "total": total, "skip": skip, "limit": limit}

    @router.get("/page-generators/{gen_id}", dependencies=[perm_dep])
    async def get_generator(gen_id: str):
        return await _load_generator(gen_id)

    @router.patch("/page-generators/{gen_id}", dependencies=[perm_dep])
    async def patch_generator(gen_id: str, payload: GeneratorPatch):
        gen = await _load_generator(gen_id)
        raw = payload.model_dump(exclude_unset=True)
        updates: dict = {}
        for field in ("name", "type", "template_html", "get_started_url", "clone_source_url"):
            if field in raw:
                updates[field] = raw[field]
        if "keywords" in raw and raw["keywords"] is not None:
            updates["keywords"] = list(raw["keywords"])
        if "states_enabled" in raw and raw["states_enabled"] is not None:
            updates["states_enabled"] = [c.upper() for c in raw["states_enabled"]]
        if "status" in raw and raw["status"] is not None:
            _ensure_status(raw["status"])
            updates["status"] = raw["status"]

        # Phase 4b per-level patterns + levels
        for lv in ("state", "county", "city"):
            key = f"slug_pattern_{lv}"
            if key in raw and raw[key] is not None:
                updates[key] = raw[key]
        if "levels" in raw and raw["levels"] is not None:
            updates["levels"] = _normalize_levels(raw["levels"])

        new_levels = updates.get("levels", gen.get("levels") or DEFAULT_LEVELS)
        new_keywords = updates.get("keywords", gen.get("keywords") or [])
        for lv in ("state", "county", "city"):
            new_pattern = updates.get(f"slug_pattern_{lv}", gen.get(f"slug_pattern_{lv}"))
            if new_levels.get(lv) and new_pattern:
                _validate_level_pattern_or_raise(new_pattern, lv, bool(new_keywords))

        if updates:
            updates["updated_at"] = _now_iso()
            await db[coll("page_generators")].update_one({"id": gen_id}, {"$set": updates})
        return await _load_generator(gen_id)

    @router.delete("/page-generators/{gen_id}", dependencies=[perm_dep])
    async def delete_generator(gen_id: str, archive: bool = False):
        await _load_generator(gen_id)
        if archive:
            await db[coll("page_generators")].update_one(
                {"id": gen_id}, {"$set": {"status": ARCHIVED, "updated_at": _now_iso()}}
            )
            return {"archived": True, "id": gen_id}
        deleted_pages = await db[coll("generated_pages")].delete_many({"generator_id": gen_id})
        await db[coll("page_generators")].delete_one({"id": gen_id})
        return {"deleted": True, "id": gen_id, "deleted_pages": deleted_pages.deleted_count}

    # ---- Phase 3.5: stats + per-state operations ----

    @router.get("/page-generators/{gen_id}/stats", dependencies=[perm_dep])
    async def get_generator_stats(gen_id: str):
        gen = await _load_generator(gen_id)
        enabled = [c.upper() for c in (gen.get("states_enabled") or [])]

        counties_scoped = 0
        cities_scoped = 0
        for code in enabled:
            st = locations_data.get_state(code)
            if not st:
                continue
            counties_scoped += len(st.get("counties") or [])
            cities_scoped += len(st.get("cities") or [])

        pages_generated = await db[coll("generated_pages")].count_documents({"generator_id": gen_id})

        per_state = {code: 0 for code in enabled}
        cursor = db[coll("generated_pages")].aggregate([
            {"$match": {"generator_id": gen_id}},
            {"$group": {"_id": "$state_code", "count": {"$sum": 1}}},
        ])
        async for doc in cursor:
            code = (doc.get("_id") or "").upper()
            per_state[code] = doc.get("count", 0)

        # Phase 4b: counts per level
        pages_by_level = {"state": 0, "county": 0, "city": 0}
        cur_lv = db[coll("generated_pages")].aggregate([
            {"$match": {"generator_id": gen_id}},
            {"$group": {"_id": "$level", "count": {"$sum": 1}}},
        ])
        async for d in cur_lv:
            lv = d.get("_id") or "city"  # legacy docs have no level → treat as city
            if lv in pages_by_level:
                pages_by_level[lv] = d.get("count", 0)

        return {
            "states_scoped": len(enabled),
            "counties_scoped": counties_scoped,
            "cities_scoped": cities_scoped,
            "pages_generated": pages_generated,
            "pages_by_level": pages_by_level,
            "per_state": per_state,
            "levels": gen.get("levels") or DEFAULT_LEVELS,
        }

    @router.delete("/page-generators/{gen_id}/pages", dependencies=[perm_dep])
    async def delete_pages_by_state(gen_id: str, state_code: str):
        await _load_generator(gen_id)
        code = (state_code or "").upper()
        if not code:
            raise HTTPException(status_code=400, detail="state_code is required")
        result = await db[coll("generated_pages")].delete_many(
            {"generator_id": gen_id, "state_code": code}
        )
        return {"deleted": result.deleted_count, "state_code": code}

    # ---- Slug preview ----

    @router.post("/page-generators/{gen_id}/preview-slugs", dependencies=[perm_dep])
    async def preview_slugs(gen_id: str, payload: PreviewRequest):
        gen = await _load_generator(gen_id)
        out = []
        cap = max(1, min(payload.limit, 500))
        level = (payload.level or "").lower() or None
        if level and level not in VALID_LEVELS:
            raise HTTPException(status_code=400, detail=f"level must be one of {sorted(VALID_LEVELS)}")

        if level:
            iterator = slug_engine.expand_for_level(gen, level)
        else:
            iterator = slug_engine.expand_pages(gen)

        for entry in iterator:
            out.append({
                "slug": entry["slug"],
                "level": entry["level"],
                "state_code": entry["state_code"],
                "state_name": entry["state_name"],
                "county": entry["county"],
                "city": entry["city"],
                "keyword": entry["keyword"],
                "parent_slug": entry.get("parent_slug"),
            })
            if len(out) >= cap:
                break
        return {"items": out, "count": len(out), "level": level}

    # ---- Bulk generate (Level 3) ----

    @router.post("/page-generators/{gen_id}/bulk-generate", dependencies=[perm_dep])
    async def bulk_generate(gen_id: str, payload: BulkGenerateRequest):
        gen = await _load_generator(gen_id)
        site = await _get_site_settings()

        state_codes = (
            [c.upper() for c in payload.state_codes]
            if payload.state_codes
            else gen.get("states_enabled")
        )

        created = 0
        updated = 0
        skipped = 0
        total = 0
        by_level = {"state": 0, "county": 0, "city": 0}

        from services.slug_engine import slugify as _slugify
        product_slug = _slugify(gen.get("type") or "service")

        seen_in_batch: set[str] = set()
        for entry in slug_engine.expand_pages(gen, state_codes=state_codes):
            total += 1
            slug = entry["slug"]
            if slug in seen_in_batch:
                skipped += 1
                continue
            seen_in_batch.add(slug)

            location_ctx = {
                "state_name": entry["state_name"],
                "state_abbr": entry["state_code"],
                "county": entry["county"],
                "city": entry["city"],
                "keyword": entry["keyword"],
                "level": entry["level"],
                "slug": slug,
            }
            content = await template_renderer.build_content(gen, location_ctx, site)

            existing = await db[coll("generated_pages")].find_one(
                {"slug": slug}, {"_id": 0, "generator_id": 1, "product_slug": 1}
            )
            if existing and existing.get("generator_id") != gen_id:
                # Only skip if it belongs to a DIFFERENT product (different URL namespace).
                # Same product/type generators share the same slug space — allow takeover.
                if existing.get("product_slug") != product_slug:
                    skipped += 1
                    continue
            
            doc = {
                "generator_id": gen_id,
                "product_slug": product_slug,
                "slug": slug,
                "level": entry["level"],
                "parent_slug": entry.get("parent_slug"),
                "state_code": entry["state_code"],
                "state_name": entry["state_name"],
                "county": entry["county"],
                "city": entry["city"],
                "title": content["title"],
                "meta_description": content["meta_description"],
                "content": content,
                "html": "",
                "legacy_html": "",
                "updated_at": _now_iso(),
            }

            if existing:
                await db[coll("generated_pages")].update_one({"slug": slug}, {"$set": doc})
                updated += 1
            else:
                doc["id"] = str(uuid.uuid4())
                doc["created_at"] = _now_iso()
                await db[coll("generated_pages")].insert_one(doc)
                created += 1

            by_level[entry["level"]] = by_level.get(entry["level"], 0) + 1

        return {
            "created": created,
            "updated": updated,
            "skipped_collisions": skipped,
            "total": total,
            "by_level": by_level,
        }

    # Phase 4b legacy alias removed; old return shape is superseded.

    # ---- Generated pages (Level 3) listing/CRUD ----

    @router.get("/page-generators/{gen_id}/pages", dependencies=[perm_dep])
    async def list_pages(
        gen_id: str,
        state_code: Optional[str] = None,
        q: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ):
        await _load_generator(gen_id)
        if limit > 200:
            limit = 200
        query: dict = {"generator_id": gen_id}
        if state_code:
            query["state_code"] = state_code.upper()
        if q:
            query["$or"] = [
                {"slug": {"$regex": re.escape(q), "$options": "i"}},
                {"title": {"$regex": re.escape(q), "$options": "i"}},
            ]
        cursor = db[coll("generated_pages")].find(query, {"_id": 0, "html": 0}).sort("slug", 1).skip(skip).limit(limit)
        items = await cursor.to_list(length=limit)
        total = await db[coll("generated_pages")].count_documents(query)
        return {"items": items, "total": total, "skip": skip, "limit": limit}

    @router.get("/generated-pages/{page_id}", dependencies=[perm_dep])
    async def get_page(page_id: str):
        doc = await db[coll("generated_pages")].find_one({"id": page_id}, {"_id": 0})
        if not doc:
            raise HTTPException(status_code=404, detail="Page not found")
        return doc

    @router.patch("/generated-pages/{page_id}", dependencies=[perm_dep])
    async def patch_page(page_id: str, payload: GeneratedPagePatch):
        updates = {k: v for k, v in payload.model_dump().items() if v is not None}
        if not updates:
            doc = await db[coll("generated_pages")].find_one({"id": page_id}, {"_id": 0})
            if not doc:
                raise HTTPException(status_code=404, detail="Page not found")
            return doc
        updates["updated_at"] = _now_iso()
        res = await db[coll("generated_pages")].update_one({"id": page_id}, {"$set": updates})
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Page not found")
        return await db[coll("generated_pages")].find_one({"id": page_id}, {"_id": 0})

    @router.delete("/generated-pages/{page_id}", dependencies=[perm_dep])
    async def delete_page(page_id: str):
        res = await db[coll("generated_pages")].delete_one({"id": page_id})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Page not found")
        return {"deleted": True, "id": page_id}

    # ---- CSV export / import ----

    @router.post("/page-generators/{gen_id}/csv-export", dependencies=[perm_dep])
    async def csv_export(gen_id: str):
        await _load_generator(gen_id)
        cursor = db[coll("generated_pages")].find(
            {"generator_id": gen_id},
            {
                "_id": 0,
                "slug": 1,
                "state_code": 1,
                "state_name": 1,
                "county": 1,
                "city": 1,
                "title": 1,
                "meta_description": 1,
            },
        ).sort("slug", 1)
        rows = await cursor.to_list(length=100000)

        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=CSV_COLUMNS, extrasaction="ignore")
        writer.writeheader()
        for r in rows:
            writer.writerow({k: (r.get(k) or "") for k in CSV_COLUMNS})
        csv_data = buf.getvalue()

        filename = f"generator-{gen_id}-pages.csv"
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    @router.post("/page-generators/{gen_id}/csv-import", dependencies=[perm_dep])
    async def csv_import(gen_id: str, file: UploadFile = File(...)):
        gen = await _load_generator(gen_id)
        site = await _get_site_settings()

        raw = (await file.read()).decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(io.StringIO(raw))
        if not reader.fieldnames or "slug" not in reader.fieldnames:
            raise HTTPException(status_code=400, detail="CSV missing required 'slug' column")

        created = 0
        updated = 0
        skipped = 0
        total = 0

        for row in reader:
            total += 1
            slug = (row.get("slug") or "").strip()
            if not slug:
                skipped += 1
                continue

            existing = await db[coll("generated_pages")].find_one({"slug": slug}, {"_id": 0})
            if existing and existing.get("generator_id") != gen_id:
                skipped += 1
                continue

            location_ctx = {
                "state_name": row.get("state_name") or (existing or {}).get("state_name") or "",
                "county": row.get("county") or (existing or {}).get("county"),
                "city": row.get("city") or (existing or {}).get("city"),
                "keyword": None,
                "slug": slug,
            }
            provided_html = (row.get("html") or "").strip()
            title = (row.get("title") or "").strip() or (existing or {}).get("title") or slug
            meta = (row.get("meta_description") or "").strip() or (existing or {}).get("meta_description") or ""
            if provided_html:
                html = provided_html
            else:
                rendered = template_renderer.render_page(gen, location_ctx, site)
                html = rendered["html"]
                if not row.get("title"):
                    title = rendered["title"]
                if not row.get("meta_description"):
                    meta = rendered["meta_description"]

            doc = {
                "generator_id": gen_id,
                "slug": slug,
                "state_code": (row.get("state_code") or "").upper() or (existing or {}).get("state_code") or "",
                "state_name": location_ctx["state_name"],
                "county": location_ctx["county"],
                "city": location_ctx["city"],
                "title": title,
                "meta_description": meta,
                "html": html,
                "updated_at": _now_iso(),
            }
            if existing:
                await db[coll("generated_pages")].update_one({"slug": slug}, {"$set": doc})
                updated += 1
            else:
                doc["id"] = str(uuid.uuid4())
                doc["created_at"] = _now_iso()
                await db[coll("generated_pages")].insert_one(doc)
                created += 1

        return {"created": created, "updated": updated, "skipped": skipped, "total": total}

    @router.post("/page-generators/{gen_id}/refetch-template", dependencies=[perm_dep])
    async def refetch_template(gen_id: str, background_tasks: BackgroundTasks):
        """
        Start a background clone of the generator's source URL.
        Returns immediately — use GET /page-generators/{id}/clone-status to poll.
        """
        from services.template_cloner import clone_template_safe, CloneError

        gen = await _load_generator(gen_id)
        url = (gen.get("clone_source_url") or "").strip()
        if not url:
            raise HTTPException(status_code=400, detail="No clone source URL set")

        # Mark as cloning so the UI can show a spinner
        await db[coll("page_generators")].update_one(
            {"id": gen_id},
            {"$set": {"clone_status": "cloning", "updated_at": _now_iso()}},
        )

        async def _do_clone():
            try:
                cloned = await clone_template_safe(url)
                await db[coll("page_generators")].update_one(
                    {"id": gen_id},
                    {"$set": {
                        "cloned_template": cloned,
                        "clone_status": "done",
                        "clone_error": None,
                        "updated_at": _now_iso(),
                    }},
                )
            except Exception as e:
                await db[coll("page_generators")].update_one(
                    {"id": gen_id},
                    {"$set": {
                        "clone_status": "error",
                        "clone_error": str(e),
                        "updated_at": _now_iso(),
                    }},
                )

        background_tasks.add_task(_do_clone)
        return {"status": "cloning", "message": f"Cloning {url} in the background — check status in a few seconds."}

    @router.get("/page-generators/{gen_id}/clone-status", dependencies=[perm_dep])
    async def get_clone_status(gen_id: str):
        """Poll the clone status after starting a background clone."""
        gen = await _load_generator(gen_id)
        status = gen.get("clone_status", "idle")
        ct = gen.get("cloned_template")
        return {
            "status": status,
            "error": gen.get("clone_error"),
            "has_template": bool(ct and ct.get("full_page_html")),
            "size_bytes": ct.get("raw_size_bytes", 0) if ct else 0,
            "fetch_method": ct.get("fetch_method") if ct else None,
        }
    
    @router.get("/available-pages")
    async def get_available_pages():
        """Get list of all MEDVera pages available for cloning"""
        from services.page_catalog import MEDVERA_PAGES
        return {"pages": MEDVERA_PAGES}

    return router
