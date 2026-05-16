# Duplicate / Redundancy Report

Updated: 2026-03-27

## Reduced in this pass
- **Public mobile navigation**: consolidated into shared React components (`PublicBrandLogo`, `PublicMobileMenu`) for public React pages.
- **Location index HTML generation**: target for backend helper consolidation so `/locations/` outputs do not maintain two divergent inline templates.
- **Static location page drift**: preview routing now prefers backend-generated location HTML so template improvements do not depend on stale files in `frontend/public/locations/`.

## Remaining duplication to watch
- Multiple public React pages still maintain their own hero/body layout structures by design, but they now share branding/menu behavior.
- `backend/server.py` still contains large legacy route blocks and should continue being split into route modules.
- SEO metadata is improved, but page-specific copy still lives per page and should eventually move to shared SEO helpers.

## Recommended next cleanup
1. Extract shared public SEO helpers for React pages.
2. Continue modularizing `backend/server.py` into `/app/backend/routes/*`.
3. Move server-generated public HTML helpers into dedicated template/helper modules.