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
	messages?: TMessage[];
	onProcessMessage?: (data: TData) => void;
	stopOnError?: boolean;
	workers?: number;
};
export function QBall<TMessage, TData>(
	processor: (message: TMessage) => Promise<TData>,
	{
		autoStart = true,
		messages = [],
		onProcessMessage,
		stopOnError = false,
		workers = 1,
	}: QBallOptions<TMessage, TData> = {},
) {
	let isProcessing = false;
	let forceStopped = false;

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

	const workerObjects = Array.from({ length: workers }, () => {
		return {
			process: async (message: TMessage) => {
				try {
					const data = await processor(message);
					emitters.processed(data);
				} catch (error) {
					emitters.error(error as Error);
				}
			},
		};
	});

	const startProcessing = () => {
		if (isProcessing) {
			return;
		}
		if (messages.length === 0) {
			emitters.finished();
			return;
		}
		forceStopped = false;
		isProcessing = true;
		for (let i = 0; i < workers && messages.length; i++) {
			const message = messages.shift();
			if (message) {
				workerObjects[i].process(message);
			}
		}
	};

	listeners.processed.push(async () => {
		if (forceStopped) {
			return;
		}
		if (messages.length > 0 && isProcessing) {
			// Process the next message
			const message = messages.shift();
			if (message) {
				await workerObjects[0].process(message);
			}
		} else {
			emitters.finished();
		}
	});
	listeners.error.push((error) => {
		if (stopOnError) {
			forceStopped = true;
			isProcessing = false;
			emitters.finished();
		} else {
			if (messages.length > 0) {
				// Process the next message
				const message = messages.shift();
				if (message) {
					workerObjects[0].process(message);
				}
			} else {
				emitters.finished();
			}
		}
	});
	listeners.finished.push(() => {
		isProcessing = false;
	});
	if (onProcessMessage) {
		listeners.processed.push(onProcessMessage);
	}
	if (autoStart && messages.length > 0) {
		startProcessing();
	}

	const qBallObject: QBallObject<TMessage, TData> = {
		add(message: TMessage) {
			messages.push(message);
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
			if (messages.length === 0) {
				emitters.finished();
			}
			return qBallObject;
		},
		async nextStop() {
			while (isProcessing) {
				await new Promise((resolve) => setTimeout(resolve, 10));
			}
			return qBallObject;
		},
		clear() {
			messages.length = 0;
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
