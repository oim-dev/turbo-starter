import { argon2id, hash, verify } from 'argon2';

export function hashPassword(password: string): Promise<string> {
  return hash(password, {
    type: argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

let dummyHash: Promise<string> | undefined;

export async function verifyPassword(
  passwordHash: string | undefined,
  password: string,
): Promise<boolean> {
  dummyHash ??= hashPassword('non-account-timing-placeholder');
  const valid = await verify(passwordHash ?? (await dummyHash), password);
  return passwordHash !== undefined && valid;
}
