import { env } from '$env/dynamic/public';

export const IS_AI_ENABLED = env.PUBLIC_IS_AI_ENABLED === 'true';
