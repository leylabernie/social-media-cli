/**
 * Instagram Graph API posting module.
 *
 * Uses the Instagram Graph API (via Facebook's graph) to publish
 * single-image posts to an Instagram Business account.
 *
 * @see https://developers.facebook.com/docs/instagram-api/guides/content-publishing
 */

import { getToken } from "@/lib/kv";
import type { InstagramToken } from "@/lib/types";

const GRAPH_API_VERSION = "v18.0";

/**
 * Post an image with caption to Instagram via the Graph API.
 *
 * This is a two-step process:
 *  1. Create a media container (upload the image)
 *  2. Publish the container
 *
 * @param caption - The caption text for the Instagram post
 * @param imageUrl - Publicly accessible URL of the image to post
 * @returns The permalink (URL) of the published Instagram post
 * @throws If token retrieval fails, API calls fail, or publishing errors
 */
export async function postToInstagram(
  caption: string,
  imageUrl: string
): Promise<string> {
  try {
    // Step 1: Retrieve token from KV
    const token = await getToken<InstagramToken>("instagram");
    const { accessToken, igBusinessAccountId } = token;

    // Step 2: Create a media container
    const mediaUrl =
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${igBusinessAccountId}/media`;

    const mediaBody = new URLSearchParams({
      image_url: imageUrl,
      caption: caption,
      access_token: accessToken,
    });

    const mediaRes = await fetch(mediaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: mediaBody.toString(),
    });

    if (!mediaRes.ok) {
      const errorData = await mediaRes.json().catch(() => ({}));
      throw new Error(
        `Instagram media container creation failed: ${mediaRes.status} - ${
          errorData.error?.message ?? mediaRes.statusText
        }`
      );
    }

    const mediaData = (await mediaRes.json()) as { id: string };
    const creationId = mediaData.id;

    if (!creationId) {
      throw new Error(
        "Instagram media container creation did not return a creation_id."
      );
    }

    // Step 3: Publish the media container
    const publishUrl =
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${igBusinessAccountId}/media_publish`;

    const publishBody = new URLSearchParams({
      creation_id: creationId,
      access_token: accessToken,
    });

    const publishRes = await fetch(publishUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: publishBody.toString(),
    });

    if (!publishRes.ok) {
      const errorData = await publishRes.json().catch(() => ({}));
      throw new Error(
        `Instagram media publish failed: ${publishRes.status} - ${
          errorData.error?.message ?? publishRes.statusText
        }`
      );
    }

    const publishData = (await publishRes.json()) as {
      id: string;
      permalink?: string;
    };

    // Return permalink if available, otherwise construct a fallback URL
    if (publishData.permalink) {
      return publishData.permalink;
    }

    // Fallback: construct an Instagram web URL from the media ID
    return `https://instagram.com/p/${publishData.id}`;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Instagram posting error";
    throw new Error(`[Instagram] ${message}`);
  }
}
