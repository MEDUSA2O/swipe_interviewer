import type { CandidateProfile, Question } from '../features/session';
import { buildFallbackQuestions } from './questionBank';
import { generateQuestionsWithGemini } from '../services/gemini';

export const generateInterviewQuestions = async (
  profile: CandidateProfile,
  resumeText?: string,
): Promise<Question[]> => {
  try {
    const questions = await generateQuestionsWithGemini(profile, resumeText);
    if (questions.length >= 6) {
      return questions.slice(0, 6);
    }
    return buildFallbackQuestions();
  } catch (error) {
    console.warn('Falling back to static questions due to error:', error);
    return buildFallbackQuestions();
  }
};
