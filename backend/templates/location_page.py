"""
Full location page template for on-demand generation.
MediNova Medical Supplies branded template with 100% unique content per location.
"""

import os
import hashlib
import random

# Production domain for absolute URLs
SITE_DOMAIN = os.environ.get("SITE_DOMAIN", "https://medinovadme.com")

def generate_full_location_page_html(
    loc_name: str,
    loc_type: str,
    state_name: str,
    state_slug: str,
    county_name: str = "",
    county_slug: str = "",
    county_count: int = 0,
    city_count: int = 0,
    counties: list = None,
    cities: list = None,
    sibling_cities: list = None,  # Other cities in same county for internal linking
    products_html: str = ""
) -> str:
    """Generate full HTML with 100% unique content tailored to each location."""
    
    def slugify(text):
        return text.lower().replace(' ', '-').replace("'", "").replace(".", "").replace(",", "")
    
    def get_seed(loc):
        """Generate consistent random seed from location name for reproducible variety."""
        return int(hashlib.md5(loc.encode()).hexdigest()[:8], 16)
    
    counties = counties or []
    cities = cities or []
    sibling_cities = sibling_cities or []
    
    # Seed random for consistent but varied content per location
    random.seed(get_seed(loc_name + state_name))
    
    # State abbreviation map
    state_abbr_map = {"alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE", "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS", "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD", "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS", "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV", "new-hampshire": "NH", "new-jersey": "NJ", "new-mexico": "NM", "new-york": "NY", "north-carolina": "NC", "north-dakota": "ND", "ohio": "OH", "oklahoma": "OK", "oregon": "OR", "pennsylvania": "PA", "rhode-island": "RI", "south-carolina": "SC", "south-dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT", "vermont": "VT", "virginia": "VA", "washington": "WA", "west-virginia": "WV", "wisconsin": "WI", "wyoming": "WY"}
    state_abbr = state_abbr_map.get(state_slug, state_slug.upper()[:2])
    
    loc_slug = slugify(loc_name)
    
    # ============================================
    # UNIQUE CONTENT VARIATIONS
    # ============================================
    
    # Title variations
    title_templates = [
        f"MediNova Medical Supplies | Medicare DME in {loc_name} - Free Delivery",
        f"Medical Equipment Delivered to {loc_name} | MediNova Medical Supplies",
        f"{loc_name} Medicare DME Supplier | MediNova Medical Supplies",
        f"MediNova Medical Supplies {loc_name} - Medicare-Covered Equipment",
        f"Free DME Delivery in {loc_name} | MediNova Medical Supplies"
    ]
    
    # Meta description variations
    meta_templates = [
        f"Get Medicare-covered medical equipment delivered to {loc_name}. Back braces, knee braces, wheelchairs & more. Free shipping. Call (248) 886-4-DME (4363).",
        f"MediNova Medical Supplies serves {loc_name} with free delivery of Medicare-covered braces, wheelchairs, and mobility aids. $0 out-of-pocket for most patients.",
        f"Need a back brace or wheelchair in {loc_name}? MediNova Medical Supplies delivers Medicare DME directly to your door. Call (248) 886-4-DME (4363) today.",
        f"Trusted Medicare DME supplier serving {loc_name}. We handle insurance, paperwork & delivery. Get started at (248) 886-4-DME (4363).",
        f"{loc_name} residents: Get Medicare-covered medical equipment delivered free. Back braces, knee braces & more from MediNova Medical Supplies."
    ]
    
    # Headline variations
    headline_templates = [
        f"Medical Equipment<br><span class='text-blue-400'>Delivered to {loc_name}</span>",
        f"Your {loc_name}<br><span class='text-blue-400'>DME Solution</span>",
        f"Medicare DME<br><span class='text-blue-400'>for {loc_name} Residents</span>",
        f"Quality Equipment<br><span class='text-blue-400'>Shipped to {loc_name}</span>",
        f"DME Made Simple<br><span class='text-blue-400'>in {loc_name}</span>"
    ]
    
    # Intro paragraph variations
    intro_templates = [
        f"MediNova Medical Supplies delivers Medicare-covered durable medical equipment directly to patients in {loc_name}. From back braces to wheelchairs, we make getting the equipment you need simple and hassle-free.",
        f"Residents of {loc_name} trust MediNova Medical Supplies for their medical equipment needs. We specialize in Medicare-covered braces, mobility aids, and more—delivered straight to your door at little to no cost.",
        f"Getting quality medical equipment in {loc_name} has never been easier. MediNova Medical Supplies handles everything from insurance verification to delivery, so you can focus on your health.",
        f"MediNova Medical Supplies proudly serves {loc_name} with fast, free delivery of Medicare-covered medical equipment. Our team handles all the paperwork while you receive quality braces, wheelchairs, and more.",
        f"If you're in {loc_name} and need medical equipment, MediNova Medical Supplies is here to help. We work with your doctor and insurance to get you the DME you need—delivered free."
    ]
    
    # CTA button variations
    cta_templates = [
        "Check My Eligibility",
        "See If I Qualify",
        "Get Started Free",
        "Check Eligibility Now",
        "Am I Eligible?"
    ]
    
    # About section variations
    about_templates = [
        f"MediNova Medical Supplies has helped thousands of Medicare beneficiaries across the country get the equipment they need. Our {loc_name} patients benefit from fast shipping, expert support, and $0 out-of-pocket costs on most orders.",
        f"We're proud to serve {loc_name} as a trusted Medicare DME supplier. Our dedicated team works directly with your physician and insurance company to ensure a smooth, hassle-free experience.",
        f"At MediNova Medical Supplies, we believe everyone deserves access to quality medical equipment. That's why we've made it our mission to serve {loc_name} with reliable delivery and personalized service.",
        f"Patients in {loc_name} choose MediNova Medical Supplies for our straightforward process and commitment to care. We handle the complexities of Medicare billing so you don't have to.",
        f"MediNova Medical Supplies combines nationwide reach with local attention. {loc_name} residents receive the same dedicated service that's made us a trusted name in durable medical equipment."
    ]
    
    # Select unique content based on location seed
    title = random.choice(title_templates)
    description = random.choice(meta_templates)
    headline = random.choice(headline_templates)
    intro_text = random.choice(intro_templates)
    cta_text = random.choice(cta_templates)
    about_text = random.choice(about_templates)
    page_url = f"{SITE_DOMAIN}/locations/durable-medical-equipment-in-{loc_slug}{'-' + state_slug if loc_type != 'state' else ''}.html"
    og_image_url = "https://customer-assets.emergentagent.com/job_7965af6d-d9f9-48a9-9447-d2e9a0ead878/artifacts/e812a763_durable-medical-equipment-wheelchair.jpg"
    
    # Breadcrumb and parent links
    if loc_type == "state":
        breadcrumb = ""
        parent_link = f"{SITE_DOMAIN}/locations/"
        region_name = loc_name
    elif loc_type == "county":
        breadcrumb = f'<a href="{SITE_DOMAIN}/locations/durable-medical-equipment-in-{state_slug}.html" class="hover:text-blue-400">{state_name}</a><span class="mx-2">/</span>'
        parent_link = f'{SITE_DOMAIN}/locations/durable-medical-equipment-in-{state_slug}.html'
        region_name = f"{loc_name}, {state_name}"
    else:  # city
        breadcrumb = f'<a href="{SITE_DOMAIN}/locations/durable-medical-equipment-in-{state_slug}.html" class="hover:text-blue-400">{state_name}</a><span class="mx-2">/</span>'
        if county_name:
            breadcrumb += f'<a href="{SITE_DOMAIN}/locations/durable-medical-equipment-in-{county_slug}.html" class="hover:text-blue-400">{county_name}</a><span class="mx-2">/</span>'
        parent_link = f'{SITE_DOMAIN}/locations/durable-medical-equipment-in-{county_slug if county_slug else state_slug}.html'
        region_name = f"{loc_name}, {state_name}"
    
    # ============================================
    # INTERNAL LINKING - Sibling Cities
    # ============================================
    sibling_links_html = ""
    if loc_type == "city" and sibling_cities:
        links = []
        for city in sibling_cities[:12]:  # Max 12 sibling links
            if city != loc_name:
                city_slug = slugify(city) + "-" + state_slug
                links.append(f'<a href="{SITE_DOMAIN}/locations/durable-medical-equipment-in-{city_slug}.html" class="text-blue-600 hover:text-blue-700 hover:underline">{city}</a>')
        
        if links:
            sibling_links_html = f'''<section class="py-12 bg-gray-50">
<div class="max-w-7xl mx-auto px-4">
<h2 class="text-xl font-bold text-navy-700 mb-4">Also Serving Nearby</h2>
<p class="text-gray-600 mb-4">MediNova Medical Supplies delivers to these communities in {county_name if county_name else state_name}:</p>
<div class="flex flex-wrap gap-3">
{" ".join(links)}
</div>
</div>
</section>'''
    
    # ============================================
    # COVERAGE AREA - Counties/Cities Grid
    # ============================================
    coverage_section = ""
    if loc_type == "state" and counties:
        cards = []
        for i, county in enumerate(counties[:24]):
            cty_slug = slugify(county) + "-" + state_slug
            sample_cities = cities[i*6:(i+1)*6] if cities else []
            city_links = "".join([f'<a href="{SITE_DOMAIN}/locations/durable-medical-equipment-in-{slugify(c)}-{state_slug}.html" class="text-sm text-gray-500 hover:text-blue-600">{c}</a>' for c in sample_cities[:4]])
            
            cards.append(f'''<a href="{SITE_DOMAIN}/locations/durable-medical-equipment-in-{cty_slug}.html" class="group block bg-white rounded-xl p-5 border border-gray-200 hover:border-lime-400 hover:shadow-md transition-all">
<div class="flex items-center justify-between mb-2">
<h3 class="font-semibold text-navy-700 group-hover:text-blue-600">{county}</h3>
<svg class="w-4 h-4 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
</div>
<div class="flex flex-wrap gap-x-3 gap-y-1">{city_links}</div>
</a>''')
        
        coverage_section = f'''<section class="py-16 bg-white">
<div class="max-w-7xl mx-auto px-4">
<div class="text-center mb-10">
<span class="inline-block px-4 py-1.5 bg-lime-100 text-blue-700 rounded-full text-sm font-medium mb-4">Service Area</span>
<h2 class="text-3xl font-bold text-navy-700 mb-3">Delivering Across {loc_name}</h2>
<p class="text-gray-600">Select your county for local delivery information.</p>
</div>
<div class="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
{"".join(cards)}
</div>
</div>
</section>'''
    
    elif loc_type == "county" and cities:
        # Show cities in this county with internal links
        city_cards = []
        for city in cities[:20]:
            city_slug = slugify(city) + "-" + state_slug
            city_cards.append(f'<a href="{SITE_DOMAIN}/locations/durable-medical-equipment-in-{city_slug}.html" class="bg-white rounded-lg p-4 border border-gray-200 hover:border-lime-400 hover:shadow-sm transition-all text-center"><span class="font-medium text-navy-700 hover:text-blue-600">{city}</span></a>')
        
        coverage_section = f'''<section class="py-16 bg-white">
<div class="max-w-7xl mx-auto px-4">
<div class="text-center mb-10">
<span class="inline-block px-4 py-1.5 bg-lime-100 text-blue-700 rounded-full text-sm font-medium mb-4">Local Delivery</span>
<h2 class="text-3xl font-bold text-navy-700 mb-3">Cities We Serve in {loc_name}</h2>
<p class="text-gray-600">Click your city for local information.</p>
</div>
<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
{"".join(city_cards)}
</div>
</div>
</section>'''
    
    # ============================================
    # PRODUCTS SECTION
    # ============================================
    default_products = '''<div class="grid md:grid-cols-3 gap-6">
<div class="bg-white rounded-xl p-6 border border-gray-200">
<h3 class="font-semibold text-navy-700 mb-2">Back Braces</h3>
<p class="text-gray-600 text-sm mb-4">Support for lower back pain, post-surgery recovery, and spinal conditions.</p>
<a href="tel:2488864363" class="text-blue-600 font-medium text-sm hover:underline">Check Eligibility</a>
</div>
<div class="bg-white rounded-xl p-6 border border-gray-200">
<h3 class="font-semibold text-navy-700 mb-2">Knee Braces</h3>
<p class="text-gray-600 text-sm mb-4">Stability and relief for arthritis, injuries, and post-operative care.</p>
<a href="tel:2488864363" class="text-blue-600 font-medium text-sm hover:underline">Check Eligibility</a>
</div>
<div class="bg-white rounded-xl p-6 border border-gray-200">
<h3 class="font-semibold text-navy-700 mb-2">Mobility Aids</h3>
<p class="text-gray-600 text-sm mb-4">Wheelchairs, walkers, and rollators for improved independence.</p>
<a href="tel:2488864363" class="text-blue-600 font-medium text-sm hover:underline">Check Eligibility</a>
</div>
</div>'''
    
    products_content = products_html if products_html else default_products
    
    products_section = f'''<section class="py-16 bg-gray-50">
<div class="max-w-7xl mx-auto px-4">
<div class="text-center mb-10">
<span class="inline-block px-4 py-1.5 bg-lime-100 text-blue-700 rounded-full text-sm font-medium mb-4">Equipment</span>
<h2 class="text-3xl font-bold text-navy-700 mb-3">Medicare-Covered DME</h2>
<p class="text-gray-600">Quality equipment delivered to {loc_name}.</p>
</div>
{products_content}
</div>
</section>'''

    # ============================================
    # BUILD FULL HTML
    # ============================================
    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#1e3a5f">
