"""Content variation — deterministic per-slug content for location pages.

Provides:
  load_library()           -> content library dict
  build_token_ctx(...)     -> token context dict
  pick_variant(...)        -> picks a deterministic variant
  expand_tokens(...)       -> expands {tokens} in a template string
  render_section(...)      -> renders a named section
  build_faqs(...)          -> builds FAQ Q&A pairs
"""
from __future__ import annotations

import hashlib
from typing import Optional

# ── Simple content library ────────────────────────────────────────────────────

_INTRO_VARIANTS = [
    "{company} provides {keyword} services throughout {location_label}. Contact us to learn how we can help you locally.",
    "Looking for {keyword} in {location_label}? {company} is here to serve residents across {state_name}.",
    "{company} offers trusted {keyword} solutions to {location_label} and the surrounding {state_name} area.",
    "Residents of {location_label}, {state_name} can rely on {company} for quality {keyword} care.",
    "{company} brings professional {keyword} services directly to {location_label}, {state_name}.",
]

_CTA_HEADLINE_VARIANTS = [
    "Ready to get started in {location_label}?",
    "Serving {location_label} — get in touch today",
    "{keyword} services in {location_label}, {state_name}",
    "Connect with {company} in {location_label}",
    "Your local {keyword} provider in {location_label}",
]

_CTA_SUBLINE_VARIANTS = [
    "Call us or send a message — we respond within one business day.",
    "Our team covers {location_label} and surrounding areas in {state_name}.",
    "Reach out for a free consultation about {keyword} in {location_label}.",
    "Trusted by families in {state_name}. Contact us anytime.",
    "Available throughout {state_name} — {location_label} included.",
]

_SERVICES_LEAD_VARIANTS = [
    "We offer a full range of {keyword} services in {location_label}.",
    "{company} covers {location_label} with reliable {keyword} solutions.",
    "Our {keyword} specialists serve {location_label} and nearby {state_name} areas.",
]

_LOC_BLURB_STATE = [
    "{state_name} residents trust {company} for their {keyword} needs.",
    "Statewide coverage across {state_name} means {company} is always nearby.",
    "{company} proudly serves all corners of {state_name}.",
]

_LOC_BLURB_COUNTY = [
    "Families throughout {county} County rely on {company} for {keyword}.",
    "{company} covers {county} County with professional {keyword} services.",
    "Serving {county} County and neighboring communities in {state_name}.",
]

_LOC_BLURB_CITY = [
    "Residents of {city} can count on {company} for {keyword} support.",
    "{company} serves the {city} community with trusted {keyword} care.",
    "Local {keyword} services are available right here in {city}, {state_name}.",
]

_TRUST_VARIANTS = [
    "HIPAA-compliant. Locally operated.",
    "Licensed professionals. Serving your community.",
    "Trusted by healthcare providers across {state_name}.",
    "Committed to quality care in every {state_name} community.",
]

_CLOSING_VARIANTS = [
    "We look forward to serving you.",
    "Contact us today — no commitment required.",
    "Reach our team and get answers fast.",
]

_FAQ_TEMPLATES = [
    ("What {keyword} services are available in {location_label}?",
     "{company} offers comprehensive {keyword} services throughout {location_label}, {state_name}. Contact us for details specific to your area."),
    ("How quickly can I get {keyword} in {location_label}?",
     "Most requests in {location_label} are handled within one business day. Call {company} for current availability."),
    ("Is {company} licensed to provide {keyword} in {state_name}?",
     "Yes, {company} is fully licensed and compliant with {state_name} healthcare regulations for {keyword} services."),
    ("Do you accept insurance for {keyword} in {location_label}?",
     "{company} works with most major insurance plans. Contact us to verify your coverage for {keyword} in {state_name}."),
    ("What areas near {location_label} do you cover?",
     "In addition to {location_label}, {company} serves many communities throughout {state_name}. Reach out for a full service area list."),
    ("How do I get started with {keyword} services from {company}?",
     "Getting started is easy. Contact {company} by phone or message, and our team will walk you through next steps for {keyword} in {location_label}."),
]

_LIBRARY = {
    "intro": _INTRO_VARIANTS,
    "cta_headline": _CTA_HEADLINE_VARIANTS,
    "cta_subline": _CTA_SUBLINE_VARIANTS,
    "services_lead": _SERVICES_LEAD_VARIANTS,
    "location_blurb_state": _LOC_BLURB_STATE,
    "location_blurb_county": _LOC_BLURB_COUNTY,
    "location_blurb_city": _LOC_BLURB_CITY,
    "trust_paragraph": _TRUST_VARIANTS,
    "closing_paragraph": _CLOSING_VARIANTS,
    "faq": _FAQ_TEMPLATES,
}


def load_library() -> dict:
    return _LIBRARY


def _seed_int(slug: str, section: str) -> int:
    h = hashlib.md5(f"{slug}:{section}".encode()).hexdigest()
    return int(h[:8], 16)


def pick_variant(variants: list, slug: str, section: str = "") -> Optional[str]:
    if not variants:
        return None
    idx = _seed_int(slug, section) % len(variants)
    return variants[idx]


def build_token_ctx(
    keyword: str = "",
    product: str = "",
    state_name: str = "",
    state_abbr: str = "",
    city: Optional[str] = None,
    county: Optional[str] = None,
    location_label: str = "",
    state_facts: dict = None,
) -> dict:
    return {
        "keyword": keyword or product or "service",
        "product": product or keyword or "service",
        "company": "__SITE_COMPANY_NAME__",
        "state_name": state_name or "",
        "state_abbr": state_abbr or "",
        "city": city or "",
        "county": county or "",
        "location_label": location_label or city or county or state_name or "",
    }


def expand_tokens(template: str, token_ctx: dict) -> str:
    result = template
    for k, v in token_ctx.items():
        result = result.replace("{" + k + "}", str(v) if v else "")
    return result


def render_section(name: str, slug: str, token_ctx: dict, library: dict = None) -> Optional[str]:
    lib = library or _LIBRARY
    variants = lib.get(name)
    if not variants:
        return None
    template = pick_variant(variants, slug, name)
    if template is None:
        return None
    return expand_tokens(template, token_ctx)


def build_faqs(slug: str, token_ctx: dict, count: int = 5, library: dict = None) -> list[dict]:
    lib = library or _LIBRARY
    faq_templates = lib.get("faq", [])
    if not faq_templates:
        return []

    seed = _seed_int(slug, "faqs")
    chosen = []
    indices = list(range(len(faq_templates)))
    # Deterministic shuffle using seed
    for i in range(len(indices) - 1, 0, -1):
        j = (seed + i * 7) % (i + 1)
        indices[i], indices[j] = indices[j], indices[i]

    for idx in indices[:count]:
        q_template, a_template = faq_templates[idx]
        chosen.append({
            "question": expand_tokens(q_template, token_ctx),
            "answer": expand_tokens(a_template, token_ctx),
        })
    return chosen
