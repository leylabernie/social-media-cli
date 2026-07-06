/**
 * Pinterest API v5 posting module.
 *
 * Uses the Pinterest REST API to create new Pins on a user's boards.
 *
 * @see https://developers.pinterest.com/docs/api/v5/pins-create
 */

import { getToken } from "@/lib/kv";
import type { PinterestToken } from "@/lib/types";

const PINTEREST_API_BASE = "https://api.pinterest.com/v5";

/**
 * Create a new Pin on Pinterest via the API v5.
 *
 * @param title - The title of the Pin (max 100 characters)
 * @param description - The description text for the Pin
 * @param imageUrl - Publicly accessible URL of the image to pin
 * @param link - The destination link users will go to when clicking the Pin
 * @returns The URL of the created Pin
 * @throws If token retrieval fails or the API call fails
 */
export async function postToPinterest(
  title: string,
  description: string,
  imageUrl: string,
  link: string
): Promise<string> {
  try {
    // Step 1: Retrieve token from KV
    const token = await getToken<PinterestToken>("pinterest");
    const { accessToken } = token;

    // Step 2: Create the pin
    const pinUrl = `${PINTEREST_API_BASE}/pins`;

    const response = await fetch(pinUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: title.slice(0, 100),
        description: description,
        link: link,
        media_source: {
          source_type: "image_url",
          url: imageUrl,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Pinterest API error: ${response.status} - ${
          errorData.message ?? response.statusText
        }`
      );
    }

    const data = (await response.json()) as {
      id: string;
      link?: string;
    };

    if (!data.id) {
      throw new Error("Pinterest API did not return a pin ID.");
    }

    // Step 3: Return the Pinterest pin URL
    return data.link ?? `https://pinterest.com/pin/${data.id}`;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Pinterest posting error";
    throw new Error(`[Pinterest] ${message}`);
  }
}
