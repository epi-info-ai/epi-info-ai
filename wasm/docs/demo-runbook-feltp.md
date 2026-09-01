# FELTP/FETP field-investigation demo runbook

## Audience and promise

This path is for field epidemiology and laboratory training participants who
use Epi Info during outbreak investigations. It demonstrates one continuous,
browser-local investigation workflow using the validated 96-record foodborne
example. It does not claim that every desktop command, mobile collection mode,
laboratory information system, or surveillance case definition has parity.

## Eight-minute investigation story

1. **Start from the familiar menu (30 seconds).** Point to Create Forms, Enter
   Data, Visual Dashboard, Classic Analysis, Maps, and StatCalc. Explain the
   design rule: familiar branches remain in their learned locations; browser
   adaptations and new capabilities are documented rather than substituted
   silently.
2. **Build the line list (60 seconds).** Restore the packaged foodborne example,
   or import its CSV with **create a form and import records** enabled. Show the
   generated field definitions and 96 imported records. Emphasize that an
   investigation can begin from a received line list without redesigning every
   field manually.
3. **Review the questionnaire (45 seconds).** In Form Designer, show the familiar
   field tree, grid, data types, and validation rules. Mention that skip-pattern
   and geolocation parity remain governed gaps unless their tested controls are
   visible in the deployed build.
4. **Find operational gaps (75 seconds).** Open Enter Data and Data Quality
   Check. Use missingness mini-bars to focus on Onset Date, Hospitalization Date,
   Specimen Date, and Interview Date. Frame this as an action list for case
   investigation and laboratory follow-up, not merely a statistical summary.
5. **Describe the outbreak (90 seconds).** Open Visual Dashboard and display the
   epidemic curve. Show its underlying data table and missing-date disclosure.
   Relate the time distribution to hypothesis generation without claiming an
   automated causal conclusion.
6. **Put cases in place (90 seconds).** Open Maps, select the latitude and
   longitude fields, and Plot Records. Show the plotted record count. Use the
   online basemap only when connectivity has been rehearsed; record points and
   uploaded layers are the investigation data, while basemap tiles are an
   optional online service.
7. **Make analysis reproducible (90 seconds).** In Classic Analysis, choose
   Statistics > Graph, select `case_status`, and insert a Pie command. Run it,
   expand **View graph data**, then point to command history. Experienced users
   can edit `GRAPHTYPE="Pie"` to `"Bar"` or `"Column"` directly; every rendering
   is backed by the same typed frequency result.
8. **Close on deployment value (30 seconds).** Summarize: the form, records,
   quality review, time/place views, command source, and history work in one
   browser surface. This is particularly useful for training and field settings
   because the deterministic workflow does not depend on sending case records
   to an AI service.

## Laboratory emphasis

When laboratory participants are present, pause on Specimen Date completeness
and distinguish specimen collection, testing, and result fields. The current
example only supplies a specimen date; do not imply laboratory-result exchange
or LIMS integration. Those should enter the compatibility registry as reviewed
new branches with governed identifiers, vocabularies, provenance, and access
controls.

## Global VPD surveillance bridge

After completing the foodborne example, explain the direct structural mapping:
case ID, demographic variables, case classification, onset date, specimen date,
investigation date, symptoms, and coordinates also appear in many
vaccine-preventable-disease surveillance workflows. Do not relabel this example
as VPD data. A separate governed, de-identified VPD fixture is required before
demonstrating disease-specific case definitions, vaccination status, laboratory
classification, timeliness indicators, or deduplication rules.

## Preflight and safe fallback

- Rehearse example restoration, Data Quality Check, epidemic curve, and Plot
  Records in the exact published build.
- Keep a prepared Classic tab containing the Pie command and output table.
- Treat basemap tiles as optional; do not troubleshoot network access during the
  primary narrative.
- Do not rely on local Granite model download for this audience unless already
  cached and tested. The end-to-end deterministic investigation is the main
  demonstration.
- If time is cut short, show the line list, missingness mini-bars, epidemic
  curve, map, and graph command history in that order.
