
import test from "node:test";
import assert from "node:assert/strict";

test("AI timeout returns manual_review", async () => {
    const response = await fetch("http://127.0.0.1:3000/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "[timeout]" }),
    });

    assert.equal(response.status, 200);

    const data = await response.json();

    assert.deepEqual(data, {
        status: "manual_review",
        topic: null,
        draft: null,
    });
});
