import { access } from 'node:fs/promises';
import { apkPath, type ApkTarget } from './paths';
import { getFlag } from './cli';

export async function resolveApkPath(target: ApkTarget): Promise<{ apk: string; version: string | null }> {
  const explicit = getFlag('apk');
  if (explicit) {
    await access(explicit);
    return { apk: explicit, version: getFlag('version') ?? null };
  }
  const version = getFlag('version');
  if (!version) {
    throw new Error('Provide --apk <path> or --version <store-version>');
  }
  const resolved = apkPath(version, target);
  await access(resolved);
  return { apk: resolved, version };
}

export function resolveTargetFlag(fallback: ApkTarget): ApkTarget {
  const target = getFlag('target') ?? fallback;
  if (target !== 'base' && target !== 'pad1') {
    throw new Error('--target must be base or pad1');
  }
  return target;
}
