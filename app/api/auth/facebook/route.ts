/**
 * @fileoverview Facebook OAuth initialization route.
 * Redirects the user to Facebook's OAuth dialog to authorize page management
 * and engagement reading permissions.
 *
 * @route GET /api/auth/facebook
 */

import { generateOAuthState } from '@/lib/kv';

/** Facebook Graph API version for OAuth */
const GRAPH_API_VERSION = 'v18.0';

/**
 * Required OAuth scopes for Facebook page integration.
 * - pages_manage_posts: Create, edit, and delete page posts
 * - pages_read_engagement: Read page engagement metrics
 */
const FACEBOOK_SCOPES = ['pages_manage_posts', 'pages_read_engagement'].join(',');

/**
 * GET handler - Initiates Facebook OAuth flow by redirecting to Facebook's OAuth dialog.
 *
 * @param {Request} _request - The incoming HTTP request
 * @returns {Response} Redirect response to Facebook OAuth dialog
 */
export async function GET(_request: Request): Promise<Response> {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const clientId = process.env.FACEBOOK_APP_ID;

    if (!appUrl || !clientId) {
      console.error('[Facebook OAuth] Missing FACEBOOK_APP_ID or NEXT_PUBLIC_APP_URL');
      return Response.redirect(
        new URL('/?error=Configuration+missing', appUrl || 'http://localhost:3000')
      );
    }

    const redirectUri = `${appUrl}/api/auth/facebook/callback`;
    const state = generateOAuthState();

    const oauthUrl = new URL(`https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth`);
    oauthUrl.searchParams.set('client_id', clientId);
    oauthUrl.searchParams.set('redirect_uri', redirectUri);
    oauthUrl.searchParams.set('scope', FACEBOOK_SCOPES);
    oauthUrl.searchParams.set('state', state);

    return Response.redirect(oauthUrl, 302);
  } catch (error) {
    console.error('[Facebook OAuth] Unexpected error:', error);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return Response.redirect(new URL('/?error=Facebook+OAuth+failed', appUrl), 302);
  }
}
