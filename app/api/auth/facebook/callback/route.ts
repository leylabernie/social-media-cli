/**
 * @fileoverview Facebook OAuth callback handler.
 * Exchanges the authorization code for an access token, retrieves the user's
 * Facebook pages, stores the page access tokens in Vercel KV.
 *
 * @route GET /api/auth/facebook/callback
 */

import { setToken } from '@/lib/kv';
import type { StoredToken, FacebookPagesResponse } from '@/lib/types';

/** Facebook Graph API version */
const GRAPH_API_VERSION = 'v18.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * Exchanges an OAuth authorization code for an access token.
 *
 * @param {string} code - The authorization code from the callback
 * @param {string} redirectUri - The registered redirect URI
 * @returns {Promise<string>} The access token
 * @throws {Error} If the token exchange fails
 */
async function exchangeCodeForToken(code: string, redirectUri: string): Promise<string> {
  const clientId = process.env.FACEBOOK_APP_ID;
  const clientSecret = process.env.FACEBOOK_APP_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing Facebook app credentials');
  }

  const url = new URL(`${GRAPH_API_BASE}/oauth/access_token`);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('client_secret', clientSecret);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('code', code);

  const response = await fetch(url.toString(), { method: 'GET' });
  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error?.message || `Token exchange failed: ${response.status}`);
  }

  return data.access_token as string;
}

/**
 * Retrieves the Facebook pages accessible to the authenticated user.
 *
 * @param {string} accessToken - The user's access token
 * @returns {Promise<FacebookPagesResponse['data']>} Array of Facebook pages
 * @throws {Error} If the API request fails
 */
async function getUserPages(accessToken: string): Promise<FacebookPagesResponse['data']> {
  const url = new URL(`${GRAPH_API_BASE}/me/accounts`);
  url.searchParams.set('access_token', accessToken);

  const response = await fetch(url.toString(), { method: 'GET' });
  const data = (await response.json()) as FacebookPagesResponse;

  if (!response.ok || !data.data) {
    throw new Error('Failed to retrieve Facebook pages');
  }

  return data.data;
}

/**
 * GET handler - Processes the Facebook OAuth callback.
 *
 * @param {Request} request - The incoming HTTP request with authorization code
 * @returns {Response} Redirect to dashboard with success or error status
 */
export async function GET(request: Request): Promise<Response> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorReason = searchParams.get('error_reason');

    // Handle OAuth errors from Facebook
    if (error || errorReason) {
      console.error('[Facebook Callback] OAuth error:', error, errorReason);
      return Response.redirect(
        new URL('/?error=Facebook+authorization+denied', appUrl),
        302
      );
    }

    if (!code) {
      console.error('[Facebook Callback] No authorization code received');
      return Response.redirect(
        new URL('/?error=Missing+authorization+code', appUrl),
        302
      );
    }

    // Exchange code for access token
    const redirectUri = `${appUrl}/api/auth/facebook/callback`;
    const accessToken = await exchangeCodeForToken(code, redirectUri);

    // Get user's Facebook pages
    const pages = await getUserPages(accessToken);

    if (pages.length === 0) {
      return Response.redirect(
        new URL('/?error=No+Facebook+pages+found', appUrl),
        302
      );
    }

    // Store the first page's token (primary page)
    // For multi-page support, extend this to store all pages
    const primaryPage = pages[0];
    const tokenData: StoredToken = {
      platform: 'facebook',
      accessToken: primaryPage.access_token,
      pageId: primaryPage.id,
      pageName: primaryPage.name,
      connectedAt: new Date().toISOString(),
    };

    await setToken('facebook', tokenData);
    console.log('[Facebook Callback] Successfully connected Facebook page:', primaryPage.name);

    return Response.redirect(new URL('/?connected=facebook', appUrl), 302);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Facebook Callback] Error:', errorMessage);
    return Response.redirect(
      new URL(`/?error=${encodeURIComponent(errorMessage)}`, appUrl),
      302
    );
  }
}
