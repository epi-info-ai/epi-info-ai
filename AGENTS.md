# Repository instructions for coding agents

## CDC endpoint-security constraint

This repository is developed on a CDC-managed Windows device. Locally generated,
unsigned Windows executables can be flagged by endpoint security even when they
are ordinary Cargo test binaries.

- Do not run native Rust build or test commands locally on Windows, including
  `cargo build`, `cargo test`, or `cargo run`, unless the user explicitly asks.
- Do not execute binaries from `wasm/engine-rust/target`.
- Prefer Rust-to-WebAssembly checks that do not produce Windows executables. When
  a native executable would still be generated, use the GitLab CI runners for
  build and test validation instead.
- TypeScript and browser checks may be run locally as long as they do not invoke
  a native Cargo build as a side effect.
- Treat all `target` contents as disposable generated artifacts. If an accidental
  native build creates `.exe` files, stop, tell the user, and remove only the
  verified `wasm/engine-rust/target` directory after obtaining approval.
- Never commit Cargo `target` artifacts or generated `.exe` files.
