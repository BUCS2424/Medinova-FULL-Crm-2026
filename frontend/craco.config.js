// craco.config.js
const path = require("path");
require("dotenv").config();

// Check if we're in development/preview mode (not production build)
// Craco sets NODE_ENV=development for start, NODE_ENV=production for build
const isDevServer = process.env.NODE_ENV !== "production";

// Environment variable overrides
const config = {
  enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === "true",
  enableVisualEdits: isDevServer, // Only enable during dev server
};

// Conditionally load visual edits modules only in dev mode
let setupDevServer;
let babelMetadataPlugin;

if (config.enableVisualEdits) {
  setupDevServer = require("./plugins/visual-edits/dev-server-setup");
  babelMetadataPlugin = require("./plugins/visual-edits/babel-metadata-plugin");
}

// Conditionally load health check modules only if enabled
let WebpackHealthPlugin;
let setupHealthEndpoints;
let healthPluginInstance;

if (config.enableHealthCheck) {
  WebpackHealthPlugin = require("./plugins/health-check/webpack-health-plugin");
  setupHealthEndpoints = require("./plugins/health-check/health-endpoints");
  healthPluginInstance = new WebpackHealthPlugin();
}

const webpackConfig = {
  eslint: {
    configure: {
      extends: ["plugin:react-hooks/recommended"],
      rules: {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
      },
    },
  },
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig) => {

      // Add ignored patterns to reduce watched directories
        webpackConfig.watchOptions = {
          ...webpackConfig.watchOptions,
          ignored: [
            '**/node_modules/**',
            '**/.git/**',
            '**/build/**',
            '**/dist/**',
            '**/coverage/**',
            '**/public/**',
        ],
      };

      // Add health check plugin to webpack if enabled
      if (config.enableHealthCheck && healthPluginInstance) {
        webpackConfig.plugins.push(healthPluginInstance);
      }
      return webpackConfig;
    },
  },
};

// Only add babel metadata plugin during dev server
if (config.enableVisualEdits && babelMetadataPlugin) {
  webpackConfig.babel = {
    plugins: [babelMetadataPlugin],
  };
}

webpackConfig.devServer = (devServerConfig) => {
  // Add custom middleware to serve static HTML files
  const originalSetupMiddlewares = devServerConfig.setupMiddlewares;
  
  devServerConfig.setupMiddlewares = (middlewares, devServer) => {
    const fs = require('fs');
    const path = require('path');
    
    // Serve landing.html at root /
    middlewares.unshift({
      name: 'serve-landing',
      path: '/',
      middleware: (req, res, next) => {
        if (req.url === '/' || req.url === '/index.html') {
          const landingPath = path.join(__dirname, 'public', 'landing.html');
          if (fs.existsSync(landingPath)) {
            res.setHeader('Content-Type', 'text/html');
            res.end(fs.readFileSync(landingPath));
            return;
          }
        }
        next();
      }
    });
    
    // Serve /locations/*.html files directly (setupProxy.js handles backend fallback)
    middlewares.unshift({
      name: 'serve-locations',
      path: '/locations',
      middleware: (req, res, next) => {
        if (req.url.endsWith('.html')) {
          const filePath = path.join(__dirname, 'public', 'locations', path.basename(req.url));
          if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'text/html');
            res.end(fs.readFileSync(filePath));
            return;
          }
        }
        next();
      }
    });
    
    // Call original setup if exists
    if (originalSetupMiddlewares) {
      middlewares = originalSetupMiddlewares(middlewares, devServer);
    }
    
    return middlewares;
  };
  
  // Disable historyApiFallback for specific paths
  devServerConfig.historyApiFallback = {
    rewrites: [
      { from: /^\/$/, to: '/landing.html' },
      { from: /^\/locations\/.*\.html$/, to: context => context.parsedUrl.pathname },
      { from: /./, to: '/index.html' }
    ]
  };

  // Apply visual edits dev server setup only if enabled
  if (config.enableVisualEdits && setupDevServer) {
    devServerConfig = setupDevServer(devServerConfig);
  }

  // Add health check endpoints if enabled
  if (config.enableHealthCheck && setupHealthEndpoints && healthPluginInstance) {
    const originalSetupMiddlewares = devServerConfig.setupMiddlewares;

    devServerConfig.setupMiddlewares = (middlewares, devServer) => {
      // Call original setup if exists
      if (originalSetupMiddlewares) {
        middlewares = originalSetupMiddlewares(middlewares, devServer);
      }

      // Setup health endpoints
      setupHealthEndpoints(devServer, healthPluginInstance);

      return middlewares;
    };
  }

  return devServerConfig;
};

module.exports = webpackConfig;
