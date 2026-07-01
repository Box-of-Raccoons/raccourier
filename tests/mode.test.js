import { describe, it, expect } from "vitest";
import { chooseMode } from "../app/mode.js";

describe("chooseMode", () => {
  it("returns 'mcp' when --mcp is present", () => {
    expect(chooseMode(["electron", "app", "--mcp"], {})).toBe("mcp");
  });
  it("returns 'mcp' when ELECTRON_RUN_AS_NODE is set", () => {
    expect(chooseMode(["node", "main.js"], { ELECTRON_RUN_AS_NODE: "1" })).toBe("mcp");
  });
  it("returns 'tray' otherwise", () => {
    expect(chooseMode(["electron", "app"], {})).toBe("tray");
  });
});
