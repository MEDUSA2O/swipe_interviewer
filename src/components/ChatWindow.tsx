import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Card, Typography } from 'antd';
import type { ChatMessage } from '../features/session';

interface ChatWindowProps {
  messages: ChatMessage[];
  footer?: ReactNode;
}

const bubbleStyles: Record<string, CSSProperties> = {
  assistant: {
    alignSelf: 'flex-start',
    background: 'var(--color-secondary)',
    color: 'var(--color-secondary-foreground)',
  },
  candidate: {
    alignSelf: 'flex-end',
    background: 'var(--color-primary)',
    color: 'var(--color-primary-foreground)',
  },
  system: {
    alignSelf: 'center',
    background: 'var(--color-accent)',
    color: 'var(--color-accent-foreground)',
  },
};

const ChatWindow = ({ messages, footer }: ChatWindowProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dynamicMinHeight = Math.min(380 + messages.length * 40, 820);
  const scrollMinHeight = Math.max(dynamicMinHeight - 180, 200);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages.length]);

  return (
    <Card
      bordered={false}
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: dynamicMinHeight,
        background: 'var(--color-card)',
      }}
      bodyStyle={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: 16,
        gap: 12,
      }}
    >
      <div
        ref={containerRef}
        style={{
          flex: 1,
          minHeight: scrollMinHeight,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {messages.map((message) => {
          const style = bubbleStyles[message.role] ?? bubbleStyles.assistant;
          return (
            <div
              key={message.id}
              style={{
                alignSelf: style.alignSelf,
                background: style.background,
                color: style.color,
                borderRadius: 12,
                padding: '12px 16px',
                maxWidth: '75%',
                border: `1px solid var(--color-border)`,
              }}
            >
              <Typography.Text style={{ color: style.color ?? 'inherit' }}>
                {message.content}
              </Typography.Text>
            </div>
          );
        })}
      </div>
      {footer && <div style={{ marginTop: 12 }}>{footer}</div>}
    </Card>
  );
};

export default ChatWindow;
