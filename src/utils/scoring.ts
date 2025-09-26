import type {
  InterviewSessionState,
  Question,
  TranscriptEntry,
  CandidateProfile,
  Difficulty,
} from '../features/session';

const DIFFICULTY_WEIGHT: Record<Difficulty, number> = {
  easy: 12,
  medium: 17,
  hard: 21,
};

const TARGET_WORDS: Record<Difficulty, number> = {
  easy: 35,
  medium: 55,
  hard: 75,
};

interface EvaluatedEntry {
  entry: TranscriptEntry;
  question: Question;
  score: number;
  weight: number;
  factor: number;
  notes: string;
  matchedKeywords: string[];
}

interface InterviewEvaluation {
  totalScore: number;
  entries: EvaluatedEntry[];
  summary: string;
}

const normalizeScore = (sum: number) => {
  return Math.max(0, Math.min(100, Math.round(sum)));
};

const computeEntryScore = (answer: string, question: Question, autoSubmitted: boolean, elapsedMs: number): Omit<EvaluatedEntry, 'entry'> => {
  const trimmed = answer.trim();
  const words = trimmed.length > 0 ? trimmed.split(/\s+/).length : 0;
  const keywordMatches = question.keywords.filter((keyword) =>
    trimmed.toLowerCase().includes(keyword.toLowerCase()),
  );
  const keywordCoverage = question.keywords.length
    ? keywordMatches.length / question.keywords.length
    : 0.5;
  const lengthScore = Math.min(words / TARGET_WORDS[question.difficulty], 1);
  const paceScore = autoSubmitted
    ? 0
    : Math.min(elapsedMs / (question.maxTime * 1000), 1);
  const factor = Math.max(0, Math.min(1, 0.5 * keywordCoverage + 0.3 * lengthScore + 0.2 * paceScore));
  const weight = DIFFICULTY_WEIGHT[question.difficulty];
  const score = Math.round(weight * factor);

  let notes = '';
  if (keywordMatches.length === 0) {
    notes = `Needs stronger coverage on ${question.keywords.join(', ')}.`;
  } else if (keywordMatches.length < question.keywords.length) {
    notes = `Touched on ${keywordMatches.join(', ')}; expand on remaining areas.`;
  } else {
    notes = 'Comprehensive answer covering all focus areas.';
  }

  if (autoSubmitted) {
    notes += ' Response auto-submitted when time expired.';
  }

  return {
    question,
    score,
    weight,
    factor,
    notes,
    matchedKeywords: keywordMatches,
  };
};

const bandDescriptor = (score: number) => {
  if (score >= 85) return 'outstanding full-stack capability with confident communication';
  if (score >= 70) return 'solid hands-on experience across the stack';
  if (score >= 55) return 'promising core skills with room to deepen practical knowledge';
  return 'foundational familiarity and strong motivation to keep improving';
};

const buildSummary = (
  profile: CandidateProfile,
  score: number,
  entries: EvaluatedEntry[],
): string => {
  const firstName = profile.name ? profile.name.split(' ')[0] : 'The candidate';
  const strengths = new Set<string>();
  const gaps = new Set<string>();

  entries.forEach((item) => {
    if (item.matchedKeywords.length > 0) {
      item.matchedKeywords.forEach((keyword) => strengths.add(keyword));
    }
    if (item.matchedKeywords.length === 0) {
      if (item.question.keywords.length > 0) {
        strengths.delete(item.question.keywords[0]);
        gaps.add(item.question.keywords[0]);
      }
    }
  });

  const strengthsText = strengths.size
    ? `Strengths included ${Array.from(strengths).slice(0, 3).join(', ')}.`
    : 'Showed enthusiasm but should deepen core technical storytelling.';

  const gapsText = gaps.size
    ? `Follow-up discussion on ${Array.from(gaps).slice(0, 3).join(', ')} will be valuable.`
    : 'Covered the essential areas effectively.';

  return `${firstName} demonstrated ${bandDescriptor(score)}. ${strengthsText} ${gapsText}`;
};

export const evaluateInterview = (session: InterviewSessionState): InterviewEvaluation => {
  const entries: EvaluatedEntry[] = session.transcript.map((entry) => {
    const question = session.questions.find((item) => item.id === entry.questionId);
    if (!question) {
      return {
        entry,
        question: {
          id: entry.questionId,
          prompt: entry.prompt,
          difficulty: 'easy',
          keywords: [],
          maxTime: 20,
        },
        score: 0,
        weight: 12,
        factor: 0,
        notes: 'Question reference missing.',
        matchedKeywords: [],
      };
    }
    const evaluated = computeEntryScore(entry.answer, question, entry.autoSubmitted, entry.elapsedMs);
    return {
      ...evaluated,
      entry,
    };
  });

  const rawScore = entries.reduce((total, item) => total + item.score, 0);
  const totalScore = normalizeScore(rawScore);
  const summary = buildSummary(session.profile, totalScore, entries);

  return {
    totalScore,
    entries,
    summary,
  };
};

export type { InterviewEvaluation, EvaluatedEntry };
