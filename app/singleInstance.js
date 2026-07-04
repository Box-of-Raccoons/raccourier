// Single-instance guard, scoped per config dir.
//
// Why the guard exists: the MCP bridge auto-launches the tray, and a second
// Claude Code instance can spawn a duplicate before the first hub is healthy.
// A duplicate tray would try to bind the same cfg.port/bind as the running hub
// and die with EADDRINUSE (breaking the host/spoke model), so only one instance
// per config dir may run; the loser quits and the winner surfaces its window
// via the second-instance event.
//
// Why it is scoped: Electron's requestSingleInstanceLock() writes its lockfile
// under userData, which is global to the app — NOT per config dir. Left alone
// it also blocks legitimate multi-instance setups: a host and a spoke on one
// machine with distinct RACCOURIER_DIRs (distinct config, port, history) fight
// over the one global lock and the second instance silently quits. Scoping
// userData to the config dir makes the lock per-dir. In the default install
// this is a no-op relocation: userData already is %APPDATA%\Raccourier, the
// same directory configDir() resolves to.
function guardSingleInstance(app, configDir, exit = process.exit) {
  app.setPath("userData", configDir);
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    exit(0);
  }
}

module.exports = { guardSingleInstance };
