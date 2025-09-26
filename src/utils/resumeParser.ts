import type { CandidateProfile, RequiredField } from '../features/session';
import { summarizeResume } from '../services/resumeSummarizer';

let pdfWorkerLoaded = false;

const loadPdfWorker = async () => {
  if (pdfWorkerLoaded) return;
  const [{ GlobalWorkerOptions }, workerSrc] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker?url'),
  ]);
  GlobalWorkerOptions.workerSrc = workerSrc.default;
  pdfWorkerLoaded = true;
};

const readArrayBuffer = (file: File) => file.arrayBuffer();

const extractTextFromPdf = async (file: File): Promise<string> => {
  await loadPdfWorker();
  const [{ getDocument }] = await Promise.all([import('pdfjs-dist')]);
  const data = await readArrayBuffer(file);
  const doc = await getDocument({ data }).promise;
  const { numPages } = doc;
  const contents: string[] = [];
  for (let i = 1; i <= numPages; i += 1) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const strings = textContent.items
      .map((item: unknown) => {
        if (typeof item === 'object' && item !== null && 'str' in item) {
          return String((item as { str: string }).str);
        }
        return '';
      })
      .filter(Boolean);
    contents.push(strings.join(' '));
  }
  return contents.join('\n');
};

const extractTextFromDocx = async (file: File): Promise<string> => {
  const arrayBuffer = await readArrayBuffer(file);
  const mammoth = await import('mammoth/mammoth.browser');
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const text = result.value
    .replace(/<\/?p>/g, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
  return text;
};

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_REGEX = /(\+?\d[\d\s().-]{7,}\d)/;

const normalizePhone = (input: string | undefined): string | undefined => {
  if (!input) return undefined;
  const digits = input.replace(/[^\d+]/g, '');
  if (digits.length < 7) return undefined;
  return digits;
};

const inferName = (lines: string[]): string | undefined => {
  const candidate = lines.find((line) => {
    const tokens = line.trim().split(/\s+/);
    if (tokens.length < 2 || tokens.length > 4) return false;
    return tokens.every((token) => /^[A-Za-z][A-Za-z'.-]*$/.test(token));
  });
  if (!candidate) return undefined;
  return candidate.replace(/^name[:\-\s]*/i, '').trim();
};

const sanitizeLines = (text: string): string[] => {
  return text
    .split(/\r?\n|(?<=[.])/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
};

const extractProfileFromText = (text: string): CandidateProfile => {
  const lines = sanitizeLines(text);
  const emailMatch = text.match(EMAIL_REGEX);
  const phoneMatch = text.match(PHONE_REGEX);
  const name = inferName(lines);
  return {
    name: name || undefined,
    email: emailMatch ? emailMatch[0] : undefined,
    phone: normalizePhone(phoneMatch ? phoneMatch[0] : undefined),
  };
};

export interface ResumeExtractionResult {
  text: string;
  profile: CandidateProfile;
  missing: RequiredField[];
  summary?: string;
}

const determineMissing = (profile: CandidateProfile): RequiredField[] => {
  const missing: RequiredField[] = [];
  if (!profile.name) missing.push('name');
  if (!profile.email) missing.push('email');
  if (!profile.phone) missing.push('phone');
  return missing;
};

export const parseResumeFile = async (file: File): Promise<ResumeExtractionResult> => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const isPdf = file.type === 'application/pdf' || extension === 'pdf';
  const isDocx =
    file.type ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || extension === 'docx';

  if (!isPdf && !isDocx) {
    throw new Error('Please upload a PDF or DOCX resume.');
  }

  const text = isPdf ? await extractTextFromPdf(file) : await extractTextFromDocx(file);
  const profile = extractProfileFromText(text);
  const summary = await summarizeResume(profile, text).catch(() => undefined);
  return {
    text,
    profile,
    missing: determineMissing(profile),
    summary,
  };
};
