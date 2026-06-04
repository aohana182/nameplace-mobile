// Expo Dynamic Configuration
// This file reads the static config from app.json and dynamically overrides fields,
// ensuring secrets are never hardcoded in source control.

module.exports = ({ config }) => {
  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: {
          // Read from environment variable in production/CI, fallback to dummy key in local development to prevent crashes
          apiKey: process.env.GOOGLE_MAPS_API_KEY || "AIzaSyDummyKeyForDevelopmentBypass123"
        }
      }
    }
  };
};
