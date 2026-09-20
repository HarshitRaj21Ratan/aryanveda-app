import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * ScopedStorage Utility — User-Isolated Mobile State Persistence
 *
 * Scopes key-value storage to the active logged-in user entity ID
 * (e.g. `dms_<key>_<userId>`). If no userId is available, falls back to `dms_<key>`.
 */

const memoryCache = new Map<string, string>();

export const ScopedStorage = {
  getScopedKey(key: string, userId?: string | null): string {
    if (!userId) return `dms_${key}`;
    return `dms_${key}_${userId}`;
  },

  async getItem(key: string, userId?: string | null): Promise<string | null> {
    const scopedKey = this.getScopedKey(key, userId);
    if (memoryCache.has(scopedKey)) {
      return memoryCache.get(scopedKey) ?? null;
    }

    try {
      const val = await AsyncStorage.getItem(scopedKey);
      if (val !== null) {
        memoryCache.set(scopedKey, val);
        return val;
      }

      // Legacy key fallback
      const legacyKey = `dms_${key}`;
      const legacyVal = await AsyncStorage.getItem(legacyKey);
      if (legacyVal !== null) {
        memoryCache.set(scopedKey, legacyVal);
        return legacyVal;
      }

      const rawVal = await AsyncStorage.getItem(key);
      if (rawVal !== null) {
        memoryCache.set(scopedKey, rawVal);
        return rawVal;
      }

      return null;
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string, userId?: string | null): Promise<void> {
    const scopedKey = this.getScopedKey(key, userId);
    memoryCache.set(scopedKey, value);

    try {
      await AsyncStorage.setItem(scopedKey, value);
    } catch (e) {
      console.warn('[ScopedStorage] Failed to setItem:', e);
    }
  },

  async removeItem(key: string, userId?: string | null): Promise<void> {
    const scopedKey = this.getScopedKey(key, userId);
    memoryCache.delete(scopedKey);
    memoryCache.delete(`dms_${key}`);
    memoryCache.delete(key);

    try {
      if (userId) {
        await AsyncStorage.removeItem(scopedKey);
      }
      await AsyncStorage.removeItem(`dms_${key}`);
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.warn('[ScopedStorage] Failed to removeItem:', e);
    }
  },
};
