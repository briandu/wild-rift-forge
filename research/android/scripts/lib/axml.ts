/**
 * Minimal Android binary XML (AXML / ResXML) decoder for AndroidManifest.xml.
 * Reads the string pool and start-element attributes only — enough for research notes.
 */

const RES_XML_TYPE = 0x0003;
const RES_STRING_POOL_TYPE = 0x0001;
const RES_XML_START_ELEMENT_TYPE = 0x0102;
const UTF8_FLAG = 1 << 8;

export interface ManifestAttribute {
  name: string;
  value: string;
}

export interface ManifestElement {
  name: string;
  attributes: ManifestAttribute[];
}

export interface DecodedManifest {
  packageName: string | null;
  versionName: string | null;
  versionCode: string | null;
  permissions: string[];
  activities: string[];
  services: string[];
  providers: string[];
  receivers: string[];
  usesFeatures: string[];
  metaData: Array<{ name: string; value: string }>;
  elements: ManifestElement[];
}

function readU16(buffer: Buffer, offset: number): number {
  return buffer.readUInt16LE(offset);
}

function readU32(buffer: Buffer, offset: number): number {
  return buffer.readUInt32LE(offset);
}

function decodeLengthPrefixedUtf8(buffer: Buffer, offset: number): { value: string; next: number } {
  let cursor = offset;
  // optional 2-byte character length when high bit set
  if (buffer[cursor]! & 0x80) {
    cursor += 2;
  } else {
    cursor += 1;
  }
  let byteLen = buffer[cursor]!;
  if (byteLen & 0x80) {
    byteLen = ((byteLen & 0x7f) << 8) | buffer[cursor + 1]!;
    cursor += 2;
  } else {
    cursor += 1;
  }
  return {
    value: buffer.subarray(cursor, cursor + byteLen).toString('utf8'),
    next: cursor + byteLen + 1,
  };
}

function decodeLengthPrefixedUtf16(buffer: Buffer, offset: number): string {
  let charCount = readU16(buffer, offset);
  let cursor = offset + 2;
  if (charCount & 0x8000) {
    charCount = ((charCount & 0x7fff) << 16) | readU16(buffer, cursor);
    cursor += 2;
  }
  return buffer.subarray(cursor, cursor + charCount * 2).toString('utf16le');
}

function parseStringPool(buffer: Buffer, poolOffset: number): string[] {
  const stringCount = readU32(buffer, poolOffset + 8);
  const flags = readU32(buffer, poolOffset + 16);
  const stringsStart = readU32(buffer, poolOffset + 20);
  const utf8 = (flags & UTF8_FLAG) !== 0;
  const strings: string[] = [];
  for (let i = 0; i < stringCount; i += 1) {
    const rel = readU32(buffer, poolOffset + 28 + i * 4);
    const abs = poolOffset + stringsStart + rel;
    strings.push(utf8 ? decodeLengthPrefixedUtf8(buffer, abs).value : decodeLengthPrefixedUtf16(buffer, abs));
  }
  return strings;
}

function attrValue(buffer: Buffer, offset: number, strings: string[]): string {
  const dataType = buffer[offset + 15]!;
  const data = readU32(buffer, offset + 16);
  // TYPE_STRING
  if (dataType === 0x03 && data >= 0 && data < strings.length) {
    return strings[data] ?? '';
  }
  // TYPE_INT_DEC / TYPE_INT_HEX / TYPE_INT_BOOLEAN
  if (dataType === 0x10 || dataType === 0x11) {
    return String(data);
  }
  if (dataType === 0x12) {
    return data !== 0 ? 'true' : 'false';
  }
  // TYPE_REFERENCE
  if (dataType === 0x01) {
    return `@0x${data.toString(16)}`;
  }
  return `0x${data.toString(16)}`;
}

export function decodeAndroidManifest(buffer: Buffer): DecodedManifest {
  if (buffer.length < 8 || readU16(buffer, 0) !== RES_XML_TYPE) {
    throw new Error('Not an Android binary XML document');
  }
  const strings = parseStringPool(buffer, 8);
  const elements: ManifestElement[] = [];
  let offset = 8;
  while (offset + 8 <= buffer.length) {
    const type = readU16(buffer, offset);
    const chunkSize = readU32(buffer, offset + 4);
    if (chunkSize < 8 || offset + chunkSize > buffer.length) {
      break;
    }
    if (type === RES_STRING_POOL_TYPE) {
      offset += chunkSize;
      continue;
    }
    if (type === RES_XML_START_ELEMENT_TYPE) {
      const nameIndex = readU32(buffer, offset + 20);
      const attributeCount = readU16(buffer, offset + 28);
      const attributes: ManifestAttribute[] = [];
      let attrOffset = offset + 36;
      for (let i = 0; i < attributeCount; i += 1) {
        const nameIdx = readU32(buffer, attrOffset + 4);
        const rawValueIdx = readU32(buffer, attrOffset + 8);
        const name = strings[nameIdx] ?? `str:${nameIdx}`;
        const value =
          rawValueIdx !== 0xffffffff && rawValueIdx < strings.length
            ? (strings[rawValueIdx] ?? attrValue(buffer, attrOffset, strings))
            : attrValue(buffer, attrOffset, strings);
        attributes.push({ name, value });
        attrOffset += 20;
      }
      elements.push({ name: strings[nameIndex] ?? 'unknown', attributes });
    }
    offset += chunkSize;
  }

  const attr = (element: ManifestElement, name: string): string | null =>
    element.attributes.find((item) => item.name === name)?.value ?? null;

  const named = (tag: string): ManifestElement[] => elements.filter((element) => element.name === tag);
  const manifest = named('manifest')[0];

  return {
    packageName: manifest ? attr(manifest, 'package') : null,
    versionName: manifest ? attr(manifest, 'versionName') : null,
    versionCode: manifest ? attr(manifest, 'versionCode') : null,
    permissions: named('uses-permission')
      .map((element) => attr(element, 'name'))
      .filter((value): value is string => Boolean(value)),
    activities: named('activity')
      .map((element) => attr(element, 'name'))
      .filter((value): value is string => Boolean(value)),
    services: named('service')
      .map((element) => attr(element, 'name'))
      .filter((value): value is string => Boolean(value)),
    providers: named('provider')
      .map((element) => attr(element, 'name'))
      .filter((value): value is string => Boolean(value)),
    receivers: named('receiver')
      .map((element) => attr(element, 'name'))
      .filter((value): value is string => Boolean(value)),
    usesFeatures: named('uses-feature')
      .map((element) => attr(element, 'name') ?? attr(element, 'glEsVersion'))
      .filter((value): value is string => Boolean(value)),
    metaData: named('meta-data')
      .map((element) => ({
        name: attr(element, 'name') ?? '',
        value: attr(element, 'value') ?? attr(element, 'resource') ?? '',
      }))
      .filter((item) => item.name),
    elements,
  };
}
