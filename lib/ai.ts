/**
 * @file OpenAI-powered caption generation for social media platforms.
 * Generates platform-optimized captions with rules for length, tone, emojis, and hashtags.
 * @module @/lib/ai
 */

import OpenAI from 'openai';
import type { ProductInfo } from '@/lib/types';

/** Platform-specific caption rules and guidelines */
interface PlatformRules {
  /** Maximum character length for the caption */
  maxLength: number;
  /** Optimal number of emojis */
  emojiCount: string;
  /** Optimal number of hashtags */
  hashtagCount: string;
  /** Tone/style guideline */
  tone: string;
  /** Additional platform-specific instructions */
  extra: string;
}

/** Caption rules for each supported platform */
const PLATFORM_RULES: Record<string, PlatformRules> = {
  x: {
    maxLength: 280,
    emojiCount: '1-2',
    hashtagCount: '2-3',
    tone: 'punchy, concise, engaging',
    extra: 'Max 280 chars. 1-2 emojis max. 2-3 hashtags. Punchy tone. Include URL.',
  },
  instagram: {
    maxLength: 2200,
    emojiCount: '5-8',
    hashtagCount: '10-15',
    tone: 'lifestyle, aspirational, friendly',
    extra: 'Max 2200 chars but 150-300 ideal. 5-8 emojis. 10-15 hashtags. Aspirational tone. Include URL.',
  },
  facebook: {
    maxLength: 500,
    emojiCount: '2-3',
    hashtagCount: '1-2',
    tone: 'conversational, community-focused, warm',
    extra: 'Max 500 chars. 2-3 emojis. Conversational, ask a question. Include URL.',
  },
  pinterest: {
    maxLength: 500,
    emojiCount: '2-3',
    hashtagCount: '5-8',
    tone: 'descriptive, inspirational, SEO-rich',
    extra: 'Title (100 chars) + Description (500 chars). SEO-rich. 5-8 hashtags. DO NOT include URL in text.',
  },
  linkedin: {
    maxLength: 700,
    emojiCount: '1-2',
    hashtagCount: '3-5',
    tone: 'professional, insightful, industry-relevant',
    extra: 'Max 700 chars. Professional tone. 1-2 emojis. 3-5 hashtags. Include URL.',
  },
};

/**
 * Build the system prompt for caption generation.
 * @param platform - Platform identifier
 * @param rules - Platform-specific rules
 * @returns System prompt string
 */
function buildSystemPrompt(platform: string, rules: PlatformRules): string {
  return `You are a social media copywriter specializing in ${platform} content.
Follow these rules STRICTLY:
- Maximum ${rules.maxLength} characters
- Use exactly ${rules.emojiCount} emoji(s)
- Include exactly ${rules.hashtagCount} hashtag(s)
- Tone: ${rules.tone}
- ${rules.extra}
- Return ONLY the caption text, nothing else
- Do not use markdown formatting`;
}

/**
 * Build the user prompt with product information.
 * @param product - Product information
 * @returns User prompt string
 */
function buildUserPrompt(product: ProductInfo): string {
  const tags = product.tags.length > 0 ? product.tags.join(', ') : 'N/A';
  return `Write a social media caption for this product:

Title: ${product.title}
Price: ${product.price}
Description: ${product.description}
Tags: ${tags}
URL: ${product.url}`;
}

/**
 * Generate a platform-optimized caption for a product.
 * Uses OpenAI GPT-4o-mini with platform-specific rules.
 * @param product - Product information to base the caption on
 * @param platform - Target platform identifier (x, instagram, facebook, pinterest, linkedin)
 * @returns Generated caption text, trimmed to platform limits
 * @throws Error if caption generation fails or platform is unsupported
 */
export async function generateCaption(
  product: ProductInfo,
  platform: string
): Promise<string> {
  const rules = PLATFORM_RULES[platform];
  if (!rules) {
    throw new Error(`No caption rules defined for platform: ${platform}`);
  }

  console.log(`[AI] Generating caption for ${platform}...`);

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt(platform, rules),
        },
        {
          role: 'user',
          content: buildUserPrompt(product),
        },
      ],
      max_tokens: 500,
      temperature: 0.8,
    });

    const caption = response.choices[0]?.message?.content?.trim() ?? '';

    if (!caption) {
      throw new Error('OpenAI returned empty caption');
    }

    // Enforce max length
    const trimmed = caption.length > rules.maxLength
      ? caption.substring(0, rules.maxLength)
      : caption;

    console.log(`[AI] Generated caption for ${platform} (${trimmed.length} chars)`);
    return trimmed;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[AI] Caption generation failed for ${platform}: ${message}`);
    throw new Error(`Failed to generate caption for ${platform}: ${message}`);
  }
}
