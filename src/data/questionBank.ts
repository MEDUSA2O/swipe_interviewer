import { v4 as uuid } from 'uuid';
import type { Difficulty, Question } from '../features/session';

interface QuestionTemplate {
  prompt: string;
  difficulty: Difficulty;
  keywords: string[];
  maxTime: number;
}

const createTemplate = (
  prompt: string,
  difficulty: Difficulty,
  keywords: string[],
  maxTime: number,
): QuestionTemplate => ({
  prompt,
  difficulty,
  keywords,
  maxTime,
});

const questionBank: QuestionTemplate[] = [
  createTemplate(
    'Explain how you would manage global state in a React application that needs offline persistence.',
    'easy',
    ['redux', 'persist', 'context'],
    20,
  ),
  createTemplate(
    'What strategies do you use to optimise React rendering performance?',
    'easy',
    ['memoization', 'useMemo', 'profiling'],
    20,
  ),
  createTemplate(
    'Describe how you would design an Express middleware pipeline to handle authentication and rate limiting.',
    'medium',
    ['middleware', 'jwt', 'rate limiting'],
    60,
  ),
  createTemplate(
    'How do you structure a REST API in Node.js to support versioning and backward compatibility?',
    'medium',
    ['versioning', 'routing', 'backward compatibility'],
    60,
  ),
  createTemplate(
    'Walk through your approach to designing a production-ready CI/CD workflow for a full-stack application.',
    'hard',
    ['ci/cd', 'testing', 'deployment'],
    120,
  ),
  createTemplate(
    'Discuss how you would architect a scalable real-time notification system for a dashboard product.',
    'hard',
    ['websockets', 'scaling', 'queues'],
    120,
  ),
  createTemplate(
    'How do you secure sensitive environment configuration across React and Node deployments?',
    'easy',
    ['environment variables', 'secrets', 'vault'],
    20,
  ),
  createTemplate(
    'Explain your debugging process when a React/Node feature regresses after deployment.',
    'medium',
    ['observability', 'logs', 'rollback'],
    60,
  ),
  createTemplate(
    'Describe how you would split a monolithic Node backend into scalable microservices.',
    'hard',
    ['microservices', 'communication', 'observability'],
    120,
  ),
];

const groupByDifficulty = questionBank.reduce<Record<Difficulty, QuestionTemplate[]>>(
  (acc, question) => {
    acc[question.difficulty].push(question);
    return acc;
  },
  { easy: [], medium: [], hard: [] },
);

const pick = (templates: QuestionTemplate[], count: number) => {
  if (templates.length === 0) return [];
  const copy = [...templates];
  const selected: QuestionTemplate[] = [];
  while (selected.length < count && copy.length > 0) {
    const index = Math.floor(Math.random() * copy.length);
    selected.push(copy.splice(index, 1)[0]);
  }
  while (selected.length < count) {
    selected.push(templates[selected.length % templates.length]);
  }
  return selected;
};

export const buildFallbackQuestions = (): Question[] => {
  const easy = pick(groupByDifficulty.easy, 2);
  const medium = pick(groupByDifficulty.medium, 2);
  const hard = pick(groupByDifficulty.hard, 2);
  const ordered = [...easy, ...medium, ...hard];
  return ordered.map((template, index) => ({
    id: uuid(),
    prompt: template.prompt,
    difficulty: template.difficulty,
    keywords: template.keywords,
    maxTime: template.maxTime,
    order: index + 1,
  }));
};
