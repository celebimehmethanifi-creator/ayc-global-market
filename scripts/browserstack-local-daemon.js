const browserstack = require("browserstack-local");

const key = process.env.BROWSERSTACK_ACCESS_KEY;
const localIdentifier = process.env.BROWSERSTACK_LOCAL_IDENTIFIER;

if (!key) {
  console.error("Missing BROWSERSTACK_ACCESS_KEY");
  process.exit(2);
}

const bsLocal = new browserstack.Local();

bsLocal.start(
  {
    key,
    localIdentifier,
    onlyAutomate: "true",
    force: "true",
    verbose: "1",
  },
  (error) => {
    if (error) {
      console.error(error);
      process.exit(1);
      return;
    }
    console.log("BROWSERSTACK_LOCAL_STARTED");
  },
);

function shutdown() {
  if (!bsLocal.isRunning()) {
    process.exit(0);
    return;
  }
  bsLocal.stop(() => process.exit(0));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

setInterval(() => {}, 1000);
