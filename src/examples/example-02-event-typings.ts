import { QBall } from "../q-ball.js";

type CustomMessage = {
  content: string;
};
type CustomResponse = {
  processedContent: string;
};

async function main() {
  const processor = async (message: CustomMessage): Promise<CustomResponse> => {
    console.log("Processing message:", message);
    return {
      processedContent: `Processed: ${message.content}`,
    };
  };

  const qBall = QBall(processor, {
    autoStart: false,
    onError(error) {
      console.error("Error processing message:", error);
    },
    onFinished() {
      console.log("QBall stopped");
    },
    onProcessed(data) {
      console.log("Processed data:", data);
    },
    onRetry(message) {
      console.log("Retrying message:", message);
    },
    onStarted() {
      console.log("QBall started");
    },
  });

  // A reasonable editor should provide specific type hints for the events and
  // the data passed to the event handlers

  qBall.addEventListener("retry", (message) => {
    console.log("EL Retrying message:", message);
  });
  qBall.addEventListener("processed", (data) => {
    console.log("EL Processed data:", data);
  });
  qBall.addEventListener("error", (error) => {
    console.error("EL Error processing message:", error);
  });
  qBall.addEventListener("started", () => {
    console.log("EL QBall started");
  });
  qBall.addEventListener("finished", () => {
    console.log("EL QBall stopped");
  });

  qBall.add({ content: "Hello" });
  qBall.add({ content: "World" });

  qBall.start();
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
