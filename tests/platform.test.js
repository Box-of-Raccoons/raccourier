import { describe, it, expect } from "vitest";
import path from "node:path";
import { isPackagedExec } from "../shared/platform.js";
import { resolveConfigDir } from "../shared/config.js";

describe("isPackagedExec", () => {
  it("windows: Raccourier.exe is packaged, node.exe is not", () => {
    expect(isPackagedExec("C:\\Users\\x\\AppData\\Local\\Programs\\Raccourier\\Raccourier.exe", "win32")).toBe(true);
    expect(isPackagedExec("C:\\Program Files\\nodejs\\node.exe", "win32")).toBe(false);
  });
  it("macOS: .app bundle binary is packaged, node is not", () => {
    expect(isPackagedExec("/Applications/Raccourier.app/Contents/MacOS/Raccourier", "darwin")).toBe(true);
    expect(isPackagedExec("/usr/local/bin/node", "darwin")).toBe(false);
  });
  it("linux: raccourier binary is packaged, node is not", () => {
    expect(isPackagedExec("/opt/Raccourier/raccourier", "linux")).toBe(true);
    expect(isPackagedExec("/usr/bin/node", "linux")).toBe(false);
  });
});

describe("resolveConfigDir", () => {
  const home = path.join(path.sep, "home", "u");

  it("RACCOURIER_DIR overrides everything", () => {
    expect(resolveConfigDir("darwin", { RACCOURIER_DIR: "/tmp/x" }, home)).toBe("/tmp/x");
  });
  it("macOS uses Library/Application Support", () => {
    expect(resolveConfigDir("darwin", {}, home)).toBe(
      path.join(home, "Library", "Application Support", "Raccourier")
    );
  });
  it("windows uses APPDATA", () => {
    const appdata = path.join("C:", "Users", "u", "AppData", "Roaming");
    expect(resolveConfigDir("win32", { APPDATA: appdata }, home)).toBe(path.join(appdata, "Raccourier"));
  });
  it("linux uses XDG_CONFIG_HOME, else ~/.config", () => {
    expect(resolveConfigDir("linux", {}, home)).toBe(path.join(home, ".config", "Raccourier"));
    expect(resolveConfigDir("linux", { XDG_CONFIG_HOME: "/cfg" }, home)).toBe(path.join("/cfg", "Raccourier"));
  });
});
