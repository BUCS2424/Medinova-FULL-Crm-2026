"""Phase 4a template cloner — fetch a host page and extract a reusable
header + footer + stylesheet shell.

Strategy:
1. Try Playwright (handles JS-rendered sites). If unavailable / fails to launch,
   fall back to httpx with a browser-like User-Agent.
2. Parse with BeautifulSoup, sanitize aggressively (strip <script>, on* handlers,
   <noscript>), absolutize URLs, extract <header> and <footer>.
3. Return a structured dict suitable for storing on
   page_generators.cloned_template.
"""
from __future__ import annotations

import asyncio
import re
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup, Tag


_PW_TIMEOUT_MS = 15000
_HTTP_TIMEOUT_S = 15.0
_MAX_BYTES = 5_000_000  # 5MB safety cap

_BROWSER_UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


class CloneError(Exception):
    """Raised when the source URL cannot be fetched or parsed."""


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _validate_url(url: str) -> None:
    if not url or not isinstance(url, str):
        raise CloneError("clone_source_url is empty")
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise CloneError("clone_source_url must start with http:// or https://")
    if not parsed.netloc:
        raise CloneError("clone_source_url has no host")


async def _fetch_with_playwright(url: str) -> Optional[tuple[str, str]]:
    """Run Playwright in an isolated subprocess — crashes/OOM don't kill FastAPI."""
    import os as _os, sys, tempfile, logging
    log = logging.getLogger(__name__)

    # Find chromium executable
    executable_path: Optional[str] = None
    _PW_CACHE = "/root/.cache/ms-playwright"
    if _os.path.isdir(_PW_CACHE):
        for root, _, files in _os.walk(_PW_CACHE):
            for f in files:
                if f in ("chrome", "chromium", "chromium-browser", "chrome-linux"):
                    executable_path = _os.path.join(root, f)
                    break
            if executable_path:
                break
    if not executable_path:
        for candidate in ("/usr/bin/chromium", "/usr/bin/chromium-browser",
                          "/usr/bin/google-chrome", "/root/bin/chromium"):
            if _os.path.isfile(candidate):
                executable_path = candidate
                break
    if not executable_path:
        return None

    script = f"""
import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            executable_path={repr(executable_path)},
            args=["--no-sandbox","--disable-dev-shm-usage","--disable-gpu",
                  "--single-process","--no-zygote"],
        )
        ctx = await browser.new_context(
            user_agent={repr(_BROWSER_UA)},
            viewport={{"width":1280,"height":900}},
        )
        page = await ctx.new_page()
        try:
            await page.goto({repr(url)}, wait_until="networkidle", timeout=25000)
        except Exception:
            try:
                await page.goto({repr(url)}, wait_until="domcontentloaded", timeout=20000)
            except Exception:
                pass
        for sel in ["h1","nav","header","main","section"]:
            try:
                await page.wait_for_selector(sel, timeout=4000)
                break
            except Exception:
                pass
        await page.wait_for_timeout(2000)
        html = await page.content()
        await browser.close()
        sys.stdout.buffer.write(html.encode("utf-8","replace"))
asyncio.run(main())
"""

    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(script)
        script_path = f.name

    try:
        proc = await asyncio.create_subprocess_exec(
            sys.executable, script_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=55)
        except asyncio.TimeoutError:
            try: proc.kill()
            except Exception: pass
            await proc.communicate()
            log.warning("template_cloner: subprocess timed out")
            return None

        if proc.returncode != 0:
            log.warning("template_cloner: subprocess failed rc=%d: %s",
                        proc.returncode, stderr.decode()[:300])
            return None

        html = stdout.decode("utf-8", errors="replace")
        if len(html) > 5000:
            return html, "playwright"
        return None
    except Exception as e:
        log.warning("template_cloner: subprocess error: %s", e)
        return None
    finally:
        try: _os.unlink(script_path)
        except Exception: pass


async def _fetch_with_httpx(url: str) -> tuple[str, str]:
    headers = {"User-Agent": _BROWSER_UA, "Accept": "text/html,*/*"}
    try:
        async with httpx.AsyncClient(
            follow_redirects=True, timeout=_HTTP_TIMEOUT_S, headers=headers
        ) as client:
            resp = await client.get(url)
    except httpx.HTTPError as e:
        raise CloneError(f"HTTP fetch failed: {e}")

    if resp.status_code >= 400:
        raise CloneError(f"HTTP fetch returned status {resp.status_code}")

    ctype = (resp.headers.get("content-type") or "").lower()
    if "html" not in ctype and "xml" not in ctype:
        raise CloneError(f"Source URL did not return HTML (content-type: {ctype or 'unknown'})")

    body = resp.text
    if len(body.encode("utf-8", errors="ignore")) > _MAX_BYTES:
        raise CloneError("Source page exceeds 5MB safety cap")
    return body, "http"


# ---- Sanitisation ----

_EVENT_HANDLER_RE = re.compile(r"^on[a-z]+$", re.IGNORECASE)


def _sanitize(soup: BeautifulSoup) -> None:
    # Remove <noscript> which can cause issues
    for tag in soup.find_all(["noscript"]):
        tag.decompose()
    
    # CRITICAL: Remove React's main.js bundle to prevent React from taking over
    # Keep other scripts (analytics, etc.) but remove the React SPA bundle
    for script in soup.find_all("script"):
        src = script.get("src", "")
        if isinstance(src, str) and ("main." in src and ".js" in src):
            script.decompose()

    # Strip on* event handler attributes everywhere
    for tag in soup.find_all(True):
        if not isinstance(tag, Tag):
            continue
        for attr in list(tag.attrs.keys()):
            if _EVENT_HANDLER_RE.match(attr):
                del tag.attrs[attr]
            # javascript: URLs in href/src
            elif attr in {"href", "src", "action"} and isinstance(tag.attrs[attr], str):
                if tag.attrs[attr].strip().lower().startswith("javascript:"):
                    del tag.attrs[attr]


