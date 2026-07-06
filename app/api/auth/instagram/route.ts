/**
 * @fileoverview Instagram OAuth initialization route.
 * Redirects the user to Facebook's OAuth dialog to authorize Instagram Basic Display
 * and Content Publishing permissions.
 *
 * @route GET /api/auth/instagram
 */

import { generateOAuthState } from '@/lib/kv';

/** Facebook Graph API version for Instagram OAuth */
const GRAPH_API_VERSION = 'v18.0';

/**
 * Required OAuth scopes for Instagram integration.
 * - instagram_basic: Read Instagram account info
 * - instagram_content_publish: Publish photos and videos
 * - pages_read_engagement: Read page engagement data (required for Instagram Business API)
 */
const INSTAGRAM_SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'pages_read_engagement',
].join(',');

/**
 * GET handler - Initiates Instagram OAuth flow by redirecting to Facebook's OAuth dialog.
 *
 * @param {Request} _request - The incoming HTTP request
 * @returns {Response} Redirect response to Facebook OAuth dialog
 */
export async function GET(_request: Request): Promise<Response> {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const clientId = process.env.FACEBOOK_APP_ID;

    if (!appUrl || !clientId) {
      console.error('[Instagram OAuth] Missing FACEBOOK_APP_ID or NEXT_PUBLIC_APP_URL');
      return Response.redirect(new URL('/?error=Configuration+missing', appUrl || 'http://localhost:3000'));
    }

    const redirectUri = `${appUrl}/api/auth/instagram/callback`;
    const state = generateOAuthState();

    const oauthUrl = new URL(`https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth`);
    oauthUrl.searchParams.set('client_id', clientId);
    oauthUrl.searchParams.set('redirect_uri', redirectUri);
    oauthUrl.searchParams.set('scope', INSTAGRAM_SCOPES);
    oauthUrl.searchParams.set('state', state);

    return Response.redirect(oauthUrl, 302);
  } catch (error) {
    console.error('[Instagram OAuth] Unexpected error:', error);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return Response.redirect(new URL('/?error=Instagram+OAuth+failed', appUrl), 302);
  }
}
