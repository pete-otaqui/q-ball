interface QBallEventMap<TData> {
	processed: TData;
	error: Error;
	// biome-ignore lint/suspicious/noConfusingVoidType: This is used as a type
	finished: void;
}
type QBallListeners<TData> = {
	[K in keyof QBallEventMap<TData>]: Array<
		(data: QBallEventMap<TData>[K]) => void
	>;
};
type QBallEmitters<TData> = {
	[K in keyof QBallEventMap<TData>]: (data: QBallEventMap<TData>[K]) => void;
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
	/**
	 * Add an event listener for a specific event
	 */
	addEventListener: <TEvent extends keyof QBallEventMap<TData>>(
		event: TEvent,
		listener: (data: QBallEventMap<TData>[TEvent]) => void,
	) => QBallObject<TMessage, TData>;
	/**
	 * Remove an event listener for a specific event
	 */
	removeEventListener: <TEvent extends keyof QBallEventMap<TData>>(
		event: TEvent,
		listener: (data: QBallEventMap<TData>[TEvent]) => void,
	) => QBallObject<TMessage, TData>;
};

export type QBallOptions<TMessage, TData> = {
	autoStart?: boolean;
	console?: Console;
	debug?: boolean;
	dlq?: QBallObject<TMessage, TData>;
	messages?: TMessage[];
	nextStopCheckFrequency?: number;
	onProcessMessage?: (data: TData) => void;
	redriveCount?: number;
	redriveDelay?: (attempt: number, message: TMessage) => number;
	stopOnError?: boolean;
	workers?: number;
};
export function QBall<TMessage, TData>(
	processor: (messagePacket: TMessage) => Promise<TData>,
	{
		autoStart = true,
		console = globalThis.console,
		debug = false,
		dlq,
		messages = [],
		nextStopCheckFrequency = 10,
		onProcessMessage,
		redriveCount = 0,
		redriveDelay = () => 0,
		stopOnError = false,
		workers = 1,
	}: QBallOptions<TMessage, TData> = {},
) {
	const qBallId = Math.random().toString(36).substring(2, 15);
	// biome-ignore lint/suspicious/noExplicitAny: Passing to console.log
	const debugLog = (...args: any[]) => {
		if (!debug) {
			return;
		}
		console.log(`[QBall ${qBallId}]`, ...args);
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

	const listeners: QBallListeners<TData> = {
		processed: [] as ((data: TData) => void)[],
		error: [] as ((error: Error) => void)[],
		finished: [] as (() => void)[],
	};

	const emitters: QBallEmitters<TData> = {
		processed: (data) => {
			for (const listener of listeners.processed) {
				listener(data);
			}
		},
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
			return;
		}
		if (!hasMessages()) {
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
	if (onProcessMessage) {
		listeners.processed.push(onProcessMessage);
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
		addEventListener<TEvent extends keyof QBallEventMap<TData>>(
			event: TEvent,
			listener: (data: QBallEventMap<TData>[TEvent]) => void,
		) {
			if (listeners[event]) {
				listeners[event].push(listener);
			}
			return qBallObject;
		},
		removeEventListener<TEvent extends keyof QBallEventMap<TData>>(
			event: TEvent,
			listener: (data: QBallEventMap<TData>[TEvent]) => void,
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
