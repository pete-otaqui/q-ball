/* node:coverage disable */
import assert from "node:assert";
import { describe, it } from "node:test";
import { QBall } from "./q-ball.js";

describe("Q-Ball", () => {
	const idProcessor = async (message: string) => {
		return message;
	};

	it("should be able to create a Q-Ball", () => {
		const qBall = QBall(idProcessor);
		assert.ok(qBall, "Q-Ball should be created");
	});

	it("should process a message", () => {
		let processed = false;
		const processor = async (message: string) => {
			processed = true;
		};
		const qBall = QBall(processor);
		qBall.add("test");
		assert.strictEqual(processed, true, "Message should be processed");
	});

	it("should not auto-start processing if autoStart is false", () => {
		let processed = false;
		const processor = async (message: string) => {
			processed = true;
		};
		const qBall = QBall(processor, { autoStart: false });
		qBall.add("test");
		assert.strictEqual(processed, false, "Message should not be processed");
	});

	it("should start processing a message in the options", () => {
		let processed = false;
		const processor = async (message: string) => {
			processed = true;
		};
		const qBall = QBall(processor, { autoStart: true, messages: ["test"] });
		assert.strictEqual(processed, true, "Message should be processed");
	});

	it("should process multiple messages concurrently", () => {
		let processedCount = 0;
		const processor = async (message: string) => {
			processedCount++;
		};
		const qBall = QBall(processor, {
			messages: ["test1", "test2"],
			workers: 2,
		});
		// await qBall.nextStop();
		assert.strictEqual(processedCount, 2, "Two messages should be processed");
	});

	it("should process messages until all are done", async () => {
		let processedCount = 0;
		const processor = async (message: string) => {
			processedCount++;
		};
		const qBall = QBall(processor, {
			messages: ["test1", "test2", "test3", "test4"],
			workers: 2,
		});
		await qBall.nextStop();
		assert.strictEqual(processedCount, 4, "Four messages should be processed");
	});

	it("should accept more workers than messages", async () => {
		let processedCount = 0;
		const processor = async (message: string) => {
			processedCount++;
		};
		const qBall = QBall(processor, {
			messages: ["test1", "test2"],
			workers: 4, // More workers than messages
		});
		await qBall.nextStop();
		assert.strictEqual(
			processedCount,
			2,
			"Two messages should be processed with more workers than messages",
		);
	});

	it("should accept an onProcessMessage option", async () => {
		let onProcessMessageCalled = false;
		const onProcessMessage = () => {
			onProcessMessageCalled = true;
		};
		const qBall = QBall(idProcessor, {
			onProcessMessage,
			messages: ["test"],
		});
		await qBall.nextStop();
		assert.strictEqual(
			onProcessMessageCalled,
			true,
			"onProcessMessage should be called",
		);
	});

	it("should add `processed` event listeners", async () => {
		let eventCalled = false;
		const qBall = QBall(idProcessor, {
			autoStart: false,
			messages: ["test"],
		});
		qBall.addEventListener("processed", (data) => {
			eventCalled = true;
		});
		qBall.start();
		await qBall.nextStop();
		assert.strictEqual(eventCalled, true, "Processed event should be called");
	});

	it("should add `finished` event listeners", async () => {
		let eventCalled = false;
		const qBall = QBall(idProcessor, {
			autoStart: false,
			messages: ["test"],
		});
		qBall.addEventListener("finished", () => {
			eventCalled = true;
		});
		qBall.start();
		await qBall.nextStop();
		assert.strictEqual(eventCalled, true, "Finished event should be called");
	});

	it("should add `error` event listeners", async () => {
		let eventCalled = false;
		const error = new Error("Test error");
		const processor = async () => {
			throw error;
		};
		const qBall = QBall(processor, {
			autoStart: false,
			messages: ["test"],
		});
		qBall.addEventListener("error", (err) => {
			eventCalled = true;
			assert.strictEqual(
				err,
				error,
				"Error event should be called with the correct error",
			);
		});
		qBall.start();
		await qBall.nextStop();
		assert.strictEqual(eventCalled, true, "Error event should be called");
	});

	it("should stop processing on error if stopOnError is true", async () => {
		let processedCount = 0;
		const processor = async (message: string) => {
			processedCount++;
			throw new Error("Test error");
		};
		const qBall = QBall(processor, {
			autoStart: false,
			messages: ["test1", "test2"],
			stopOnError: true,
		});
		qBall.start();
		await qBall.nextStop();
		assert.strictEqual(
			processedCount,
			1,
			"Only one message should be processed",
		);
	});

	it("should not stop processing on error if stopOnError is false", async () => {
		let processedCount = 0;
		const processor = async (message: string) => {
			processedCount++;
			throw new Error("Test error");
		};
		const qBall = QBall(processor, {
			messages: ["test1", "test2"],
			stopOnError: false,
		});
		await qBall.nextStop();
		assert.strictEqual(processedCount, 2, "Two messages should be processed");
	});

	it("should stop processing when stop() is called", async () => {
		let processedCount = 0;
		const processor = async (message: string) => {
			await new Promise((resolve) => setTimeout(resolve, 1));
			processedCount++;
		};
		const qBall = QBall(processor, {
			messages: ["test1", "test2", "test3"],
		});
		qBall.stop();
		await new Promise((resolve) => setTimeout(resolve, 10));
		assert.strictEqual(processedCount, 1, "1 message should be processed");
	});

	it("should stop if the queue is cleared", async () => {
		let processedCount = 0;
		const processor = async (message: string) => {
			await new Promise((resolve) => setTimeout(resolve, 1));
			processedCount++;
		};
		const qBall = QBall(processor, {
			autoStart: false,
			messages: ["test1", "test2", "test3"],
		});
		qBall.clear();
		qBall.start();
		await qBall.nextStop();
		assert.strictEqual(processedCount, 0, "No messages should be processed");
	});

	it("should remove event listeners", async () => {
		let eventCalled = false;
		const listener = () => {
			eventCalled = true;
		};
		const qBall = QBall(idProcessor, {
			autoStart: false,
			messages: ["test"],
		});
		qBall.addEventListener("processed", listener);
		qBall.removeEventListener("processed", listener);
		qBall.start();
		await qBall.nextStop();
		assert.strictEqual(
			eventCalled,
			false,
			"Processed event should not be called",
		);
	});

	it("should be able to call start multiple times", () => {
		let processedCount = 0;
		const processor = async (message: string) => {
			processedCount++;
		};
		const qBall = QBall(processor, {
			autoStart: false,
			messages: ["test"],
		});
		qBall.start();
		qBall.start();
		assert.strictEqual(processedCount, 1, "Message should be processed once");
	});

	it("should emit a finished event when stop is called with 0 messages", () => {
		const qBall = QBall(idProcessor);
		let finishedCalled = false;
		qBall.addEventListener("finished", () => {
			finishedCalled = true;
		});
		qBall.stop();
		assert.strictEqual(finishedCalled, true, "Finished event should be called");
	});

	it("should stop processing on error if stopOnError is true with multiple workers", async () => {
		let processedCount = 0;
		const processor = async (message: string) => {
			processedCount++;
			if (processedCount === 1) {
				throw new Error("Test error");
			}
			await new Promise((resolve) => setTimeout(resolve, Math.random()));
		};
		const qBall = QBall(processor, {
			autoStart: false,
			messages: ["test1", "test2", "test3", "test4", "test5"],
			workers: 2,
			stopOnError: true,
		});
		qBall.start();
		await qBall.nextStop();
		assert.strictEqual(processedCount, 2, "Two messages should be processed");
	});
});
