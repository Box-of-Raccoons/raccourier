// True when execPath is the packaged Raccourier binary (vs. dev node/electron).
// Windows: Raccourier.exe. macOS: <...>/Raccourier.app/Contents/MacOS/Raccourier.
// Linux: a `raccourier` binary.
//
// Splits separators manually (not path.basename) so the result is identical
// regardless of the host OS running the check — important for cross-platform tests.
function baseName(p) {
  const parts = String(p || "").split(/[\\/]/);
  return parts[parts.length - 1] || "";
}

function isPackagedExec(execPath, platform) {
  const base = baseName(execPath).toLowerCase();
  if (platform === "win32") return base === "raccourier.exe";
  if (platform === "darwin") return /\.app\/contents\/macos\/[^/]+$/i.test(execPath || "");
  return base === "raccourier";
}

module.exports = { baseName, isPackagedExec };
