// Client-side mirror of the backend's credentials schema (backend/src/routes/auth.js,
// documented in API.md). The server validates these regardless and answers 400;
// checking here is only so the user gets a message without a round-trip.
//
// Kept in one place so the Login and Register screens cannot drift apart, or from
// the server -- they previously declared their own copies with different bounds.
export const MIN_USERNAME = 3;
export const MAX_USERNAME = 32;
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 128;

// Both return a user-facing message, or null when the value is acceptable.

export function validateUsername(username: string): string | null {
  const { length } = username.trim();
  if (length < MIN_USERNAME || length > MAX_USERNAME) {
    return `Username must be ${MIN_USERNAME}-${MAX_USERNAME} characters.`;
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
    return `Password must be ${MIN_PASSWORD}-${MAX_PASSWORD} characters.`;
  }
  return null;
}
