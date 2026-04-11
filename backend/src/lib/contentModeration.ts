import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.CODEX_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

export interface ModerationResult {
  isExplicit: boolean;
  contentScore: number; // 0.0 to 1.0
}

export async function moderateImageContent(imageUrl: string): Promise<ModerationResult> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 10,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "low" },
            },
            {
              type: "text",
              text: "Does this image contain nudity, explicit sexual content, graphic sexual material, or pornographic content? Answer with only: YES or NO",
            },
          ],
        },
      ],
    });

    const answer = response.choices[0]?.message?.content?.trim().toUpperCase() ?? "NO";
    const isExplicit = answer.startsWith("YES");
    return {
      isExplicit,
      contentScore: isExplicit ? 0.9 : 0.1,
    };
  } catch (err) {
    // On error, don't block post creation — default to non-explicit
    console.error("[contentModeration] Error:", err);
    return { isExplicit: false, contentScore: 0 };
  }
}

export async function moderatePostContent(imageUrls: string[], videoUrl?: string | null): Promise<ModerationResult> {
  // Check the first image (most representative)
  const urlToCheck = imageUrls[0] ?? null;
  if (!urlToCheck) {
    return { isExplicit: false, contentScore: 0 };
  }
  return moderateImageContent(urlToCheck);
}
