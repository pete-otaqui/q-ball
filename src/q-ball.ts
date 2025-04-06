interface QBallEventMap<TMessage, TData> {
  /**
   * Emitted when a message fails to process (after any retries)
   */
  error: Error;
  /**
   * Emitted when the queue is finished processing all messages
   * (including any retries)
   */
  // biome-ignore lint/suspicious/noConfusingVoidType: This is used as a type
  finished: void;
  /**
   * Emitted when a message is processed successfully
   */
  processed: TData;
  /**
   * Emitted when a message will be retried (the message will be added back to
   * the queue _after_ the delay)
   */
  retry: { message: TMessage; attempt: number; delay: number };
  /**
   * Emitted when the queue is started
   */
  // biome-ignore lint/suspicious/noConfusingVoidType: This is used as a type
  started: void;
}
type QBallListeners<TMessage, TData> = {
  [K in keyof QBallEventMap<TMessage, TData>]: Array<
    (data: QBallEventMap<TMessage, TData>[K]) => void
  >;
};
type QBallEmitters<TMessage, TData> = {
  [K in keyof QBallEventMap<TMessage, TData>]: (
    data: QBallEventMap<TMessage, TData>[K],
  ) => void;
};

export type QBallMessagePacket<TMessage> = {
  message: TMessage;
  attempt: number;
};

export type QBallObject<TMessage, TData> = {
  /**
   * Add a message to the queue
   */
  add: (message: TMessage) => QBallObject<TMessage, TData>;
  /**
   * Start processing messages in the queue
   */
  start: () => QBallObject<TMessage, TData>;
  /**
   * Stop processing messages in the queue
   */
  stop: () => QBallObject<TMessage, TData>;
  /**
   * Async function to wait for the next time the queue stops
   */
  nextStop: () => Promise<QBallObject<TMessage, TData>>;
  /**
   * Clear the queue
   */
  clear: () => QBallObject<TMessage, TData>;
  addEventListener: {
    /**
     * Listen for error events that occur when a message fails to process (after any retries)
     * @param event The "error" event
     * @param listener Function that receives the error object
     */
    (
      event: "error",
      listener: (error: Error) => void,
    ): QBallObject<TMessage, TData>;

    /**
     * Listen for when the queue is finished processing all messages (including any retries)
     * @param event The "finished" event
     * @param listener Callback function that's called when processing finishes
     */
    (event: "finished", listener: () => void): QBallObject<TMessage, TData>;

    /**
     * Listen for when a message is processed successfully
     * @param event The "processed" event
     * @param listener Function that receives the processed data
     */
    (
      event: "processed",
      listener: (data: TData) => void,
    ): QBallObject<TMessage, TData>;

    /**
     * Listen for when a message will be retried
     * @param event The "retry" event
     * @param listener Function that receives retry information (message, attempt count, and delay)
     */
    (
      event: "retry",
      listener: (data: {
        message: TMessage;
        attempt: number;
        delay: number;
      }) => void,
    ): QBallObject<TMessage, TData>;

    /**
     * Listen for when the queue is started
     * @param event The "started" event
     * @param listener Callback function that's called when processing starts
     */
    (event: "started", listener: () => void): QBallObject<TMessage, TData>;

    /**
     * Generic event listener registration
     * @param event The event name to listen for
     * @param listener The callback function that receives event data
     */
    <TEvent extends keyof QBallEventMap<TMessage, TData>>(
      event: TEvent,
      listener: (data: QBallEventMap<TMessage, TData>[TEvent]) => void,
    ): QBallObject<TMessage, TData>;
  };
  /**
   * Remove an event listener for a specific event
   */
  removeEventListener: <TEvent extends keyof QBallEventMap<TMessage, TData>>(
    event: TEvent,
    listener: (data: QBallEventMap<TMessage, TData>[TEvent]) => void,
  ) => QBallObject<TMessage, TData>;
};

