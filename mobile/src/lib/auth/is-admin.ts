export const ADMIN_EMAIL = "your@email.com";

export function isAdmin(user?: { email?: string } | null) {
  return user?.email === ADMIN_EMAIL;
}
