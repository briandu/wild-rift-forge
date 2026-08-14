import type { User } from '@supabase/supabase-js';

type NameMeta = {
  given_name?: string;
  first_name?: string;
  full_name?: string;
  name?: string;
};

function firstToken(value: string | undefined | null): string | null {
  const token = value?.trim().split(/\s+/)[0];
  if (!token || token.includes('@')) return null;
  return token;
}

function fullName(value: string | undefined | null): string | null {
  const name = value?.trim();
  if (!name || name.includes('@')) return null;
  return name;
}

function nameFromMeta(meta: NameMeta | undefined | null): { first: string | null; full: string | null } {
  const first = firstToken(meta?.given_name) || firstToken(meta?.first_name);
  const full = fullName(meta?.full_name) || fullName(meta?.name);
  return { first: first || firstToken(full), full };
}

function metasFrom(user: User): NameMeta[] {
  const metas: NameMeta[] = [user.user_metadata as NameMeta];
  for (const identity of user.identities ?? []) {
    metas.push(identity.identity_data as NameMeta);
  }
  return metas;
}

/** Given name from Google/OAuth metadata, else the first word of the full name. */
export function firstNameFromUser(user: User | null | undefined): string | null {
  if (!user) return null;
  for (const meta of metasFrom(user)) {
    const { first } = nameFromMeta(meta);
    if (first) return first;
  }
  return null;
}

/** Full display name from Google/OAuth metadata. */
export function fullNameFromUser(user: User | null | undefined): string | null {
  if (!user) return null;
  for (const meta of metasFrom(user)) {
    const { full } = nameFromMeta(meta);
    if (full) return full;
  }
  return null;
}

/** Large heading on /me: first name, then email if the account has no name. */
export function accountHeadingName(user: User | null | undefined): string {
  return firstNameFromUser(user) || user?.email || 'Account';
}
