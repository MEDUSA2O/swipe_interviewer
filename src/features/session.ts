import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { v4 as uuid } from 'uuid';

type Difficulty = 'easy' | 'medium' | 'hard';
export type RequiredField = 'name' | 'email' | 'phone';
export type ChatRole = 'assistant' | 'candidate' | 'system';

export interface Question {
  id: string;
  prompt: string;
  difficulty: Difficulty;
  keywords: string[];
  maxTime: number;
  order?: number;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface TranscriptEntry {
  id: string;
  questionId: string;
  prompt: string;
  difficulty: Difficulty;
  answer: string;
  elapsedMs: number;
  autoSubmitted: boolean;
  scored?: boolean;
  score?: number;
  notes?: string;
  createdAt: string;
}

export interface CountdownState {
  questionId: string;
  durationMs: number;
  startedAt: string;
  deadline: string;
  remainingMs: number;
}

export interface CandidateProfile {
  name?: string;
  email?: string;
  phone?: string;
}

export interface InterviewSessionState {
  active: boolean;
  status: 'idle' | 'collecting-profile' | 'interview' | 'completed';
  candidateId: string | null;
  profile: CandidateProfile;
  resumeText?: string;
  resumeSummary?: string;
  resumeFileName?: string;
  missingFields: RequiredField[];
  chat: ChatMessage[];
  questions: Question[];
  currentQuestionIndex: number;
  transcript: TranscriptEntry[];
  countdown?: CountdownState;
  createdAt?: string;
  updatedAt?: string;
}

const initialState: InterviewSessionState = {
  active: false,
  status: 'idle',
  candidateId: null,
  profile: {},
  missingFields: [],
  chat: [],
  questions: [],
  currentQuestionIndex: -1,
  transcript: [],
};

interface StartSessionPayload {
  candidateId: string;
  resumeText?: string;
  resumeSummary?: string;
  resumeFileName?: string;
  missingFields: RequiredField[];
  profile: CandidateProfile;
}

interface UpdateProfilePayload {
  field: RequiredField;
  value: string;
}

interface SetQuestionsPayload {
  questions: Question[];
}

interface RecordChatPayload {
  message: Omit<ChatMessage, 'id' | 'createdAt'> & { id?: string; createdAt?: string };
}

interface RecordAnswerPayload {
  questionId: string;
  answer: string;
  elapsedMs: number;
  autoSubmitted: boolean;
}

interface UpdateTranscriptScorePayload {
  questionId: string;
  score: number;
  notes?: string;
}

interface SetCountdownPayload {
  countdown?: CountdownState;
}

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    startSession(state, action: PayloadAction<StartSessionPayload>) {
      const { candidateId, resumeText, resumeSummary, missingFields, profile, resumeFileName } =
        action.payload;
      state.active = true;
      state.status = missingFields.length > 0 ? 'collecting-profile' : 'interview';
      state.candidateId = candidateId;
      state.profile = { ...profile };
      state.resumeText = resumeText;
      state.resumeSummary = resumeSummary;
      state.resumeFileName = resumeFileName;
      state.missingFields = missingFields;
      state.chat = [];
      state.questions = [];
      state.currentQuestionIndex = -1;
      state.transcript = [];
      state.countdown = undefined;
      const timestamp = new Date().toISOString();
      state.createdAt = timestamp;
      state.updatedAt = timestamp;
    },
    recordChatMessage(state, action: PayloadAction<RecordChatPayload>) {
      const { message } = action.payload;
      state.chat.push({
        id: message.id ?? uuid(),
        role: message.role,
        content: message.content,
        createdAt: message.createdAt ?? new Date().toISOString(),
      });
      state.updatedAt = new Date().toISOString();
    },
    setMissingFields(state, action: PayloadAction<RequiredField[]>) {
      state.missingFields = action.payload;
      state.status = action.payload.length > 0 ? 'collecting-profile' : 'interview';
      state.updatedAt = new Date().toISOString();
    },
    updateProfileField(state, action: PayloadAction<UpdateProfilePayload>) {
      const { field, value } = action.payload;
      state.profile[field] = value;
      if (state.missingFields.includes(field)) {
        state.missingFields = state.missingFields.filter((item) => item !== field);
        if (state.missingFields.length === 0 && state.status === 'collecting-profile') {
          state.status = 'interview';
        }
      }
      state.updatedAt = new Date().toISOString();
    },
    setQuestions(state, action: PayloadAction<SetQuestionsPayload>) {
      state.questions = action.payload.questions;
      state.currentQuestionIndex = action.payload.questions.length > 0 ? 0 : -1;
      state.updatedAt = new Date().toISOString();
    },
    goToQuestion(state, action: PayloadAction<number>) {
      state.currentQuestionIndex = action.payload;
      state.updatedAt = new Date().toISOString();
    },
    setCountdown(state, action: PayloadAction<SetCountdownPayload>) {
      state.countdown = action.payload.countdown;
      state.updatedAt = new Date().toISOString();
    },
    recordAnswer(state, action: PayloadAction<RecordAnswerPayload>) {
      const { questionId, answer, elapsedMs, autoSubmitted } = action.payload;
      const question = state.questions.find((item) => item.id === questionId);
      if (!question) return;
      state.transcript.push({
        id: uuid(),
        questionId,
        prompt: question.prompt,
        difficulty: question.difficulty,
        answer,
        elapsedMs,
        autoSubmitted,
        createdAt: new Date().toISOString(),
      });
      state.updatedAt = new Date().toISOString();
    },
    updateTranscriptScore(state, action: PayloadAction<UpdateTranscriptScorePayload>) {
      const { questionId, score, notes } = action.payload;
      const entry = state.transcript.find((item) => item.questionId === questionId);
      if (!entry) return;
      entry.scored = true;
      entry.score = score;
      entry.notes = notes;
      state.updatedAt = new Date().toISOString();
    },
    setStatus(state, action: PayloadAction<InterviewSessionState['status']>) {
      state.status = action.payload;
      state.updatedAt = new Date().toISOString();
    },
    completeSession(state) {
      state.active = false;
      state.status = 'completed';
      state.countdown = undefined;
      state.updatedAt = new Date().toISOString();
    },
    resetSession() {
      return initialState;
    },
  },
});

export const {
  startSession,
  recordChatMessage,
  setMissingFields,
  updateProfileField,
  setQuestions,
  goToQuestion,
  setCountdown,
  recordAnswer,
  updateTranscriptScore,
  setStatus,
  completeSession,
  resetSession,
} = sessionSlice.actions;

export const sessionReducer = sessionSlice.reducer;

export const getNextRequiredField = (state: InterviewSessionState): RequiredField | null => {
  return state.missingFields.length > 0 ? state.missingFields[0] : null;
};

export const isInterviewComplete = (state: InterviewSessionState): boolean => {
  return state.questions.length > 0 && state.transcript.length >= state.questions.length;
};

export const getActiveCountdown = (state: InterviewSessionState): CountdownState | undefined => {
  return state.countdown;
};

export type { Difficulty };
