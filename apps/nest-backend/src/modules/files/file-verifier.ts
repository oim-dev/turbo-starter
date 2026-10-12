import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  ObjectStorage,
  type StoredObject,
} from '../../infrastructure/storage/object-storage.service';

@Injectable()
export class FileVerifier {
  constructor(private readonly storage: ObjectStorage) {}

  async verify(
    object: StoredObject,
    expected: { byteSize: bigint; claimedSha256: string },
  ): Promise<string> {
    const source = await this.storage.get(object);
    const hash = createHash('sha256');
    let byteSize = 0n;
    // Проверка целостности потоковая, без фильтра формата и общего дедлайна
    // по размеру. Зависший транспорт ограничен socket idle timeout хранилища.
    try {
      for await (const chunk of source) {
        const bytes: Buffer = Buffer.isBuffer(chunk)
          ? chunk
          : Buffer.from(chunk as Uint8Array);
        byteSize += BigInt(bytes.length);
        if (byteSize > expected.byteSize)
          this.invalid(
            'FILE_SIZE_MISMATCH',
            'Размер файла не совпадает с заявленным.',
          );
        hash.update(bytes);
      }
      if (byteSize !== expected.byteSize)
        this.invalid('FILE_SIZE_MISMATCH', 'Файл получен не полностью.');
    } finally {
      source.destroy();
    }
    const sha256 = hash.digest('hex');
    if (sha256 !== expected.claimedSha256)
      this.invalid(
        'FILE_HASH_MISMATCH',
        'SHA-256 файла не совпадает с заявленным.',
      );
    return sha256;
  }

  private invalid(code: string, message: string): never {
    throw new BadRequestException({ code, message });
  }
}
