import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';

export const load = ({ params }) => {
  redirect(307, resolve(`/courses/${params.id}/lessons`, {}));
};
