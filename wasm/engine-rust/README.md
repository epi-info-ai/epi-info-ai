# Epi Info AI 2 x 2 kernel

This Rust crate implements the candidate deterministic `epi.table2x2` kernel. It
exports risks, association measures, named confidence intervals, chi-square
statistics, the one-degree-of-freedom chi-square survival probability, and the
legacy-compatible Fisher and mid-p exact tails, the conditional maximum-
likelihood odds ratio, exact Fisher/mid-p odds-ratio limits, and candidate
stratified Mantel-Haenszel OR/RR estimates, confidence limits, and tests through
WebAssembly. `libm` is
compiled into the module; the release artifact has no runtime dependencies or
operating-system access.

The TypeScript adapter validates the request, selects the supported confidence
multiplier, assembles the versioned result contract, and owns presentation
diagnostics. Exact enumeration is capped at 100,000 support points. The Fisher
two-sided test retains Epi Info's probability-ordering tolerance of `1.000001`;
the result contract identifies that compatibility choice explicitly.

Build from the repository root after installing Rust and the browser target:

```powershell
rustup target add wasm32-unknown-unknown
cargo build --manifest-path wasm/engine-rust/Cargo.toml --release --target wasm32-unknown-unknown
Copy-Item wasm/engine-rust/target/wasm32-unknown-unknown/release/epi_info_table2x2.wasm wasm/demo/epi2x2.wasm
```
