/**
 * Centralized admin configuration
 *
 * To add yourself as an admin:
 * 1. Log in to your app at http://localhost:3000
 * 2. Check your user email in the database or session
 * 3. Add your email to this array
 * 4. Restart your dev server
 */

export const ADMIN_EMAILS = [
  "alex.r.macleod@gmail.com",
  "dev+blocknative-http@context.local",
  // Add your email here:
  // "your-email@example.com",
];

/**
 * Check if a user email has admin privileges
 */
export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email);
}
