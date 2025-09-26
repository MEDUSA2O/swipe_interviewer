import { v4 as uuid } from 'uuid';
import type { CandidateProfile, Question } from '../features/session';
import { buildFallbackQuestions } from '../data/questionBank';

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const SYSTEM_PROMPT = `You are Swipe's technical interview assistant. Generate exactly six full-stack interview questions (React + Node.js focus).
Return ONLY valid JSON with this shape:
{
  "questions": [
    {
      "prompt": string,
      "difficulty": "easy" | "medium" | "hard",
      "keywords": string[]
    }
  ]
}
Rules:
- Two questions per difficulty in this order: easy, easy, medium, medium, hard, hard.
- Prompts must be concise but specific to technical depth.
- Provide 3-5 focus keywords per question.
- Do not include explanations or markdown fences.`;

const DIFFICULTY_ORDER: Array<'easy' | 'medium' | 'hard'> = ['easy', 'easy', 'medium', 'medium', 'hard', 'hard'];

const DIFFICULTY_TIMER: Record<'easy' | 'medium' | 'hard', number> = {
  easy: 20,
  medium: 60,
  hard: 120,
};

interface GeminiResponse {
  questions?: Array<{
    prompt?: string;
    difficulty?: string;
    keywords?: string[];
  }>;
}

const difficultyFromText = (value: string | undefined): 'easy' | 'medium' | 'hard' | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized.includes('easy')) return 'easy';
  if (normalized.includes('medium')) return 'medium';
  if (normalized.includes('hard')) return 'hard';
  return null;
};

const sanitizeKeywords = (keywords?: string[]): string[] => {
  if (!Array.isArray(keywords)) return [];
  return keywords
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0)
    .slice(0, 5);
};

const parseGeminiJson = (text: string): GeminiResponse | null => {
  const fenced = text.match(/```json([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  try {
    return JSON.parse(raw) as GeminiResponse;
  } catch {
    return null;
  }
};

const buildUserPrompt = (profile: CandidateProfile, resumeText?: string) => {
  const basics = [
    profile.name ? `Name: ${profile.name}` : null,
    profile.email ? `Email: ${profile.email}` : null,
    profile.phone ? `Phone: ${profile.phone}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const resumeSnippet = resumeText ? `Candidate resume excerpt:\n${resumeText.substring(0, 1200)}` : '';

  return `Interview the candidate for a senior full-stack (React + Node.js) role. Tailor the questions using their profile when available.\n${basics}\n${resumeSnippet}`.trim();
};

export const generateQuestionsWithGemini = async (
  profile: CandidateProfile,
  resumeText?: string,
): Promise<Question[]> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) {
    console.warn('Gemini API key missing, falling back to static bank.');
    return buildFallbackQuestions();
  }

  const requestBody = {
    system_instruction: {
      role: 'system' as const,
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: 'user' as const,
        parts: [{ text: buildUserPrompt(profile, resumeText) }],
      },
    ],
    generationConfig: {
      temperature: 0.5,
    },
  };

  try {
    const controller = new AbortController();
    const timeoutId = typeof window !== 'undefined' ? window.setTimeout(() => controller.abort(), 6000) : undefined;
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`Gemini request failed with status ${response.status}`);
    }

    const data = await response.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text).join('\n') ?? '';
    const parsed = parseGeminiJson(text);
    if (!parsed?.questions || parsed.questions.length < 6) {
      throw new Error('Gemini response did not include the expected questions.');
    }

    const mapped: Question[] = parsed.questions.slice(0, 6).map((item, index) => {
      const fallbackDifficulty = DIFFICULTY_ORDER[index];
      const difficulty = difficultyFromText(item.difficulty) ?? fallbackDifficulty;
      return {
        id: uuid(),
        prompt: item.prompt?.trim() || `Placeholder question ${index + 1}`,
        difficulty,
        keywords: sanitizeKeywords(item.keywords),
        maxTime: DIFFICULTY_TIMER[difficulty],
        order: index + 1,
      };
    });

    const hasAllDifficulties = mapped.every((question, index) => question.difficulty === DIFFICULTY_ORDER[index]);
    if (!hasAllDifficulties) {
      return DIFFICULTY_ORDER.map((difficulty, index) => ({
        ...mapped[index],
        difficulty,
        maxTime: DIFFICULTY_TIMER[difficulty],
      }));
    }

    return mapped;
  } catch (error) {
    console.warn('Falling back to static question bank due to Gemini error:', error);
    return buildFallbackQuestions();
  }
};
