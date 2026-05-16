"""Theme inheritance — CSS custom property design tokens + dark-mode script.

Provides:
  theme_style_block()            -> <style> tag string with :root CSS vars
  PREFERS_COLOR_SCHEME_SCRIPT    -> inline <script> for auto dark/light
"""
from __future__ import annotations

PREFERS_COLOR_SCHEME_SCRIPT = """<script>
(function(){
  var stored = localStorage.getItem('theme');
  var dark = stored === 'dark' ||
    (!stored && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) document.documentElement.setAttribute('data-theme', 'dark');
})();
</script>"""


def theme_style_block() -> str:
    return """<style>
:root {
  --host-primary: #0055CC;
  --host-primary-rgb: 0, 85, 204;
  --host-primary-foreground: #ffffff;
  --host-secondary: #F0F4FF;
  --host-background: #ffffff;
  --host-foreground: #0B1120;
  --host-accent: #0055CC;
  --host-border: #D0DCF0;
  --host-font-sans: 'Figtree', 'Inter', system-ui, sans-serif;
  --host-radius: 0.5rem;
  --host-shadow: 0 1px 3px rgba(0,0,0,.08);
}
[data-theme="dark"] {
  --host-primary: #3B82F6;
  --host-primary-rgb: 59, 130, 246;
  --host-primary-foreground: #ffffff;
  --host-secondary: #1E2A3B;
  --host-background: #0B1120;
  --host-foreground: #E8EDF5;
  --host-accent: #60A5FA;
  --host-border: #1E3A5F;
  --host-font-sans: 'Figtree', 'Inter', system-ui, sans-serif;
}
</style>"""
