/**
 * @file OpenAI-powered caption generation for social media platforms.
 * Generates platform-optimized captions with rules for length, tone, and hashtags.
 * @module luxemia-social/ai/caption-generator
 */

import OpenAI from 'openai';
import env from '../utils/env.js';
import { debug, info, error } from '../utils/logger.js';
import type { ProductInfo } from '../platforms/types.js';

/** Platform-specific caption rules and guidelines */
interface PlatformRules {
  /** Maximum character length for the caption */
  maxLength: number;
  /** Optimal number of emojis */
  emojiCount: number;
  /** Optimal number of hashtags */
  hashtagCount: number;
  /** Tone/style guideline */
  tone: string;
  /** Additional platform-specific instructions */
  extra?: string;
}

/** Caption rules for each supported platform */
const PLATFORM_RULES: Record<string, PlatformRules> = {
  x: {
    maxLength: 280,
    emojiCount: 1,
    hashtagCount: 1,
    tone: 'concise, punchy, engaging',
    extra: 'Focus on the hook. Use strong verbs. Avoid excessive punctuation.',
  },
  instagram: {
    maxLength: 2200,
    emojiCount: 4,
    hashtagCount: 10,
    tone: 'lifestyle, aspirational, friendly',
    extra: 'Use line breaks for readability. Include a call-to-action. Add relevant hashtags at the end.',
  },
  facebook: {
    maxLength: 500,
    emojiCount: 2,
    hashtagCount: 2,
    tone: 'conversational, community-focused',
    extra: 'Ask a question to encourage comments. Keep it friendly and approachable.',
  },
  pinterest: {
    maxLength: 500,
    emojiCount: 2,
    hashtagCount: 5,
    tone: 'descriptive, inspirational, search-friendly',
    extra: 'Use keywords people search for. Write in a helpful, tutorial-like tone.',
  },
  linkedin: {
    maxLength: 3000,
    emojiCount: 2,
    hashtagCount: 5,
    tone: 'professional, insightful, industry-relevant',
    extra: 'Focus on the business/value angle. Share why this product matters professionally.',
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
${rules.extra ? `- ${rules.extra}` : ''}
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
 * @throws Error if caption generation fails
 */
export async function generateCaption(
  product: ProductInfo,
  platform: string
): Promise<string> {
  const rules = PLATFORM_RULES[platform];
  if (!rules) {
    throw new Error(`No caption rules defined for platform: ${platform}`);
  }

  info(`Generating caption for ${platform}...`);

  const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
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

    debug(`Generated caption (${trimmed.length} chars)`);
    return trimmed;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    error(`Caption generation failed for ${platform}: ${message}`);
    throw new Error(`Failed to generate caption for ${platform}: ${message}`);
  }
}
