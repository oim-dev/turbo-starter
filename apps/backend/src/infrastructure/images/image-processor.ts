import type { StoredObject } from '../storage/image-storage.service';
import type { VariantPlan } from '../../modules/images/image-variants';
import type { SourceMetadata } from '../../modules/images/image-metadata';

export interface ProcessedImage {
  bytes: Buffer;
  width: number;
  height: number;
  format: string;
  mimeType: string;
}

export abstract class ImageProcessor {
  abstract normalizeIndexedPng(
    source: StoredObject,
    metadata: SourceMetadata,
    signal: AbortSignal,
  ): Promise<StoredObject>;

  abstract process(
    source: StoredObject,
    plan: VariantPlan,
    signal: AbortSignal,
  ): Promise<ProcessedImage>;
}
