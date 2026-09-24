# Epi Info AI desktop packaging spike

This directory contains two related experiments around the same `wasm/dist`
browser artifact published to Pages:

1. a Linux-first Tauri v2 native shell; and
2. a Linux container that serves Epi Info AI locally to a browser on Windows,
   macOS, or Linux.

They are packaging and compatibility probes, not a new application architecture
and not approved desktop releases.

## CI-only build

The GitHub workflow `.github/workflows/tauri-desktop-spike.yml` performs the
native Linux and container builds on hosted runners. A CDC-managed workstation
does not need Rust, Tauri, or native build tools and must not execute locally
generated Rust binaries.

1. Merge or replicate the spike to GitHub's default branch.
2. Open **Actions > Tauri desktop spike > Run workflow**.
3. Leave `engineering` selected and run the workflow.
4. Download the Linux x64 DEB/AppImage from the workflow's **Artifacts** section.

The engineering artifacts are intentionally not attached to a GitHub Release
and carry no CDC publisher identity. They must not be presented as trusted or
production-ready. GitHub does record signed build provenance for the DEB,
AppImage, and container digest; that proves which workflow built an artifact but
is not an operating-system publisher signature.

## Run the browser container

After the first successful workflow, make the GHCR package public (or sign in to
GHCR) and run this on a machine with an approved Docker installation:

```text
docker pull ghcr.io/epi-info-ai/epi-info-ai-browser-spike:demo
docker run --rm -p 8765:8080 ghcr.io/epi-info-ai/epi-info-ai-browser-spike:demo
```

Open `http://127.0.0.1:8765`. The container is a local web server, not a native
Windows application. Docker Desktop itself is an installed application, so this
path does not bypass CDC installation policy; Pages remains the no-install path.
Use the immutable `sha-<commit>` tag or recorded digest for repeatable testing.

## Authority boundary

The shell embeds the existing web build and grants no Tauri IPC capabilities.
It includes no shell, filesystem, updater, HTTP, process, or dialog plugin. File
selection and storage therefore remain the application's existing browser/Web
View workflows. Adding native authority requires a separate threat model,
least-privilege capability, tests, and review.

Linux Tauri uses WebKitGTK, which differs from Chrome. OPFS, WebGPU, downloads,
workers, maps, package import/export, and offline restoration all require
platform acceptance evidence before any parity claim. Windows WebView2 and
macOS WKWebView remain deferred follow-on targets after the Linux spike.

## Production signing promotion

Production distribution is a separate protected workflow:

- **Windows:** provision an organization-validated code-signing identity,
  preferably HSM/cloud backed (for example Azure Artifact Signing); sign and
  timestamp the MSI in CI; retain one publisher identity across releases.
- **macOS:** enroll the publisher in the Apple Developer Program, use a
  `Developer ID Application` certificate, notarize the DMG with App Store
  Connect credentials, and staple the notarization ticket.
- **Linux:** publish checksums and organization-signed provenance or detached
  signatures; if an APT repository is introduced, sign its repository metadata
  and protect that signing key as release infrastructure.
- Put credentials in a protected GitHub Environment such as
  `desktop-production-signing`, require human approval, restrict the workflow
  and branch/tag that may access it, and retain signing/provenance receipts.
- Do not store certificates, private keys, passwords, Apple credentials, or
  cloud-signing credentials in source, local `.secrets`, build artifacts, or
  project packages.

Signing identifies the publisher and protects artifact integrity. It does not
replace malware scanning, dependency review, SBOM/provenance, scientific
validation, privacy review, or application security testing.
