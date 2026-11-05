// Native-only Expo modules, replaced by do-nothing versions on the web.
export const StatusBar = () => null;
export const impactAsync = async () => {};
export const notificationAsync = async () => {};
export const selectionAsync = async () => {};
export const ImpactFeedbackStyle = { Light: 'light', Medium: 'medium', Heavy: 'heavy' };
export const NotificationFeedbackType = { Success: 'success', Warning: 'warning', Error: 'error' };
export const preventAutoHideAsync = async () => {};
export const hideAsync = async () => {};
export const setBackgroundColorAsync = async () => {};
const store = new Map();
export const getItemAsync = async (k) => store.get(k) ?? null;
export const setItemAsync = async (k, v) => { store.set(k, v); };
export const deleteItemAsync = async (k) => { store.delete(k); };
export default { expoConfig: { version: '1.0.0' }, nativeAppVersion: '1.0.0' };
export const useFonts = () => [true, null];
export const PlusJakartaSans_500Medium = 'PlusJakartaSans_500Medium';
export const PlusJakartaSans_700Bold = 'PlusJakartaSans_700Bold';
export const PlusJakartaSans_800ExtraBold = 'PlusJakartaSans_800ExtraBold';
// expo-camera
import { View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
// The camera preview on the web is a flat, pastel park scene (no real camera on the landing page).
export const CameraView = ({ children, style }) => (
  <View style={[style, { backgroundColor: '#CFE9F1' }]}>
    <Svg width="100%" height="100%" viewBox="0 0 390 800" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', left: 0, top: 0 }}>
      <Rect width="390" height="800" fill="#CFE9F1" />
      <Circle cx="300" cy="190" r="46" fill="#F9D77E" />
      <Ellipse cx="90" cy="250" rx="62" ry="20" fill="#FFFFFF" />
      <Ellipse cx="130" cy="236" rx="40" ry="18" fill="#FFFFFF" />
      <Ellipse cx="320" cy="330" rx="48" ry="14" fill="#FFFFFF" />
      <Ellipse cx="60" cy="520" rx="260" ry="150" fill="#B9DC8E" />
      <Ellipse cx="360" cy="560" rx="260" ry="160" fill="#A6D16C" />
      <Rect y="560" width="390" height="240" fill="#93C45C" />
      <Rect x="276" y="470" width="14" height="70" fill="#9C6B3F" />
      <Circle cx="283" cy="450" r="46" fill="#7FB04A" />
      <Circle cx="252" cy="476" r="30" fill="#8CC152" />
      <Circle cx="316" cy="474" r="30" fill="#8CC152" />
      <Path d="M0 640 Q195 600 390 650 L390 800 L0 800Z" fill="#86B955" />
    </Svg>
    {children}
  </View>
);
export const useCameraPermissions = () => [{ granted: true, canAskAgain: true }, async () => ({ granted: true })];
