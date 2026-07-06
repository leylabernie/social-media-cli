/**
 * @fileoverview Pinterest OAuth initialization route.
 * Redirects the user to Pinterest's OAuth dialog to authorize board reading,
 * pin reading, and pin writing permissions.
 *
 * @route GET /api/auth/pinterest
 */

import { generateOAuthState } from '@/lib/kv';

/**
 * Required OAuth scopes for Pinterest integration.
 * - boards:read: Read user's boards
 * - pins:read: Read user's pins
 * - pins:write: Create and manage pins
 */
const PINTEREST_SCOPES = ['boards:read', 'pins:read', 'pins:write'].join(',');

/**
 * GET handler - Initiates Pinterest OAuth flow by redirecting to Pinterest's OAuth dialog.
 *
 * @param {Request} _request - The incoming HTTP request
 * @returns {Response} Redirect response to Pinterest OAuth dialog
 */
export async function GET(_request: Request): Promise<Response> {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const clientId = process.env.PINTEREST_APP_ID;

    if (!appUrl || !clientId) {
      console.error('[Pinterest OAuth] Missing PINTEREST_APP_ID or NEXT_PUBLIC_APP_URL');
      return Response.redirect(
        new URL('/?error=Configuration+missing', appUrl || 'http://localhost:3000')
      );
    }

    const redirectUri = `${appUrl}/api/auth/pinterest/callback`;
    const state = generateOAuthState();

    const oauthUrl = new URL('https://www.pinterest.com/oauth/');
    oauthUrl.searchParams.set('client_id', clientId);
    oauthUrl.searchParams.set('redirect_uri', redirectUri);
    oauthUrl.searchParams.set('response_type', 'code');
    oauthUrl.searchParams.set('scope', PINTEREST_SCOPES);
    oauthUrl.searchParams.set('state', state);

    return Response.redirect(oauthUrl, 302);
  } catch (error) {
    console.error('[Pinterest OAuth] Unexpected error:', error);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return Response.redirect(new URL('/?error=Pinterest+OAuth+failed', appUrl), 302);
  }
}
