export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

interface RunUntilConditionOpts {
  initialDelay?: number;
  wait: number;
  maxNumberOfAttempts?: number;
  onMaxNumberOfAttemptsReached?: () => void;
  isCancelled?: () => boolean;
}

export const runUntilConditionMet = async <T>(
  run: () => Promise<T>,
  conditionMet: (data: T) => boolean,
  onConditionMet: (data: T) => void,
  {
    initialDelay = 0,
    wait,
    maxNumberOfAttempts = 10,
    onMaxNumberOfAttemptsReached,
    isCancelled,
  }: RunUntilConditionOpts
) => {
  if (maxNumberOfAttempts === 0) {
    if (onMaxNumberOfAttemptsReached) onMaxNumberOfAttemptsReached();
    return;
  }

  if (initialDelay) {
    await sleep(initialDelay);
  }

  const data = await run();
  const done = conditionMet(data);

  if (done) {
    onConditionMet(data);
    return;
  }

  const newOpts = {
    initialDelay: wait,
    wait,
    maxNumberOfAttempts: maxNumberOfAttempts--,
    onMaxNumberOfAttemptsReached,
  };

  const cancelled = isCancelled ? isCancelled() : false;

  if (!cancelled) {
    runUntilConditionMet(run, conditionMet, onConditionMet, newOpts);
  }
};
