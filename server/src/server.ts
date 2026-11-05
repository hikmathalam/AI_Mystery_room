import { app } from "./app.js";
import { connectDatabase } from "./config/database.js";
import { env } from "./config/env.js";

try {
  await connectDatabase();
  app.listen(env.SERVER_PORT, () => console.info(`AI Mystery Room API listening on port ${env.SERVER_PORT}`));
} catch (error) {
  console.error("Unable to start the API:", error);
  process.exit(1);
}
