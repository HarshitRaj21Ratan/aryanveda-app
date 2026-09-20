import React from 'react';
import { useRouter } from 'expo-router';
import AddSkuModal from '@/components/catalog/AddSkuModal';

export default function NewSkuScreen() {
  const router = useRouter();

  return (
    <AddSkuModal
      visible={true}
      onClose={() => router.back()}
      onSuccess={() => router.back()}
    />
  );
}
