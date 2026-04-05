import { test, expect } from "@playwright/test";

test("sign in -> add bookmark -> schedule -> notifications smoke", async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run smoke flow.");

  await page.goto("/auth");
  await page.getByLabel("Email").fill(email ?? "");
  await page.getByLabel("Password").fill(password ?? "");
  await page.getByRole("button", { name: "Sign In" }).click();

  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

  await page.goto("/new");
  await page.getByRole("button", { name: "Add manually without a link" }).click();
  await page.getByLabel("Title *").fill(`Smoke Test ${Date.now()}`);
  await page.getByRole("button", { name: "Save to Watchlist" }).click();

  // Wait for save to complete
  await expect(page.getByRole("button", { name: "Tomorrow" })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Tomorrow" }).click();
  await expect(page.getByText("Scheduled!")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Done" }).click();

  await page.goto("/notifications");
  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
});
