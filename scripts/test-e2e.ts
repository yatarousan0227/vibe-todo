import assert from "node:assert/strict";
import { chromium } from "playwright";
import { pool } from "../src/lib/intake/db";
import { BASE_URL, ensureSchema, resetDatabase, waitForApp } from "./intake-test-support";

async function main() {
  const browser = await chromium.launch({
    headless: true,
  });

  try {
    await ensureSchema();
    await resetDatabase();
    await waitForApp();

    const page = await browser.newPage();
    const freeFormBody =
      "Families, volunteers, and school staff all need a simple launch plan that feels welcoming.\nThe first refinement artifact should preserve the setup details and the community tone without drifting into software jargon.";

    await page.goto(BASE_URL, {
      waitUntil: "networkidle",
    });

    await page.getByLabel("Title").fill("Community garden launch");
    await page
      .getByLabel("Objective")
      .fill("Prepare a neighborhood garden opening plan");
    await page
      .getByLabel("Background or current situation")
      .fill(
        "The lot is available, but volunteer shifts and permit timing are not aligned yet.",
      );
    await page
      .getByLabel("Scope summary")
      .fill("Beds, volunteer shifts, supply pickup, and opening-day setup");
    await page
      .getByLabel("Stakeholders")
      .fill("Neighbors, school staff, city permit office");
    await page
      .getByLabel("Constraints or conditions")
      .fill(
        "Stay within donated materials, school pickup timing, and the city permit window.",
      );
    await page.getByLabel("Free-form context").fill(freeFormBody);

    await page.getByRole("button", { name: "Save draft" }).click();
    await page.waitForSelector("text=Draft saved to PostgreSQL");

    const draftIdText = (
      await page.getByTestId("draft-id").textContent()
    )?.trim();
    assert.ok(draftIdText);
    assert.notEqual(draftIdText, "assigned on first save");

    await page.goto(`${BASE_URL}/?projectId=${draftIdText}`, {
      waitUntil: "networkidle",
    });
    await page.waitForSelector("text=resumed from PostgreSQL on load");
    await expectValue(page, "Title", "Community garden launch");
    await expectValue(page, "Free-form context", freeFormBody);

    await page.getByRole("button", { name: "Review before refinement" }).click();
    await page.waitForSelector("text=Review state stays inside SCR-001");
    await page.waitForSelector("text=Community garden launch");
    await page.waitForSelector("text=Neighbors, school staff, city permit office");
    await page.getByTestId("review-free-form-summary").waitFor();
    const reviewText = await page
      .getByTestId("review-free-form-summary")
      .textContent();
    assert.ok(reviewText?.includes(freeFormBody));

    await page.getByRole("button", { name: "Edit before start" }).click();
    await page.waitForSelector("text=Returned to the draft editor");
    await page
      .getByLabel("Stakeholders")
      .fill("Neighbors, school staff, city permit office, volunteer coordinators");

    await page.getByRole("button", { name: "Review before refinement" }).click();
    await page.waitForSelector("text=volunteer coordinators");
    await page
      .getByRole("button", { name: "Confirm and start refinement" })
      .click();

    await page.waitForURL(
      new RegExp(`/projects/${draftIdText}/refinement\\?artifactKey=objective_and_outcome`),
    );
    await page.waitForSelector("text=SCR-002 Refinement Loop");
    await page.getByTestId("active-artifact-key").waitFor();
    await page.getByTestId("confirmed-free-form-context").waitFor();
    await page.waitForSelector("text=volunteer coordinators");
    await page.waitForSelector("text=objective_and_outcome");
  } finally {
    await browser.close();
    await pool.end();
  }
}

async function expectValue(
  page: {
    getByLabel(label: string): {
      inputValue(): Promise<string>;
    };
  },
  label: string,
  expectedValue: string,
) {
  assert.equal(await page.getByLabel(label).inputValue(), expectedValue);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
