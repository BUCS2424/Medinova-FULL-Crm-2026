"""Slug pattern engine — Phase 4b: per-level (state / county / city) patterns.

Tokens (same set across all levels; per-level rules below):
  {state}        full state name, lowercased + hyphenated  ("texas")
  {state_abbr}   2-letter postal code, lowercased          ("tx")
  {city}         city name, lowercased + hyphenated
  {county}       county name, lowercased + hyphenated, no "county" suffix
  {product}      generator type, lowercased + hyphenated
  {keyword}      one keyword (one page per keyword × location)
  {keywords}     all keywords joined with "-and-"

Per-level validation:
  state pattern  → must contain {state} or {state_abbr}; cannot use {city}/{county}.
  county pattern → must contain {county} AND ({state} or {state_abbr}); cannot use {city}.
  city pattern   → must contain {city} AND ({state} or {state_abbr}).
"""
from __future__ import annotations

import re
from typing import Iterator, Optional

from . import locations_data

_STATE_TOKENS = {"{state}", "{state_abbr}"}
_LOCATION_TOKENS = {"{state}", "{state_abbr}", "{city}", "{county}"}
_ALL_TOKENS = _LOCATION_TOKENS | {"{product}", "{keyword}", "{keywords}"}
_TOKEN_REGEX = re.compile(r"\{[a-z_]+\}")

DEFAULT_PATTERNS = {
    "state": "{product}-{state}",
    "county": "{product}-{county}-county-{state}",
    "city": "{product}-{city}-{state}",
}


def slugify(value: str) -> str:
    if value is None:
        return ""
    s = str(value).lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-{2,}", "-", s)
    return s.strip("-")


def _strip_county_suffix(name: str) -> str:
    s = name.strip()
    for suffix in (" County", " Parish", " Borough", " Census Area"):
        if s.lower().endswith(suffix.lower()):
            return s[: -len(suffix)]
    return s


def validate_pattern_for_level(pattern: str, level: str, has_keywords: bool) -> tuple[bool, Optional[str]]:
    if not pattern or not isinstance(pattern, str):
        return False, "Pattern must be a non-empty string"
    if level not in {"state", "county", "city"}:
        return False, f"Unknown level: {level}"

    found = set(_TOKEN_REGEX.findall(pattern))
    unknown = found - _ALL_TOKENS
    if unknown:
        return False, f"Unknown token(s) in pattern: {', '.join(sorted(unknown))}"

    if "{keyword}" in found and not has_keywords:
        return False, "Pattern uses {keyword} but generator has no keywords"

    has_state_token = bool(found & _STATE_TOKENS)

    if level == "state":
        if "{city}" in found or "{county}" in found:
            return False, "State pattern cannot use {city} or {county}"
        if not has_state_token:
            return False, "State pattern must contain {state} or {state_abbr}"
    elif level == "county":
        if "{city}" in found:
            return False, "County pattern cannot use {city}"
        if "{county}" not in found:
            return False, "County pattern must contain {county}"
        if not has_state_token:
            return False, "County pattern must contain {state} or {state_abbr}"
    elif level == "city":
        if "{city}" not in found:
            return False, "City pattern must contain {city}"
        if not has_state_token:
            return False, "City pattern must contain {state} or {state_abbr}"

    return True, None


# Legacy single-pattern validator — retained for the migration path.
def validate_pattern(pattern: str, scope: str, has_keywords: bool) -> tuple[bool, Optional[str]]:
    return validate_pattern_for_level(pattern, scope, has_keywords)


def render_slug(pattern: str, ctx: dict) -> str:
    out = pattern
    for token, raw_val in [
        ("{state}", ctx.get("state")),
        ("{state_abbr}", ctx.get("state_abbr")),
        ("{city}", ctx.get("city")),
        ("{county}", ctx.get("county")),
        ("{product}", ctx.get("product")),
        ("{keyword}", ctx.get("keyword")),
        ("{keywords}", ctx.get("keywords")),
    ]:
        out = out.replace(token, "" if raw_val is None else str(raw_val))
    return slugify(out)


