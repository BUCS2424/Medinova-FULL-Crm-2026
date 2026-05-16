"""Phase 7-lite v1.1.1: install-time namespace + public-prefix support.

Two independent install-time settings:

  Internal namespace (collections + admin + admin API):
    /app/backend/data/.location-generator-namespace        (one line; "" or slug)
    Empty/missing -> default behavior, no namespace.
    Affects: Mongo collection prefix, /api/{ns}/page-generators, /api/{ns}/component,
             /api/{ns}/public/, /dev/page-generator-{ns}, /admin/site-settings-{ns},
             /admin/component-updates-{ns}.

  Public URL prefix (SEO-facing, decoupled from namespace):
    /app/backend/data/.location-generator-public-prefix    (one line; slug)
    Empty/missing -> "locations" (default; preserves v1.1.0 default install behavior).
    Affects: /{public_prefix}, /{public_prefix}/{slug},
             /{public_prefix}/{state}/cities, /{public_prefix}-sitemap.xml,
             rendered hrefs in cross-links / breadcrumbs / canonical / og:url / JSON-LD.

Helpers:
    get_namespace()        -> "" | slug
    get_public_prefix()    -> slug (defaults to "locations")
    coll(name)             -> namespace-prefixed collection name
    loc_prefix()           -> "/{public_prefix}"  (NO LONGER tied to namespace)
    loc_api_prefix()       -> "/api/public/{public_prefix}"
    loc_path(slug)         -> "/{public_prefix}/{slug}"
    sitemap_path()         -> "/{public_prefix}-sitemap.xml"
    sitemap_root_path()    -> "/sitemap.xml" if (default ns AND public_prefix=='locations') else None
                              (preserves the v1.1.0 default-install behavior of also serving /sitemap.xml)
    robots_root_enabled()  -> True only in the same default+default case
    robots_snippet_path()  -> "/{public_prefix}-robots-snippet.txt"  (always served by us)
    api_ns_segment()       -> "" | "/{ns}"
"""
from __future__ import annotations

import re
from pathlib import Path

_NS_FILE = Path("/app/backend/data/.location-generator-namespace")
_PP_FILE = Path("/app/backend/data/.location-generator-public-prefix")

_NS_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,30}[a-z0-9]?$")
_PP_RE = re.compile(r"^[a-z][a-z0-9-]{1,40}$")

_DEFAULT_PUBLIC_PREFIX = "locations"

_ns_cached: str | None = None
_pp_cached: str | None = None


def _load_ns() -> str:
    try:
        raw = _NS_FILE.read_text().strip().lower()
    except FileNotFoundError:
        return ""
    except Exception:
        return ""
    if not raw:
        return ""
    return raw if _NS_RE.match(raw) else ""


def _load_pp() -> str:
    try:
        raw = _PP_FILE.read_text().strip().lower()
    except FileNotFoundError:
        return _DEFAULT_PUBLIC_PREFIX
    except Exception:
        return _DEFAULT_PUBLIC_PREFIX
    if not raw:
        return _DEFAULT_PUBLIC_PREFIX
    if not _PP_RE.match(raw):
        # Invalid value at install time — fail loudly so the operator sees it
        # rather than silently routing pages under an unintended slug.
        raise ValueError(
            f"Invalid public_prefix in {_PP_FILE}: {raw!r}. "
            f"Must match {_PP_RE.pattern}"
        )
    return raw


def get_namespace() -> str:
    global _ns_cached
    if _ns_cached is None:
        _ns_cached = _load_ns()
    return _ns_cached


def get_public_prefix() -> str:
    global _pp_cached
    if _pp_cached is None:
        _pp_cached = _load_pp()
    return _pp_cached


def clear_cache() -> None:
    global _ns_cached, _pp_cached
    _ns_cached = None
    _pp_cached = None


def coll(name: str) -> str:
    ns = get_namespace()
    return f"{ns}_{name}" if ns else name


def loc_prefix() -> str:
    """Public route prefix — driven by public_prefix, NOT namespace."""
    return f"/{get_public_prefix()}"


def loc_api_prefix() -> str:
    """API-mirrored public route prefix used by the admin View button."""
    return f"/api/public/{get_public_prefix()}"


def loc_path(slug: str) -> str:
    return f"{loc_prefix()}/{slug}"


def sitemap_path() -> str:
    """Sitemap path is always {public_prefix}-sitemap.xml (distinct from the
    host's own /sitemap.xml in side-by-side installs)."""
    return f"/{get_public_prefix()}-sitemap.xml"


def sitemap_root_path() -> str | None:
    """Return /sitemap.xml only when this install owns the default
    (no-namespace, default public_prefix) shape — preserves v1.1.0
    default-install behavior. Otherwise None (host owns root sitemap)."""
    if get_namespace() == "" and get_public_prefix() == _DEFAULT_PUBLIC_PREFIX:
        return "/sitemap.xml"
    return None


def robots_root_enabled() -> bool:
    """True only in the default+default install. Side-by-side installs MUST
    leave the host's existing /robots.txt alone."""
    return get_namespace() == "" and get_public_prefix() == _DEFAULT_PUBLIC_PREFIX


def robots_snippet_path() -> str:
    """Always-served snippet endpoint that returns the lines an operator
    should append to the host's existing root /robots.txt."""
    return f"/{get_public_prefix()}-robots-snippet.txt"


def api_ns_segment() -> str:
    ns = get_namespace()
    return f"/{ns}" if ns else ""
