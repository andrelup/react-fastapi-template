/**
 * Returns the API base URL from a Vite env, or throws if it is missing.
 *
 * There is no default on purpose: a fallback to localhost would let a
 * misconfigured build start and call an API that does not exist. The URL does
 * not have to be absolute — a relative path such as `/api`, served by a
 * reverse proxy in front of the API, is valid too.
 *
 * Used twice: by `vite.config.ts`, so that `vite`, `vite build` and `vitest`
 * refuse to start without it, and by `api-client.ts` at runtime. That is why
 * this module imports nothing and never reads `import.meta.env` itself: the
 * Vite config loads it before any alias or env exists.
 */
export const requireApiUrl = (env: { readonly VITE_API_URL?: string }): string => {
  const url = env.VITE_API_URL?.trim();
  if (!url) {
    throw new Error(
      'VITE_API_URL is not set. Add it to the .env at the repository root (see .env.example); ' +
        'a Docker build receives it as a build arg.',
    );
  }
  return url;
};
