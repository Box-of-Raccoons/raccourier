import { describe, it, expect, vi } from "vitest";
import { guardSingleInstance } from "../app/singleInstance.js";

function fakeApp({ lockAcquired }) {
  const calls = [];
  return {
    calls,
    setPath: vi.fn((name, dir) => calls.push(["setPath", name, dir])),
    requestSingleInstanceLock: vi.fn(() => {
      calls.push(["requestSingleInstanceLock"]);
      return lockAcquired;
    }),
    quit: vi.fn(() => calls.push(["quit"])),
  };
}

describe("guardSingleInstance", () => {
  it("scopes userData to the config dir BEFORE requesting the lock (per-dir lock)", () => {
    const app = fakeApp({ lockAcquired: true });
    guardSingleInstance(app, "C:\\spoke-dir", vi.fn());
    // Order matters: the lockfile lives under userData, so setPath after (or
    // never) would leave the lock global — host + spoke on one machine would
    // fight over one lock and the second instance silently quits.
    expect(app.calls).toEqual([
      ["setPath", "userData", "C:\\spoke-dir"],
      ["requestSingleInstanceLock"],
    ]);
  });

  it("keeps running when the lock is acquired", () => {
    const app = fakeApp({ lockAcquired: true });
    const exit = vi.fn();
    guardSingleInstance(app, "C:\\dir", exit);
    expect(app.quit).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it("quits and exits 0 when another instance holds this dir's lock", () => {
    const app = fakeApp({ lockAcquired: false });
    const exit = vi.fn();
    guardSingleInstance(app, "C:\\dir", exit);
    expect(app.quit).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledWith(0);
  });
});
