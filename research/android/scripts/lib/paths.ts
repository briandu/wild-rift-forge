import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));

export const ANDROID_ROOT = path.resolve(scriptsDir, '../..');
export const INPUT_DIR = path.join(ANDROID_ROOT, 'input');
export const EXTRACTED_DIR = path.join(ANDROID_ROOT, 'extracted');
export const REPORTS_DIR = path.join(ANDROID_ROOT, 'reports');

export const DEFAULT_VERSION = '7.2.0.2460';

export const APKMIRROR_ORG = 'riot-games-inc';
export const APKMIRROR_REPO = 'league-of-legends-wild-rift';
export const APKMIRROR_LISTING_URL =
  'https://www.apkmirror.com/apk/riot-games-inc/league-of-legends-wild-rift/';

export type ApkTarget = 'base' | 'pad1';

const APK_FILE_BY_TARGET: Record<ApkTarget, string> = {
  base: 'base.apk',
  pad1: 'split_pad1.apk',
};

export function versionInputDir(version: string): string {
  return path.join(INPUT_DIR, version);
}

export function apkmPath(version: string): string {
  return path.join(versionInputDir(version), `${APKMIRROR_REPO}-${version}.apkm`);
}

export function apkPath(version: string, target: ApkTarget): string {
  return path.join(versionInputDir(version), APK_FILE_BY_TARGET[target]);
}

export function reportPath(name: string): string {
  return path.join(REPORTS_DIR, name);
}
