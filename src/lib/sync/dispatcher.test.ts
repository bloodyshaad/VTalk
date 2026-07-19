import { describe, it, expect } from "vitest";
import { applyOperation, encodeOp } from "./dispatcher";
import type { PendingOp } from "./dispatcher";

describe("sync dispatcher", () => {
  it("drops corrupt payloads instead of retrying forever", async () => {
    const op: PendingOp = {
      id: "x",
      entity: "posts",
      operation: "create",
      payload: "not json{",
    };
    const res = await applyOperation(op);
    // ok:true => the op is cleared (we don't want to retry garbage).
    expect(res.ok).toBe(true);
  });

  it("keeps unknown operations queued (no silent data loss)", async () => {
    const op: PendingOp = {
      id: "y",
      entity: "analytics",
      operation: "ping",
      payload: "{}",
    };
    const res = await applyOperation(op);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/unknown operation/);
  });

  it("encodeOp serializes payloads", () => {
    expect(encodeOp({ a: 1 })).toBe('{"a":1}');
  });
});