def _absolutize(soup: BeautifulSoup, base_url: str) -> None:
    """Rewrite relative href/src/srcset to absolute URLs using base_url."""
    for tag in soup.find_all(True):
        if not isinstance(tag, Tag):
            continue
        for attr in ("href", "src"):
            v = tag.attrs.get(attr)
            if isinstance(v, str) and v and not v.startswith(("data:", "mailto:", "tel:", "#")):
                try:
                    tag.attrs[attr] = urljoin(base_url, v)
                except Exception:
                    pass
        ss = tag.attrs.get("srcset")
        if isinstance(ss, str) and ss:
            new_parts = []
            for part in ss.split(","):
                part = part.strip()
                if not part:
                    continue
                bits = part.split()
                if bits and not bits[0].startswith(("data:", "mailto:")):
                    try:
                        bits[0] = urljoin(base_url, bits[0])
                    except Exception:
                        pass
                new_parts.append(" ".join(bits))
            tag.attrs["srcset"] = ", ".join(new_parts)


def _extract_stylesheets(soup: BeautifulSoup) -> list[str]:
    out = []
    for link in soup.find_all("link"):
        rel = link.get("rel") or []
        if isinstance(rel, list):
            rel = " ".join(rel).lower()
        else:
            rel = str(rel).lower()
        if "stylesheet" in rel and link.get("href"):
            out.append(link["href"])
    return out


def _extract_shell(soup: BeautifulSoup) -> tuple[str, str, str, list[str]]:
    """Returns (header_html, footer_html, full_page_html, warnings).
    
    FULL CLONE MODE: Captures the entire page HTML for true cloning.
    The full_page_html contains everything - we'll inject location content later.
    """
    warnings: list[str] = []
    
    # For backwards compatibility, still extract header/footer
    header_tag = soup.find("header")
    if header_tag is None:
        nav = soup.find("nav")
        header_tag = nav

    footer_tag = soup.find("footer")

    header_html = str(header_tag) if header_tag else ""
    footer_html = str(footer_tag) if footer_tag else ""
    
    # NEW: Capture the COMPLETE page HTML
    # This is the actual clone - everything from the source page
    full_page_html = str(soup)
    
    warnings.append("Full page clone captured - all content preserved")

    return header_html, footer_html, full_page_html, warnings


# ---- Public API ----

async def clone_template(url: str, prefer_playwright: bool = True) -> dict:
    _validate_url(url)

    import os as _os
    fetch_warnings: list[str] = []
    html: Optional[str] = None
    fetch_method: Optional[str] = None

    # ── Internal shortcut for same-server pages ───────────────────────────────
    # When cloning a page on our own domain (e.g. medvera.io/weight-loss),
    # the external URL may fail because the server can't reach itself.
    # Instead, use localhost:3000 — the React dev server is always running locally
    # and Playwright can render it fully with JavaScript.
    parsed = urlparse(url)
    site_domain = _os.environ.get("SITE_URL", "https://medvera.io").rstrip("/")
    site_host = urlparse(site_domain).netloc  # e.g. "medvera.io"

    if prefer_playwright and parsed.netloc and site_host and site_host in parsed.netloc:
        internal_url = f"http://localhost:3000{parsed.path}"
        try:
            result = await _fetch_with_playwright(internal_url)
            if result is not None:
                raw_html, _ = result
                if len(raw_html.encode("utf-8", errors="ignore")) >= 15_000:
                    # Replace localhost:3000 references with the real domain
                    html = raw_html.replace("http://localhost:3000", site_domain) \
                                   .replace("//localhost:3000", f"//{site_host}")
                    fetch_method = "playwright-local"
                    fetch_warnings.append("Cloned from local React dev server (localhost:3000)")
        except Exception as e:
            fetch_warnings.append(f"Local clone failed ({e}), trying external URL")

    if html is None and prefer_playwright:
        try:
            result = await _fetch_with_playwright(url)
            if result is not None:
                html, fetch_method = result
        except CloneError as e:
            fetch_warnings.append(f"Playwright failed; trying HTTP fallback ({e})")

    if html is None:
        html, fetch_method = await _fetch_with_httpx(url)

    raw_size = len(html.encode("utf-8", errors="ignore"))

    MIN_VIABLE_SIZE = 15_000
    if raw_size < MIN_VIABLE_SIZE:
        raise CloneError(
            f"The page returned only {raw_size:,} bytes — this is a React app shell "
            f"with no rendered content (got via {fetch_method}). "
            f"Please try again or contact support if this persists."
        )

    soup = BeautifulSoup(html, "html.parser")
    _sanitize(soup)
    _absolutize(soup, url)

    stylesheets = _extract_stylesheets(soup)
    header_html, footer_html, full_page_html, w = _extract_shell(soup)
    fetch_warnings.extend(w)

    return {
        "fetched_at": _now_iso(),
        "source_url": url,
        "fetch_method": fetch_method or "http",
        "header_html": header_html,
        "footer_html": footer_html,
        "body_html": full_page_html,
        "full_page_html": full_page_html,
        "stylesheets": stylesheets,
        "raw_size_bytes": raw_size,
        "fetch_warnings": fetch_warnings,
    }


async def clone_template_safe(url: str) -> dict:
    """Wrapper that always raises CloneError (never bubbles up other exceptions)."""
    try:
        return await clone_template(url)
    except CloneError:
        raise
    except asyncio.CancelledError:
        raise
    except Exception as e:
        raise CloneError(f"Unexpected error while cloning: {e}")
