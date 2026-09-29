export function getActiveMakeupPolicy(
  makeup: { opensAt: string; closesAt: string; maxAttempts: number } | null,
  now = Date.now()
) {
  if (!makeup || Date.parse(makeup.opensAt) > now || Date.parse(makeup.closesAt) <= now) return null;

  return {
    opensAt: makeup.opensAt,
    closesAt: makeup.closesAt,
    maxAttempts: makeup.maxAttempts,
    allowMakeup: true,
    allowMultipleAttempts: true
  };
}
