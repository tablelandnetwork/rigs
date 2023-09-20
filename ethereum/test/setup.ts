import { LocalTableland } from "@tableland/local";

const lt = new LocalTableland({ silent: true });

before(async function () {
  this.timeout(15000);
  lt.start();
  await lt.isReady();
});

after(async function () {
  await lt.shutdown();
});
