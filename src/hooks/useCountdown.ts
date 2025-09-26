import { useEffect, useMemo, useRef, useState } from 'react';
import type { CountdownState } from '../features/session';

const computeRemaining = (countdown?: CountdownState | null) => {
  if (!countdown) return 0;
  const deadlineMs = new Date(countdown.deadline).getTime();
  const diff = deadlineMs - Date.now();
  return diff > 0 ? diff : 0;
};

interface UseCountdownOptions {
  onExpire?: () => void;
}

export const useCountdown = (countdown: CountdownState | undefined, options?: UseCountdownOptions) => {
  const [remainingMs, setRemainingMs] = useState(() => countdown?.remainingMs ?? computeRemaining(countdown));
  const expireRef = useRef(false);

  useEffect(() => {
    expireRef.current = false;
    setRemainingMs(countdown?.remainingMs ?? computeRemaining(countdown));
  }, [countdown]);

  useEffect(() => {
    if (!countdown) return () => undefined;
    const tick = () => {
      setRemainingMs(computeRemaining(countdown));
    };
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [countdown]);

  useEffect(() => {
    if (!countdown || !options?.onExpire) return;
    if (remainingMs <= 0 && !expireRef.current) {
      expireRef.current = true;
      options.onExpire();
    }
  }, [countdown, options, remainingMs]);

  const seconds = useMemo(() => Math.ceil(remainingMs / 1000), [remainingMs]);

  return {
    remainingMs,
    seconds: seconds > 0 ? seconds : 0,
  };
};
