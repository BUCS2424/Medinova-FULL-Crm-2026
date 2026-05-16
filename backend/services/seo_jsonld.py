"""SEO JSON-LD schema builders for generated location pages."""
from __future__ import annotations

from typing import Optional


def build_local_business(
    company_name_token: str,
    company_phone_token: str,
    company_address_token: str,
    canonical_url: str,
    location_name: str,
    state_abbr: str,
    address_locality: str,
    area_served_type: str = "State",
) -> dict:
    return {
        "@context": "https://schema.org",
        "@type": ["MedicalBusiness", "LocalBusiness"],
        "name": company_name_token,
        "telephone": company_phone_token,
        "address": {
            "@type": "PostalAddress",
            "addressLocality": address_locality or location_name,
            "addressRegion": state_abbr,
            "addressCountry": "US",
            "streetAddress": company_address_token,
        },
        "url": canonical_url,
        "areaServed": {
            "@type": area_served_type,
            "name": location_name,
        },
    }


def build_breadcrumb_list(crumbs: list[dict]) -> Optional[dict]:
    if not crumbs:
        return None
    items = []
    for i, c in enumerate(crumbs, 1):
        items.append({
            "@type": "ListItem",
            "position": i,
            "name": c.get("label") or "",
            "item": c.get("url") or "",
        })
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": items,
    }


def build_service(
    service_type: str,
    company_name_token: str,
    location_name: str,
    name: str,
    description: str,
) -> dict:
    return {
        "@context": "https://schema.org",
        "@type": "Service",
        "serviceType": service_type,
        "provider": {
            "@type": "Organization",
            "name": company_name_token,
        },
        "areaServed": location_name,
        "name": name,
        "description": description,
    }


def build_faq_page(faq_pairs: list[dict]) -> Optional[dict]:
    if not faq_pairs:
        return None
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": p.get("question") or "",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": p.get("answer") or "",
                },
            }
            for p in faq_pairs
            if p.get("question")
        ],
    }