def _location_ctx_base(loc: dict, product: str, keywords_str: str) -> dict:
    county_clean = _strip_county_suffix(loc["county"]) if loc.get("county") else None
    return {
        "state": slugify(loc["state_name"]),
        "state_abbr": (loc["state_code"] or "").lower(),
        "state_name": loc["state_name"],
        "city": slugify(loc.get("city") or ""),
        "county": slugify(county_clean) if county_clean else "",
        "_county_clean": county_clean,
        "product": slugify(product),
        "keywords": keywords_str,
    }


def expand_for_level(
    generator: dict,
    level: str,
    state_codes: Optional[list[str]] = None,
) -> Iterator[dict]:
    """Yield page expansion entries for a single level.

    Each entry: slug, level, state_code, state_name, county, city, keyword, product,
    parent_slug (city → state's state-page slug if state level enabled, else state slug
    in canonical form for foreign-key joining; county → state's slug; state → None).
    """
    pattern = (
        generator.get(f"slug_pattern_{level}")
        or DEFAULT_PATTERNS[level]
    )
    keywords = list(generator.get("keywords") or [])
    product = generator.get("type") or ""
    codes = state_codes or generator.get("states_enabled") or locations_data.get_all_state_codes()

    use_keyword_token = "{keyword}" in pattern
    keywords_str = "-and-".join(slugify(k) for k in keywords) if keywords else ""

    if level == "state":
        loc_iter = locations_data.iter_state_only(codes)
    elif level == "county":
        loc_iter = locations_data.iter_counties(codes)
    else:
        loc_iter = locations_data.iter_locations("city", codes)

    seen_slugs: set[str] = set()

    # Pre-resolve county for each city using the city→county map (Phase 4c-1).
    # When a city's county is known, the page's parent_slug points to the
    # county-level slug, enabling true State > County > City breadcrumbs.
    for loc in loc_iter:
        # City→county enrichment
        if level == "city" and loc.get("city") and not loc.get("county"):
            mapped = locations_data.get_county_for_city(loc["state_code"], loc["city"])
            if mapped:
                loc = {**loc, "county": mapped}

        ctx = _location_ctx_base(loc, product, keywords_str)
        county_clean = ctx.pop("_county_clean", None)
        kw_iter = keywords if use_keyword_token else [None]
        for kw in kw_iter:
            ctx["keyword"] = slugify(kw) if kw else ""
            slug = render_slug(pattern, ctx)
            if not slug or slug in seen_slugs:
                continue
            seen_slugs.add(slug)

            # Parent slug resolution — Phase 4c-1 promotes city.parent to
            # county slug when the city→county map knows the county.
            parent_slug = None
            if level == "county":
                state_pattern = generator.get("slug_pattern_state") or DEFAULT_PATTERNS["state"]
                state_ctx = _location_ctx_base(
                    {"state_code": loc["state_code"], "state_name": loc["state_name"]},
                    product, keywords_str,
                )
                state_ctx["keyword"] = ""
                parent_slug = render_slug(state_pattern, state_ctx) or None
            elif level == "city":
                if county_clean:
                    county_pattern = generator.get("slug_pattern_county") or DEFAULT_PATTERNS["county"]
                    county_ctx = _location_ctx_base(
                        {
                            "state_code": loc["state_code"],
                            "state_name": loc["state_name"],
                            "county": county_clean,
                        },
                        product, keywords_str,
                    )
                    county_ctx["keyword"] = ""
                    parent_slug = render_slug(county_pattern, county_ctx) or None
                if not parent_slug:
                    state_pattern = generator.get("slug_pattern_state") or DEFAULT_PATTERNS["state"]
                    state_ctx = _location_ctx_base(
                        {"state_code": loc["state_code"], "state_name": loc["state_name"]},
                        product, keywords_str,
                    )
                    state_ctx["keyword"] = ""
                    parent_slug = render_slug(state_pattern, state_ctx) or None

            yield {
                "level": level,
                "slug": slug,
                "parent_slug": parent_slug,
                "state_code": loc["state_code"],
                "state_name": loc["state_name"],
                "county": county_clean,
                "city": loc.get("city"),
                "keyword": kw,
                "product": product,
            }


def expand_pages(generator: dict, state_codes: Optional[list[str]] = None) -> Iterator[dict]:
    """Phase 4b: walk all enabled levels for the generator."""
    levels_cfg = generator.get("levels") or {"state": True, "county": True, "city": True}
    for lv in ("state", "county", "city"):
        if levels_cfg.get(lv):
            yield from expand_for_level(generator, lv, state_codes)