<title>{title}</title>
<meta name="description" content="{description}">
<meta name="author" content="MediNova Medical Supplies">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">

<!-- Open Graph / Facebook -->
<meta property="og:type" content="website">
<meta property="og:url" content="{page_url}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:image" content="{og_image_url}">
<meta property="og:image:alt" content="MediNova Medical Supplies serving {loc_name} with Medicare-covered medical equipment">
<meta property="og:site_name" content="MediNova Medical Supplies">
<meta property="og:locale" content="en_US">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:url" content="{page_url}">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{description}">
<meta name="twitter:image" content="{og_image_url}">
<meta name="twitter:image:alt" content="MediNova Medical Supplies serving {loc_name} with Medicare-covered medical equipment">
<meta name="twitter:site" content="@medinovadme">

<!-- SEO -->
<meta name="googlebot" content="index, follow">
<meta name="geo.region" content="US-{state_abbr}">
<meta name="geo.placename" content="{loc_name}">
<link rel="canonical" href="{page_url}">
<script data-host="https://a2ganalytics.com" data-dnt="false" src="https://a2ganalytics.com/js/script.js" id="ZwSg9rf6GA" async defer></script>

<!-- JSON-LD Structured Data -->
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "MedicalBusiness",
  "name": "MediNova Medical Supplies - {loc_name}",
  "description": "{description}",
  "url": "{page_url}",
  "telephone": "+1-248-886-4363",
  "email": "info@medinovadme.com",
  "address": {{
    "@type": "PostalAddress",
    "addressLocality": "{loc_name}",
    "addressRegion": "{state_abbr}",
    "addressCountry": "US"
  }},
  "areaServed": {{
    "@type": "State",
    "name": "{state_name}"
  }},
  "priceRange": "$0 - Covered by Medicare",
  "openingHours": "Mo-Th 09:30-17:30",
  "sameAs": [
    "https://www.facebook.com/medinovadme",
    "https://www.instagram.com/medinovadme"
  ],
  "hasOfferCatalog": {{
    "@type": "OfferCatalog",
    "name": "Durable Medical Equipment",
    "itemListElement": [
      {{
        "@type": "Offer",
        "itemOffered": {{
          "@type": "Product",
          "name": "Back Braces",
          "description": "Medicare-covered back support braces"
        }}
      }},
      {{
        "@type": "Offer",
        "itemOffered": {{
          "@type": "Product",
          "name": "Knee Braces",
          "description": "Medicare-covered knee support braces"
        }}
      }},
      {{
        "@type": "Offer",
        "itemOffered": {{
          "@type": "Product",
          "name": "Wheelchairs",
          "description": "Medicare-covered mobility wheelchairs"
        }}
      }}
    ]
  }}
}}
</script>

