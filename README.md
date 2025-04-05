# QBall - lightweight queue system in typescript

QBall is a lightweight, zero-dependency queue system written in Typescript. It
can be used in both Node.js and browser environments.

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
const id = async (message: string): Promise<string> => {
  await new Promise((resolve) => setTimeout(resolve, 10));
  return `processed ${message}`;
};

async function main() {
  // qBall has a fluent API, so you can chain methods
  const qBall = QBall(id, {
    // max number of messages to process at once
    workers: 4,
    // pass in messages right away
    messages: Array.from({ length: 100 }, (_, i) => `Message ${i}`),
    // stop if there is an error:
    stopOnError: true,
    // require an explicit call to `start()`
    autoStart: false,
    // convenience option for process event listener:
    onProcessMessage: (string) => {
      console.log(`A message was processed and returned: ${string}`);
    },
  });
  // start the queue
  await qBall.start()
    // add more messages
    .add("Message 100")
    // add an event listener:
    .addEventListener("finished", () => {
      console.log("Queue is empty");
    })
    // the only async method is `nextStop()`
    // which will resolve the next time the
    // queue is empty
    .nextStop();
}

main();
```