export type QBallOptions<TMessage, TData> = {
  /**
   * Whether to start processing messages automatically
   */
  autoStart?: boolean;
  /**
   * The console object to use for logging, defaults to globalThis.console
   */
  console?: Console;
  /**
   * Whether to log debug messages
   */
  debug?: boolean;
  /**
   * The dead letter queue instance of QBall to use for failed messages
   */
  dlq?: QBallObject<TMessage, TData>;
  /**
   * The id of the queue, used in debug loggins. Defaults to a random
   * string.
   */
  id?: string;
  /**
   * Initial messages to add to the queue
   */
  messages?: TMessage[];
  /**
   * The frequency to check for the next stop in milliseconds, default is 10ms
   */
  nextStopCheckFrequency?: number;
  /**
   * Callback function to call when an error occurs. Alternatively, you can
   * use the `addEventListener` method to listen for the `error` event.
   */
  onError?: (error: Error) => void;
  /**
   * Callback function to call when the queue is finished processing. This
   * will be called after all messages have been processed, including any
   * retries. Alternatively, you can use the `addEventListener` method to
   * listen for the `finished` event.
   */
  onFinished?: () => void;
  /**
   * Callback function to call when a message is processed. Alternatively,
   * you can use the `addEventListener` method to listen for the `processed`
   * event.
   */
  onProcessed?: (data: TData) => void;
  /**
   * Callback function to call when a message is retried. Alternatively, you
   * can use the `addEventListener` method to listen for the `retry` event.
   */
  onRetry?: ({
    message,
    attempt,
  }: {
    message: TMessage;
    attempt: number;
  }) => void;
  /**
   * Callback function to call when the queue is started. Alternatively, you
   * can use the `addEventListener` method to listen for the `started` event.
   */
  onStarted?: () => void;
  /**
   * The maximum number of times to retry processing a message before sending
   * it to the dead letter queue, default is 0
   */
  redriveCount?: number;
  /**
   * A function to determine the delay before retrying a message, default is
   * 0ms
   */
  redriveDelay?: (attempt: number, message: TMessage) => number;
  /**
   * Whether to stop processing messages on error, default is false
   */
  stopOnError?: boolean;
  /**
   * The number of workers to use for processing messages, default is 1
   */
  workers?: number;
};
export function QBall<TMessage, TData>(
  processor: (messagePacket: TMessage) => Promise<TData>,
  {
    autoStart = true,
    console = globalThis.console,
    debug = false,
    dlq,
    id = Math.random().toString(36).substring(2, 15),
    messages = [],
    nextStopCheckFrequency = 10,
    onError,
    onFinished,
    onProcessed,
    onRetry,
    onStarted,
    redriveCount = 0,
    redriveDelay = () => 0,
    stopOnError = false,
    workers = 1,
  }: QBallOptions<TMessage, TData> = {},
) {
  // biome-ignore lint/suspicious/noExplicitAny: Passing to console.log
  const debugLog = (...args: any[]) => {
    if (!debug) {
      return;
    }
    console.log(`[QBall ${id}]`, ...args);
  };
  let isProcessing = false;
  let forceStopped = false;

  const messagePackets: QBallMessagePacket<TMessage>[] = messages.map(
    (message) => ({
      message,
      attempt: 0,
    }),
  );

  const hasMessages = () => {
    return messagePackets.length > 0;
  };

  const isAwaitingRetry = () => {
    return workerObjects.some((workerObject) => {
      return workerObject.isAwaitingRetry;
    });
  };

  const getNextMessagePacket = () => {
    return messagePackets.shift();
  };

  const listeners: QBallListeners<TMessage, TData> = {
    error: [] as ((error: Error) => void)[],
    finished: [] as (() => void)[],
    processed: [] as ((data: TData) => void)[],
    retry: [] as (({
      message,
      attempt,
    }: { message: TMessage; attempt: number }) => void)[],
    started: [] as (() => void)[],
  };

  const emitters: QBallEmitters<TMessage, TData> = {
    error: (error) => {
      for (const listener of listeners.error) {
        listener(error);
      }
    },
    finished: () => {
      for (const listener of listeners.finished) {
        listener();
      }
    },
    retry: ({ message, attempt, delay }) => {
      for (const listener of listeners.retry) {
        listener({ message, attempt, delay });
      }
    },
    started: () => {
      for (const listener of listeners.started) {
        listener();
      }
    },
    processed: (data) => {
      for (const listener of listeners.processed) {
        listener(data);
      }
    },
  };

  const workerObjects = Array.from({ length: workers }, (i) => {
    const workerObject = {
      index: i,
      isWorking: false,
      isAwaitingRetry: false,
      start: async () => {
        debugLog(`Worker ${i} started`);
        while (isProcessing || isAwaitingRetry()) {
          const messagePacket = getNextMessagePacket();
          if (messagePacket) {
            await workerObject.process(messagePacket);
          } else {
            const isAwaiting = isAwaitingRetry();
            if (isProcessing && !isAwaiting) {
              emitters.finished();
            }
          }
          await new Promise((resolve) => {
            setTimeout(resolve, 1);
          });
        }
      },
      process: async (messagePacket: QBallMessagePacket<TMessage>) => {
        workerObject.isWorking = true;
        messagePacket.attempt++;
        debugLog(
          `Worker ${i} processing message (attempt ${messagePacket.attempt})`,
          messagePacket.message,
        );
        try {
          const data = await processor(messagePacket.message);
          emitters.processed(data);
        } catch (error) {
          debugLog(
            `Worker ${i} error processing message (attempt ${messagePacket.attempt})`,
            messagePacket.message,
            error,
          );
          if (messagePacket.attempt < redriveCount) {
            const delay = redriveDelay(
              messagePacket.attempt,
              messagePacket.message,
            );
            emitters.retry({
              message: messagePacket.message,
              attempt: messagePacket.attempt,
              delay,
            });
            workerObject.isAwaitingRetry = true;
            setTimeout(() => {
              messagePackets.push(messagePacket);
              setTimeout(() => {
                startProcessing();
                workerObject.isAwaitingRetry = false;
              }, 0);
            }, delay);
          } else {
            emitters.error(error as Error);
            if (dlq) {
              dlq.add(messagePacket.message);
            }
          }
        }
        workerObject.isWorking = false;
      },
    };
    return workerObject;
  });

  const startProcessing = () => {
    if (isProcessing && !isAwaitingRetry()) {
      debugLog("Already processing messages, not starting again");
      return;
    }
    emitters.started();
    if (!hasMessages()) {
      debugLog("No messages to process, stopping immediately");
      emitters.finished();
      return;
    }
    forceStopped = false;
    isProcessing = true;
    for (let i = 0; i < workers && messagePackets.length; i++) {
      if (!workerObjects[i].isWorking) {
        workerObjects[i].start();
      }
    }
  };

  listeners.processed.push(async () => {
    if (!hasMessages() && !isAwaitingRetry()) {
      emitters.finished();
    }
  });
  listeners.error.push((error) => {
    if (stopOnError) {
      forceStopped = true;
      emitters.finished();
    }
  });
  listeners.finished.push(() => {
    isProcessing = false;
  });
  if (onError) {
    listeners.error.push(onError);
  }
  if (onFinished) {
    listeners.finished.push(onFinished);
  }
  if (onProcessed) {
    listeners.processed.push(onProcessed);
  }
  if (onRetry) {
    listeners.retry.push(onRetry);
  }
  if (onStarted) {
    listeners.started.push(onStarted);
  }
  if (autoStart && hasMessages()) {
    startProcessing();
  }

  const qBallObject: QBallObject<TMessage, TData> = {
    add(message: TMessage) {
      messagePackets.push({
        message,
        attempt: 0,
      });
      if (autoStart) {
        startProcessing();
      }
      return qBallObject;
    },
    start() {
      startProcessing();
      return qBallObject;
    },
    stop() {
      isProcessing = false;
      // Emit the finished event if there are no messages to process
      if (!hasMessages()) {
        emitters.finished();
      }
      return qBallObject;
    },
    async nextStop() {
      while (isProcessing) {
        await new Promise((resolve) =>
          setTimeout(resolve, nextStopCheckFrequency),
        );
      }
      return qBallObject;
    },
    clear() {
      messagePackets.length = 0;
      isProcessing = false;
      emitters.finished();
      return qBallObject;
    },
    addEventListener<TEvent extends keyof QBallEventMap<TMessage, TData>>(
      event: TEvent,
      listener: (data: QBallEventMap<TMessage, TData>[TEvent]) => void,
    ) {
      if (listeners[event]) {
        listeners[event].push(listener);
      }
      return qBallObject;
    },
    removeEventListener<TEvent extends keyof QBallEventMap<TMessage, TData>>(
      event: TEvent,
      listener: (data: QBallEventMap<TMessage, TData>[TEvent]) => void,
    ) {
      const index = listeners[event].indexOf(listener);
      if (index !== -1) {
        listeners[event].splice(index, 1);
      }
      return qBallObject;
    },
  };
  return qBallObject;
}
