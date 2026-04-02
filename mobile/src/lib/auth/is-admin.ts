export const ADMIN_EMAIL = "wdaas@me.com";

export function isAdmin(user?: { email?: string } | null) {
  return user?.email === ADMIN_EMAIL;
}
