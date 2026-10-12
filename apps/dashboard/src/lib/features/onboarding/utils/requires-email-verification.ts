export function requiresEmailVerification(
  emailVerified: boolean,
  organizationId: string,
  dingtalkOrganizationId: string | null,
  isSelfHosted: boolean
) {
  return !isSelfHosted && !emailVerified && (!organizationId || organizationId !== dingtalkOrganizationId);
}
