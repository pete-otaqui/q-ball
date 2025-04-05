import { QBall } from "../q-ball.js";

async function main() {
	const processor = async (message: string) => {
		console.log("Processing message:", message);
		return message;
	};

	const qBall = QBall(processor, {
		autoStart: true,
		messages: ["Hello", "World"],
		onProcessMessage: (data) => {
			console.log("Processed data:", data);
		},
	});

	await qBall.nextStop();
	console.log("All messages processed");
}

main()
	.then(() => {
		console.log("Done");
	})
	.catch((error) => {
		console.error("Error:", error);
	});
