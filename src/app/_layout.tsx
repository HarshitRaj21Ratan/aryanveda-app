import { Stack } from "expo-router";
import { Providers } from "@/components/providers";
import AppLayout from "@/components/layout/AppLayout";
import { cssInterop } from "react-native-css-interop";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../../global.css";

cssInterop(Ionicons, {
  className: {
    target: "style",
    nativeStyleToProp: {
      color: true,
      size: true,
    },
  },
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Providers>
        <AppLayout>
          <Stack screenOptions={{ headerShown: false }} />
        </AppLayout>
      </Providers>
    </SafeAreaProvider>
  );
}


