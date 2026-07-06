/**
 * @fileoverview Pinterest OAuth callback handler.
 * Exchanges the authorization code for an access token via POST request,
 * stores the credentials (including refresh token) in Vercel KV.
 *
 * @route GET /api/auth/pinterest/callback
 */

import { setToken } from '@/lib/kv';
import type { StoredToken, PinterestTokenResponse } from '@/lib/types';

/** Pinterest OAuth token endpoint */
const PINTEREST_TOKEN_URL = 'https://api.pinterest.com/v5/oauth/token';

/**
 * Encodes client credentials for HTTP Basic Authentication.
 *
 * @param {string} clientId - The Pinterest App ID
 * @param {string} clientSecret - The Pinterest App Secret
 * @returns {string} Base64-encoded credentials string
 */
function encodeBasicAuth(clientId: string, clientSecret: string): string {
  const credentials = `${clientId}:${clientSecret}`;
  return Buffer.from(credentials).toString('base64');
}

/**
 * Exchanges an OAuth authorization code for an access token via POST request.
 *
 * @param {string} code - The authorization code from the callback
 * @param {string} redirectUri - The registered redirect URI
 * @returns {Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }>} Token data
 * @throws {Error} If the token exchange fails
 */
async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> {
  const clientId = process.env.PINTEREST_APP_ID;
  const clientSecret = process.env.PINTEREST_APP_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing Pinterest app credentials');
  }

  // Build x-www-form-urlencoded body
  const params = new URLSearchParams();
  params.set('code', code);
  params.set('grant_type', 'authorization_code');
  params.set('redirect_uri', redirectUri);

  const response = await fetch(PINTEREST_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${encodeBasicAuth(clientId, clientSecret)}`,
    },
    body: params.toString(),
  });

  const data = (await response.json()) as PinterestTokenResponse;

  if (!response.ok || !data.access_token) {
    throw new Error(data.access_token ? 'Token exchange failed' : 'Invalid Pinterest token response');
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

/**
 * GET handler - Processes the Pinterest OAuth callback.
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

    // Handle OAuth errors from Pinterest
    if (error) {
      console.error('[Pinterest Callback] OAuth error:', error, errorDescription);
      return Response.redirect(
        new URL('/?error=Pinterest+authorization+denied', appUrl),
        302
      );
    }

    if (!code) {
      console.error('[Pinterest Callback] No authorization code received');
      return Response.redirect(
        new URL('/?error=Missing+authorization+code', appUrl),
        302
      );
    }

    // Exchange code for access token
    const redirectUri = `${appUrl}/api/auth/pinterest/callback`;
    const tokenData = await exchangeCodeForToken(code, redirectUri);

    // Calculate expiration timestamp
    const expiresAt = tokenData.expiresIn
      ? new Date(Date.now() + tokenData.expiresIn * 1000).toISOString()
      : undefined;

    // Store token in KV
    const storedToken: StoredToken = {
      platform: 'pinterest',
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      connectedAt: new Date().toISOString(),
      expiresAt,
    };

    await setToken('pinterest', storedToken);
    console.log('[Pinterest Callback] Successfully connected Pinterest account');

    return Response.redirect(new URL('/?connected=pinterest', appUrl), 302);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Pinterest Callback] Error:', errorMessage);
    return Response.redirect(
      new URL(`/?error=${encodeURIComponent(errorMessage)}`, appUrl),
      302
    );
  }
}
