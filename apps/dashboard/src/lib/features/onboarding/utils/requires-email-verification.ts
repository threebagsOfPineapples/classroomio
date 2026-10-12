export function requiresEmailVerification(
  emailVerified: boolean,
  organizationId: string,
  dingtalkOrganizationId: string | null
) {
  return !emailVerified && (!organizationId || organizationId !== dingtalkOrganizationId);
}
