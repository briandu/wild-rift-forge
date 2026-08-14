import { describe, expect, it } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { accountHeadingName, firstNameFromUser, fullNameFromUser } from './user-name';

function user(partial: Partial<User>): User {
  return { email: 'brian.bh.du@gmail.com', ...partial } as User;
}

describe('firstNameFromUser', () => {
  it('prefers Google given_name', () => {
    expect(
      firstNameFromUser(
        user({
          user_metadata: { given_name: 'Brian', full_name: 'Brian Du', name: 'Brian Du' },
        }),
      ),
    ).toBe('Brian');
  });

  it('uses the first word of full_name when given_name is missing', () => {
    expect(firstNameFromUser(user({ user_metadata: { full_name: 'Brian Du' } }))).toBe('Brian');
  });

  it('reads Google identity_data when user_metadata has no name', () => {
    expect(
      firstNameFromUser(
        user({
          user_metadata: {},
          identities: [{ identity_data: { given_name: 'Brian', full_name: 'Brian Du' } }] as unknown as User['identities'],
        }),
      ),
    ).toBe('Brian');
  });

  it('ignores email-shaped names', () => {
    expect(firstNameFromUser(user({ user_metadata: { name: 'brian.bh.du@gmail.com' } }))).toBeNull();
  });
});

describe('accountHeadingName', () => {
  it('shows first name instead of email', () => {
    expect(accountHeadingName(user({ user_metadata: { full_name: 'Brian Du' } }))).toBe('Brian');
  });

  it('falls back to email when Google did not send a name', () => {
    expect(accountHeadingName(user({ user_metadata: {} }))).toBe('brian.bh.du@gmail.com');
  });
});

describe('fullNameFromUser', () => {
  it('returns the Google full name', () => {
    expect(fullNameFromUser(user({ user_metadata: { full_name: 'Brian Du' } }))).toBe('Brian Du');
  });
});
