{
  "project": {
    "name": "MediNova Medical Supplies Landing (landing.html)",
    "type": "marketing_site",
    "audience": {
      "primary": "Medicare beneficiaries (55+)",
      "secondary": "Caregivers, patients seeking DME",
      "needs": [
        "Trust signals up-front",
        "Large, readable typography",
        "Clear section rhythm (no huge blank gaps)",
        "Obvious primary CTA",
        "Low-cognitive-load scanning"
      ]
    },
    "non_negotiables": [
      "Do NOT change any content/text; visual polish only",
      "Keep existing section order and overall layout (no major restructuring)",
      "Use Tailwind CDN + Lucide CDN only (pure HTML/CSS/JS)",
      "Brand gradient colors must remain: #0055CC → #0090D0",
      "Add scroll-reveal animations via IntersectionObserver",
      "Must be responsive (mobile-first) and look correct at 1920px",
      "All interactive and key informational elements MUST include data-testid attributes"
    ]
  },

  "brand_attributes": {
    "tone": ["professional", "clean", "trustworthy", "calm", "clinical-modern"],
    "visual_personality": {
      "keywords": ["frosted", "soft depth", "airy", "structured", "high-contrast type"],
      "avoid": [
        "jarring neon accents",
        "overly saturated gradients",
        "heavy drop shadows",
        "centered-everything layouts",
        "busy textures behind text"
      ]
    }
  },

  "typography": {
    "google_fonts": {
      "primary_choice": {
        "family": "Figtree",
        "weights": [400, 500, 600, 700],
        "reason": "More readable than Montserrat at smaller sizes; modern healthcare SaaS feel."
      },
      "fallback_choice": {
        "family": "Montserrat",
        "weights": [400, 500, 600, 700],
        "reason": "If brand already uses Montserrat; keep headings slightly tighter to reduce airy gaps."
      },
      "implementation": {
        "head_tag": "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n<link href=\"https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap\" rel=\"stylesheet\">",
        "css": ":root{--font-sans:'Figtree',system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;} body{font-family:var(--font-sans);}"
      }
    },
    "type_scale": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl (tight leading, max-w for readability)",
      "h2": "text-base md:text-lg (per constraint) but use font-weight + tracking + color to differentiate",
      "h3": "text-xl md:text-2xl (section card titles)",
      "body": "text-sm md:text-base (55+ audience: keep minimum 16px on most body)",
      "small": "text-xs md:text-sm (badges, meta)"
    },
    "hierarchy_rules": [
      "Use weight + color + spacing to create hierarchy (since H2 size is constrained).",
      "Keep line-length ~60–75 characters for paragraphs (max-width on text blocks).",
      "Use consistent vertical rhythm: headings have smaller bottom margin than section padding to avoid ‘white gaps’."
    ]
  },

  "color_system": {
    "gradient_restriction_rule": {
      "prohibited": [
        "blue-500 to purple-600",
        "purple-500 to pink-500",
        "green-500 to blue-500",
        "red to pink"
      ],
      "rules": [
        "NEVER let gradients cover more than 20% of the viewport.",
        "NEVER apply gradients to text-heavy content or reading areas.",
        "NEVER use gradients on small UI elements (<100px width).",
        "NEVER stack multiple gradient layers in the same viewport.",
        "IF gradient area exceeds 20% OR affects readability THEN use solid colors."
      ],
      "allowed_usage": [
        "Hero background accent only (subtle)",
        "Testimonials section background (already gradient; keep it controlled)",
        "Decorative separators / top borders / subtle glows"
      ]
    },
    "tokens": {
      "brand": {
        "primary": "#0055CC",
        "secondary": "#0090D0",
        "navy": "#0B2A5B",
        "navy_2": "#0A1F44"
      },
      "neutrals": {
        "bg": "#F6FAFF",
        "surface": "#FFFFFF",
        "surface_2": "#F1F6FF",
        "border": "#D9E6F7",
        "text": "#0B1B33",
        "muted_text": "#4B607A"
      },
      "states": {
        "success": "#1F8A5B",
        "warning": "#B7791F",
        "danger": "#C53030",
        "info": "#0B6FBF"
      },
      "focus_ring": "rgba(0,85,204,0.28)"
    },
    "usage_notes": [
      "Default page background should be a very light blue-tinted neutral (bg) to reduce stark white gaps.",
      "Cards remain white (surface) with subtle border and shadow.",
      "Use navy for headings and primary text; muted_text for supporting copy.",
      "Use brand primary for primary CTA and key links; secondary for accents (icons, small highlights)."
    ]
  },

  "layout_and_spacing": {
    "container": {
      "max_width": "1200px",
      "padding_x": "px-4 sm:px-6 lg:px-8",
      "rule": "Keep consistent container width across sections to fix visual rhythm."
    },
    "section_rhythm": {
      "mobile": "py-12",
      "tablet": "py-16",
      "desktop": "py-20",
      "tight_sections": "py-10 (for dense sections like certifications grid / FAQ)",
      "rule": "Replace large empty gaps with consistent section padding; use separators instead of whitespace."
    },
    "grid_gaps": {
      "cards": "gap-4 sm:gap-6",
      "feature_grids": "gap-6 lg:gap-8"
    },
    "section_alternation": {
      "pattern": [
        "Section A: bg (light blue tint)",
        "Section B: surface (white) with top/bottom hairline separators",
        "Section C: bg again"
      ],
      "implementation": "Use subtle background alternation + 1px borders to separate sections instead of huge whitespace."
    }
  },

  "elevation_and_surfaces": {
    "radius": {
      "card": "16px",
      "button": "12px",
      "pill": "999px (badges/chips)",
      "inputs": "12px"
    },
    "shadow_scale": {
      "shadow_1": "0 1px 2px rgba(16,24,40,0.06)",
      "shadow_2": "0 10px 28px rgba(16,24,40,0.10)",
      "shadow_3": "0 18px 48px rgba(16,24,40,0.14)"
    },
    "card_style": {
      "default": "background: surface; border: 1px solid border; shadow: shadow_1",
      "hover": "shadow: shadow_2; border-color: rgba(0,85,204,0.22); translateY(-2px)",
      "rule": "No heavy shadows; keep depth soft and consistent across all cards (features, products, certifications, testimonials)."
    }
  },

  "components_and_section_recipes": {
    "sticky_nav": {
      "goal": "More premium + readable while staying minimal.",
      "styles": [
        "Sticky with backdrop blur",
        "Add subtle bottom border + shadow only after scroll",
        "Increase nav link hit-area for 55+ audience"
      ],
      "css_snippet": "header.sticky{position:sticky;top:0;z-index:50;background:rgba(255,255,255,0.78);backdrop-filter:blur(10px);border-bottom:1px solid rgba(217,230,247,0.9);} .nav-scrolled{box-shadow:0 10px 28px rgba(16,24,40,0.08);}"
    },

    "hero": {
      "goal": "Immediate trust + clear CTA; reduce empty space; add subtle texture.",
      "background": {
        "allowed_gradient": "radial + linear accent only behind hero (<=20% viewport)",
        "example": "background: radial-gradient(900px circle at 15% 10%, rgba(0,144,208,0.14), transparent 55%), radial-gradient(700px circle at 85% 30%, rgba(0,85,204,0.12), transparent 52%), #F6FAFF;"
      },
      "floating_stat_cards": {
        "style": "white cards with border + shadow_1; slight tilt/float on hover",
        "micro": "hover: translateY(-3px) + shadow_2",
        "note": "Keep stats large and labels short; ensure contrast."
      }
    },

    "feature_grid_difference": {
      "goal": "Unify card styling + add icon containers.",
      "card_pattern": [
        "Icon in soft blue chip (32–40px)",
        "Title (h3)",
        "Body copy",
        "Optional subtle ‘learn more’ arrow (if exists)"
      ],
      "hover": "border-color to brand primary at 20% + shadow_2"
    },

    "about_section": {
      "goal": "Tighten spacing; add image frame; align list items.",
      "image_treatment": "Rounded-2xl, 1px border, soft shadow_2; optional subtle ‘grid’ overlay at 6% opacity.",
      "list": "Use consistent icon bullets (Lucide check-circle) with aligned baseline and 12–14px gap."
    },

    "certifications_grid": {
      "goal": "Make it feel official and consistent.",
      "card": "Use same card tokens; add small ‘seal’ icon container; keep typography compact.",
      "separator": "Add a thin top border between sections to reduce reliance on whitespace."
    },

    "products_grid": {
      "goal": "Reduce flatness; unify product cards.",
      "card": "Image area with aspect ratio, then title + short description; consistent CTA button style.",
      "empty_space_fix": "Use consistent grid gap and reduce section padding slightly."
    },

    "testimonials_gradient_section": {
      "goal": "Keep gradient but improve readability and card contrast.",
      "gradient": "linear-gradient(135deg, #0055CC 0%, #0090D0 100%) (already allowed)",
      "overlay": "Add subtle noise overlay at 6–10% opacity to avoid banding.",
      "cards": "Use white cards with slightly stronger shadow_2; keep quotes large enough for 55+.",
      "accessibility": "Ensure text on gradient meets contrast; prefer white text with subtle text-shadow: 0 1px 0 rgba(0,0,0,0.12)."
    },

    "faq_accordion": {
      "goal": "Make accordion scannable and touch-friendly.",
      "interaction": "Chevron rotates 180deg; panel expands with height animation (CSS) + fade.",
      "spacing": "Each item has 16–18px vertical padding; 1px separators.",
      "note": "If using custom accordion JS, ensure keyboard support (Enter/Space) and aria-expanded."
    },

    "contact_two_column_card": {
      "goal": "Premium split card with clear hierarchy.",
      "left_panel": "Deep navy background (#0B2A5B) with white text; add subtle pattern/noise.",
      "right_panel": "White form with strong labels and focus rings.",
      "form": "Increase input height (min 44px), larger label text, clear error states."
    },

    "footer": {
      "goal": "Reduce heaviness; add top border; keep links readable.",
      "style": "bg white or surface_2; 1px border-top; small muted text."
    }
  },

  "motion_and_microinteractions": {
    "principles": [
      "Subtle, calm motion (healthcare trust)",
      "No bouncing or elastic overshoot",
      "Use easing: cubic-bezier(0.22, 1, 0.36, 1)",
      "Respect prefers-reduced-motion"
    ],
    "scroll_reveal": {
      "classes": {
        "base": ".reveal{opacity:0;transform:translateY(14px);transition:opacity 520ms cubic-bezier(0.22,1,0.36,1), transform 520ms cubic-bezier(0.22,1,0.36,1);} .reveal.is-visible{opacity:1;transform:translateY(0);} .reveal-delay-1{transition-delay:80ms;} .reveal-delay-2{transition-delay:160ms;} .reveal-delay-3{transition-delay:240ms;}",
        "reduced_motion": "@media (prefers-reduced-motion: reduce){html{scroll-behavior:auto;} .reveal{opacity:1;transform:none;transition:none;}}"
      },
      "intersection_observer_js": "const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;\nif(!prefersReduced){\n  const els = document.querySelectorAll('.reveal');\n  const io = new IntersectionObserver((entries)=>{\n    entries.forEach(e=>{\n      if(e.isIntersecting){\n        e.target.classList.add('is-visible');\n        io.unobserve(e.target);\n      }\n    });\n  }, { threshold: 0.14, rootMargin: '0px 0px -10% 0px' });\n  els.forEach(el=>io.observe(el));\n}"
    },
    "hover_states": {
      "cards": "transition: box-shadow 220ms ease, border-color 220ms ease; hover translateY(-2px) (use transform only on hover, no transition: all)",
      "buttons": "hover: brightness(0.98) + shadow_2; active: scale(0.98)",
      "links": "underline appears via background-size animation (subtle)"
    }
  },

  "accessibility": {
    "rules": [
      "Minimum touch target 44x44 for nav links, buttons, accordion headers.",
      "Visible focus ring: 2px ring in brand primary at ~28% opacity + 2px offset.",
      "Avoid low-contrast gray text; muted_text must still pass AA on white.",
      "Accordion must use aria-expanded, aria-controls, and keyboard interaction.",
      "Respect prefers-reduced-motion."
    ]
  },

  "testing_attributes": {
    "data_testid_rules": [
      "Use kebab-case describing role, not appearance.",
      "Apply to: nav links, CTA buttons, product cards CTAs, accordion triggers, form inputs, submit button, testimonial carousel controls (if any).",
      "Also apply to key informational elements: hero headline, stats numbers, section headings (optional but recommended)."
    ],
    "examples": {
      "nav": "data-testid=\"top-nav\"; links: data-testid=\"nav-products-link\"",
      "hero": "data-testid=\"hero-primary-cta\"",
      "faq": "data-testid=\"faq-item-1-trigger\"",
      "contact": "data-testid=\"contact-form-submit-button\""
    }
  },

  "implementation_notes_for_landing_html": {
    "css_tokens_to_add": {
      "where": "In a <style> block in landing.html (or existing stylesheet)",
      "tokens": ":root{\n  --mn-primary:#0055CC;\n  --mn-secondary:#0090D0;\n  --mn-navy:#0B2A5B;\n  --mn-bg:#F6FAFF;\n  --mn-surface:#FFFFFF;\n  --mn-surface-2:#F1F6FF;\n  --mn-border:#D9E6F7;\n  --mn-text:#0B1B33;\n  --mn-muted:#4B607A;\n  --mn-ring:rgba(0,85,204,0.28);\n  --mn-radius-card:16px;\n  --mn-radius-btn:12px;\n  --mn-shadow-1:0 1px 2px rgba(16,24,40,0.06);\n  --mn-shadow-2:0 10px 28px rgba(16,24,40,0.10);\n  --mn-shadow-3:0 18px 48px rgba(16,24,40,0.14);\n}\nbody{background:var(--mn-bg);color:var(--mn-text);}\n::selection{background:rgba(0,144,208,0.22);}\n"
    },
    "noise_texture": {
      "rule": "Use subtle noise only on large backgrounds (hero/testimonials/contact left panel).",
      "css": ".noise-overlay{position:absolute;inset:0;pointer-events:none;opacity:.08;mix-blend-mode:multiply;background-image:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22120%22 height=%22120%22 filter=%22url(%23n)%22 opacity=%220.35%22/%3E%3C/svg%3E');}"
    },
    "section_separators": {
      "css": ".section-sep{border-top:1px solid rgba(217,230,247,0.9);}"
    },
    "no_transition_all": "Do not use transition: all; only transition opacity, box-shadow, border-color, background-color."
  },

  "component_path": {
    "note": "This landing page is pure HTML/CSS/JS; shadcn components are not used directly here. Reference only for interaction patterns.",
    "shadcn_reference_only": {
      "accordion": "/app/frontend/src/components/ui/accordion.jsx",
      "button": "/app/frontend/src/components/ui/button.jsx",
      "card": "/app/frontend/src/components/ui/card.jsx",
      "navigation_menu": "/app/frontend/src/components/ui/navigation-menu.jsx"
    }
  },

  "image_urls": {
    "note": "No new images required by constraints; keep existing imagery. If placeholders are needed for missing sections, use these optional stock images.",
    "optional": [
      {
        "category": "about-section",
        "description": "Warm, trustworthy caregiver/medical supply context (non-hospital, home-care feel).",
        "url": "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1600&q=80"
      },
      {
        "category": "products-section",
        "description": "Clean medical equipment still-life (neutral, bright).",
        "url": "https://images.unsplash.com/photo-1580281657527-47f249e8f6b5?auto=format&fit=crop&w=1600&q=80"
      },
      {
        "category": "hero-background",
        "description": "Abstract soft blue gradient texture (use as subtle background only).",
        "url": "https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=1600&q=80"
      }
    ]
  },

  "instructions_to_main_agent": [
    "Tighten section spacing: replace large blank gaps with consistent py-12/16/20 rhythm and add subtle separators.",
    "Unify all cards (features/products/certs/testimonials) to one radius + border + shadow system.",
    "Implement sticky nav blur + add ‘scrolled’ shadow state via JS on window scroll.",
    "Add IntersectionObserver reveal classes to each section heading + grid items with stagger delays.",
    "Keep gradients limited to hero accent + testimonials background; do not introduce new large gradients.",
    "Switch typography to Figtree (preferred) via Google Fonts; apply consistent heading weights and tighter leading.",
    "Add subtle noise overlay only to large background sections (hero/testimonials/contact-left) at <=10% opacity.",
    "Ensure all interactive elements and key info blocks have data-testid attributes (kebab-case).",
    "Do not use transition: all; specify transitions per property."
  ],

  "general_ui_ux_design_guidelines": [
    "- You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms",
    "- You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text",
    "- NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json",
    "\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc\n",
    "\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead.\n   ",
    "- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n",
    "- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   ",
    "- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n",
    "\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n",
    "\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n",
    "\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n",
    "\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n",
    "\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n",
    "\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.\n"
  ]
}
