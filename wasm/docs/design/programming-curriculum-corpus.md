# Epi Info programming curriculum corpus

## Purpose

This corpus turns commands and workflows taught in official CDC materials into
versioned migration examples. It complements, but does not replace, the grammar,
legacy C# implementation, command dialogs, User Guide, and preserved Sample
project. Training examples reveal the sequences and terminology users learned;
the source audit remains authoritative for implementation details and edge cases.

The machine-readable index is
[`tests/fixtures/programming-curriculum/registry.json`](../../tests/fixtures/programming-curriculum/registry.json).

## Evidence classes

| Class | Meaning | Use |
|---|---|---|
| Taught workflow | A sequence explicitly taught in CDC training | UX and end-to-end acceptance fixture |
| Command reference example | Official syntax/behavior example | Parser, generator, and focused execution fixture |
| Official Sample program | Preserved runnable program shipped with Epi Info | Integration and regression corpus |
| Legacy implementation | Grammar, rules, dialogs, and C# behavior | Semantic floor and edge-case resolution |

No single class is sufficient by itself. Conflicts are recorded rather than
silently resolved, with the inspected release and evidence cited.

## Initial classical examples

| Example | Learned sequence | Initial migration use |
|---|---|---|
| Check Code skip pattern | field event -> `IF/THEN/ELSE` -> `GOTO` | Parse and execute a bounded, validated same-form navigation rule |
| Calculated age | field event -> `ASSIGN` with `YEARS` | Type-check date inputs and deterministic calculated-field output |
| Data-entry notification | field event/condition -> `DIALOG` | Permission-free browser dialog with accessible focus behavior |
| NIOSH recoding lesson | `READ -> DEFINE -> RECODE -> FREQ -> WRITE` | First data-management PGM fixture using synthetic codes and expected frequency/export results |
| Saved program composition | generate/edit -> save/open `.pgm7` -> selected/full run -> `RUNPGM` | IDE persistence, bounded composition, selection execution, and run-history fixture |
| Sample line listing | `READ -> LIST` including selected fields and `* EXCEPT` | Dataset session and structured Output fixture |
| Sample outbreak analysis | `READ -> TABLES ... STRATAVAR -> MEANS` with routed output | Multi-command orchestration over validated operations; desktop `EXECUTE` remains blocked/adapted |
| Age-range analysis | `DEFINE -> RECODE age ranges -> FREQ ... STRATAVAR` | First executable bounded Program Editor fixture over the foodborne data |

## Promotion into executable fixtures

Each example advances independently through these states:

1. **Catalogued:** source, section, learned goal, and command family recorded.
2. **Transcribed:** a minimal non-sensitive source fixture is checked in with its
   expected typed intermediate representation.
3. **Parsed:** canonical source round-trips without changing meaning; malformed
   and unsupported variants have explicit diagnostics.
4. **Executable:** every operation is allowlisted and validated, with deterministic
   dataset/session transitions and structured output.
5. **Parity candidate:** browser results are compared with a recorded legacy run
   and independent references where statistical calculations are involved.
6. **Reviewed:** experienced-user, statistical, security, privacy, and
   accessibility gates applicable to the example have passed.

An example may remain useful as parser evidence when one of its commands cannot
be executed safely in a browser. Unsupported source must still round-trip.

## Safety boundary

Curriculum source is test input, not blanket authorization. Commands that launch
processes, load DLLs, use arbitrary filesystem/database paths, or otherwise depend
on ambient desktop authority are classified `blocked-or-adapted`. For example,
`EXECUTE` may become an allowlisted browser navigation/download action, but its
legacy arbitrary-process behavior is never reproduced in WASM or JavaScript.

AI-assisted questions and visual-flow nodes target the same typed representation
proven by these fixtures. They may select supported commands and arguments; they
cannot submit arbitrary curriculum or generated source for unchecked execution.

## Source set

- [CDC Community Health Assessment Tutorial](https://www.cdc.gov/epiinfo/pdfs/eihat/EIHATFull.pdf)
- [CDC Classic Analysis user-defined commands](https://www.cdc.gov/epiinfo/user-guide/classic-analysis/userdefinedcommands.html)
- [CDC/NIOSH industry and occupation recoding lesson](https://archive.cdc.gov/www_cdc_gov/niosh/topics/coding/epiinfo.html)
- [CDC command-reference introduction](https://www.cdc.gov/epiinfo/user-guide/command-reference/introduction.html)
- [CDC Classic Analysis chapter](https://www.cdc.gov/epiinfo/pdfs/userguide/9_classicanalysis.pdf)
- Preserved Epi Info Sample `Statistics.pgm` in the portable Sample project fixture

Retrieved links and local snapshots must record retrieval date and content hash
before they are used as frozen expected evidence.
