import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const read = async (path) => readFile(new URL(path, root), "utf8");

const config = JSON.parse(await read("wasm/desktop-spike/src-tauri/tauri.conf.json"));
assert.equal(config.build.frontendDist, "../../dist");
assert.deepEqual(config.app.security.capabilities, []);
assert.equal(config.app.security.freezePrototype, true);

const cargo = await read("wasm/desktop-spike/src-tauri/Cargo.toml");
assert.match(cargo, /tauri = \{ version = "2", features = \[\] \}/);
assert.doesNotMatch(cargo, /tauri-plugin-(shell|fs|http|process|dialog)/);

const workflow = await read(".github/workflows/tauri-desktop-spike.yml");
assert.match(workflow, /workflow_dispatch:/);
assert.match(workflow, /ubuntu-24\.04/);
assert.match(workflow, /--bundles deb,appimage/);
assert.match(workflow, /docker\/build-push-action@v6/);
assert.match(workflow, /ghcr\.io\/epi-info-ai\/epi-info-ai-browser-spike/);
assert.match(workflow, /actions\/attest-build-provenance@v3/);
assert.match(workflow, /uploadWorkflowArtifacts: true/);
assert.doesNotMatch(workflow, /releaseName:|tagName:|contents: write/);

const macConfig = JSON.parse(await read("wasm/desktop-spike/src-tauri/tauri.macos.conf.json"));
assert.equal(macConfig.bundle.macOS.signingIdentity, "-");

const dockerfile = await read("wasm/desktop-spike/Dockerfile");
assert.match(dockerfile, /nginxinc\/nginx-unprivileged/);
assert.match(dockerfile, /USER 101/);
assert.doesNotMatch(dockerfile, /ENTRYPOINT.*tauri|CMD.*tauri/);

console.log("Desktop spike static contract passed: Linux Tauri plus browser container, no native IPC grants.");
