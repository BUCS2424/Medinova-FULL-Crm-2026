# Agent Rules — Read Before Coding

This file is the quick-start rulebook for future agents working on DME PROS.

## Priority order
1. Read this file first.
2. Read `/app/memory/PRD.md` next.
3. Follow the latest explicit user request over older assumptions.

## Current non-negotiables
- Keep DME PROS branding consistent across public and app surfaces.
- Public header logo must remain `h-[70px] max-w-[230px]`.
- Root `/` must keep the landing experience intact and must not break login redirects.
- Inject the A2G Analytics script on all public page outputs.
- Public mobile menus must be right-side slide-outs with a logo placeholder.
- Public SEO must include canonical URLs, Open Graph, Twitter cards, and JSON-LD where relevant.
- Prefer modular helpers/components instead of repeating public page logic.

## Security rules
- Validate public page names and slugs before reading or generating files.
- Do not trust DB or route values when inserting into public HTML.
- Avoid SSRF-style behavior by normalizing public-facing site URLs and refusing unsafe schemes.
- Avoid mass-assignment patterns when updating stored objects.
- Do not leak sensitive fields in public responses.

## Code quality rules
- Keep files/components small and reusable where practical.
- Reuse shared public UI components for branding and navigation.
- Prefer clear helpers over long inline duplicated HTML.

## Process rules
- Test before claiming completion.
- Update `/app/memory/PRD.md` when major work lands.
- Keep a duplicate/redundancy report in `/app/memory/duplicate_redundancy_report.md` when touching repeated systems.
- In user-facing progress updates, include a lightweight credit usage estimate.