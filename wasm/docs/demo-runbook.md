# Experienced-user demo runbook

## Audience and promise

This short path is for experienced Epi Info programmers and global-health
surveillance practitioners. The demonstration claim is deliberately narrow:
Epi Info AI preserves familiar learned workflows and visible Classic source
while moving reviewed operations into a browser-first architecture. It does not
claim full desktop parity.

Use the validated foodborne line list for this demo. Describe its fields as the
same surveillance pattern used for vaccine-preventable diseases: case ID,
classification, onset date, demographics, clinical indicators, interview or
investigation dates, and location. Do not imply that the example is a validated
VPD case definition or VPD reference dataset.

## Seven-minute primary path

1. **Familiar entry point (30 seconds).** Open the published Epi Info AI page.
   Point out the retained Create Forms, Enter Data, Classic, Visual Dashboard,
   Maps, and StatCalc branches. Say: “The old tree remains; reviewed browser and
   AI capabilities become explicit new branches.”
2. **Case line list (60 seconds).** Restore or import the packaged foodborne
   example, then open Enter Data. Show that the generated form and 96 records
   remain ordinary fields and rows rather than an opaque AI artifact.
3. **Surveillance quality (60 seconds).** Open Data Quality Check. Use the
   missingness mini-bars to identify onset, hospitalization, specimen, or
   interview-date completeness issues. Relate this directly to completeness
   monitoring in VPD surveillance; do not label this V0.1 output as timeliness.
4. **Time and place (90 seconds).** Open Visual Dashboard and show the epidemic
   curve, then Maps and Plot Records. If the map network is reliable, enable the
   basemap; otherwise retain the plotted data layer without making a network
   claim. Mention the reviewed H3 and GeoJSON layer paths only if they have been
   rehearsed in the deployed build.
5. **Programmer-first graph (2 minutes).** Open Classic Analysis, expand
   Statistics, and choose Graph. Select `case_status` and Pie, insert the command,
   and pause on the generated source:

   ```text
   GRAPH case_status GRAPHTYPE="Pie" TITLETEXT="Foodborne case status"
   ```

   Run the selected command. Show the four slices and then expand **View graph
   data** to establish that the table—not the picture—is the auditable result.
   Change `Pie` to `Column` directly in the editor, run it again, and show that
   command history retains both executions. This is the key experienced-user
   moment: familiar dialogs and directly editable source are two views of the
   same operation.
6. **New branch, same audit trail (60 seconds).** Expand **New Branches — Epi
   Info AI**, choose **Quality Profile**, and insert `EPIAI QUALITY *`. Select
   the command and run it. Show problematic fields first, then open Command
   history to show the exact source, origin, status, and result summary.
7. **Close on trust (60 seconds).** Show the compatibility inventory and command
   history. Explain that browser-verified candidates remain distinct from
  legacy-parity-verified features, and unsupported syntax fails closed instead
  of being silently reinterpreted.

As an optional migration coda, choose **Convert Access Database**, select the
official legacy `Sample.mdb`, insert and run
`FILE CONVERT "Sample.mdb" TO "Sample.sqlite"`, and show the download. For an analytical branch, choose DuckDB and show that the visible source becomes `FILE CONVERT "Sample.mdb" TO "Sample.duckdb"`. Describe
this accurately as V0.1 user-table/row migration with a manifest—not complete
conversion of Access forms, reports, VBA, relationships, indexes, or queries.

## Optional local-AI coda

Only demonstrate Epi Assist if the Granite model has already been loaded and
rehearsed on the same browser. Ask it for an analysis plan, then emphasize that
it proposes allowlisted typed actions for user review; it does not execute
arbitrary Epi Info source. Skip this segment if model retrieval, WebGPU, or JSON
generation is not already confirmed. The deterministic Classic workflow above
is the primary demo, not the fallback.

## Preflight and fallback

- Open the published page in a fresh tab and confirm the cache version before
  the meeting.
- Restore/import the example once, then rehearse Pie-to-Column source editing.
- Confirm Data Quality Check, epidemic curve, and record plotting before relying
  on them live.
- Keep one tab positioned on the Classic program and graph Output.
- Treat online basemap tiles and Granite model retrieval as optional network
  enhancements. The case data, typed calculations, command history, and graph
  data table should remain demonstrable without them.
- Do not claim VPD algorithm or case-definition validation until a governed VPD
  fixture is added to the validation corpus.
