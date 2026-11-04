// craco.config.js
const path = require("path");
require("dotenv").config();
// CRA's bare PostCSS plugin name can resolve Tailwind from a sibling workspace package.
const tailwindPostCssPlugin = require("tailwindcss");

// Check if we're in development/preview mode (not production build)
// Craco sets NODE_ENV=development for start, NODE_ENV=production for build
const isDevServer = process.env.NODE_ENV !== "production";

// Environment variable overrides
const config = {
  enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === "true",
};

function makeDevServerV5Compatible(devServerConfig) {
  const {
    https,
    onAfterSetupMiddleware,
    onBeforeSetupMiddleware,
    onListening,
    setupMiddlewares,
    ...compatibleConfig
  } = devServerConfig;

  compatibleConfig.server =
    typeof https === "object"
      ? { type: "https", options: https }
      : https
        ? "https"
        : "http";
  compatibleConfig.headers = {
    ...compatibleConfig.headers,
    "Cross-Origin-Resource-Policy": "same-origin",
  };

  if (onBeforeSetupMiddleware || setupMiddlewares) {
    compatibleConfig.setupMiddlewares = (middlewares, devServer) => {
      if (onBeforeSetupMiddleware) {
        onBeforeSetupMiddleware(devServer);
      }

      return setupMiddlewares
        ? setupMiddlewares(middlewares, devServer)
        : middlewares;
    };
  }

  compatibleConfig.onListening = (devServer) => {
    devServer.close ??= (callback) => devServer.stopCallback(callback);

    if (onListening) {
      onListening(devServer);
    }
    if (onAfterSetupMiddleware) {
      onAfterSetupMiddleware(devServer);
    }
  };

  return compatibleConfig;
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

let webpackConfig = {
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
      const updateTailwindPlugin = (rules = []) => {
        for (const rule of rules) {
          if (rule.oneOf) updateTailwindPlugin(rule.oneOf);
          if (rule.rules) updateTailwindPlugin(rule.rules);
          const uses = Array.isArray(rule.use) ? rule.use : rule.use ? [rule.use] : [];
          for (const use of uses) {
            if (!String(use?.loader || "").includes("postcss-loader")) continue;
            const plugins = use.options?.postcssOptions?.plugins;
            if (!Array.isArray(plugins)) continue;
            const tailwindIndex = plugins.indexOf("tailwindcss");
            if (tailwindIndex >= 0) plugins[tailwindIndex] = tailwindPostCssPlugin;
          }
        }
      };
      updateTailwindPlugin(webpackConfig.module?.rules);

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

webpackConfig.devServer = (devServerConfig) => {
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

const configureDevServer = webpackConfig.devServer;
webpackConfig.devServer = (devServerConfig) => {
  const compatible = makeDevServerV5Compatible(configureDevServer(devServerConfig));
  // Proxy /api calls to the FastAPI backend so the browser never hits a
  // cross-origin port — works transparently in Replit's proxied iframe.
  // /api is routed directly to FastAPI by the multi-artifact proxy.
  // Do not add a second frontend proxy or change the existing API contract.
  delete compatible.proxy;
  // Allow all hosts (required for Replit's proxied preview iframe).
  compatible.allowedHosts = "all";
  return compatible;
};

module.exports = webpackConfig;
