import {
  MAX_PASSWORD,
  MAX_USERNAME,
  MIN_PASSWORD,
  MIN_USERNAME,
  validatePassword,
  validateUsername,
} from '../src/auth/credentials';

describe('validateUsername', () => {
  it('accepts a name within bounds', () => {
    expect(validateUsername('bob')).toBeNull();
  });

  it('accepts exactly the boundary lengths', () => {
    expect(validateUsername('a'.repeat(MIN_USERNAME))).toBeNull();
    expect(validateUsername('a'.repeat(MAX_USERNAME))).toBeNull();
  });

  it('rejects a name shorter than the minimum', () => {
    expect(validateUsername('a'.repeat(MIN_USERNAME - 1))).not.toBeNull();
  });

  it('rejects a name longer than the maximum', () => {
    expect(validateUsername('a'.repeat(MAX_USERNAME + 1))).not.toBeNull();
  });

  it('trims surrounding whitespace before measuring length', () => {
    expect(validateUsername(`  ${'a'.repeat(MIN_USERNAME)}  `)).toBeNull();
    expect(validateUsername('  ab  ')).not.toBeNull(); // still 2 chars once trimmed
  });
});

describe('validatePassword', () => {
  it('accepts a password within bounds', () => {
    expect(validatePassword('a'.repeat(MIN_PASSWORD))).toBeNull();
  });

  it('accepts exactly the boundary lengths', () => {
    expect(validatePassword('a'.repeat(MIN_PASSWORD))).toBeNull();
    expect(validatePassword('a'.repeat(MAX_PASSWORD))).toBeNull();
  });

  it('rejects a password shorter than the minimum', () => {
    expect(validatePassword('a'.repeat(MIN_PASSWORD - 1))).not.toBeNull();
  });

  it('rejects a password longer than the maximum', () => {
    expect(validatePassword('a'.repeat(MAX_PASSWORD + 1))).not.toBeNull();
  });
});
