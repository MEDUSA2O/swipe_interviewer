import type { CandidateProfile } from '../features/session';

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const SYSTEM_PROMPT = `You are an expert technical recruiter. Summarize a candidate's resume into a short paragraph (max 60 words) highlighting role focus, seniority, standout achievements, and key technologies. Respond ONLY with natural language sentences.`;

const buildUserPrompt = (profile: CandidateProfile, resumeText: string) => {
  const basics = [
    profile.name ? `Name: ${profile.name}` : null,
    profile.email ? `Email: ${profile.email}` : null,
    profile.phone ? `Phone: ${profile.phone}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const snippet = resumeText.length > 4000 ? resumeText.slice(0, 4000) : resumeText;

  return `${basics}\nResume:\n${snippet}`.trim();
};

export const summarizeResume = async (
  profile: CandidateProfile,
  resumeText: string,
): Promise<string | undefined> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) return undefined;

  try {
    const controller = new AbortController();
    const timeoutId = typeof window !== 'undefined' ? window.setTimeout(() => controller.abort(), 6000) : undefined;

    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        system_instruction: {
          role: 'system',
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: buildUserPrompt(profile, resumeText) }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
        },
      }),
      signal: controller.signal,
    });

    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`Gemini resume summary failed with status ${response.status}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text).join(' ');
    return text?.trim().replace(/```[\s\S]*?```/g, '') || undefined;
  } catch (error) {
    console.warn('Resume summarization failed:', error);
    return undefined;
  }
};
