const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Proxy /sitemap.xml and /robots.txt to backend (exact paths)
  app.get('/sitemap.xml', createProxyMiddleware({
    target: 'http://localhost:8001',
    changeOrigin: true,
  }));
  app.get('/robots.txt', createProxyMiddleware({
    target: 'http://localhost:8001',
    changeOrigin: true,
  }));

  // Always proxy /locations/*.html to backend so preview uses fresh generated HTML
  app.use('/locations', (req, res, next) => {
    if (req.url.endsWith('.html')) {
      const proxy = createProxyMiddleware({
        target: 'http://localhost:8001',
        changeOrigin: true,
        pathRewrite: (reqPath) => `/locations${reqPath}`,
      });
      return proxy(req, res, next);
    }
    next();
  });
};
