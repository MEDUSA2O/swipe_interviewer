import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Button, Form, Input, Space, Typography, Spin } from 'antd';
import type { Rule } from 'antd/es/form';
import dayjs from 'dayjs';
import { v4 as uuid } from 'uuid';
import ResumeUploader from './ResumeUploader';
import ChatWindow from './ChatWindow';
import {
  completeSession,
  getNextRequiredField,
  goToQuestion,
  recordAnswer,
  recordChatMessage,
  resetSession,
  setCountdown,
  setQuestions,
  startSession,
  updateProfileField,
  updateTranscriptScore,
  type RequiredField,
} from '../features/session';
import { useAppDispatch, useAppSelector } from '../hooks/storeHooks';
import type { ResumeExtractionResult } from '../utils/resumeParser';
import { generateInterviewQuestions } from '../data/questions';
import { buildFallbackQuestions } from '../data/questionBank';
import { useCountdown } from '../hooks/useCountdown';
import { evaluateInterview } from '../utils/scoring';
import { upsertCandidate } from '../features/candidates';

const FIELD_LABELS: Record<RequiredField, string> = {
  name: 'full name',
  email: 'email address',
  phone: 'phone number',
};

const fieldPrompt = (field: RequiredField) => {
  switch (field) {
    case 'name':
      return 'Could you please tell me your full name before we begin?';
    case 'email':
      return 'May I have your email address so we can stay in touch?';
    case 'phone':
      return 'What is the best phone number to reach you on?';
    default:
      return 'Could you provide the missing information?';
  }
};

const formatQuestionPrompt = (index: number, total: number, difficulty: string, prompt: string) =>
  `Question ${index} of ${total} (${difficulty}): ${prompt}`;

