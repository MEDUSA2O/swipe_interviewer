import { useMemo, useState } from 'react';
import {
  Card,
  Divider,
  Drawer,
  Empty,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useAppSelector } from '../hooks/storeHooks';
import { selectCandidatesArray } from '../features/candidates';
import type { CandidateRecord } from '../features/candidates';

const sortCandidates = (
  list: CandidateRecord[],
  sortKey: 'score' | 'recent' | 'name',
): CandidateRecord[] => {
  const copy = [...list];
  switch (sortKey) {
    case 'recent':
      return copy.sort(
        (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
      );
    case 'name':
      return copy.sort((a, b) => a.profile.name.localeCompare(b.profile.name));
    case 'score':
    default:
      return copy.sort((a, b) => b.score - a.score || new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  }
};

const InterviewerView = () => {
  const candidates = useAppSelector((state) => selectCandidatesArray(state.candidates));
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'score' | 'recent' | 'name'>('score');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = term
      ? candidates.filter(
          (candidate) =>
            candidate.profile.name.toLowerCase().includes(term) ||
            candidate.profile.email.toLowerCase().includes(term),
        )
      : candidates;
    return sortCandidates(base, sortKey);
  }, [candidates, search, sortKey]);

  const selectedCandidate = useAppSelector((state) =>
    selectedId ? state.candidates.items[selectedId] ?? null : null,
  );

  const columns: ColumnsType<CandidateRecord> = [
    {
      title: 'Name',
      dataIndex: ['profile', 'name'],
      key: 'name',
      render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: 'Email',
      dataIndex: ['profile', 'email'],
      key: 'email',
      render: (value: string) => <Typography.Text type="secondary">{value}</Typography.Text>,
    },
    {
      title: 'Score',
      dataIndex: 'score',
      key: 'score',
      sorter: (a, b) => a.score - b.score,
      render: (value: number) => <Typography.Text>{value}</Typography.Text>,
    },
    {
      title: 'Summary',
      dataIndex: 'summary',
      key: 'summary',
      ellipsis: true,
      render: (value: string) => <Typography.Text type="secondary">{value}</Typography.Text>,
    },
    {
      title: 'Completed',
      dataIndex: 'completedAt',
      key: 'completedAt',
      render: (value: string) => (
        <Typography.Text type="secondary">{dayjs(value).format('DD MMM YYYY, HH:mm')}</Typography.Text>
      ),
    },
  ];

  return (
    <Card bordered={false} style={{ background: 'var(--color-card)', border: `1px solid var(--color-border)` }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Space
          direction="horizontal"
          size={12}
          style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}
        >
          <Typography.Text strong style={{ fontSize: 16, color: 'var(--color-text)' }}>
            Candidate leaderboard
          </Typography.Text>
          <Space size={12} wrap>
            <Input.Search
              allowClear
              placeholder="Search name or email"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={{ width: 220, background: 'var(--color-secondary)', borderRadius: 8 }}
            />
            <Select<'score' | 'recent' | 'name'>
              value={sortKey}
              style={{ width: 160 }}
              onChange={(value) => setSortKey(value)}
              options={[
                { value: 'score', label: 'Sort by score' },
                { value: 'recent', label: 'Sort by recent' },
                { value: 'name', label: 'Sort by name' },
              ]}
            />
          </Space>
        </Space>
        {filtered.length === 0 ? (
          <Empty description={<Typography.Text>No candidates yet.</Typography.Text>} />
        ) : (
          <Table<CandidateRecord>
            columns={columns}
            dataSource={filtered}
            rowKey={(candidate) => candidate.id}
            onRow={(candidate) => ({
              onClick: () => setSelectedId(candidate.id),
            })}
            pagination={false}
            scroll={{ x: true }}
          />
        )}
      </Space>

      <Drawer
        width={520}
        open={Boolean(selectedCandidate)}
        onClose={() => setSelectedId(null)}
        title={
          selectedCandidate ? (
            <Space direction="vertical" size={4}>
              <Typography.Text strong>{selectedCandidate.profile.name}</Typography.Text>
              <Typography.Text type="secondary">{selectedCandidate.profile.email}</Typography.Text>
            </Space>
          ) : undefined
        }
      >
        {selectedCandidate && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card
              size="small"
              bordered={false}
              style={{ background: 'var(--color-secondary)', border: `1px solid var(--color-border)` }}
            >
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                <Typography.Text strong>Overview</Typography.Text>
                <Typography.Text type="secondary">
                  Score: {selectedCandidate.score} / 100
                </Typography.Text>
                <Typography.Text type="secondary">
                  Completed on {dayjs(selectedCandidate.completedAt).format('DD MMM YYYY, HH:mm')}
                </Typography.Text>
                <Typography.Text type="secondary">
                  Phone: {selectedCandidate.profile.phone}
                </Typography.Text>
                {selectedCandidate.resumeSummary && (
                  <Typography.Text type="secondary">
                    Resume summary: {selectedCandidate.resumeSummary}
                  </Typography.Text>
                )}
                <Typography.Text>{selectedCandidate.summary}</Typography.Text>
              </Space>
            </Card>
            <Divider plain>
              <Typography.Text type="secondary">Interview transcript</Typography.Text>
            </Divider>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {selectedCandidate.transcript.map((entry) => (
                <Card key={entry.id} size="small" bordered>
                  <Space direction="vertical" size={6} style={{ width: '100%' }}>
                    <Space align="center" size={8} wrap>
                      <Tag
                        style={{
                          background: 'var(--color-accent)',
                          color: 'var(--color-accent-foreground)',
                          borderColor: 'var(--color-accent)',
                        }}
                      >
                        {entry.difficulty.toUpperCase()}
                      </Tag>
                      <Typography.Text strong>{entry.prompt}</Typography.Text>
                    </Space>
                    <Typography.Text type="secondary">Answer</Typography.Text>
                    <Typography.Text>{entry.answer || 'No answer captured.'}</Typography.Text>
                    <Space size={12} wrap>
                      <Typography.Text type="secondary">
                        Time used: {Math.round(entry.elapsedMs / 1000)}s
                      </Typography.Text>
                      <Typography.Text type="secondary">
                        Score: {entry.score ?? 0} / {entry.difficulty === 'hard' ? 21 : entry.difficulty === 'medium' ? 17 : 12}
                      </Typography.Text>
                      {entry.autoSubmitted && (
                        <Tag
                          style={{
                            background: 'var(--color-destructive)',
                            color: 'var(--color-destructive-foreground)',
                            borderColor: 'var(--color-destructive)',
                          }}
                        >
                          Auto submitted
                        </Tag>
                      )}
                    </Space>
                    {entry.notes && <Typography.Text type="secondary">{entry.notes}</Typography.Text>}
                  </Space>
                </Card>
              ))}
            </Space>
          </Space>
        )}
      </Drawer>
    </Card>
  );
};

export default InterviewerView;
