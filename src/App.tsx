import { useEffect, useMemo, useRef, useState } from 'react';
import { Layout, Modal, Tabs, Typography, Button, Space } from 'antd';
import IntervieweeView from './components/IntervieweeView';
import InterviewerView from './components/InterviewerView';
import { useAppDispatch, useAppSelector } from './hooks/storeHooks';
import { resetSession } from './features/session';
import { persistor } from './store';

const { Header, Content } = Layout;

const App = () => {
  const session = useAppSelector((state) => state.session);
  const dispatch = useAppDispatch();
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      if (session.active && session.status !== 'completed') {
        setWelcomeVisible(true);
      }
      return;
    }
    if (session.status === 'completed') {
      setWelcomeVisible(false);
    }
  }, [session.active, session.status]);

  const welcomeDescription = useMemo(() => {
    if (!session.profile.name) {
      return 'You have an unfinished interview setup.';
    }
    return `Welcome back, ${session.profile.name.split(' ')[0]}. Pick up right where you left off.`;
  }, [session.profile.name]);

  return (
    <Layout style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <Header
        style={{
          background: 'var(--color-bg)',
          borderBottom: `1px solid var(--color-border)`,
          display: 'flex',
          alignItems: 'center',
          paddingInline: 24,
          justifyContent: 'space-between',
        }}
      >
        <Typography.Text strong style={{ fontSize: 18, color: 'var(--color-text)' }}>
          Swipe Interview Assistant
        </Typography.Text>
        <Space>
          <Button
            size="small"
            danger
            onClick={async () => {
              await persistor.purge();
              try {
                localStorage.removeItem('persist:root');
              } catch {
                // Ignore localStorage errors
              }
              dispatch(resetSession());
              window.location.reload();
            }}
          >
            Reset data
          </Button>
        </Space>
      </Header>
      <Content style={{ padding: 24, background: 'var(--color-bg)' }}>
        <Tabs
          className="app-tabs"
          type="card"
          items={[
            {
              key: 'interviewee',
              label: 'Interviewee',
              children: <IntervieweeView />,
            },
            {
              key: 'interviewer',
              label: 'Interviewer',
              children: <InterviewerView />,
            },
          ]}
        />
      </Content>

      <Modal
        open={welcomeVisible}
        centered
        closable={false}
        title={<Typography.Text strong style={{ color: 'var(--color-text)' }}>Welcome Back</Typography.Text>}
        footer={
          <Space>
            <Button onClick={() => setWelcomeVisible(false)} type="primary">
              Resume interview
            </Button>
            <Button
              danger
              onClick={() => {
                dispatch(resetSession());
                setWelcomeVisible(false);
              }}
            >
              Start over
            </Button>
          </Space>
        }
      >
        <Typography.Text style={{ color: 'var(--color-text)' }}>{welcomeDescription}</Typography.Text>
      </Modal>
    </Layout>
  );
};

export default App;
