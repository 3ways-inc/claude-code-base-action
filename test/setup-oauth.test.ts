#!/usr/bin/env bun

import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  spyOn,
} from "bun:test";
import { setupOAuthCredentials } from "../src/setup-oauth";
import { mkdtempSync } from "fs";
import { readFile, unlink, access, rm } from "fs/promises";
import { join } from "path";
import * as os from "os";

describe("setupOAuthCredentials", () => {
  const testDirectory = mkdtempSync(
    join(os.tmpdir(), "claude-code-base-action-test-"),
  );
  const credentialsPath = join(testDirectory, ".claude", ".credentials.json");
  const homedirSpy = spyOn(os, "homedir").mockReturnValue(testDirectory);

  beforeAll(() => {
    expect(os.homedir()).toBe(testDirectory);
  });

  afterAll(async () => {
    homedirSpy.mockRestore();
    await rm(testDirectory, { recursive: true, force: true });
  });

  afterEach(async () => {
    // Clean up the credentials file after each test
    try {
      await unlink(credentialsPath);
    } catch (e) {
      // Ignore if file doesn't exist
    }
  });

  test("should create credentials file with correct structure", async () => {
    const credentials = {
      accessToken: "test-access-token",
      refreshToken: "test-refresh-token",
      expiresAt: "1234567890",
    };

    await setupOAuthCredentials(credentials);

    // Check file exists
    await access(credentialsPath);

    // Check file contents
    const content = await readFile(credentialsPath, "utf-8");
    const parsed = JSON.parse(content);

    expect(parsed).toEqual({
      claudeAiOauth: {
        accessToken: "test-access-token",
        refreshToken: "test-refresh-token",
        expiresAt: 1234567890,
        scopes: ["user:inference", "user:profile"],
      },
    });
  });

  test("should convert expiresAt string to number", async () => {
    const credentials = {
      accessToken: "test-access-token",
      refreshToken: "test-refresh-token",
      expiresAt: "9876543210",
    };

    await setupOAuthCredentials(credentials);

    const content = await readFile(credentialsPath, "utf-8");
    const parsed = JSON.parse(content);

    expect(typeof parsed.claudeAiOauth.expiresAt).toBe("number");
    expect(parsed.claudeAiOauth.expiresAt).toBe(9876543210);
  });

  test("should overwrite existing credentials file", async () => {
    // Create initial credentials
    await setupOAuthCredentials({
      accessToken: "old-token",
      refreshToken: "old-refresh",
      expiresAt: "1111111111",
    });

    // Overwrite with new credentials
    await setupOAuthCredentials({
      accessToken: "new-token",
      refreshToken: "new-refresh",
      expiresAt: "2222222222",
    });

    const content = await readFile(credentialsPath, "utf-8");
    const parsed = JSON.parse(content);

    expect(parsed.claudeAiOauth.accessToken).toBe("new-token");
    expect(parsed.claudeAiOauth.refreshToken).toBe("new-refresh");
    expect(parsed.claudeAiOauth.expiresAt).toBe(2222222222);
  });

  test("should create .claude directory if it doesn't exist", async () => {
    await rm(join(testDirectory, ".claude"), { recursive: true, force: true });
    const credentials = {
      accessToken: "test-token",
      refreshToken: "test-refresh",
      expiresAt: "1234567890",
    };

    await setupOAuthCredentials(credentials);

    // Verify file was created
    await access(credentialsPath);
  });
});
