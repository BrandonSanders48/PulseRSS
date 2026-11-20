import { defineConfig } from "@playwright/test";
import { randomUUID } from "node:crypto";
import path from "node:path";

export default defineConfig({
  testDir: "./tests",
  workers: 1,
  use: {
    baseURL: "http://localhost:3217",
    viewport: { width: 1440, height: 900 },
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  },
  webServer: {
    command: "node scripts/start.mjs",
    url: "http://localhost:3217",
    reuseExistingServer: false,
    env: { PORT: "3217", PULSE_DATA_DIR: path.join(process.cwd(), ".test-data", randomUUID()) },
  },
});
