# QBall - lightweight queue system in typescript

QBall is a lightweight, zero-dependency queue system written in Typescript. It
can be used in both Node.js and browser environments.

QBall supports the following features:

- **Concurrency**: Process multiple messages at once with a configurable number
  of workers.
- **Auto-start**: Automatically start processing messages when they are added to
  the queue.
- **Event listeners**: Listen for events when the queue is empty or when a
  message is processed.
- **Fluent API**: Chain methods together for a more readable API.
- **Type safety**: QBall is fully typed, so you can define your own messages and
  results or let it infer them for you.
- **No dependencies**: QBall is a single file with no dependencies, so you can
  use it in any environment.
- **Redrive messages**: QBall can redrive messages where the processor throws an
  Error, with a configurable delay and max number of retries.
- **Dead Letter Queue (DLQ)**: QBall can send messages to a secondary instance
  for messages that fail after the max number of retries.

## Usage

```typescript
import { QBall } from "q-ball";

// QBall is well typed, so you can define your own messages and results
// or it will infer them for you.  Let's be explicit here:

type MyMessage = {
  id: string;
  data: string;
};

type MyResult = {
  dataLength: number;
};

// Create a processor function that take the message and returns a result

async function myProcessor(message: MyMessage): Promise<MyResult> {
  console.log(`Processing message ${message.id}`);
  // Simulate some async work
  await new Promise((resolve) => setTimeout(resolve, 100));
  return { dataLength: message.data.length };
}

async function main() {
  // Now create a queue with the processor function
  const queue = new QBall(myProcessor);

  // callback for when the queue is empty
  queue.addEventListener("finished", () => {
    console.log("Queue is empty");
  });

  // Add some messages to the queue
  queue.add({ id: "1", data: "Hello" });
  queue.add({ id: "2", data: "World" });
  queue.add({ id: "3", data: "!" });
  queue.add({ id: "4", data: "This is a test" });
});

main().then(() => {
  console.log("The queue will be processing in the background");
});
```

QBall has several options and some convenience features:

```typescript
// no op processor
const throwOn101Processor = async (message: string): Promise<string> => {
  if (message === "Message 101") {
    throw new Error("This is a test error");
  }
  await new Promise((resolve) => setTimeout(resolve, 10));
  return `processed ${message}`;
};

const dlqProcessor = async (message: string): Promise<void> => {
  console.log("DLQ MESSAGE", message);
};

async function main() {
  const dlqBall = QBall(dlqProcessor);

  // qBall has a fluent API, so you can chain methods
  const qBall = QBall(throwOn101Processor, {
    // max number of messages to process at once
    workers: 4,
    // pass in messages right away
    messages: Array.from({ length: 100 }, (_, i) => `Message ${i}`),
    // require an explicit call to `start()`
    autoStart: false,
    // convenience option for process event listener:
    onProcessMessage: (string) => {
      console.log(`A message was processed and returned: ${string}`);
    },
    // retry messages that throw an error:
    redriveCount: 3,
    // define a custom delay for redriving if you want:
    redriveDelay: (attempt: number) => {
      return attempt * 1000;
    },
    // pass a secondary instance for messages that fail after the max number of retries:
    dlq: dlqBall,
  });
  // start the queue
  await qBall.start()
    // add more messages
    .add("Message 100")
    // add an event listener:
    .addEventListener("finished", () => {
      console.log("Queue is empty");
    })
    // we already passed in one of these, but you can add more:
    .addEventListener("processed", (message) => {
      console.log(
        `A message was processed and returned (duplicate function): ${string}`,
      );
    })
    // the only async method is `nextStop()`
    // which will resolve the next time the
    // queue is empty
    .nextStop();

  // add more messages
  qBall.add("Message 101");
  qBall.add("Message 102");
  qBall.add("Message 103");

  // The "finished" listener will be called again
  await qBall.nextStop();
}

main();
```
