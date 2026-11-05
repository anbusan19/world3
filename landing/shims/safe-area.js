import { View } from 'react-native';
export const SafeAreaProvider = ({ children, style }) => <View style={[{ flex: 1 }, style]}>{children}</View>;
export const SafeAreaView = View;
export const useSafeAreaInsets = () => ({ top: 0, bottom: 0, left: 0, right: 0 });
