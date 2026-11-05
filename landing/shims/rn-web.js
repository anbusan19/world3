// react-native-web plus the few native-registry helpers that react-native-svg imports but never calls on the web.
export * from 'react-native-web';
export const TurboModuleRegistry = { getEnforcing: () => ({}), get: () => null };
export const codegenNativeComponent = () => () => null;
export const codegenNativeCommands = () => ({});
// react-native-web's BackHandler logs an error on every use; the Android back button does not exist in a browser.
export const BackHandler = { addEventListener: () => ({ remove() {} }), removeEventListener() {}, exitApp() {} };
