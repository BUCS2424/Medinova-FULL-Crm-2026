(function () {
  function appendVersion(url, version) {
    if (!url) return null;
    if (!version) return url;
    var separator = url.indexOf('?') >= 0 ? '&' : '?';
    return url + separator + 'v=' + encodeURIComponent(version);
  }

  function applyBranding(branding) {
    if (!branding) return;

    var logoUrl = branding.logo_url;
    var logoLink = branding.logo_link_url || '/';
    var faviconUrl = branding.favicon_url;
    var version = branding.branding_version;

    document.querySelectorAll('[data-brand-logo-link]').forEach(function (anchor) {
      anchor.setAttribute('href', logoLink);
    });

    document.querySelectorAll('[data-brand-logo-image]').forEach(function (img) {
      if (logoUrl) {
        img.setAttribute('src', appendVersion(logoUrl, version));
        img.classList.remove('hidden');
      } else {
        img.classList.add('hidden');
      }
    });

    document.querySelectorAll('[data-brand-logo-fallback]').forEach(function (node) {
      node.style.display = logoUrl ? 'none' : '';
    });

    if (faviconUrl) {
      ['icon', 'shortcut icon', 'apple-touch-icon'].forEach(function (rel) {
        var tag = document.querySelector('link[rel="' + rel + '"]');
        if (!tag) {
          tag = document.createElement('link');
          tag.setAttribute('rel', rel);
          document.head.appendChild(tag);
        }
        tag.setAttribute('href', appendVersion(faviconUrl, version));
      });
    }
  }

  fetch('/api/public/site-branding', { cache: 'no-store' })
    .then(function (res) { return (res.ok ? res.json() : null); })
    .then(function (branding) { if (branding) applyBranding(branding); })
    .catch(function () { /* keep fallback branding */ });
})();
