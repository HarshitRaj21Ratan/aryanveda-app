import { apiClient } from '@/lib/api-client';
import { UserRole } from '@/types';

export interface RetailerInfo {
  entityId: string;
  name: string;
  phone: string;
  state: string;
  beat: string | null;
  authorizedAt: string | null;
}

export interface AvailableSO {
  entityId: string;
  name: string;
  phone: string;
  state: string;
  distributor: string | null;
  asm: string | null;
}

export interface TransferPreview {
  retailer: RetailerInfo;
  sourceSo: {
    entityId: string;
    name: string;
    distributor: string | null;
    asm: string | null;
    rsm: string | null;
  };
  targetSo: {
    entityId: string;
    name: string;
    distributor: string | null;
    asm: string | null;
    rsm: string | null;
  };
  changes: {
    field: string;
    from: string;
    to: string;
  }[];
  warnings?: string[];
}

export interface TransferResult {
  success: boolean;
  message: string;
  transfer?: {
    retailerEntityId: string;
    fromSo: string;
    toSo: string;
    transferredAt: string;
  };
  warnings?: string[];
}

export const retailerTransferService = {
  getMyRetailers: async (): Promise<RetailerInfo[]> => {
    const response = await apiClient.get<{ success: boolean; data: RetailerInfo[] }>(
      '/retailer-transfer/my-retailers'
    );
    return response.data.data;
  },

  getSoRetailers: async (soEntityId: string): Promise<RetailerInfo[]> => {
    const response = await apiClient.get<{ success: boolean; data: RetailerInfo[] }>(
      `/retailer-transfer/so-retailers/${encodeURIComponent(soEntityId)}`
    );
    return response.data.data;
  },

  getMultiSoRetailers: async (soEntityIds: string[]): Promise<RetailerInfo[]> => {
    if (!soEntityIds || soEntityIds.length === 0) return [];
    const response = await apiClient.post<{ success: boolean; data: RetailerInfo[] }>(
      '/retailer-transfer/multi-so-retailers',
      { soEntityIds }
    );
    return response.data.data;
  },

  getMultiSoBeats: async (soEntityIds: string[]): Promise<string[]> => {
    if (!soEntityIds || soEntityIds.length === 0) return [];

    // Helper to split array into smaller chunks
    const chunkArray = <T>(arr: T[], size: number): T[][] => {
      const chunks: T[][] = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
      }
      return chunks;
    };

    // For bulk SO selections, chunk requests into parallel batches of 10 SOs
    // to execute ultra-fast indexed MongoDB queries on backend without triggering 15s timeout
    const batches = chunkArray(soEntityIds, 10);

    try {
      const batchResults = await Promise.allSettled(
        batches.map(async (batch) => {
          try {
            const retailers = await retailerTransferService.getMultiSoRetailers(batch);
            return retailers
              .map((r) => r.beat)
              .filter((b): b is string => Boolean(b && typeof b === 'string' && b.trim().length > 0));
          } catch {
            const response = await apiClient.post<{ success: boolean; data: string[] }>(
              '/retailer-transfer/multi-so-beats',
              { soEntityIds: batch }
            );
            return response.data.data ?? [];
          }
        })
      );

      const allBeats = batchResults
        .filter((r): r is PromiseFulfilledResult<string[]> => r.status === 'fulfilled')
        .flatMap((r) => r.value);

      const uniqueBeats = Array.from(new Set(allBeats.map((b) => b.trim()))).sort();
      return uniqueBeats;
    } catch (err) {
      console.error('Failed to load multi-SO beats:', err);
      return [];
    }
  },

  transferBulkBeat: async (
    sourceSoEntityIds: string[],
    targetSoEntityId: string,
    beats?: string[]
  ): Promise<TransferResult> => {
    const response = await apiClient.post<TransferResult>('/retailer-transfer/bulk-beat', {
      sourceSoEntityIds,
      targetSoEntityId,
      beats,
    });
    return response.data;
  },

  getAvailableSOs: async (excludeSoEntityId?: string): Promise<AvailableSO[]> => {
    const params = excludeSoEntityId ? `?exclude=${encodeURIComponent(excludeSoEntityId)}` : '';
    const response = await apiClient.get<{ success: boolean; data: AvailableSO[] }>(
      `/retailer-transfer/available-sos${params}`
    );
    return response.data.data;
  },

  previewTransfer: async (
    retailerEntityId: string,
    targetSoEntityId: string
  ): Promise<TransferPreview> => {
    const response = await apiClient.post<{ success: boolean; data: TransferPreview }>(
      '/retailer-transfer/preview',
      {
        retailerEntityId,
        targetSoEntityId,
      }
    );
    return response.data.data;
  },

  transferRetailer: async (
    retailerEntityId: string,
    sourceSoEntityId: string,
    targetSoEntityId: string
  ): Promise<TransferResult> => {
    const response = await apiClient.post<TransferResult>('/retailer-transfer/transfer', {
      retailerEntityId,
      sourceSoEntityId,
      targetSoEntityId,
    });
    return response.data;
  },

  transferDistributor: async (
    sourceDistributorEntityId: string,
    targetDistributorEntityId: string,
    selectedSourceIds?: string[]
  ): Promise<TransferResult> => {
    const response = await apiClient.post<TransferResult>('/retailer-transfer/distributor', {
      sourceDistributorEntityId,
      targetDistributorEntityId,
      selectedSourceIds,
    });
    return response.data;
  },

  transferSuperStockist: async (
    sourceSsEntityId: string,
    targetSsEntityId: string,
    distributorMapping?: Record<string, string>
  ): Promise<TransferResult> => {
    const response = await apiClient.post<TransferResult>('/retailer-transfer/super-stockist', {
      sourceSsEntityId,
      targetSsEntityId,
      distributorMapping,
    });
    return response.data;
  },

  transferBeat: async (
    beat: string,
    state: string,
    sourceSoEntityId: string,
    targetSoEntityId: string
  ): Promise<TransferResult> => {
    const response = await apiClient.post<TransferResult>('/retailer-transfer/beat', {
      beat,
      state,
      sourceSoEntityId,
      targetSoEntityId,
    });
    return response.data;
  },

  changeRetailerDistributor: async (
    retailerEntityId: string,
    newDistributorEntityId: string
  ): Promise<TransferResult> => {
    const response = await apiClient.post<TransferResult>('/retailer-transfer/change-distributor', {
      retailerEntityId,
      newDistributorEntityId,
    });
    return response.data;
  },

  changeParent: async (
    targetEntityId: string,
    newParentEntityId: string
  ): Promise<TransferResult> => {
    const response = await apiClient.post<TransferResult>('/retailer-transfer/change-parent', {
      targetEntityId,
      newParentEntityId,
    });
    return response.data;
  },

  previewAseTransfer: async (
    sourceAseEntityId: string,
    targetAseEntityId: string
  ): Promise<{
    sourceSos: { entityId: string; name: string }[];
    targetSos: { entityId: string; name: string }[];
    suggestedMapping: Record<string, string>;
  }> => {
    const response = await apiClient.post<{
      success: boolean;
      data: {
        sourceSos: { entityId: string; name: string }[];
        targetSos: { entityId: string; name: string }[];
        suggestedMapping: Record<string, string>;
      };
    }>('/retailer-transfer/ase-preview', {
      sourceAseEntityId,
      targetAseEntityId,
    });
    return response.data.data;
  },

  transferAse: async (
    sourceAseEntityId: string,
    targetAseEntityId: string,
    soMapping?: Record<string, string>,
    newAsmEntityId?: string,
    selectedChildIds?: string[]
  ): Promise<TransferResult> => {
    const response = await apiClient.post<TransferResult>('/retailer-transfer/ase', {
      sourceAseEntityId,
      targetAseEntityId,
      soMapping,
      newAsmEntityId,
      selectedSourceIds: selectedChildIds,
    });
    return response.data;
  },

  previewAsmTransfer: async (
    sourceAsmEntityId: string,
    targetAsmEntityId: string
  ): Promise<{
    sourceAses: { entityId: string; name: string; role: string; parentId: string | null }[];
    targetAses: { entityId: string; name: string; role: string }[];
    suggestedMapping: Record<string, string>;
  }> => {
    const response = await apiClient.post<{
      success: boolean;
      data: {
        sourceAses: { entityId: string; name: string; role: string; parentId: string | null }[];
        targetAses: { entityId: string; name: string; role: string }[];
        suggestedMapping: Record<string, string>;
      };
    }>('/retailer-transfer/asm-preview', {
      sourceAsmEntityId,
      targetAsmEntityId,
    });
    return response.data.data;
  },

  transferAsm: async (
    sourceAsmEntityId: string,
    targetAsmEntityId: string,
    aseMapping?: Record<string, string>,
    newRsmEntityId?: string,
    selectedChildIds?: string[]
  ): Promise<TransferResult> => {
    const response = await apiClient.post<TransferResult>('/retailer-transfer/asm', {
      sourceAsmEntityId,
      targetAsmEntityId,
      aseMapping,
      newRsmEntityId,
      selectedSourceIds: selectedChildIds,
    });
    return response.data;
  },

  previewRsmTransfer: async (
    sourceRsmEntityId: string,
    targetRsmEntityId: string
  ): Promise<{
    sourceAsms: { entityId: string; name: string; role: string; parentId: string | null }[];
    targetAsms: { entityId: string; name: string; role: string }[];
    suggestedMapping: Record<string, string>;
  }> => {
    const response = await apiClient.post<{
      success: boolean;
      data: {
        sourceAsms: { entityId: string; name: string; role: string; parentId: string | null }[];
        targetAsms: { entityId: string; name: string; role: string }[];
        suggestedMapping: Record<string, string>;
      };
    }>('/retailer-transfer/rsm-preview', {
      sourceRsmEntityId,
      targetRsmEntityId,
    });
    return response.data.data;
  },

  transferRsm: async (
    sourceRsmEntityId: string,
    targetRsmEntityId: string,
    asmMapping?: Record<string, string>,
    selectedSourceIds?: string[]
  ): Promise<TransferResult> => {
    const response = await apiClient.post<TransferResult>('/retailer-transfer/rsm', {
      sourceRsmEntityId,
      targetRsmEntityId,
      asmMapping,
      selectedSourceIds,
    });
    return response.data;
  },

  changeRetailerSalesAgent: async (
    retailerEntityId: string,
    newSalesAgentEntityId: string
  ): Promise<TransferResult> => {
    const response = await apiClient.post<TransferResult>('/retailer-transfer/change-sales-agent', {
      retailerEntityId,
      newSalesAgentEntityId,
    });
    return response.data;
  },
};