const IntervieweeView = () => {
  const session = useAppSelector((state) => state.session);
  const dispatch = useAppDispatch();
  const [profileForm] = Form.useForm();
  const [answerValue, setAnswerValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);

  const introSentRef = useRef(false);
  const welcomeSentRef = useRef(false);
  const summarySentRef = useRef(false);
  const autoSubmitRef = useRef<string | null>(null);
  const questionsRequestedRef = useRef(false);

  const nextField = useMemo(() => getNextRequiredField(session), [session]);
  const currentQuestion = useMemo(() => {
    if (session.currentQuestionIndex < 0) return null;
    return session.questions[session.currentQuestionIndex] ?? null;
  }, [session.currentQuestionIndex, session.questions]);

  const countdownState = session.countdown;
  const countdown = useCountdown(countdownState);

  useEffect(() => {
    if (!session.active) {
      introSentRef.current = false;
      welcomeSentRef.current = false;
      summarySentRef.current = false;
      autoSubmitRef.current = null;
      questionsRequestedRef.current = false;
      setGeneratingQuestions(false);
    }
  }, [session.active]);

  useEffect(() => {
    if (!session.active || introSentRef.current) return;
    dispatch(
      recordChatMessage({
        message: {
          id: 'assistant-welcome',
          role: 'assistant',
          content:
            'Thanks for sharing your resume. I will ask a few quick questions to get everything ready.',
        },
      }),
    );
    introSentRef.current = true;
  }, [dispatch, session.active]);

  useEffect(() => {
    if (!session.active || !nextField) return;
    const promptId = `assistant-missing-${nextField}`;
    if (!session.chat.some((message) => message.id === promptId)) {
      dispatch(
        recordChatMessage({
          message: {
            id: promptId,
            role: 'assistant',
            content: fieldPrompt(nextField),
          },
        }),
      );
    }
  }, [dispatch, nextField, session.active, session.chat]);

  useEffect(() => {
    if (!session.active || summarySentRef.current) return;
    if (session.resumeSummary) {
      dispatch(
        recordChatMessage({
          message: {
            id: 'assistant-resume-summary',
            role: 'assistant',
            content: `Here is what I gathered from your resume: ${session.resumeSummary}`,
          },
        }),
      );
      summarySentRef.current = true;
    }
  }, [dispatch, session.active, session.resumeSummary]);

  useEffect(() => {
    if (!session.active || session.status !== 'interview') return;
    if (welcomeSentRef.current) return;

    const readyId = 'assistant-ready';
    const alreadySent = session.chat.some((message) => message.id === readyId);
    if (!alreadySent) {
      dispatch(
        recordChatMessage({
          message: {
            id: readyId,
            role: 'assistant',
            content: 'Great! Let us move into the interview questions. Take your time and answer honestly.',
          },
        }),
      );
    }
    welcomeSentRef.current = true;
  }, [dispatch, session.active, session.chat, session.status]);

  useEffect(() => {
    if (!session.active) {
      questionsRequestedRef.current = false;
      return;
    }

    if (
      session.status !== 'interview' ||
      session.questions.length > 0 ||
      questionsRequestedRef.current
    ) {
      return;
    }

    questionsRequestedRef.current = true;
    setGeneratingQuestions(true);

    (async () => {
      try {
        const questions = await generateInterviewQuestions(session.profile, session.resumeText);
        const ensured = questions.length >= 6 ? questions : buildFallbackQuestions();

        dispatch(setQuestions({ questions: ensured }));

        const first = ensured[0];
        if (first) {
          dispatch(goToQuestion(0));
          const messageId = `assistant-question-${first.id}`;
          dispatch(
            recordChatMessage({
              message: {
                id: messageId,
                role: 'assistant',
                content: formatQuestionPrompt(1, ensured.length, first.difficulty.toUpperCase(), first.prompt),
              },
            }),
          );

          const now = Date.now();
          const durationMs = first.maxTime * 1000;
          dispatch(
            setCountdown({
              countdown: {
                questionId: first.id,
                durationMs,
                startedAt: new Date(now).toISOString(),
                deadline: new Date(now + durationMs).toISOString(),
                remainingMs: durationMs,
              },
            }),
          );
        }
      } catch (error) {
        console.error('[Interview] Error generating questions:', error);
        const fallback = buildFallbackQuestions();
        dispatch(setQuestions({ questions: fallback }));
        const firstFallback = fallback[0];
        if (firstFallback) {
          dispatch(goToQuestion(0));
          const messageId = `assistant-question-${firstFallback.id}`;
          dispatch(
            recordChatMessage({
              message: {
                id: messageId,
                role: 'assistant',
                content: formatQuestionPrompt(
                  1,
                  fallback.length,
                  firstFallback.difficulty.toUpperCase(),
                  firstFallback.prompt,
                ),
              },
            }),
          );
          const now = Date.now();
          const durationMs = firstFallback.maxTime * 1000;
          dispatch(
            setCountdown({
              countdown: {
                questionId: firstFallback.id,
                durationMs,
                startedAt: new Date(now).toISOString(),
                deadline: new Date(now + durationMs).toISOString(),
                remainingMs: durationMs,
              },
            }),
          );
        }
      } finally {
        setGeneratingQuestions(false);
      }
    })();
  }, [dispatch, session.active, session.profile, session.resumeText, session.questions.length, session.status]);

  useEffect(() => {
    if (!session.active) return;
    if (session.status !== 'interview') return;
    if (session.questions.length > 0 && session.currentQuestionIndex < 0) {
      dispatch(goToQuestion(0));
    }
  }, [dispatch, session.active, session.currentQuestionIndex, session.questions.length, session.status]);

  useEffect(() => {
    if (!currentQuestion || session.status !== 'interview') {
      setAnswerValue('');
      return;
    }

    const questionId = currentQuestion.id;
    const messageId = `assistant-question-${questionId}`;

    if (!session.chat.some((message) => message.id === messageId)) {
      dispatch(
        recordChatMessage({
          message: {
            id: messageId,
            role: 'assistant',
            content: formatQuestionPrompt(
              session.currentQuestionIndex + 1,
              session.questions.length,
              currentQuestion.difficulty.toUpperCase(),
              currentQuestion.prompt,
            ),
          },
        }),
      );
    }

    if (!countdownState || countdownState.questionId !== questionId) {
      const now = Date.now();
      const durationMs = currentQuestion.maxTime * 1000;
      dispatch(
        setCountdown({
          countdown: {
            questionId,
            durationMs,
            startedAt: new Date(now).toISOString(),
            deadline: new Date(now + durationMs).toISOString(),
            remainingMs: durationMs,
          },
        }),
      );
    }

    autoSubmitRef.current = null;
    setAnswerValue('');
  }, [countdownState, currentQuestion, dispatch, session.chat, session.currentQuestionIndex, session.questions.length, session.status]);

  const finalizeInterview = useCallback(() => {
    if (!session.candidateId || !session.profile.name || !session.profile.email || !session.profile.phone) {
      return;
    }

    const evaluation = evaluateInterview(session);

    evaluation.entries.forEach((item) => {
      dispatch(
        updateTranscriptScore({
          questionId: item.entry.questionId,
          score: item.score,
          notes: item.notes,
        }),
      );
    });

    dispatch(
      upsertCandidate({
        record: {
          id: session.candidateId,
          profile: {
            name: session.profile.name,
            email: session.profile.email,
            phone: session.profile.phone,
          },
          resumeText: session.resumeText,
          resumeSummary: session.resumeSummary,
          score: evaluation.totalScore,
          summary: evaluation.summary,
          completedAt: dayjs().toISOString(),
          transcript: evaluation.entries.map((item) => ({
            ...item.entry,
            score: item.score,
            notes: item.notes,
            scored: true,
          })),
        },
      }),
    );

    dispatch(
      recordChatMessage({
        message: {
          id: 'assistant-summary',
          role: 'assistant',
          content: `Your interview is complete. Final score: ${evaluation.totalScore}/100. ${evaluation.summary}`,
        },
      }),
    );

    dispatch(completeSession());
  }, [dispatch, session]);

  useEffect(() => {
    if (
      session.active &&
      session.status === 'interview' &&
      session.questions.length > 0 &&
      session.transcript.length === session.questions.length
    ) {
      finalizeInterview();
    }
  }, [finalizeInterview, session.active, session.questions.length, session.status, session.transcript.length]);

  const submitAnswer = useCallback(
    async (rawAnswer: string, autoSubmitted: boolean, remainingOverride?: number) => {
      if (!currentQuestion || submitting) return;
      const alreadyAnswered = session.transcript.some((item) => item.questionId === currentQuestion.id);
      if (alreadyAnswered) return;

      setSubmitting(true);
      const durationMs = currentQuestion.maxTime * 1000;
      const remainingMs = Math.max(
        0,
        Math.min(durationMs, remainingOverride ?? countdown.remainingMs ?? durationMs),
      );
      const elapsedMs = durationMs - remainingMs;
      const answer = rawAnswer.trim();

      if (answer.length > 0) {
        dispatch(
          recordChatMessage({
            message: {
              role: 'candidate',
              content: answer,
            },
          }),
        );
      }

      dispatch(
        recordAnswer({
          questionId: currentQuestion.id,
          answer,
          elapsedMs,
          autoSubmitted,
        }),
      );

      dispatch(setCountdown({ countdown: undefined }));
      setAnswerValue('');

      const nextIndex = session.currentQuestionIndex + 1;
      if (nextIndex < session.questions.length) {
        dispatch(goToQuestion(nextIndex));
      }

      if (autoSubmitted) {
        dispatch(
          recordChatMessage({
            message: {
              id: `assistant-autosubmit-${currentQuestion.id}`,
              role: 'assistant',
              content:
                nextIndex < session.questions.length
                  ? 'Time is up. Moving to the next question.'
                  : 'Time is up. Wrapping up your interview.',
            },
          }),
        );
      } else {
        dispatch(
          recordChatMessage({
            message: {
              id: `assistant-ack-${currentQuestion.id}`,
              role: 'assistant',
              content:
                nextIndex < session.questions.length
                  ? 'Got it. Let us continue.'
                  : 'Thank you. Let me process your performance.',
            },
          }),
        );
      }

      setSubmitting(false);
    },
    [countdown.remainingMs, currentQuestion, dispatch, session.currentQuestionIndex, session.questions.length, session.transcript, submitting],
  );

  useEffect(() => {
    if (!session.active || session.status !== 'interview') return;
    if (!countdownState || !currentQuestion) return;
    if (autoSubmitRef.current === currentQuestion.id) return;

    if (countdown.seconds > 0) {
      return;
    }

    const deadline = new Date(countdownState.deadline).getTime();
    if (deadline > Date.now()) {
      return;
    }

    autoSubmitRef.current = currentQuestion.id;
    submitAnswer(answerValue, true, 0);
  }, [answerValue, countdown.seconds, countdownState, currentQuestion, session.active, session.status, submitAnswer]);

  const handleResumeReady = useCallback(
    ({ text, profile, summary, missing, fileName }: ResumeExtractionResult & { fileName: string }) => {
      const candidateId = uuid();
      dispatch(
        startSession({
          candidateId,
          resumeText: text,
          resumeSummary: summary,
          resumeFileName: fileName,
          profile,
          missingFields: missing,
        }),
      );
      profileForm.resetFields();
      setAnswerValue('');
    },
    [dispatch, profileForm],
  );

  const handleFieldSubmit = useCallback(
    async (values: { fieldValue: string }) => {
      if (!nextField) return;
      const value = values.fieldValue.trim();
      if (!value) return;
      dispatch(
        recordChatMessage({
          message: {
            role: 'candidate',
            content: value,
          },
        }),
      );
      dispatch(updateProfileField({ field: nextField, value }));
      profileForm.resetFields();
    },
    [dispatch, nextField, profileForm],
  );

  const handleManualSubmit = useCallback(() => {
    if (!currentQuestion || submitting) return;
    submitAnswer(answerValue, false, countdown.remainingMs);
  }, [answerValue, countdown.remainingMs, currentQuestion, submitAnswer, submitting]);

  if (session.status === 'completed') {
    return (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          type="success"
          message={<Typography.Text strong>Interview finished</Typography.Text>}
          description={
            <Space direction="vertical" size={4}>
              <Typography.Text>
                Great job! Head over to the interviewer tab to review the full dashboard.
              </Typography.Text>
              {session.resumeSummary && (
                <Typography.Text type="secondary">{session.resumeSummary}</Typography.Text>
              )}
            </Space>
          }
          showIcon
          style={{
            background: 'var(--color-secondary)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text)',
          }}
        />
        <Button type="primary" onClick={() => dispatch(resetSession())}>
          Start a new interview
        </Button>
      </Space>
    );
  }

  if (!session.active) {
    return <ResumeUploader onResumeReady={handleResumeReady} />;
  }

  let footer: ReactNode = null;
  if (nextField) {
    const rules: Rule[] = [{ required: true, message: `Please enter your ${FIELD_LABELS[nextField]}.` }];
    if (nextField === 'email') {
      rules.push({ type: 'email', message: 'Please enter a valid email address.' });
    }
    footer = (
      <Form form={profileForm} layout="vertical" onFinish={handleFieldSubmit} style={{ marginTop: 12 }}>
        <Form.Item
          name="fieldValue"
          label={<Typography.Text>Provide your {FIELD_LABELS[nextField]}</Typography.Text>}
          rules={rules}
        >
          <Input
            placeholder={`Enter your ${FIELD_LABELS[nextField]}`}
            inputMode={nextField === 'phone' ? 'tel' : 'text'}
            autoFocus
          />
        </Form.Item>
        <Button type="primary" htmlType="submit">
          Submit
        </Button>
      </Form>
    );
  } else if (currentQuestion) {
    footer = (
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
          <Typography.Text type="secondary">
            {`Timer: ${Math.max(0, countdown.seconds)}s remaining`}
          </Typography.Text>
          <Typography.Text type="secondary">
            {`Difficulty: ${currentQuestion.difficulty.toUpperCase()}`}
          </Typography.Text>
        </Space>
        <Input.TextArea
          value={answerValue}
          rows={4}
          placeholder="Type your answer and press Send before the timer ends."
          onChange={(event) => setAnswerValue(event.target.value)}
          disabled={submitting}
        />
        <Button
          type="primary"
          onClick={handleManualSubmit}
          loading={submitting}
          disabled={answerValue.trim().length === 0}
        >
          Send answer
        </Button>
      </Space>
    );
  } else {
    footer = (
      <Space align="center" size={8}>
        {generatingQuestions && <Spin size="small" />}
        <Typography.Text type="secondary">
          Preparing your interview questions. You will see them shortly.
        </Typography.Text>
      </Space>
    );
  }

  return <ChatWindow messages={session.chat} footer={footer} />;
};

export default IntervieweeView;