<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "{title}",
  "url": "{page_url}",
  "description": "{description}",
  "isPartOf": {{
    "@type": "WebSite",
    "name": "MediNova Medical Supplies",
    "url": "{SITE_DOMAIN}"
  }}
}}
</script>

<!-- BreadcrumbList Schema -->
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {{
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "{SITE_DOMAIN}/"
    }},
    {{
      "@type": "ListItem",
      "position": 2,
      "name": "Coverage Areas",
      "item": "{SITE_DOMAIN}/locations/"
    }},
    {{
      "@type": "ListItem",
      "position": 3,
      "name": "{state_name}",
      "item": "{SITE_DOMAIN}/locations/durable-medical-equipment-in-{state_slug}.html"
    }}{f',{{"@type": "ListItem", "position": 4, "name": "{loc_name}", "item": "{SITE_DOMAIN}/locations/durable-medical-equipment-in-{loc_slug}-{state_slug}.html"}}' if loc_type != 'state' else ''}
  ]
}}
</script>

<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config = {{
  theme: {{
    extend: {{
      colors: {{
        lime: {{ 50:'#f7fee7',100:'#ecfccb',200:'#d9f99d',300:'#bef264',400:'#a3e635',500:'#0055CC',600:'#65a30d',700:'#4d7c0f' }},
        navy: {{ 700:'#1e3a5f',800:'#172e4d',900:'#0f1f33' }}
      }}
    }}
  }}
}}
</script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{{font-family:'Inter',sans-serif}}
html{{scroll-behavior:smooth}}
.modal-overlay{{position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);z-index:100;display:flex;align-items:center;justify-content:center;opacity:0;visibility:hidden;transition:all 0.3s}}
.modal-overlay.active{{opacity:1;visibility:visible}}
.modal-content{{background:white;border-radius:1rem;max-width:480px;width:95%;max-height:90vh;overflow-y:auto;transform:scale(0.95);transition:transform 0.3s}}
.modal-overlay.active .modal-content{{transform:scale(1)}}
.step{{display:none}}.step.active{{display:block}}
.opt{{border:2px solid #e5e7eb;border-radius:0.75rem;padding:1rem;cursor:pointer;transition:all 0.2s}}
.opt:hover{{border-color:#0055CC;background:#f7fee7}}
.opt.sel{{border-color:#0055CC;background:#ecfccb}}
.mobile-drawer-overlay{{position:fixed;inset:0;background:rgba(15,23,42,0.5);opacity:0;visibility:hidden;transition:opacity 0.25s ease,visibility 0.25s ease;z-index:80}}
.mobile-drawer{{position:fixed;top:0;right:0;bottom:0;width:min(86vw,360px);background:rgba(255,255,255,0.98);backdrop-filter:blur(14px);border-left:1px solid rgba(226,232,240,0.9);box-shadow:-20px 0 50px rgba(15,23,42,0.18);transform:translateX(100%);transition:transform 0.25s ease;z-index:90;display:flex;flex-direction:column;padding:1.5rem;gap:1.5rem}}
body.mobile-drawer-open .mobile-drawer-overlay{{opacity:1;visibility:visible}}
body.mobile-drawer-open .mobile-drawer{{transform:translateX(0)}}
</style>
</head>
<body class="bg-white">

<!-- Top Bar -->
<div class="bg-navy-700 text-white py-2.5 px-4">
<div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between text-sm">
<div class="flex items-center gap-6">
<a href="tel:2488864363" class="flex items-center gap-2 hover:text-blue-400">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
<span class="font-medium">(248) 886-4-DME (4363)</span>
</a>
<span class="hidden md:flex items-center gap-2 text-gray-300">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>
<span>Serving {region_name}</span>
</span>
</div>
<a href="{SITE_DOMAIN}/" class="flex items-center gap-2 hover:text-blue-400">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
<span>Home</span>
</a>
</div>
</div>

<!-- Header -->
<header class="bg-white border-b border-gray-100 py-4 sticky top-0 z-50">
<div class="max-w-7xl mx-auto px-4 flex items-center justify-between">
<a href="{SITE_DOMAIN}/" class="flex items-center gap-2" data-brand-logo-link data-default-href="{SITE_DOMAIN}/">
<img data-brand-logo-image src="/images/medinova/logo.webp" alt="MediNova Medical Supplies logo" class="h-[60px] max-w-[200px] object-contain" />
</a>
<nav class="hidden md:flex items-center gap-4 text-sm">
{f'<span class="text-gray-500">{breadcrumb}<span class="text-navy-700 font-medium">{loc_name}</span></span>' if breadcrumb else ''}
<a href="#contact" class="bg-blue-500 hover:bg-lime-600 text-white px-5 py-2 rounded-lg font-semibold">Get Started</a>
</nav>
<button id="mobile-menu-btn" type="button" class="md:hidden p-2 rounded-xl text-navy-700 hover:bg-gray-100" aria-label="Open navigation menu" data-testid="location-mobile-menu-button"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg></button>
</div>
</header>

<div id="mobile-drawer-overlay" class="mobile-drawer-overlay md:hidden"></div>
<aside id="mobile-drawer" class="mobile-drawer md:hidden" aria-hidden="true" data-testid="location-mobile-drawer">
<div class="flex items-start justify-between gap-4">
<a href="{SITE_DOMAIN}/" class="flex items-center gap-2" data-brand-logo-link data-default-href="{SITE_DOMAIN}/" data-testid="location-mobile-menu-logo-link">
<img data-brand-logo-image src="/images/medinova/logo.webp" alt="MediNova Medical Supplies logo" class="h-[55px] max-w-[180px] object-contain" data-testid="location-mobile-menu-logo-image" />
</a>
<button id="mobile-menu-close" type="button" class="p-2 rounded-xl text-navy-700 hover:bg-gray-100" aria-label="Close navigation menu" data-testid="location-mobile-menu-close-button"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
</div>
<p class="text-sm text-gray-500">Serving {region_name} with Medicare-covered DME delivery and fast support.</p>
<nav class="flex flex-col gap-2" aria-label="Mobile navigation" data-testid="location-mobile-menu-nav">
<a href="{SITE_DOMAIN}/" class="flex items-center justify-between rounded-2xl bg-gray-100/80 px-4 py-3 font-medium text-navy-700 hover:bg-blue-50 hover:text-blue-700" data-testid="location-mobile-menu-link-home"><span>Home</span><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg></a>
<a href="{SITE_DOMAIN}/products" class="flex items-center justify-between rounded-2xl bg-gray-100/80 px-4 py-3 font-medium text-navy-700 hover:bg-blue-50 hover:text-blue-700" data-testid="location-mobile-menu-link-products"><span>Products</span><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg></a>
<a href="{SITE_DOMAIN}/locations" class="flex items-center justify-between rounded-2xl bg-gray-100/80 px-4 py-3 font-medium text-navy-700 hover:bg-blue-50 hover:text-blue-700" data-testid="location-mobile-menu-link-service-areas"><span>Coverage Areas</span><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg></a>
<a href="#contact" class="flex items-center justify-between rounded-2xl bg-gray-100/80 px-4 py-3 font-medium text-navy-700 hover:bg-blue-50 hover:text-blue-700" data-testid="location-mobile-menu-link-contact"><span>Contact</span><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg></a>
</nav>
<div class="mt-auto space-y-3 border-t border-gray-200 pt-6">
<a href="tel:2488864363" class="flex w-full items-center justify-center gap-2 rounded-2xl border border-gray-200 px-4 py-3 font-semibold text-navy-700 hover:bg-blue-50 hover:text-blue-700" data-testid="location-mobile-menu-call-button"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>(248) 886-4-DME (4363)</a>
<a href="#contact" class="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 px-4 py-3 font-semibold text-white hover:bg-lime-600" data-testid="location-mobile-menu-primary-cta">{cta_text}<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg></a>
</div>
</aside>

<!-- Hero -->
<section class="relative bg-gradient-to-br from-navy-700 via-navy-800 to-navy-900 py-16 md:py-20 overflow-hidden">
<div class="absolute inset-0 opacity-10">
<div class="absolute top-10 left-10 w-64 h-64 bg-lime-400 rounded-full blur-3xl"></div>
<div class="absolute bottom-10 right-10 w-80 h-80 bg-lime-300 rounded-full blur-3xl"></div>
</div>
<div class="max-w-7xl mx-auto px-4 relative">
<div class="max-w-3xl">
<div class="inline-flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 rounded-full text-blue-400 text-sm font-medium mb-6">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
Medicare Accredited
</div>
<h1 class="text-4xl md:text-5xl font-bold text-white leading-tight mb-6">{headline}</h1>
<p class="text-lg text-gray-300 mb-8 leading-relaxed">{intro_text}</p>
<div class="flex flex-col sm:flex-row gap-4 mb-8">
<button onclick="openModal()" class="group bg-blue-500 hover:bg-lime-400 text-white px-8 py-4 text-lg font-semibold rounded-xl flex items-center justify-center gap-2">
{cta_text}
<svg class="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
</button>
<a href="tel:2488864363" class="border-2 border-white/30 hover:border-white/50 text-white px-8 py-4 text-lg font-semibold rounded-xl flex items-center justify-center gap-2">
<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
(248) 886-4-DME (4363)
</a>
</div>
<div class="flex flex-wrap gap-6 text-white/80 text-sm">
<span class="flex items-center gap-2"><svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>Free Delivery</span>
<span class="flex items-center gap-2"><svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>$0 Out-of-Pocket</span>
<span class="flex items-center gap-2"><svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>We Handle Paperwork</span>
</div>
</div>
</div>
</section>

<!-- Benefits -->
<section class="py-16 bg-white">
<div class="max-w-7xl mx-auto px-4">
<div class="grid md:grid-cols-4 gap-6 text-center">
<div class="p-6">
<div class="w-12 h-12 bg-lime-100 rounded-xl flex items-center justify-center mx-auto mb-4">
<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
</div>
<h3 class="font-semibold text-navy-700 mb-1">Medicare Accepted</h3>
<p class="text-gray-600 text-sm">Most equipment covered at no cost.</p>
</div>
<div class="p-6">
<div class="w-12 h-12 bg-lime-100 rounded-xl flex items-center justify-center mx-auto mb-4">
<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
</div>
<h3 class="font-semibold text-navy-700 mb-1">Free Delivery</h3>
<p class="text-gray-600 text-sm">Shipped to your door in {loc_name}.</p>
</div>
<div class="p-6">
<div class="w-12 h-12 bg-lime-100 rounded-xl flex items-center justify-center mx-auto mb-4">
<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
</div>
<h3 class="font-semibold text-navy-700 mb-1">Easy Paperwork</h3>
<p class="text-gray-600 text-sm">We handle insurance and doctors.</p>
</div>
<div class="p-6">
<div class="w-12 h-12 bg-lime-100 rounded-xl flex items-center justify-center mx-auto mb-4">
<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
</div>
<h3 class="font-semibold text-navy-700 mb-1">Expert Support</h3>
<p class="text-gray-600 text-sm">Bilingual team ready to help.</p>
</div>
</div>
</div>
</section>

{products_section}

{coverage_section}

{sibling_links_html}

<!-- About -->
<section class="py-16 bg-white">
<div class="max-w-7xl mx-auto px-4">
<div class="grid lg:grid-cols-2 gap-12 items-center">
<div>
<span class="inline-block px-4 py-1.5 bg-lime-100 text-blue-700 rounded-full text-sm font-medium mb-4">About MediNova Medical Supplies</span>
<h2 class="text-3xl font-bold text-navy-700 mb-6">Your {loc_name} DME Partner</h2>
<p class="text-gray-600 mb-6">{about_text}</p>
<div class="grid grid-cols-2 gap-4">
<div class="flex items-center gap-3"><div class="w-8 h-8 bg-lime-100 rounded-lg flex items-center justify-center"><svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg></div><span class="text-sm font-medium text-navy-700">Licensed</span></div>
<div class="flex items-center gap-3"><div class="w-8 h-8 bg-lime-100 rounded-lg flex items-center justify-center"><svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg></div><span class="text-sm font-medium text-navy-700">HIPAA Compliant</span></div>
<div class="flex items-center gap-3"><div class="w-8 h-8 bg-lime-100 rounded-lg flex items-center justify-center"><svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg></div><span class="text-sm font-medium text-navy-700">Nationwide</span></div>
<div class="flex items-center gap-3"><div class="w-8 h-8 bg-lime-100 rounded-lg flex items-center justify-center"><svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg></div><span class="text-sm font-medium text-navy-700">Bilingual</span></div>
</div>
</div>
<div class="bg-blue-50 rounded-2xl p-8 text-center">
<div class="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
<svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
</div>
<p class="text-xl font-bold text-navy-700 mb-1">Proudly Serving</p>
<p class="text-blue-600 font-semibold">{loc_name}</p>
</div>
</div>
</div>
</section>

<!-- CTA -->
<section class="py-16 bg-navy-700">
<div class="max-w-3xl mx-auto px-4 text-center">
<h2 class="text-3xl font-bold text-white mb-6">Ready to Get Started?</h2>
<p class="text-gray-300 mb-8">Check your eligibility in 60 seconds. We'll handle the rest.</p>
<div class="flex flex-col sm:flex-row gap-4 justify-center">
<button onclick="openModal()" class="bg-blue-500 hover:bg-lime-400 text-white px-8 py-4 text-lg font-semibold rounded-xl">{cta_text}</button>
<a href="tel:2488864363" class="border-2 border-white/30 text-white px-8 py-4 text-lg font-semibold rounded-xl">(248) 886-4-DME (4363)</a>
</div>
</div>
</section>

<!-- Contact -->
<section id="contact" class="py-16 bg-gray-50">
<div class="max-w-xl mx-auto px-4">
<div class="text-center mb-8">
<h2 class="text-2xl font-bold text-navy-700 mb-2">Contact Us</h2>
<p class="text-gray-600">We'll get back to you within 24 hours.</p>
</div>
<form id="contact-form" class="bg-white rounded-xl p-6 shadow-sm border border-gray-200" data-testid="location-contact-form">
<div class="grid grid-cols-2 gap-4 mb-4">
<input type="text" name="firstName" required placeholder="First Name" data-testid="location-contact-first-name-input" class="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500">
<input type="text" name="lastName" required placeholder="Last Name" data-testid="location-contact-last-name-input" class="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500">
</div>
<input type="tel" name="phone" required placeholder="Phone Number" data-testid="location-contact-phone-input" class="w-full mb-4 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500">
<textarea name="message" rows="3" placeholder="What equipment do you need?" data-testid="location-contact-message-input" class="w-full mb-4 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-lime-500 resize-none"></textarea>
<div class="p-3 bg-gray-50 rounded-lg space-y-2 mb-4">
<label class="flex items-start gap-2 cursor-pointer">
<input type="checkbox" name="consent_contact" required data-testid="location-contact-consent-contact-checkbox" class="w-4 h-4 mt-0.5 text-blue-500 rounded">
<span class="text-xs text-gray-600"><strong>Consent to Contact:</strong> I agree to be contacted by MediNova Medical Supplies via phone, email, or text.</span>
</label>
<label class="flex items-start gap-2 cursor-pointer">
<input type="checkbox" name="consent_tcpa" required data-testid="location-contact-consent-tcpa-checkbox" class="w-4 h-4 mt-0.5 text-blue-500 rounded">
<span class="text-xs text-gray-600"><strong>TCPA:</strong> I consent to automated calls/texts. Msg rates apply. Not required for purchase.</span>
</label>
<label class="flex items-start gap-2 cursor-pointer">
<input type="checkbox" name="consent_hipaa" required data-testid="location-contact-consent-hipaa-checkbox" class="w-4 h-4 mt-0.5 text-blue-500 rounded">
<span class="text-xs text-gray-600"><strong>HIPAA:</strong> I authorize sharing my health info with providers and insurance as needed.</span>
</label>
</div>
<div class="hidden" aria-hidden="true">
<label for="location-contact-website">Leave this field empty</label>
<input id="location-contact-website" type="text" name="website" tabindex="-1" autocomplete="off" data-testid="location-contact-honeypot-input">
</div>
<button type="submit" data-testid="location-contact-submit-button" class="w-full bg-blue-500 hover:bg-lime-600 text-white py-3 rounded-lg font-semibold">Submit</button>
</form>
</div>
</section>

<!-- Footer -->
<footer class="bg-navy-800 text-white py-12">
<div class="max-w-7xl mx-auto px-4">
<div class="grid md:grid-cols-3 gap-8 mb-8">
<div>
<div class="flex items-center gap-2 mb-4">
<img data-brand-logo-image data-logo-style="footer" src="/images/medinova/logo.webp" alt="MediNova Medical Supplies" class="h-10 max-w-[160px] object-contain brightness-0 invert opacity-90" />
</div>
<p class="text-gray-400 text-sm">Medicare DME supplier serving {loc_name}.</p>
</div>
<div>
<h4 class="font-semibold mb-4">Links</h4>
<ul class="space-y-2 text-gray-400 text-sm">
<li><a href="{SITE_DOMAIN}/" class="hover:text-blue-400">Home</a></li>
<li><a href="{SITE_DOMAIN}/locations/" class="hover:text-blue-400">Coverage Areas</a></li>
<li><a href="{parent_link}" class="hover:text-blue-400">Back</a></li>
</ul>
</div>
<div>
<h4 class="font-semibold mb-4">Contact</h4>
<ul class="space-y-2 text-gray-400 text-sm">
<li><a href="tel:2488864363" class="hover:text-blue-400">(248) 886-4-DME (4363)</a></li>
<li>info@medinovadme.com</li>
<li>Nationwide Delivery</li>
</ul>
</div>
</div>
<div class="border-t border-gray-700 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-gray-400 text-sm">
<p>&copy; 2025 MediNova Medical Supplies. All rights reserved.</p>
<div class="flex flex-wrap gap-x-5 gap-y-2 justify-center">
<a href="{SITE_DOMAIN}/legal/privacy-policy" class="hover:text-blue-400 transition-colors">Privacy Policy</a>
<a href="{SITE_DOMAIN}/legal/terms-of-service" class="hover:text-blue-400 transition-colors">Terms of Service</a>
<a href="{SITE_DOMAIN}/legal/hipaa-notice" class="hover:text-blue-400 transition-colors">HIPAA Notice</a>
<a href="{SITE_DOMAIN}/legal/accessibility" class="hover:text-blue-400 transition-colors">Accessibility</a>
</div>
</div>
</div>
</footer>

<!-- Modal -->
<div id="modal" class="modal-overlay" onclick="if(event.target===this)closeModal()">
<div class="modal-content">
<div class="p-4 border-b flex justify-between items-center">
<div><h2 class="text-lg font-bold text-navy-700">Check Eligibility</h2><p class="text-xs text-gray-500">60 seconds</p></div>
<button onclick="closeModal()" class="p-1.5 hover:bg-gray-100 rounded-lg"><svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
</div>
<div class="px-4 py-2 bg-blue-50">
<div class="flex justify-between text-xs mb-1"><span id="stxt">Step 1 of 4</span><span id="ptxt" class="text-blue-600 font-medium">25%</span></div>
<div class="w-full h-1.5 bg-lime-100 rounded-full"><div id="pbar" class="h-full bg-blue-500 rounded-full transition-all" style="width:25%"></div></div>
</div>
<form id="eform" class="p-4" data-testid="location-eligibility-form">
<div class="step active" data-step="1">
<h3 class="font-semibold text-navy-700 mb-4">What equipment do you need?</h3>
<div class="grid grid-cols-2 gap-3">
<div class="opt" data-v="back" onclick="sel(this,'eq')"><span class="font-medium text-sm">Back Brace</span></div>
<div class="opt" data-v="knee" onclick="sel(this,'eq')"><span class="font-medium text-sm">Knee Brace</span></div>
<div class="opt" data-v="wheelchair" onclick="sel(this,'eq')"><span class="font-medium text-sm">Wheelchair</span></div>
<div class="opt" data-v="other" onclick="sel(this,'eq')"><span class="font-medium text-sm">Other</span></div>
</div>
</div>
<div class="step" data-step="2">
<h3 class="font-semibold text-navy-700 mb-4">Insurance type?</h3>
<div class="grid grid-cols-2 gap-3">
<div class="opt" data-v="medicare" onclick="sel(this,'ins')"><span class="font-medium text-sm">Medicare</span></div>
<div class="opt" data-v="medicaid" onclick="sel(this,'ins')"><span class="font-medium text-sm">Medicaid</span></div>
<div class="opt" data-v="private" onclick="sel(this,'ins')"><span class="font-medium text-sm">Private</span></div>
<div class="opt" data-v="other" onclick="sel(this,'ins')"><span class="font-medium text-sm">Other</span></div>
</div>
</div>
<div class="step" data-step="3">
<h3 class="font-semibold text-navy-700 mb-4">Do you have a doctor?</h3>
<div class="grid grid-cols-2 gap-3">
<div class="opt" data-v="yes" onclick="sel(this,'doc')"><span class="font-medium text-sm">Yes</span></div>
<div class="opt" data-v="no" onclick="sel(this,'doc')"><span class="font-medium text-sm">No</span></div>
</div>
</div>
<div class="step" data-step="4">
<h3 class="font-semibold text-navy-700 mb-4">Your Info</h3>
<div class="space-y-3">
<div class="grid grid-cols-2 gap-3">
<input type="text" name="fn" required placeholder="First Name" data-testid="location-eligibility-first-name-input" class="px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-lime-500">
<input type="text" name="ln" required placeholder="Last Name" data-testid="location-eligibility-last-name-input" class="px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-lime-500">
</div>
<input type="tel" name="ph" required placeholder="Phone" data-testid="location-eligibility-phone-input" class="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-lime-500">
<input type="text" name="zip" required placeholder="ZIP Code" data-testid="location-eligibility-zip-input" class="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-lime-500">
<label class="flex items-start gap-2"><input type="checkbox" name="ok" required data-testid="location-eligibility-consent-contact-checkbox" class="mt-0.5"><span class="text-xs text-gray-600">I consent to be contacted.</span></label>
<label class="flex items-start gap-2"><input type="checkbox" name="tcpa" required data-testid="location-eligibility-consent-tcpa-checkbox" class="mt-0.5"><span class="text-xs text-gray-600">I consent to automated calls/texts under TCPA terms.</span></label>
<div class="hidden" aria-hidden="true">
<label for="location-eligibility-website">Leave this field empty</label>
<input id="location-eligibility-website" type="text" name="website" tabindex="-1" autocomplete="off" data-testid="location-eligibility-honeypot-input">
</div>
</div>
</div>
<div class="step" data-step="5">
<div class="text-center py-6">
<div class="w-16 h-16 bg-lime-100 rounded-full flex items-center justify-center mx-auto mb-4"><svg class="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg></div>
<h3 class="text-xl font-bold text-navy-700 mb-2">Thank You!</h3>
<p class="text-gray-600 text-sm mb-4">We'll contact you within 24 hours.</p>
<button type="button" onclick="closeModal()" class="bg-blue-500 text-white px-6 py-2 rounded-lg font-semibold">Close</button>
</div>
</div>
<div id="nav" class="flex justify-between mt-4 pt-4 border-t">
<button type="button" onclick="prev()" id="pbtn" data-testid="location-eligibility-back-button" class="px-4 py-2 border rounded-lg text-sm" style="visibility:hidden">Back</button>
<button type="button" onclick="next()" id="nbtn" data-testid="location-eligibility-next-button" class="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm">Next</button>
</div>
</form>
</div>
</div>

<script>
let s=1,d={{}};
const leadsApiEndpoint='/api/public/leads';

function primeFormStartTime(formId){{
  const form=document.getElementById(formId);
  if(form&&!form.dataset.startedAt){{
    form.dataset.startedAt=Date.now().toString();
  }}
}}

function getSubmissionDuration(formId){{
  const form=document.getElementById(formId);
  const startedAt=Number(form?.dataset?.startedAt||Date.now());
  return Math.max(0,Date.now()-startedAt);
}}

function openModal(){{
  document.getElementById('modal').classList.add('active');
  document.body.style.overflow='hidden';
  s=1;
  show(1);
  primeFormStartTime('eform');
}}

function closeModal(){{
  document.getElementById('modal').classList.remove('active');
  document.body.style.overflow='';
  s=1;
  d={{}};
  document.querySelectorAll('.opt').forEach(c=>c.classList.remove('sel'));
  const form=document.getElementById('eform');
  form.reset();
  form.dataset.startedAt=Date.now().toString();
  show(1);
}}

function show(n){{
  document.querySelectorAll('.step').forEach(e=>e.classList.remove('active'));
  document.querySelector('[data-step="'+n+'"]').classList.add('active');
  document.getElementById('pbtn').style.visibility=n===1?'hidden':'visible';
  document.getElementById('nbtn').textContent=n===4?'Submit':'Next';
  document.getElementById('nav').style.display=n===5?'none':'flex';
  const p=Math.round((n/4)*100);
  document.getElementById('stxt').textContent='Step '+n+' of 4';
  document.getElementById('ptxt').textContent=p+'%';
  document.getElementById('pbar').style.width=p+'%';
}}

function sel(el,f){{
  el.parentElement.querySelectorAll('.opt').forEach(c=>c.classList.remove('sel'));
  el.classList.add('sel');
  d[f]=el.dataset.v;
}}

async function submitEligibilityLead(form){{
  const payload={{
    firstName:form.fn.value.trim(),
    lastName:form.ln.value.trim(),
    phone:form.ph.value.trim(),
    zipCode:form.zip.value.trim(),
    formType:'eligibility_modal',
    painLocation:d.eq,
    insuranceType:d.ins,
    hasDoctor:d.doc,
    message:'Location: {loc_name}',
    consentContact:form.ok.checked,
    consentTcpa:form.tcpa.checked,
    consentLanguage:'Consent to Contact and TCPA consent accepted via location eligibility form.',
    website:form.website.value.trim(),
    submissionDuration:getSubmissionDuration('eform')
  }};

  const response=await fetch(leadsApiEndpoint,{{
    method:'POST',
    headers:{{'Content-Type':'application/json'}},
    body:JSON.stringify(payload)
  }});

  if(!response.ok){{
    const errorData=await response.json().catch(()=>({{}}));
    throw new Error(errorData.detail||'Unable to submit the form.');
  }}
}}

function next(){{
  if(s===1&&!d.eq){{alert('Select equipment');return}}
  if(s===2&&!d.ins){{alert('Select insurance');return}}
  if(s===3&&!d.doc){{alert('Answer question');return}}
  if(s<4){{
    s++;
    show(s);
    return;
  }}

  if(s===4){{
    const f=document.getElementById('eform');
    if(!f.checkValidity()){{
      f.reportValidity();
      return;
    }}
    submitEligibilityLead(f)
      .then(()=>{{
        s=5;
        show(5);
      }})
      .catch((error)=>{{
        alert(error.message||'Something went wrong. Please try again.');
      }});
  }}
}}

function prev(){{if(s>1){{s--;show(s)}}}}

function setMobileDrawerState(isOpen){{
  document.body.classList.toggle('mobile-drawer-open',isOpen);
  document.getElementById('mobile-drawer')?.setAttribute('aria-hidden',isOpen?'false':'true');
}}

document.getElementById('mobile-menu-btn')?.addEventListener('click',()=>setMobileDrawerState(true));
document.getElementById('mobile-menu-close')?.addEventListener('click',()=>setMobileDrawerState(false));
document.getElementById('mobile-drawer-overlay')?.addEventListener('click',()=>setMobileDrawerState(false));
document.querySelectorAll('#mobile-drawer a').forEach((link)=>{{
  link.addEventListener('click',()=>setMobileDrawerState(false));
}});
window.addEventListener('keydown',(event)=>{{
  if(event.key==='Escape') setMobileDrawerState(false);
}});

document.getElementById('contact-form')?.addEventListener('submit',function(e){{
  e.preventDefault();
  if(!this.checkValidity()){{
    this.reportValidity();
    return;
  }}

  const payload={{
    firstName:this.firstName.value.trim(),
    lastName:this.lastName.value.trim(),
    phone:this.phone.value.trim(),
    message:this.message.value.trim(),
    formType:'contact_form',
    consentContact:this.consent_contact.checked,
    consentTcpa:this.consent_tcpa.checked,
    consentHipaa:this.consent_hipaa.checked,
    consentLanguage:'Consent to Contact, TCPA, and HIPAA authorization accepted via location contact form.',
    website:this.website.value.trim(),
    submissionDuration:getSubmissionDuration('contact-form')
  }};

  fetch(leadsApiEndpoint,{{
    method:'POST',
    headers:{{'Content-Type':'application/json'}},
    body:JSON.stringify(payload)
  }})
    .then(async (response)=>{{
      if(!response.ok){{
        const errorData=await response.json().catch(()=>({{}}));
        throw new Error(errorData.detail||'Unable to submit contact form.');
      }}
      alert('Thank you! We will contact you shortly.');
      this.reset();
      this.dataset.startedAt=Date.now().toString();
    }})
    .catch((error)=>{{
      alert(error.message||'Something went wrong. Please try again.');
    }});
}});

function applyBranding(branding){{
  if(!branding) return;
  const version=branding.branding_version;
  const logoUrl=branding.logo_url;
  const logoLink=branding.logo_link_url||'{SITE_DOMAIN}/';
  const faviconUrl=branding.favicon_url;

  const appendVersion=(url)=>{{
    if(!url) return null;
    if(!version) return url;
    const separator=url.includes('?')?'&':'?';
    return `${{url}}${{separator}}v=${{encodeURIComponent(version)}}`;
  }};

  document.querySelectorAll('[data-brand-logo-link]').forEach((anchor)=>{{
    anchor.setAttribute('href',logoLink);
  }});

  document.querySelectorAll('[data-brand-logo-image]').forEach((logoImage)=>{{
    if(logoUrl){{
      logoImage.setAttribute('src',appendVersion(logoUrl));
    }}
    logoImage.style.display='';
  }});

  document.querySelectorAll('[data-brand-logo-fallback]').forEach((node)=>{{
    node.style.display='none';
  }});

  // Wire favicon from branding settings
  const faviconUrl=branding.favicon_url;
  if(faviconUrl){{
    let link=document.querySelector("link[rel~='icon']");
    if(!link){{link=document.createElement('link');link.rel='icon';document.head.appendChild(link);}}
    link.href=appendVersion(faviconUrl);
  }}

  if(faviconUrl){{
    ['icon','shortcut icon','apple-touch-icon'].forEach((rel)=>{{
      let tag=document.querySelector(`link[rel="${{rel}}"]`);
      if(!tag){{
        tag=document.createElement('link');
        tag.setAttribute('rel',rel);
        document.head.appendChild(tag);
      }}
      tag.setAttribute('href',appendVersion(faviconUrl));
    }});
  }}
}}

async function loadBranding(){{
  try{{
    const res=await fetch('/api/public/site-branding',{{cache:'no-store'}});
    if(!res.ok) return;
    const branding=await res.json();
    applyBranding(branding);
  }}catch(e){{
    // keep fallback branding
  }}
}}

loadBranding();
primeFormStartTime('contact-form');
primeFormStartTime('eform');
</script>
</body>
</html>'''
    
    return html
