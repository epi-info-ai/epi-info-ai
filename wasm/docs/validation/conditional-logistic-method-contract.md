# Conditional LOGISTIC V0.1 method contract

## Status and purpose

This contract governs the first executable browser candidate for the retained
Epi Info source form:

```text
LOGISTIC outcome = predictor [predictor ...] MATCHVAR=matched_set
```

It completes the current matched case-control teaching workflow after `MATCH`.
It is not a claim of full `LOGISTIC` parity. The output identifies the browser
kernel and the remaining Rust/WASM and desktop-differential work.

## Executable boundary

- The outcome must be binary `0/1` or `No/Yes`.
- `MATCHVAR` is required and defines one matched set.
- Each included set must contain exactly one case and at least one control.
- One to ten distinct Number predictors are accepted as simple terms.
- The active `READ`/`SELECT` record set is the analysis population.
- Missing match identifiers or participating values, invalid outcomes,
  nonnumeric predictors, invalid set composition, and sets above 20 members are
  excluded by named category and counted in visible Output.
- The browser limit is 100,000 active records and 50,000 matched sets.
- `TITLETEXT` is honored. `NOINTERCEPT` is accepted because conditional
  likelihood eliminates the set intercepts.
- Categorical expansion, interactions, `WEIGHTVAR`, `OUTTABLE`, non-95%
  `PVALUE`, `LINKFUNCTION=LOG`, and ordinary logistic regression remain
  fail-closed even though their syntax is retained.

## Method

For matched set `s`, with one case and members `j`, V0.1 maximizes the
conditional log likelihood

```text
sum_s [beta' x_case(s) - log(sum_j exp(beta' x_sj))].
```

It uses Newton-Raphson scoring with step halving, a 50-iteration ceiling, and a
`1e-9` convergence tolerance. The inverse observed information supplies
standard errors. Output includes coefficients, adjusted odds ratios, two-sided
normal Wald p-values and 95% Wald confidence limits, log likelihoods, and the
likelihood-ratio chi-square against the zero-coefficient model.

Separation or a singular information matrix is an explicit error; the program
must not silently fall back to ordinary logistic regression or add a penalty.

## Current validation evidence

Phase 0 constructs 21 complete 1:1 sets with 13 discordant pairs in the
case-exposed direction and eight in the reverse direction. For a single binary
predictor, conditional logistic regression reduces analytically to:

```text
coefficient = log(13 / 8)
standard error = sqrt(1 / 13 + 1 / 8)
adjusted odds ratio = 13 / 8 = 1.625
```

The automated test asserts all three identities to `1e-8`. The browser
acceptance test loads the 130-record legacy case-control workbook, runs the
nine-command teaching tour through the visible Program Editor, and verifies
the two-predictor conditional output and common history entry. Phase 0 also
selects iteration zero of the checked-in synthetic corpus and verifies that all
100 one-case/two-control sets (300 records) converge with two finite
coefficients and positive standard errors; independent coefficient comparison
for that corpus is now provided by the
[JupyterLite conditional LOGISTIC lab](../../validation-lab/content/validate-conditional-logistic.ipynb).
The lab uses SciPy's optimizer, gradient, Hessian, and linear algebra directly
against the raw CSV and compares the resulting coefficients, standard errors,
odds ratios, Wald limits, log likelihoods, and likelihood-ratio statistic with
the captured browser-candidate fixture. It also verifies row-order and
matched-set-label invariance.

## Remaining acceptance work

1. Migrate the reviewed numerical kernel to Rust/WASM without changing this
   public contract.
2. Add categorical-term and interaction design-matrix rules before enabling
   those retained source forms.
3. Recover or obtain reviewed desktop Epi Info results, including the historic
   `LOGISTIC CASE = RELY MATCHVAR=ID` example.
4. Review legacy Output layout, convergence diagnostics, missing-value rules,
   and error wording with experienced Epi Info users.
