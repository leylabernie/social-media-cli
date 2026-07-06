/**
 * OpenAI-powered caption generator for social media platforms.
 *
 * Generates platform-optimized captions using GPT-4o-mini,
 * with tailored tone, hashtag strategy, and character limits
 * for each supported platform.
 *
 * Requires the OPENAI_API_KEY environment variable.
 */

import OpenAI from "openai";
import type { ProductInfo, Platform, GeneratedCaption } from "@/lib/types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/** Platform-specific rules injected into the AI prompt */
const PLATFORM_RULES: Record<Platform, string> = {
  instagram:
    "Instagram: Use engaging, visual language. Include 5-10 relevant hashtags. " +
    "Add emojis for personality. Keep under 2,200 characters but aim for 125-150 " +
    "for optimal engagement. Use line breaks for readability.",

  facebook:
    "Facebook: Conversational and friendly tone. Ask questions to drive engagement. " +
    "Use 1-2 hashtags max. Keep under 500 characters. Include a call-to-action.",

  tiktok:
    "TikTok: Short, punchy, trend-aware captions. Use trending hashtags if relevant. " +
    "Keep under 100 characters. Add hooks and emojis. Fun, casual energy.",

  pinterest:
    "Pinterest: Keyword-rich, descriptive text. Focus on searchability. " +
    "Use natural language with keywords buyers search for. " +
    "Include a clear value proposition. Keep under 500 characters.",
};

/**
 * Generate a social media caption optimized for a specific platform.
 *
 * Uses GPT-4o-mini with platform-specific prompting to create
 * tailored captions that match each platform's audience and format.
 *
 * @param product - The product information to base the caption on
 * @param platform - The target social media platform
 * @returns The generated caption string
 * @throws If the OpenAI API call fails or returns invalid data
 */
export async function generateCaption(
  product: ProductInfo,
  platform: Platform
): Promise<string> {
  const rules = PLATFORM_RULES[platform];

  const systemPrompt =
    `You are an expert social media copywriter for a luxury e-commerce brand called Luxemia.\n` +
    `Write a compelling ${platform} caption for the following product.\n` +
    `Rules for this platform:\n${rules}\n\n` +
    `Do NOT include markdown formatting. Output ONLY the caption text.`;

  const userPrompt =
    `Product: ${product.title}\n` +
    `Price: ${product.price}\n` +
    `Description: ${product.description}\n\n` +
    `Write the ${platform} caption now:`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 500,
    });

    const caption = completion.choices[0]?.message?.content?.trim();

    if (!caption) {
      throw new Error("OpenAI returned an empty caption.");
    }

    return caption;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown OpenAI error";
    throw new Error(`[CaptionGenerator] Failed for ${platform}: ${message}`);
  }
}

/**
 * Generate captions for multiple platforms in parallel.
 *
 * @param product - The product information to base captions on
 * @param platforms - Array of target platforms
 * @returns Array of platform-caption pairs
 * @throws If any individual caption generation fails
 */
export async function generateCaptionsForPlatforms(
  product: ProductInfo,
  platforms: Platform[]
): Promise<GeneratedCaption[]> {
  const results = await Promise.allSettled(
    platforms.map(async (platform) => {
      const caption = await generateCaption(product, platform);
      return { platform, caption } satisfies GeneratedCaption;
    })
  );

  const captions: GeneratedCaption[] = [];
  const errors: string[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      captions.push(result.value);
    } else {
      errors.push(result.reason?.message ?? String(result.reason));
    }
  }

  if (captions.length === 0) {
    throw new Error(
      `Failed to generate captions for all platforms: ${errors.join("; ")}`
    );
  }

  return captions;
}
