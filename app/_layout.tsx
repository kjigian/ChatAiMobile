import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Drawer } from 'expo-router/drawer';
import CustomDrawer from '@/components/CustomDrawer';
import { ProviderModelProvider } from '../context/ProviderModelContext';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <ProviderModelProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Drawer drawerContent={(props) => <CustomDrawer {...props} />} screenOptions={{ headerShown: true }}>
        <Drawer.Screen name="index" options={{ title: 'GeminiChat' }} />
        <Drawer.Screen name="conversations" options={{ title: 'History' }} />
        <Drawer.Screen name="settings" options={{ title: 'Settings' }} />
        <Drawer.Screen name="+not-found" />
      </Drawer>
      <StatusBar style="auto" />
    </ThemeProvider>
    </ProviderModelProvider>
  );
}
