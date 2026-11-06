/** @type {import('next').NextConfig} */
const noop = './shims/noop-modules.js';
const nextConfig = {
  allowedDevOrigins: ['127.0.0.1'], // lets the dev server be opened as 127.0.0.1 too
  // The app's own screens (migrated/) run in the browser through react-native-web; native-only modules get web stand-ins.
  turbopack: {
    resolveExtensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
    resolveAlias: {
      'react-native': './shims/rn-web.js',
      'react-native-svg': './shims/svg.js',
      '@expo/vector-icons': './shims/vector-icons.js',
      'react-native-safe-area-context': './shims/safe-area.js',
      '@maplibre/maplibre-react-native': './shims/maplibre.js',
      'expo-status-bar': noop,
      'expo-haptics': noop,
      'expo-secure-store': noop,
      'expo-splash-screen': noop,
      'expo-system-ui': noop,
      'expo-constants': noop,
      'expo-camera': noop,
      '@expo-google-fonts/plus-jakarta-sans': noop,
      '@expo-google-fonts/geist-mono': noop,
      'expo-image-picker': noop,
      'expo-file-system/legacy': noop,
      'expo-location': noop,
    },
  },
};
export default nextConfig;
