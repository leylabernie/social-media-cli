/**
 * TikTok API v2 posting module.
 *
 * Uses the TikTok Open API to publish video content to a user's account.
 * Note: TikTok does not support direct image posting via API — video only.
 *
 * @see https://developers.tiktok.com/doc/video-kit-web-video-kit
 */

import { getToken } from "@/lib/kv";
import type { TikTokToken } from "@/lib/types";

const TIKTOK_API_BASE = "https://open.tiktokapis.com/v2";

/**
 * Post a video with caption to TikTok via the Open API.
 *
 * Uses the Direct Post inbox flow where TikTok pulls the video
 * from a publicly accessible URL.
 *
 * @param caption - The caption/title for the TikTok video
 * @param videoUrl - Publicly accessible URL of the video file to post
 * @returns The publish_id or share URL from TikTok
 * @throws If token retrieval fails, the API call fails, or video URL is invalid
 */
export async function postToTiktok(
  caption: string,
  videoUrl: string
): Promise<string> {
  try {
    // Step 1: Retrieve token from KV
    const token = await getToken<TikTokToken>("tiktok");
    const { accessToken, openId } = token;

    // Step 2: Initiate video upload via Direct Post
    const initUrl = `${TIKTOK_API_BASE}/post/publish/inbox/video/init/`;

    const response = await fetch(initUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_info: {
          source: "PULL_FROM_URL",
          url: videoUrl,
        },
        title: caption,
        privacy_level: "PUBLIC",
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
        video_cover_timestamp_ms: 0,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `TikTok API error: ${response.status} - ${
          errorData.error?.message ?? response.statusText
        }`
      );
    }

    const data = (await response.json()) as {
      data?: { publish_id?: string; share_url?: string };
      error?: { message: string };
    };

    if (data.error) {
      throw new Error(`TikTok API error: ${data.error.message}`);
    }

    const publishId = data.data?.publish_id;
    const shareUrl = data.data?.share_url;

    if (!publishId && !shareUrl) {
      throw new Error(
        "TikTok API did not return a publish_id or share_url."
      );
    }

    return shareUrl ?? `https://tiktok.com/@user/video/${publishId}`;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown TikTok posting error";
    throw new Error(`[TikTok] ${message}`);
  }
}

/**
 * Upload an image to TikTok.
 *
 * IMPORTANT: TikTok's API does not support direct image posting.
 * Images must be converted to video format first.
 * This function returns a clear error guiding the user.
 *
 * @throws Always throws — TikTok requires video content
 */
export async function postImageToTiktok(): Promise<string> {
  throw new Error(
    "TikTok requires video content. Image posting is not supported via the TikTok API. " +
      "Please convert your image to a video (e.g., slideshow or animated format) before posting."
  );
}
