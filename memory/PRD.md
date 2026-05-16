# DME PROS CRM - Product Requirements Document

> Agent quick-start rules: see `/app/AGENT_RULES.md`

## Project Overview
**Project Name**: DME PROS (formerly dme-rus-crm)
**Source**: https://github.com/BUCS2424/New-Core-Lead-vender-DME-r-us
**Setup Date**: 2026-03-13
**Last Updated**: 2026-04-14

## Architecture
- **Backend**: FastAPI (Python) on port 8001
- **Frontend**: React with craco, Tailwind CSS on port 3000
- **Database**: MongoDB (local)
- **Key Features**: CRM for DME (Durable Medical Equipment) with patients, leads, orders, fax, voice, analytics

## Branding
- **Company Name**: DME PROS
- **Phone**: (727) 966-7767 (727-966-PROS)
- **Address**: Nationwide Delivery
- **Color Scheme**: Lime green (#84CC16) + Navy blue (#1e3a5f) - matching dmerus.com

## What's Been Implemented
- [x] Repository cloned and setup
- [x] All dependencies installed
- [x] Environment variables configured
- [x] Rebranded from "Mastech Med DME" to "DME PROS"
- [x] Phone number updated to (727) 966-7767
- [x] Address changed to "Nationwide Delivery"
- [x] Color scheme updated to lime/navy (matching dmerus.com)
- [x] Landing page completely redesigned with new colors
- [x] All 40+ pages updated with new color scheme
- [x] Super admin account created: mel@a2gdesigns.com
- [x] Feature flags system implemented with FeatureContext
- [x] ChatWidget now respects live_chat feature flag
- [x] Layout sidebar respects fax_center, phone_dialer, doctors_directory flags
- [x] Public lead submission hardening: required name/phone checks, required consent_contact/consent_tcpa checks
- [x] Honeypot bot protection added to public lead submissions (`website` field) and enforced in backend
- [x] Landing page forms now submit to `/api/public/leads` with validation + honeypot + consent payloads
- [x] Location page template forms now submit to `/api/public/leads` with validation + honeypot + consent payloads
- [x] Lead detail page now includes **Print Lead Sheet** action for sales handoff
- [x] Lead detail page now includes **Fax** quick action that opens Fax Center with lead-prefilled recipient/notes
- [x] Landing page feature card copy updated from HIPAA/security messaging to DME product + sales workflow messaging
- [x] New **Doctor** tab on Lead Detail page with doctor directory search, selection, and autofill of available doctor fields
- [x] Quick-create doctor flow from lead page when doctor is not found in directory
- [x] Per-doctor product linking with product search by number/name and multi-product support
- [x] Dedicated save action for Doctor tab (`/api/leads/{lead_id}/doctor-links`)
- [x] Lead-to-patient conversion now carries linked doctors/products into patient profile (`linked_doctors`)
- [x] Integrated **NPI Registry** doctor lookup into lead Doctor tab (local directory + nationwide NPI search)
- [x] Added NPI-first workflow: preview provider details, then import to local directory (dedupe by NPI, smart field updates)
- [x] Replaced quick-create doctor flow with NPI-only import flow per user preference
- [x] Added linked-doctor fax selector in Fax dialog with auto-prefill of doctor name + fax number
- [x] Added dedicated fax transmission compliance trail (`fax_transmission_audit`) capturing who sent, when, to whom, and status events
- [x] Added `GET /api/fax/{fax_id}/audit-trail` endpoint for transmission audit review
- [x] Enforced HTTPS document URLs for outbound fax submission (`/api/fax/send` now rejects non-HTTPS file URLs)
- [x] Added encrypted-at-rest fax secure upload flow (`POST /api/fax/upload-secure`) with short-lived signed download URLs
- [x] Added signed URL refresh/download endpoints for secure fax files (`/api/fax/files/{file_id}/signed-url`, `/api/fax/files/{file_id}/download`)
- [x] Added encrypted storage fallback for secure fax files when cloud storage is not configured (preview-safe)
- [x] Masked recipient fax numbers in fax UI endpoints by default while retaining full value encrypted in secure audit (`include_sensitive=true` for admin/super_admin)
- [x] Added Patient Medical Records APIs with full requested schema:
  - `GET /api/patients/{id}/medical`
  - `PUT /api/patients/{id}/medical`
- [x] Added Patient Insurance Data APIs with full requested schema:
  - `GET /api/patients/{id}/insurance-data`
  - `PUT /api/patients/{id}/insurance-data`
- [x] Medical/Insurance saves are HIPAA audit-logged as one event per Save All:
  - `PATIENT_MEDICAL_RECORDS_UPDATED`
  - `PATIENT_INSURANCE_DATA_UPDATED`
- [x] Implemented frontend `PatientMedicalRecords` component with 8 editable sections, inline add/edit/delete rows, empty states, and Save All
- [x] Updated Medical Records UI to framed accordion boxes with chevron collapse/expand controls per section (including Vitals), matching requested layout style
- [x] Updated Insurance Coverage UI to framed accordion boxes with chevron collapse/expand controls on every insurance section card
- [x] Added per-card `Verified` toggles in Insurance sections; verified cards now highlight with light green styling
- [x] Added persistence for per-section insurance verification state via `insurance_data.section_verification`
- [x] Updated root (`/`) behavior to keep URL on `/` while rendering landing content (no redirect to `/landing.html`)
- [x] Migrated root landing from iframe mode to native route rendering (parsed `/landing.html` content + sequential script/style injection with safe fallback)
- [x] Preserved authenticated behavior: logged-in users hitting `/` still redirect to `/dashboard`
- [x] Restored homepage visual integrity by returning root render path to stable iframe mode (keeps URL at `/`, preserves exact original landing design without CSS/script conflicts)
- [x] Phase 2A native migration implemented safely:
  - Native React: Top bar + Header + Hero on `/`
  - Stable embedded remainder: iframe `/landing.html?embed=rest` for lower sections
  - Added `embed=rest` mode in `landing.html` to hide duplicated top bar/header/hero in embedded context
  - Preserved auth redirect (`/` -> `/dashboard` when authenticated)
- [x] Restored hero floating image tabs in native hero:
  - Top-right "AI Powered" pill
  - Bottom-left "Real-time Sync" floating card
- [x] Restored hero statistics details and separators in native hero:
  - Labels under stats (Active Patients, Satisfaction, States Covered)
  - Vertical divider lines between stat columns
- [x] Updated public-facing wording: replaced "Location Pages" with "Coverage Areas"
- [x] Implemented unified branding source-of-truth in General Settings:
  - One **primary logo** and one **favicon** model
  - Backend normalization enforces sync (`logo_url` -> `dashboard_logo_url`, `favicon_url` -> `pwa_icon_url`)
  - Added `branding_version` for cache-busting and instant refresh
- [x] Added drag/drop + click upload for both primary logo and favicon in Dev Settings Site Settings
- [x] Instant UI sync on save via frontend `BrandingContext` + `branding-updated` event dispatch (no hard refresh required)
- [x] Synced branding targets across app/public surfaces:
  - Login page logo
  - Dashboard top + bottom logos
  - Public landing header logo
  - Public locations header/footer logos
  - Location generated pages branding hooks
  - Browser favicon tags (`icon`, `shortcut icon`, `apple-touch-icon`)
- [x] Updated public header logo holder width for landing/location surfaces to `h-10 max-w-[230px]`
- [x] Implemented frontend `PatientInsuranceCoverage` component with 6+ editable sections (primary, secondary, financial summary, dme benefits, claims summary, remittance, verification), inline row controls, and Save All
- [x] Wired new components into `PatientDetailPage` Medical/Insurance tabs and removed old placeholder behavior for medical tab
- [x] Added DME category dropdown options exactly per requirement (12 categories)
- [x] Added root-level agent guidance file: `/app/AGENT_RULES.md`
- [x] Added duplicate/redundancy report: `/app/memory/duplicate_redundancy_report.md`
- [x] Injected A2G analytics script into public HTML outputs (`landing.html`, `index.html`, backend-generated location pages, locations index HTML)
- [x] Upgraded public SEO coverage across landing/root/products/locations/resources outputs:
  - Canonical tags
  - Open Graph and Twitter metadata
  - JSON-LD for public landing, locations, and resources surfaces
  - `robots.txt` available at both `/robots.txt` and `/api/robots.txt`
  - `sitemap.xml` updated to include `/medicare-resources`
- [x] Enforced right-side slide-out mobile menus with branding/placeholder support on:
  - Landing page
  - Products catalog
  - Product detail
  - Service Areas page
  - Medicare Resources page
  - Backend-generated location pages
- [x] Added shared public UI helpers for consistent branding/navigation:
  - `frontend/src/components/PublicBrandLogo.jsx`
  - `frontend/src/components/PublicMobileMenu.jsx`
- [x] Hardened location page serving against invalid/traversal-style page names with strict filename validation
- [x] Updated preview proxy behavior so `/locations/*.html` uses fresh backend-generated HTML instead of stale static files during preview testing
- [x] Updated public navigation labels from **Service Areas** to **Coverage Areas** in top/footer menus and public mobile menus
- [x] Restored the public `/locations` coverage landing page to the original Mastech-style header + hero layout (dark patterned hero, search card, stat cards, top call/login controls)
- [x] Applied a styling-only public page refresh to bring the main public surfaces closer to the homepage CSS/colors without changing functionality:
  - Products catalog
  - Product detail
  - Medicare Resources
  - Login
  - Write Review

- [x] **Stay Up To Date** dashboard page — HealthCare.gov Content API integration (2026-04-14):
  - Added "Stay Up To Date" nav item in sidebar visible to all authenticated users
  - Backend proxy endpoints with 1-hour caching: `/api/healthcare-gov/articles`, `/api/healthcare-gov/glossary`, `/api/healthcare-gov/content`, `/api/healthcare-gov/index`
  - Frontend page at `/stay-up-to-date` with category cards (Healthcare Articles: 436 items, Healthcare Glossary: 256 items)
  - Search, pagination, alphabet filter (glossary), and content viewer modal with external link to HealthCare.gov
  - "More Sources Coming Soon" placeholder for future data feeds
- [x] **CMS.gov & Medicare Data Integration** added to Stay Up To Date page (2026-04-14):
  - 4 CMS DME datasets from data.cms.gov public API (no auth key needed):
    - Medicare DME Suppliers (63,988 records)
    - Medicare DME Services by Supplier (463,784 records)
    - Medicare DME Referring Providers (387,352 records)
    - Medicare DME Services by Referring Provider (1,439,587 records)
  - Backend: `/api/cms-data/datasets`, `/api/cms-data/{key}/data`, `/api/cms-data/{key}/stats` with caching
  - Frontend: Data table view with state filter, name search, pagination, expandable row details

## Core Features (from existing codebase)
- Patient Management
- Lead Management & Conversion
- Order Processing
- Fax Center (HIPAA compliant)
- Voice/Voicemail Settings (Telnyx)
- Analytics Dashboard
- Product Catalog
- Document Management with E-Signatures
- User Management & Audit Logs
- Live Chat (Joffry AI)
- Feature Flags System

## Feature Flags Available
- patient_portal, user_registration, doctor_portal
- testimonials, phone_dialer, fax_center
- location_pages, product_catalog, online_orders
- notifications, sms_notifications, live_chat
- appointment_scheduling, analytics_dashboard
- document_upload, document_esign, patient_tutorial
- ai_template_editor, doctors_directory, public_website
- jornaya_tracking, trustedform_cert
- availity_integration, waystar_integration, officeally_integration
- video_conferencing, marketing_campaigns, lead_intake_hub

## Prioritized Backlog
- P1: Add more data sources to "Stay Up To Date" page (CMS Marketplace API for plan lookups, state-specific health info)
- P0: User acceptance check for print/fax lead workflow in real sales process
- P0: Configure Telnyx fax settings in preview/prod to enable actual outgoing fax delivery
- P0: User acceptance check for doctor tab workflow (search, quick-create, multi-doctor, multi-product linking)
- P0: User acceptance check for NPI search + import quality across multiple states/specialties
- P0: Confirm final legal/compliance wording for encryption section in policy docs/UI text
- P0: Continue credit usage tracking in assistant progress/final summaries
- P0: Optional next step: add “Sync from Availity” and “Sync from Waystar” buttons with merge-without-overwrite strategy (fields already mapped for future integration)
- P1: Add server-side rate limiting thresholds specific to `/api/public/leads` spam bursts
- P1: Add printable PDF export option (downloadable file) alongside browser print
- P2: Refactor oversized files (`backend/server.py`, `frontend/src/pages/DevSettingsPage.js`)

## Login Credentials
- **Email**: mel@a2gdesigns.com
- **Password**: BigDaddy2016!!
- **Role**: super_admin
