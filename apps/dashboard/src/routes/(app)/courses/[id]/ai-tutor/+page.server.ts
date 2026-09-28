import { redirect } from '@sveltejs/kit';
import { IS_AI_ENABLED } from '$lib/utils/constants/ai';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
  if (!IS_AI_ENABLED) redirect(307, `/courses/${params.id}/settings`);
};
