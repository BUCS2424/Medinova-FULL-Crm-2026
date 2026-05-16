"""Render overlay — applies live site settings to generated HTML pages.

Injects:
  - Google Analytics / GTM snippet if configured in site_settings
  - Canonical meta tag
  - CTA button href if get_started_url is set
"""
from __future__ import annotations

import re
from typing import Optional


def apply_live_overlay(
    html: str,
    site_settings: dict,
    generator: Optional[dict] = None,
    page: Optional[dict] = None,
    is_index: bool = False,
) -> str:
    if not html:
        return html

    # 1. Inject GA4 / GTM snippet
    ga_id = (site_settings or {}).get("google_analytics_id") or \
            (site_settings or {}).get("gtm_id")
    if ga_id and ga_id.strip() and "</head>" in html:
        if ga_id.startswith("GTM-"):
            snippet = (
                f'<script>(function(w,d,s,l,i){{w[l]=w[l]||[];w[l].push({{'
                f"'gtm.start':new Date().getTime(),event:'gtm.js'}});"
                f"var f=d.getElementsByTagName(s)[0],j=d.createElement(s),"
                f"dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src="
                f"'https://www.googletagmanager.com/gtm.js?id='+i+dl;"
                f"f.parentNode.insertBefore(j,f);}})(window,document,'script','dataLayer','{ga_id}');"
                f"</script>"
            )
        else:
            snippet = (
                f'<script async src="https://www.googletagmanager.com/gtag/js?id={ga_id}"></script>'
                f"<script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}"
                f"gtag('js',new Date());gtag('config','{ga_id}');</script>"
            )
        html = html.replace("</head>", snippet + "\n</head>", 1)

    # 2. Swap CTA / get-started links
    get_started_url = (generator or {}).get("get_started_url") or ""
    if get_started_url and get_started_url.strip():
        # Replace common placeholder hrefs
        html = re.sub(
            r'href="(__GET_STARTED_URL__|#get-started|#contact)"',
            f'href="{get_started_url}"',
            html,
        )

    return html
