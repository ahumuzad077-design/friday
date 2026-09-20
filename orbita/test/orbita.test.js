import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbita-test-"));
process.env.ORBITA_DATA_DIR = dir;

const { status, addInvestor, addTask, requestAction } = await import("../src/engine.js");

test("ORBITA starts with safe fundraising defaults", () => {
  const result = status();
  assert.equal(result.module, "ORBITA");
  assert.equal(result.status, "ONLINE");
  assert.equal(result.project.publicOfferEnabled, false);
});

test("investors and tasks persist", () => {
  const investor = addInvestor({ name: "Test Investor", organization: "Test Capital" });
  const task = addTask({ title: "Prepare investor brief" });

  assert.ok(investor.id);
  assert.ok(task.id);
  assert.equal(status().counts.investors, 1);
  assert.equal(status().counts.openTasks, 1);
});

test("binding actions enter approval queue", () => {
  const result = requestAction("issue_shares", { round: "seed" });
  assert.equal(result.status, "approval_required");
  assert.equal(status().counts.pendingApprovals, 1);
});
