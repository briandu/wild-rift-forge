export function getFlag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || index + 1 >= process.argv.length) {
    return undefined;
  }
  return process.argv[index + 1];
}

export function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

export function requireFlag(name: string): string {
  const value = getFlag(name);
  if (!value) {
    throw new Error(`Missing required --${name}`);
  }
  return value;
}
