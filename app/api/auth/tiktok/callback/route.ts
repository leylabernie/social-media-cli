/**
 * @fileoverview TikTok OAuth callback handler.
 * Exchanges the authorization code for an access token via POST request,
 * stores the credentials (including refresh token and open_id) in Vercel KV.
 *
 * @route GET /api/auth/tiktok/callback
 */

import { setToken } from '@/lib/kv';
import type { StoredToken, TikTokTokenResponse } from '@/lib/types';

/** TikTok OAuth token endpoint */
const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';

/**
 * Exchanges an OAuth authorization code for an access token via POST request.
 *
 * @param {string} code - The authorization code from the callback
 * @param {string} redirectUri - The registered redirect URI
 * @returns {Promise<{ accessToken: string; refreshToken: string; openId: string; expiresIn: number }>} Token data
 * @throws {Error} If the token exchange fails
 */
async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string; openId: string; expiresIn: number }> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

  if (!clientKey || !clientSecret) {
    throw new Error('Missing TikTok app credentials');
  }

  // Build x-www-form-urlencoded body
  const params = new URLSearchParams();
  params.set('client_key', clientKey);
  params.set('client_secret', clientSecret);
  params.set('code', code);
  params.set('grant_type', 'authorization_code');
  params.set('redirect_uri', redirectUri);

  const response = await fetch(TIKTOK_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: params.toString(),
  });

  const data = (await response.json()) as TikTokTokenResponse;

  if (!response.ok || !data.access_token) {
    throw new Error(data.access_token ? 'Token exchange failed' : 'Invalid TikTok token response');
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    openId: data.open_id,
    expiresIn: data.expires_in,
  };
}

/**
 * GET handler - Processes the TikTok OAuth callback.
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
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors from TikTok
    if (error) {
      console.error('[TikTok Callback] OAuth error:', error, errorDescription);
      return Response.redirect(
        new URL('/?error=TikTok+authorization+denied', appUrl),
        302
      );
    }

    if (!code) {
      console.error('[TikTok Callback] No authorization code received');
      return Response.redirect(
        new URL('/?error=Missing+authorization+code', appUrl),
        302
      );
    }

    // Exchange code for access token
    const redirectUri = `${appUrl}/api/auth/tiktok/callback`;
    const tokenData = await exchangeCodeForToken(code, redirectUri);

    // Calculate expiration timestamp
    const expiresAt = tokenData.expiresIn
      ? new Date(Date.now() + tokenData.expiresIn * 1000).toISOString()
      : undefined;

    // Store token in KV
    const storedToken: StoredToken = {
      platform: 'tiktok',
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      openId: tokenData.openId,
      connectedAt: new Date().toISOString(),
      expiresAt,
    };

    await setToken('tiktok', storedToken);
    console.log('[TikTok Callback] Successfully connected TikTok account');

    return Response.redirect(new URL('/?connected=tiktok', appUrl), 302);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[TikTok Callback] Error:', errorMessage);
    return Response.redirect(
      new URL(`/?error=${encodeURIComponent(errorMessage)}`, appUrl),
      302
    );
  }
}
