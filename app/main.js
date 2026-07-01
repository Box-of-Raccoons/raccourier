const { chooseMode } = require("./mode");

if (chooseMode(process.argv, process.env) === "mcp") {
  require("../mcp/server.js");
} else {
  require("./tray.js");
}
