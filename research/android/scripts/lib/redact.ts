const SECRET_PATTERNS: Array<{ re: RegExp; replacement: string }> = [
  { re: /MSDK_SDK_KEY\s*=\s*\S+/gi, replacement: 'MSDK_SDK_KEY=[redacted]' },
  { re: /MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8[\w+/=]+/g, replacement: '[redacted-public-key]' },
];

export function redactSecrets(value: string): string {
  let out = value;
  for (const { re, replacement } of SECRET_PATTERNS) {
    out = out.replace(re, replacement);
  }
  return out;
}
