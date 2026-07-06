/**
 * @fileoverview TikTok OAuth initialization route.
 * Redirects the user to TikTok's OAuth authorization page to grant
 * user info and video publishing permissions.
 *
 * @route GET /api/auth/tiktok
 */

import { generateOAuthState } from '@/lib/kv';

/**
 * Required OAuth scopes for TikTok integration.
 * - user.info.basic: Read basic user profile information
 * - video.publish: Publish videos to TikTok
 */
const TIKTOK_SCOPES = ['user.info.basic', 'video.publish'].join(',');

/**
 * GET handler - Initiates TikTok OAuth flow by redirecting to TikTok's authorization page.
 *
 * @param {Request} _request - The incoming HTTP request
 * @returns {Response} Redirect response to TikTok OAuth page
 */
export async function GET(_request: Request): Promise<Response> {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const clientKey = process.env.TIKTOK_CLIENT_KEY;

    if (!appUrl || !clientKey) {
      console.error('[TikTok OAuth] Missing TIKTOK_CLIENT_KEY or NEXT_PUBLIC_APP_URL');
      return Response.redirect(
        new URL('/?error=Configuration+missing', appUrl || 'http://localhost:3000')
      );
    }

    const redirectUri = `${appUrl}/api/auth/tiktok/callback`;
    const state = generateOAuthState();

    const oauthUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
    oauthUrl.searchParams.set('client_key', clientKey);
    oauthUrl.searchParams.set('redirect_uri', redirectUri);
    oauthUrl.searchParams.set('scope', TIKTOK_SCOPES);
    oauthUrl.searchParams.set('response_type', 'code');
    oauthUrl.searchParams.set('state', state);

    return Response.redirect(oauthUrl, 302);
  } catch (error) {
    console.error('[TikTok OAuth] Unexpected error:', error);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return Response.redirect(new URL('/?error=TikTok+OAuth+failed', appUrl), 302);
  }
}
