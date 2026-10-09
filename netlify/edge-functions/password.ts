// Password gate for the whole site (works on Netlify's free plan).
// Set SITE_USER and SITE_PASSWORD under Site configuration → Environment variables.
// Without them the site stays locked (fail closed).
import type { Config, Context } from 'https://edge.netlify.com';

declare const Netlify: { env: { get(name: string): string | undefined } };

export default async (request: Request, context: Context) => {
  const user = Netlify.env.get('SITE_USER');
  const password = Netlify.env.get('SITE_PASSWORD');
  if (!user || !password) return new Response('Site password is not configured.', { status: 503 });

  const [scheme, encoded] = (request.headers.get('authorization') ?? '').split(' ');
  if (scheme === 'Basic' && encoded) {
    const decoded = atob(encoded);
    const i = decoded.indexOf(':');
    if (decoded.slice(0, i) === user && decoded.slice(i + 1) === password) return context.next();
  }
  return new Response('Login required.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Portfolio Builder", charset="UTF-8"' },
  });
};

export const config: Config = { path: '/*' };
