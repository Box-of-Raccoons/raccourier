import { describe, it, expect, vi, afterEach } from "vitest";
import { buildCodexArgs, codexTomlSnippet, runCodex, serverEntry, parseOrigin } from "../mcp/install.js";

// Restore all spies after every test so they don't bleed across cases.
afterEach(() => vi.restoreAllMocks());

// ---------------------------------------------------------------------------
// parseOrigin
// ---------------------------------------------------------------------------
describe("parseOrigin", () => {
  it("returns the label that follows --origin", () => {
    expect(parseOrigin(["--target", "codex", "--origin", "home"])).toBe("home");
  });

  it("returns undefined when --origin is absent", () => {
    expect(parseOrigin(["--target", "codex"])).toBeUndefined();
  });

  it("returns undefined for an empty argv", () => {
    expect(parseOrigin([])).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildCodexArgs — argv assembly
// ---------------------------------------------------------------------------
describe("buildCodexArgs — argv assembly", () => {
  it("starts with mcp add raccourier", () => {
    const args = buildCodexArgs(serverEntry(), undefined);
    expect(args.slice(0, 3)).toEqual(["mcp", "add", "raccourier"]);
  });

  it("includes --env ELECTRON_RUN_AS_NODE=1 preceded by the --env flag", () => {
    const args = buildCodexArgs(serverEntry(), undefined);
    const idx = args.indexOf("ELECTRON_RUN_AS_NODE=1");
    expect(idx).toBeGreaterThan(-1);
    expect(args[idx - 1]).toBe("--env");
  });

  it("omits RACCOURIER_ORIGIN entirely when origin is undefined", () => {
    const args = buildCodexArgs(serverEntry(), undefined);
    expect(args.some((a) => a.startsWith("RACCOURIER_ORIGIN"))).toBe(false);
  });

  it("includes --env RACCOURIER_ORIGIN=<label> preceded by --env when origin is provided", () => {
    const args = buildCodexArgs(serverEntry(), "home");
    const idx = args.indexOf("RACCOURIER_ORIGIN=home");
    expect(idx).toBeGreaterThan(-1);
    expect(args[idx - 1]).toBe("--env");
  });

  it("places -- separator followed by exe path then server.js path", () => {
    const entry = serverEntry();
    const args = buildCodexArgs(entry, undefined);
    const sepIdx = args.indexOf("--");
    expect(sepIdx).toBeGreaterThan(-1);
    expect(args[sepIdx + 1]).toBe(entry.command);
    expect(args[sepIdx + 2]).toMatch(/server\.js$/);
  });

  it("handles a packaged-exe entry: exe path and server.js path appear after --", () => {
    // buildCodexArgs is a pure function: pass a synthetic packaged entry to verify
    // that Raccourier.exe and the server.js path land in the right positions.
    const fakeEntry = {
      type: "stdio",
      command: "C:\\Program Files\\Raccourier\\Raccourier.exe",
      args: ["C:\\Program Files\\Raccourier\\resources\\app.asar\\mcp\\server.js"],
      env: { ELECTRON_RUN_AS_NODE: "1" },
    };
    const args = buildCodexArgs(fakeEntry, "work");
    expect(args).toContain("ELECTRON_RUN_AS_NODE=1");
    expect(args).toContain("RACCOURIER_ORIGIN=work");
    const sepIdx = args.indexOf("--");
    expect(args[sepIdx + 1]).toBe(fakeEntry.command);
    expect(args[sepIdx + 2]).toMatch(/server\.js$/i);
  });
});

// ---------------------------------------------------------------------------
// codexTomlSnippet — fallback TOML content
// ---------------------------------------------------------------------------
describe("codexTomlSnippet — fallback TOML content", () => {
  it("contains [mcp_servers.raccourier]", () => {
    expect(codexTomlSnippet(serverEntry(), undefined)).toContain("[mcp_servers.raccourier]");
  });

  it("contains the exe/node command path in TOML basic-string form", () => {
    const entry = serverEntry();
    // Backslashes are escaped for TOML (JSON.stringify), so match the quoted form.
    expect(codexTomlSnippet(entry, undefined)).toContain(`command = ${JSON.stringify(entry.command)}`);
  });

  it('contains ELECTRON_RUN_AS_NODE = "1"', () => {
    expect(codexTomlSnippet(serverEntry(), undefined)).toContain('ELECTRON_RUN_AS_NODE = "1"');
  });

  it("contains the [mcp_servers.raccourier.env] section header", () => {
    expect(codexTomlSnippet(serverEntry(), undefined)).toContain("[mcp_servers.raccourier.env]");
  });

  it("contains RACCOURIER_ORIGIN and the quoted label when origin is provided", () => {
    const snippet = codexTomlSnippet(serverEntry(), "home");
    expect(snippet).toContain("RACCOURIER_ORIGIN");
    expect(snippet).toContain('"home"');
  });

  it("omits RACCOURIER_ORIGIN when origin is absent", () => {
    expect(codexTomlSnippet(serverEntry(), undefined)).not.toContain("RACCOURIER_ORIGIN");
  });

  it("contains the server.js path in the args line", () => {
    const entry = serverEntry();
    const snippet = codexTomlSnippet(entry, undefined);
    expect(snippet).toMatch(/args\s*=\s*\[.*server\.js.*\]/);
  });
});

// ---------------------------------------------------------------------------
// runCodex — invocation and fallback behaviour
// ---------------------------------------------------------------------------
describe("runCodex — invocation and fallback", () => {
  it("calls spawnSync('codex', <correct args>, { stdio: 'inherit' })", () => {
    const mockSpawn = vi.fn().mockReturnValue({ status: 0, error: null });
    vi.spyOn(process, "exit").mockImplementation(() => {});

    runCodex(["--target", "codex", "--origin", "home"], mockSpawn);

    expect(mockSpawn).toHaveBeenCalledOnce();
    const [cmd, args, opts] = mockSpawn.mock.calls[0];
    expect(cmd).toBe("codex");
    expect(args.slice(0, 3)).toEqual(["mcp", "add", "raccourier"]);
    expect(args).toContain("ELECTRON_RUN_AS_NODE=1");
    expect(args).toContain("RACCOURIER_ORIGIN=home");
    expect(opts).toMatchObject({ stdio: "inherit" });
  });

  it("does not call process.exit on a successful (status 0) codex run", () => {
    const mockSpawn = vi.fn().mockReturnValue({ status: 0, error: null });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {});

    runCodex(["--target", "codex"], mockSpawn);

    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("omits RACCOURIER_ORIGIN from the codex argv when --origin is not in argv", () => {
    const mockSpawn = vi.fn().mockReturnValue({ status: 0, error: null });
    vi.spyOn(process, "exit").mockImplementation(() => {});

    runCodex(["--target", "codex"], mockSpawn);

    const [, args] = mockSpawn.mock.calls[0];
    expect(args.some((a) => a.startsWith("RACCOURIER_ORIGIN"))).toBe(false);
  });

  it("exits 2 and prints TOML fallback when codex is not on PATH (ENOENT)", () => {
    const enoentErr = Object.assign(new Error("spawn codex ENOENT"), { code: "ENOENT" });
    const mockSpawn = vi.fn().mockReturnValue({ status: null, error: enoentErr });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {});
    const errMsgs = [];
    vi.spyOn(console, "error").mockImplementation((...a) => errMsgs.push(a.join(" ")));

    runCodex(["--target", "codex", "--origin", "home"], mockSpawn);

    expect(exitSpy).toHaveBeenCalledWith(2);
    const output = errMsgs.join("\n");
    expect(output).toContain("[mcp_servers.raccourier]");
    expect(output).toContain("ELECTRON_RUN_AS_NODE");
    expect(output).toContain("home"); // origin label appears in the TOML snippet
  });

  it("exits 2 and prints TOML fallback when codex exits non-zero", () => {
    const mockSpawn = vi.fn().mockReturnValue({ status: 1, error: null });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {});
    const errMsgs = [];
    vi.spyOn(console, "error").mockImplementation((...a) => errMsgs.push(a.join(" ")));

    runCodex(["--target", "codex"], mockSpawn);

    expect(exitSpy).toHaveBeenCalledWith(2);
    const output = errMsgs.join("\n");
    expect(output).toContain("[mcp_servers.raccourier]");
    expect(output).toContain("ELECTRON_RUN_AS_NODE");
  });

  // Windows: codex is usually an npm .cmd shim, which Node won't spawn without a
  // shell (EINVAL since the CVE-2024-27980 hardening). runCodex must route through
  // the shell on win32 and pre-quote args containing spaces.
  it("uses shell:true and quotes spaced args on win32", () => {
    const mockSpawn = vi.fn().mockReturnValue({ status: 0, error: null });
    vi.spyOn(process, "exit").mockImplementation(() => {});

    runCodex(["--target", "codex"], mockSpawn, "win32");

    const [, args, opts] = mockSpawn.mock.calls[0];
    expect(opts.shell).toBe(true);
    for (const a of args.filter((x) => /\s/.test(x))) {
      expect(a.startsWith('"') && a.endsWith('"')).toBe(true);
    }
  });

  it("spawns codex directly (no shell, unquoted args) off win32", () => {
    const mockSpawn = vi.fn().mockReturnValue({ status: 0, error: null });
    vi.spyOn(process, "exit").mockImplementation(() => {});

    runCodex(["--target", "codex"], mockSpawn, "linux");

    const [, args, opts] = mockSpawn.mock.calls[0];
    expect(opts.shell).toBe(false);
    expect(args.every((a) => !a.startsWith('"'))).toBe(true);
  });

  it("TOML fallback omits RACCOURIER_ORIGIN when --origin was not passed", () => {
    const enoentErr = Object.assign(new Error("spawn codex ENOENT"), { code: "ENOENT" });
    const mockSpawn = vi.fn().mockReturnValue({ status: null, error: enoentErr });
    vi.spyOn(process, "exit").mockImplementation(() => {});
    const errMsgs = [];
    vi.spyOn(console, "error").mockImplementation((...a) => errMsgs.push(a.join(" ")));

    runCodex(["--target", "codex"], mockSpawn);

    const output = errMsgs.join("\n");
    expect(output).not.toContain("RACCOURIER_ORIGIN");
  });
});
