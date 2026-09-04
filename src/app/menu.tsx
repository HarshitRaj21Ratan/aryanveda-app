import { Text, View, TouchableOpacity, ScrollView } from "react-native";
import { Link, useRouter } from "expo-router";
import { useAuthStore } from "@/store/auth.store";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { UserRole } from "@/types";

export default function Menu() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-5 py-4 border-b border-gray-100 flex-row items-center justify-between bg-white">
        <View className="flex-row items-center gap-2">
          <TouchableOpacity onPress={() => router.push('/dashboard')} className="p-1 mr-1">
            <Ionicons name="arrow-back" size={24} color="#4b5563" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-800">App Navigation</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            logout();
            router.replace('/(auth)/login');
          }}
          className="flex-row items-center gap-1 bg-red-50 px-3 py-1.5 rounded-lg border border-red-150"
        >
          <Ionicons name="log-out-outline" size={16} color="#ef4444" />
          <Text className="text-xs font-semibold text-red-600">Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
        {user && (
          <View className="mb-6 bg-orange-50 border border-orange-100 p-4 rounded-xl">
            <Text className="text-sm font-bold text-gray-800">Logged in as: {user.name}</Text>
            <Text className="text-xs text-gray-500 mt-1">Role: {user.role} · State: {user.state || 'N/A'}</Text>
          </View>
        )}

        <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Screens & Features</Text>

        <View className="gap-3">
          <Link href="/dashboard" asChild>
            <TouchableOpacity className="flex-row items-center justify-between bg-gray-50 border border-gray-100 p-3.5 rounded-xl">
              <View className="flex-row items-center gap-3">
                <Ionicons name="grid-outline" size={20} color="#f97316" />
                <Text className="text-sm font-semibold text-gray-700">Dashboard</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
            </TouchableOpacity>
          </Link>

          <Link href="/orders" asChild>
            <TouchableOpacity className="flex-row items-center justify-between bg-gray-50 border border-gray-100 p-3.5 rounded-xl">
              <View className="flex-row items-center gap-3">
                <Ionicons name="cart-outline" size={20} color="#f97316" />
                <Text className="text-sm font-semibold text-gray-700">Orders Dashboard</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
            </TouchableOpacity>
          </Link>

          <Link href="/inventory" asChild>
            <TouchableOpacity className="flex-row items-center justify-between bg-gray-50 border border-gray-100 p-3.5 rounded-xl">
              <View className="flex-row items-center gap-3">
                <Ionicons name="cube-outline" size={20} color="#f97316" />
                <Text className="text-sm font-semibold text-gray-700">Inventory Management</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
            </TouchableOpacity>
          </Link>

          <Link href="/inventory-analytics" asChild>
            <TouchableOpacity className="flex-row items-center justify-between bg-gray-50 border border-gray-100 p-3.5 rounded-xl">
              <View className="flex-row items-center gap-3">
                <Ionicons name="pie-chart-outline" size={20} color="#f97316" />
                <Text className="text-sm font-semibold text-gray-700">Inventory Analytics</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
            </TouchableOpacity>
          </Link>

          <Link href="/inventory-intel" asChild>
            <TouchableOpacity className="flex-row items-center justify-between bg-gray-50 border border-gray-100 p-3.5 rounded-xl">
              <View className="flex-row items-center gap-3">
                <Ionicons name="bulb-outline" size={20} color="#f97316" />
                <Text className="text-sm font-semibold text-gray-700">Inventory Intel</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
            </TouchableOpacity>
          </Link>

          <Link href="/beat-visits" asChild>
            <TouchableOpacity className="flex-row items-center justify-between bg-gray-50 border border-gray-100 p-3.5 rounded-xl">
              <View className="flex-row items-center gap-3">
                <Ionicons name="walk-outline" size={20} color="#f97316" />
                <Text className="text-sm font-semibold text-gray-700">Beat Visits / Retailers</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
            </TouchableOpacity>
          </Link>

          <Link href="/attendance" asChild>
            <TouchableOpacity className="flex-row items-center justify-between bg-gray-50 border border-gray-100 p-3.5 rounded-xl">
              <View className="flex-row items-center gap-3">
                <Ionicons name="calendar-outline" size={20} color="#f97316" />
                <Text className="text-sm font-semibold text-gray-700">Attendance Tracker</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
            </TouchableOpacity>
          </Link>

          <Link href="/announcement" asChild>
            <TouchableOpacity className="flex-row items-center justify-between bg-gray-50 border border-gray-100 p-3.5 rounded-xl">
              <View className="flex-row items-center gap-3">
                <Ionicons name="megaphone-outline" size={20} color="#f97316" />
                <Text className="text-sm font-semibold text-gray-700">Announcements</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
            </TouchableOpacity>
          </Link>

          <Link href="/gps-tracking" asChild>
            <TouchableOpacity className="flex-row items-center justify-between bg-gray-50 border border-gray-100 p-3.5 rounded-xl">
              <View className="flex-row items-center gap-3">
                <Ionicons name="navigate-outline" size={20} color="#f97316" />
                <Text className="text-sm font-semibold text-gray-700">GPS Live Tracking</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
            </TouchableOpacity>
          </Link>

          <Link href="/i-am-here" asChild>
            <TouchableOpacity className="flex-row items-center justify-between bg-gray-50 border border-gray-100 p-3.5 rounded-xl">
              <View className="flex-row items-center gap-3">
                <Ionicons name="pin-outline" size={20} color="#f97316" />
                <Text className="text-sm font-semibold text-gray-700">I Am Here (Location Check-in)</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
            </TouchableOpacity>
          </Link>

          <Link href="/catalog" asChild>
            <TouchableOpacity className="flex-row items-center justify-between bg-gray-50 border border-gray-100 p-3.5 rounded-xl">
              <View className="flex-row items-center gap-3">
                <Ionicons name="book-outline" size={20} color="#f97316" />
                <Text className="text-sm font-semibold text-gray-700">SKU Catalog Manager</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
            </TouchableOpacity>
          </Link>

          <Link href="/catalog/product-catalogs" asChild>
            <TouchableOpacity className="flex-row items-center justify-between bg-gray-50 border border-gray-100 p-3.5 rounded-xl">
              <View className="flex-row items-center gap-3">
                <Ionicons name="images-outline" size={20} color="#f97316" />
                <Text className="text-sm font-semibold text-gray-700">Product Catalogs</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
            </TouchableOpacity>
          </Link>

          <Link href="/skus" asChild>
            <TouchableOpacity className="flex-row items-center justify-between bg-gray-50 border border-gray-100 p-3.5 rounded-xl">
              <View className="flex-row items-center gap-3">
                <Ionicons name="pricetag-outline" size={20} color="#f97316" />
                <Text className="text-sm font-semibold text-gray-700">SKU Master</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
            </TouchableOpacity>
          </Link>

          <Link href="/stock-movements" asChild>
            <TouchableOpacity className="flex-row items-center justify-between bg-gray-50 border border-gray-100 p-3.5 rounded-xl">
              <View className="flex-row items-center gap-3">
                <Ionicons name="swap-horizontal-outline" size={20} color="#f97316" />
                <Text className="text-sm font-semibold text-gray-700">Stock Movements</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
            </TouchableOpacity>
          </Link>

          <Link href="/users" asChild>
            <TouchableOpacity className="flex-row items-center justify-between bg-gray-50 border border-gray-100 p-3.5 rounded-xl">
              <View className="flex-row items-center gap-3">
                <Ionicons name="people-outline" size={20} color="#f97316" />
                <Text className="text-sm font-semibold text-gray-700">User Management</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
            </TouchableOpacity>
          </Link>

          <Link href="/territories" asChild>
            <TouchableOpacity className="flex-row items-center justify-between bg-gray-50 border border-gray-100 p-3.5 rounded-xl">
              <View className="flex-row items-center gap-3">
                <Ionicons name="map-outline" size={20} color="#f97316" />
                <Text className="text-sm font-semibold text-gray-700">Territory Network Map</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
            </TouchableOpacity>
          </Link>

          <Link href="/leaderboard" asChild>
            <TouchableOpacity className="flex-row items-center justify-between bg-gray-50 border border-gray-100 p-3.5 rounded-xl">
              <View className="flex-row items-center gap-3">
                <Ionicons name="trophy-outline" size={20} color="#f97316" />
                <Text className="text-sm font-semibold text-gray-700">Leaderboard</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
            </TouchableOpacity>
          </Link>

          {(user?.role === UserRole.ADMIN || user?.role === UserRole.NSM || user?.role === UserRole.RSM || user?.role === UserRole.ASM || user?.role === UserRole.ASE) && (
            <Link href="/admin/performance" asChild>
              <TouchableOpacity className="flex-row items-center justify-between bg-gray-50 border border-gray-100 p-3.5 rounded-xl">
                <View className="flex-row items-center gap-3">
                  <Ionicons name="stats-chart-outline" size={20} color="#f97316" />
                  <Text className="text-sm font-semibold text-gray-700">Team Performance</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
              </TouchableOpacity>
            </Link>
          )}

          <Link href="/notifications" asChild>
            <TouchableOpacity className="flex-row items-center justify-between bg-gray-50 border border-gray-100 p-3.5 rounded-xl">
              <View className="flex-row items-center gap-3">
                <Ionicons name="notifications-outline" size={20} color="#f97316" />
                <Text className="text-sm font-semibold text-gray-700">Notifications List</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
            </TouchableOpacity>
          </Link>

          <Link href="/admin" asChild>
            <TouchableOpacity className="flex-row items-center justify-between bg-gray-50 border border-gray-100 p-3.5 rounded-xl">
              <View className="flex-row items-center gap-3">
                <Ionicons name="settings-outline" size={20} color="#f97316" />
                <Text className="text-sm font-semibold text-gray-700">Admin Control Portal</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
