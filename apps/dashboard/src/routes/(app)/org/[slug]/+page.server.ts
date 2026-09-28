import { redirect } from '@sveltejs/kit';
import { IS_AI_ENABLED } from '$lib/utils/constants/ai';

export const load = async ({ params }) => {
  if (!IS_AI_ENABLED) redirect(307, '/admin');

  return {
    orgName: params.slug
  };
};
