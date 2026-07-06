/**
 * Facebook Graph API posting module.
 *
 * Uses the Facebook Graph API to publish photos to a Facebook Page.
 *
 * @see https://developers.facebook.com/docs/graph-api/reference/page/photos
 */

import { getToken } from "@/lib/kv";
import type { FacebookToken } from "@/lib/types";

const GRAPH_API_VERSION = "v18.0";

/**
 * Post an image with caption to a Facebook Page via the Graph API.
 *
 * @param caption - The caption text for the Facebook post
 * @param imageUrl - Publicly accessible URL of the image to post
 * @returns The URL of the published Facebook post
 * @throws If token retrieval fails or the API call fails
 */
export async function postToFacebook(
  caption: string,
  imageUrl: string
): Promise<string> {
  try {
    // Step 1: Retrieve token from KV
    const token = await getToken<FacebookToken>("facebook");
    const { accessToken, pageId } = token;

    // Step 2: Post photo to the page
    const postUrl =
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/photos`;

    const body = new URLSearchParams({
      url: imageUrl,
      caption: caption,
      access_token: accessToken,
    });

    const response = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Facebook API error: ${response.status} - ${
          errorData.error?.message ?? response.statusText
        }`
      );
    }

    const data = (await response.json()) as { id: string; post_id?: string };
    const postId = data.post_id ?? data.id;

    if (!postId) {
      throw new Error(
        "Facebook API did not return a post ID."
      );
    }

    // Step 3: Return the Facebook post URL
    return `https://facebook.com/${pageId}/posts/${postId}`;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Facebook posting error";
    throw new Error(`[Facebook] ${message}`);
  }
}
