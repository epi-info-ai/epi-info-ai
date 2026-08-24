# 2 x 2 WASM spike

This small Rust crate tests the browser/WASM boundary for the deterministic
2 x 2 engine. It exports the risk, association, and chi-square primitives via
a dependency-free WebAssembly module. The browser adapter continues to handle
confidence intervals, exact tests, validation, and the result contract for now.

Build from the repository root after installing Rust and the browser target:

```powershell
rustup target add wasm32-unknown-unknown
cargo build --manifest-path wasm/engine-rust/Cargo.toml --release --target wasm32-unknown-unknown
Copy-Item wasm/engine-rust/target/wasm32-unknown-unknown/release/epi_info_table2x2.wasm wasm/demo/epi2x2.wasm
```

