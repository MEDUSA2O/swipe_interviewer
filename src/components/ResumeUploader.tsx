import { InboxOutlined } from '@ant-design/icons';
import { Typography, Upload, message } from 'antd';
import type { RcFile } from 'antd/es/upload';
import { useState } from 'react';
import type { ResumeExtractionResult } from '../utils/resumeParser';
import { parseResumeFile } from '../utils/resumeParser';

interface ResumeUploaderProps {
  disabled?: boolean;
  onResumeReady: (result: ResumeExtractionResult & { fileName: string }) => void;
}

const ResumeUploader = ({ disabled, onResumeReady }: ResumeUploaderProps) => {
  const [loading, setLoading] = useState(false);

  const handleBeforeUpload = async (file: RcFile) => {
    if (disabled) {
      return Upload.LIST_IGNORE;
    }
    setLoading(true);
    try {
      const extraction = await parseResumeFile(file as File);
      onResumeReady({ ...extraction, fileName: file.name });
      message.success('Resume parsed successfully.');
    } catch (error) {
      const err = error as Error;
      message.error(err.message || 'Unable to read the resume.');
    } finally {
      setLoading(false);
    }
    return Upload.LIST_IGNORE;
  };

  const dummyRequest = (options: { onSuccess?: (result: string) => void }) => {
    if (options.onSuccess) {
      options.onSuccess('ok');
    }
  };

  return (
    <Upload.Dragger
      multiple={false}
      maxCount={1}
      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      customRequest={dummyRequest}
      beforeUpload={handleBeforeUpload}
      showUploadList={false}
      disabled={disabled || loading}
      style={{
        padding: 24,
        borderRadius: 12,
        background: 'var(--color-secondary)',
        border: `1px dashed var(--color-border)`,
      }}
    >
      <p className="ant-upload-drag-icon">
        <InboxOutlined style={{ color: 'var(--color-primary)' }} />
      </p>
      <Typography.Text strong style={{ color: 'var(--color-text)' }}>
        Upload your resume (PDF preferred)
      </Typography.Text>
      <br />
      <Typography.Text type="secondary">
        We will auto-extract your name, email, and phone. DOCX is also supported.
      </Typography.Text>
    </Upload.Dragger>
  );
};

export default ResumeUploader;
