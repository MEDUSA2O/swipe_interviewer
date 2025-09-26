import { createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CandidateProfile, TranscriptEntry } from './session';

export interface CandidateRecord {
  id: string;
  profile: Required<CandidateProfile>;
  resumeText?: string;
  resumeSummary?: string;
  score: number;
  summary: string;
  completedAt: string;
  transcript: TranscriptEntry[];
}

export interface CandidatesState {
  items: Record<string, CandidateRecord>;
  order: string[]; // ordered by score desc then recency
}

const initialState: CandidatesState = {
  items: {},
  order: [],
};

interface UpsertCandidatePayload {
  record: CandidateRecord;
}

const candidatesSlice = createSlice({
  name: 'candidates',
  initialState,
  reducers: {
    upsertCandidate(state, action: PayloadAction<UpsertCandidatePayload>) {
      const { record } = action.payload;
      state.items[record.id] = record;
      state.order = Array.from(new Set([record.id, ...state.order])).sort((a, b) => {
        const left = state.items[a];
        const right = state.items[b];
        if (!left || !right) return 0;
        if (left.score === right.score) {
          return new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime();
        }
        return right.score - left.score;
      });
    },
    clearCandidates() {
      return initialState;
    },
  },
});

export const { upsertCandidate, clearCandidates } = candidatesSlice.actions;
export const candidatesReducer = candidatesSlice.reducer;

export const selectCandidatesArray = createSelector(
  (state: CandidatesState) => state.order,
  (state: CandidatesState) => state.items,
  (order, items) => order.map((id) => items[id]).filter((candidate): candidate is CandidateRecord => Boolean(candidate)),
);
