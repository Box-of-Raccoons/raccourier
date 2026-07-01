function chooseMode(argv, env) {
  if (argv.includes("--mcp") || env.ELECTRON_RUN_AS_NODE) return "mcp";
  return "tray";
}

module.exports = { chooseMode };
