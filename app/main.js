const { chooseMode } = require("./mode");

if (process.argv.includes("--install-mcp")) {
  require("../mcp/install.js").run(process.argv);
} else if (chooseMode(process.argv, process.env) === "mcp") {
  require("../mcp/server.js");
} else {
  require("./tray.js");
}
