"""Build-time checks for the data-only Validation Lab contract."""

from __future__ import annotations

import csv
import hashlib
import json
import math
from pathlib import Path

import nbformat


REPOSITORY = Path(__file__).resolve().parents[2]
NOTEBOOKS = [
    REPOSITORY / "wasm/validation-lab/content/validate-table2x2.ipynb",
    REPOSITORY / "wasm/validation-lab/content/validate-stratified2x2.ipynb",
    REPOSITORY / "wasm/validation-lab/content/validate-frequency.ipynb",
    REPOSITORY / "wasm/validation-lab/content/validate-means.ipynb",
    REPOSITORY / "wasm/validation-lab/content/validate-rate.ipynb",
    REPOSITORY / "wasm/validation-lab/content/validate-population-survey.ipynb",
    REPOSITORY / "wasm/validation-lab/content/validate-cohort-cross-sectional.ipynb",
    REPOSITORY / "wasm/validation-lab/content/validate-unmatched-case-control.ipynb",
    REPOSITORY / "wasm/validation-lab/content/validate-chi-square-trend.ipynb",
    REPOSITORY / "wasm/validation-lab/content/validate-tables.ipynb",
]
FIXTURE = REPOSITORY / "wasm/tests/fixtures/algorithm-validation/foodborne-outbreak-v1-table2x2.json"
STRATIFIED_OPERATIONAL_FIXTURE = REPOSITORY / "wasm/tests/fixtures/algorithm-validation/stratified-operational-v0.8.json"
FREQUENCY_FIXTURE = REPOSITORY / "wasm/tests/fixtures/algorithm-validation/foodborne-frequency-v0.9.json"
MEANS_FIXTURE = REPOSITORY / "wasm/tests/fixtures/algorithm-validation/foodborne-means-v0.10.json"
RATE_FIXTURE = REPOSITORY / "wasm/tests/fixtures/algorithm-validation/foodborne-rate-v0.11.json"
POPULATION_SURVEY_FIXTURE = REPOSITORY / "wasm/tests/fixtures/algorithm-validation/population-survey-v0.12.json"
COHORT_FIXTURE = REPOSITORY / "wasm/tests/fixtures/algorithm-validation/cohort-cross-sectional-v0.13.json"
UNMATCHED_FIXTURE = REPOSITORY / "wasm/tests/fixtures/algorithm-validation/unmatched-case-control-v0.14.json"
TREND_FIXTURE = REPOSITORY / "wasm/tests/fixtures/algorithm-validation/chi-square-trend-v0.15.json"
TABLES_FIXTURES = [
    REPOSITORY / "wasm/tests/fixtures/classic-command-parity/foodborne-tables-potato-salad-by-status.expected.json",
    REPOSITORY / "wasm/tests/fixtures/classic-command-parity/foodborne-tables-potato-salad-by-status-unstratified.expected.json",
    REPOSITORY / "wasm/tests/fixtures/classic-command-parity/foodborne-tables-fisher.expected.json",
    REPOSITORY / "wasm/tests/fixtures/classic-command-parity/foodborne-tables-missing.expected.json",
]
TABLES_ADJUSTED_FIXTURE = REPOSITORY / "wasm/tests/fixtures/classic-command-parity/foodborne-tables-stratified-two-by-two.expected.json"
TABLES_WEIGHTED_FIXTURE = REPOSITORY / "wasm/tests/fixtures/classic-command-parity/foodborne-tables-weighted.expected.json"
COMPLEX_MEANS_FIXTURE = REPOSITORY / "wasm/tests/fixtures/classic-command-parity/foodborne-means-psuvar.expected.json"
COMPLEX_MEANS_OUTTABLE_FIXTURE = REPOSITORY / "wasm/tests/fixtures/classic-command-parity/foodborne-means-psuvar-outtable.expected.json"


def normalized(values: list[str]) -> set[str]:
    return {value.strip().casefold() for value in values}


def verify_notebook() -> None:
    for notebook_path in NOTEBOOKS:
        notebook = nbformat.read(notebook_path, as_version=4)
        nbformat.validate(notebook)
        identifiers = [cell.id for cell in notebook.cells]
        assert len(identifiers) == len(set(identifiers)), "notebook cell IDs must be unique"
        for cell in notebook.cells:
            if cell.cell_type == "code":
                compile(cell.source, str(notebook_path), "exec", flags=0x2000)
        source = "\n".join(cell.source for cell in notebook.cells)
        if "wasm_response = await pyfetch" in source:
            assert "wasm_response.buffer()" in source
            assert "wasm_response.arrayBuffer()" not in source

    stratified = nbformat.read(NOTEBOOKS[1], as_version=4)
    source = "\n".join(cell.source for cell in stratified.cells)
    assert "stratified-operational-v0.8.json" in source
    assert "1,024-strata" in source

    frequency = nbformat.read(NOTEBOOKS[2], as_version=4)
    source = "\n".join(cell.source for cell in frequency.cells)
    assert "foodborne-frequency-v0.9.json" in source
    assert "frequency_ci_lower" in source
    assert "scipy.stats" in source

    trend = nbformat.read(NOTEBOOKS[8], as_version=4)
    source = "\n".join(cell.source for cell in trend.cells)
    assert "chi-square-trend-v0.15.json" in source
    assert "trend_chi_square" in source
    assert "math.erfc" in source

    tables = nbformat.read(NOTEBOOKS[9], as_version=4)
    source = "\n".join(cell.source for cell in tables.cells)
    assert "foodborne-tables-stratified-v0.3.json" in source
    assert "foodborne-tables-unstratified-v0.3.json" in source
    assert "chi2_contingency" in source
    assert "foodborne-tables-fisher-v0.5.json" in source
    assert "Fisher-Freeman-Halton" in source
    assert "foodborne-tables-missing-v0.6.json" in source
    assert "foodborne-tables-adjusted-v0.8.json" in source
    assert "SET MISSING=ON" in source
    assert "foodborne-means-psuvar-v0.1.json" in source
    assert "foodborne-means-psuvar-outtable-v0.1.json" in source
    assert "CSM domain means, Taylor variance" in source
    assert "adjusted output produced by the Rust/WASM kernel" in source

    unmatched = nbformat.read(NOTEBOOKS[7], as_version=4)
    source = "\n".join(cell.source for cell in unmatched.cells)
    assert "unmatched-case-control-v0.14.json" in source
    assert "unmatched_case_control_sample_size" in source
    assert "scipy.stats" in source

    cohort = nbformat.read(NOTEBOOKS[6], as_version=4)
    source = "\n".join(cell.source for cell in cohort.cells)
    assert "cohort-cross-sectional-v0.13.json" in source
    assert "cohort_sample_size" in source
    assert "scipy.stats" in source

    means = nbformat.read(NOTEBOOKS[3], as_version=4)
    source = "\n".join(cell.source for cell in means.cells)
    assert "foodborne-means-v0.10.json" in source
    assert "means_sample_variance" in source
    assert "statistics.variance" in source

    rate = nbformat.read(NOTEBOOKS[4], as_version=4)
    source = "\n".join(cell.source for cell in rate.cells)
    assert "foodborne-rate-v0.11.json" in source
    assert "rate_calculate" in source
    assert "wasm_response.buffer()" in source

    population_survey = nbformat.read(NOTEBOOKS[5], as_version=4)
    source = "\n".join(cell.source for cell in population_survey.cells)
    assert "population-survey-v0.12.json" in source
    assert "population_survey_cluster_size" in source
    assert "scipy.stats" in source


def verify_stratified_operational_fixture() -> None:
    fixture = json.loads(STRATIFIED_OPERATIONAL_FIXTURE.read_text(encoding="utf-8"))
    assert fixture["operation"] == "epi.stratified2x2"
    assert len(fixture["literalCases"]) >= 4
    maximum = fixture["generatedCases"][0]
    assert maximum["strata"] == fixture["reviewedLimits"]["maximumStrata"] == 1024
    assert maximum["budget"]["ciRunnerMilliseconds"] == 5000
    assert fixture["reviewedLimits"]["maximumSupportWidth"] == 4096
    assert fixture["reviewedLimits"]["maximumConvolutionWork"] == 2_000_000


def verify_foodborne_derivation() -> None:
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    data_file = REPOSITORY / fixture["dataset"]["file"]
    data = data_file.read_bytes()
    assert hashlib.sha256(data).hexdigest() == fixture["dataset"]["sha256"]
    rows = list(csv.DictReader(data.decode("utf-8-sig").splitlines()))
    assert len(rows) == fixture["dataset"]["rows"]

    rules = fixture["derivation"]
    cases = normalized(rules["caseValues"])
    noncases = normalized(rules["noncaseValues"])
    yes = normalized(rules["yesValues"])
    no = normalized(rules["noValues"])
    table = [0, 0, 0, 0]
    excluded = 0
    for row in rows:
        status = row[rules["caseField"]].strip().casefold()
        exposure = row[rules["exposureField"]].strip().casefold()
        if status not in cases | noncases or exposure not in yes | no:
            excluded += 1
        elif exposure in yes and status in cases:
            table[0] += 1
        elif exposure in yes:
            table[1] += 1
        elif status in cases:
            table[2] += 1
        else:
            table[3] += 1

    expected = fixture["input"]
    assert table == [
        expected["exposedCases"],
        expected["exposedNonCases"],
        expected["unexposedCases"],
        expected["unexposedNonCases"],
    ]
    assert excluded == rules["excludedRows"]


def verify_foodborne_frequency() -> None:
    fixture = json.loads(FREQUENCY_FIXTURE.read_text(encoding="utf-8"))
    data = (REPOSITORY / fixture["dataset"]["file"]).read_bytes()
    assert hashlib.sha256(data).hexdigest() == fixture["dataset"]["sha256"]
    rows = list(csv.DictReader(data.decode("utf-8-sig").splitlines()))
    counts: dict[str, int] = {}
    for row in rows:
        value = row[fixture["request"]["sourceHeader"]]
        counts[value] = counts.get(value, 0) + 1
    expected = {item["value"]: item["frequency"] for item in fixture["expected"]["categories"]}
    assert counts == expected


def verify_foodborne_means() -> None:
    fixture = json.loads(MEANS_FIXTURE.read_text(encoding="utf-8"))
    data = (REPOSITORY / fixture["dataset"]["file"]).read_bytes()
    assert hashlib.sha256(data).hexdigest() == fixture["dataset"]["sha256"]
    rows = list(csv.DictReader(data.decode("utf-8-sig").splitlines()))
    ages = [float(row[fixture["request"]["sourceHeader"]]) for row in rows]
    assert len(ages) == fixture["expected"]["statistics"]["observations"]
    assert sum(ages) == fixture["expected"]["statistics"]["total"]


def verify_foodborne_rate() -> None:
    fixture = json.loads(RATE_FIXTURE.read_text(encoding="utf-8"))
    data = (REPOSITORY / fixture["dataset"]["file"]).read_bytes()
    assert hashlib.sha256(data).hexdigest() == fixture["dataset"]["sha256"]
    rows = list(csv.DictReader(data.decode("utf-8-sig").splitlines()))
    request = fixture["request"]
    eligible = [row for row in rows if row[request["denominatorSourceHeader"]].strip()]
    numerator = sum(
        row[request["numeratorSourceHeader"]].strip().casefold() == request["numeratorValue"].casefold()
        for row in eligible
    )
    assert numerator == fixture["expected"]["numerator"]
    assert len(eligible) == fixture["expected"]["denominator"]


def verify_population_survey() -> None:
    fixture = json.loads(POPULATION_SURVEY_FIXTURE.read_text(encoding="utf-8"))
    default = fixture["cases"][0]
    assert [row["confidenceLevel"] for row in default["expected"]] == [0.80, 0.90, 0.95, 0.97, 0.99, 0.999, 0.9999]
    assert [row["clusterSize"] for row in default["expected"]] == [164, 270, 384, 471, 663, 1082, 1512]
    clustered = fixture["cases"][1]
    assert clustered["expected95"]["clusterSize"] * clustered["input"]["clusters"] == clustered["expected95"]["totalSample"]


def verify_cohort() -> None:
    fixture = json.loads(COHORT_FIXTURE.read_text(encoding="utf-8"))
    assert fixture["cases"][0]["methods"] == [
        {"method": "Kelsey", "exposed": 13, "unexposed": 13, "total": 26},
        {"method": "Fleiss", "exposed": 12, "unexposed": 12, "total": 24},
        {"method": "Fleiss with continuity correction", "exposed": 16, "unexposed": 16, "total": 32},
    ]
    assert fixture["cases"][1]["methods"][2]["total"] == 669


def verify_unmatched() -> None:
    fixture = json.loads(UNMATCHED_FIXTURE.read_text(encoding="utf-8"))
    assert fixture["cases"][0]["methods"] == [
        {"method": "Kelsey", "cases": 17, "controls": 17, "total": 34},
        {"method": "Fleiss", "cases": 16, "controls": 16, "total": 32},
        {"method": "Fleiss with continuity correction", "cases": 20, "controls": 20, "total": 40},
    ]
    assert fixture["cases"][1]["methods"][2]["total"] == 159


def verify_chi_square_trend() -> None:
    fixture = json.loads(TREND_FIXTURE.read_text(encoding="utf-8"))
    rows = fixture["input"]["rows"]
    assert len(rows) == 4
    assert fixture["expected"]["oddsRatios"] == [1, 2.25, 27 / 7, 6]
    assert fixture["expected"]["chiSquare"] == 26.6


def verify_foodborne_tables() -> None:
    for fixture_path in TABLES_FIXTURES:
        fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
        data = (REPOSITORY / fixture["dataset"]["file"]).read_bytes()
        assert hashlib.sha256(data).hexdigest() == fixture["dataset"]["sha256"]
        rows = list(csv.DictReader(data.decode("utf-8-sig").splitlines()))
        request = fixture["request"]
        if "strata" not in fixture:
            expected = fixture["expected"]
            if "counts" in expected:
                exposures = ["No", "Yes"]
                outcomes = ["Confirmed", "Not a case", "Probable", "Suspected"]
                counts = [[sum(row["Potato Salad"] == exposure and row["Case Status"] == outcome for row in rows)
                           for outcome in outcomes] for exposure in exposures]
                assert counts == expected["counts"]
            else:
                missing_by_sex = [sum(not row["Vomiting"].strip() and row["Sex"] == sex for row in rows)
                                  for sex in ["Female", "Male"]]
                assert len(rows) == expected["includedRecords"]
                assert sum(missing_by_sex) == expected["includedMissing"]
                assert missing_by_sex == expected["missingExposureCounts"]
            continue
        for stratum in fixture["strata"]:
            members = [row for row in rows if "strataHeader" not in request or row[request["strataHeader"]] == stratum["value"]]
            observed = {
                (exposure, outcome): sum(
                    row[request["exposureHeader"]] == exposure and row[request["outcomeHeader"]] == outcome
                    for row in members
                )
                for exposure in fixture["exposureValues"] for outcome in fixture["outcomeValues"]
            }
            assert [[observed[(exposure, outcome)] for outcome in fixture["outcomeValues"]]
                    for exposure in fixture["exposureValues"]] == [row["counts"] for row in stratum["rows"]]


def verify_foodborne_tables_adjusted() -> None:
    fixture = json.loads(TABLES_ADJUSTED_FIXTURE.read_text(encoding="utf-8"))
    data = (REPOSITORY / fixture["dataset"]["file"]).read_bytes()
    assert hashlib.sha256(data).hexdigest() == fixture["dataset"]["sha256"]
    rows = list(csv.DictReader(data.decode("utf-8-sig").splitlines()))
    request = fixture["request"]
    orientation = request["orientation"]
    strata = []
    for expected in fixture["strata"]:
        members = [row for row in rows if row[request["strataHeaders"][0]] == expected["value"]]
        cells = [[sum(row[request["exposureHeader"]] == exposure and row[request["outcomeHeader"]] == outcome
                      for row in members)
                  for outcome in [orientation["case"], orientation["nonCase"]]]
                 for exposure in [orientation["exposed"], orientation["unexposed"]]]
        assert cells == expected["cells"]
        strata.append((*cells[0], *cells[1]))
    expected = fixture["adjusted"]
    tolerance = fixture["tolerance"]
    mh_or = sum(a * d / (a + b + c + d) for a, b, c, d in strata) / sum(
        b * c / (a + b + c + d) for a, b, c, d in strata)
    mh_rr = sum(a * (c + d) / (a + b + c + d) for a, b, c, d in strata) / sum(
        c * (a + b) / (a + b + c + d) for a, b, c, d in strata)
    observed_minus_expected = sum(a - (a + b) * (a + c) / (a + b + c + d) for a, b, c, d in strata)
    variance = sum((a + b) * (c + d) * (a + c) * (b + d) /
                   ((a + b + c + d) ** 2 * (a + b + c + d - 1)) for a, b, c, d in strata)
    uncorrected = observed_minus_expected ** 2 / variance
    corrected = max(0, abs(observed_minus_expected) - 0.5) ** 2 / variance
    assert math.isclose(mh_or, expected["adjustedOddsRatio"], abs_tol=tolerance, rel_tol=0)
    assert math.isclose(mh_rr, expected["adjustedRiskRatio"], abs_tol=tolerance, rel_tol=0)
    assert math.isclose(uncorrected, expected["mantelHaenszelUncorrected"], abs_tol=tolerance, rel_tol=0)
    assert math.isclose(corrected, expected["mantelHaenszelCorrected"], abs_tol=tolerance, rel_tol=0)
    assert math.isclose(math.erfc(math.sqrt(uncorrected / 2)), expected["mantelHaenszelUncorrectedP"], abs_tol=tolerance, rel_tol=0)


def verify_foodborne_tables_weighted() -> None:
    fixture = json.loads(TABLES_WEIGHTED_FIXTURE.read_text(encoding="utf-8"))
    data = (REPOSITORY / fixture["dataset"]["file"]).read_bytes()
    assert hashlib.sha256(data).hexdigest() == fixture["dataset"]["sha256"]
    records = list(csv.DictReader(data.decode("utf-8-sig").splitlines()))
    exposures = ["No", "Yes"]
    outcomes = ["Confirmed", "Not a case", "Probable", "Suspected"]
    cells = [[sum(float(record["Age"]) for record in records
                  if record["Potato Salad"] == exposure and record["Case Status"] == outcome)
              for outcome in outcomes] for exposure in exposures]
    assert cells == [row["counts"] for row in fixture["rows"]]
    assert sum(sum(row) for row in cells) == fixture["weightedTotal"]


def verify_foodborne_complex_means() -> None:
    """Independently reproduce the mechanical CSM fixture without candidate code."""
    fixture = json.loads(COMPLEX_MEANS_FIXTURE.read_text(encoding="utf-8"))
    data = (REPOSITORY / fixture["dataset"]["file"]).read_bytes()
    assert hashlib.sha256(data).hexdigest() == fixture["dataset"]["sha256"]
    source = list(csv.DictReader(data.decode("utf-8-sig").splitlines()))
    records = [{"value": float(row["Age"]), "domain": row["Sex"],
                "stratum": row["Case Status"], "psu": row["Household Neighborhood"]}
               for row in source]
    pairs = {(row["stratum"], row["psu"]) for row in records}
    strata = {row["stratum"] for row in records}
    expected = fixture["expected"]
    assert len(records) == expected["includedRecords"] == 96
    assert len(pairs) == expected["primarySamplingUnits"] == 63
    assert len(strata) == expected["designStrata"] == 4
    assert len(pairs) - len(strata) == expected["degreesOfFreedom"] == 59

    def design_variance(influence) -> float:
        total = 0.0
        for stratum in strata:
            members = [row for row in records if row["stratum"] == stratum]
            psus = {row["psu"] for row in members}
            if len(psus) <= 1:
                continue
            values = [sum(influence(row) for row in members if row["psu"] == psu)
                      for psu in psus]
            total += (len(psus) * sum(value * value for value in values)
                      - sum(values) ** 2) / (len(psus) - 1)
        return total

    estimates = {}
    for expected_row in expected["rows"][:2]:
        label = expected_row["label"]
        members = [row for row in records if row["domain"] == label]
        mean = sum(row["value"] for row in members) / len(members)
        variance = design_variance(
            lambda row, label=label, mean=mean, count=len(members):
            (row["value"] - mean) / count if row["domain"] == label else 0)
        standard_error = math.sqrt(variance)
        estimates[label] = (mean, len(members))
        assert len(members) == expected_row["count"]
        for actual, name in [(mean, "mean"), (standard_error, "standardError")]:
            assert math.isclose(actual, expected_row[name], abs_tol=1e-10, rel_tol=0)
        assert min(row["value"] for row in members) == expected_row["minimum"]
        assert max(row["value"] for row in members) == expected_row["maximum"]

    left, right, difference = expected["rows"]
    left_mean, left_count = estimates[left["label"]]
    right_mean, right_count = estimates[right["label"]]
    difference_mean = left_mean - right_mean
    difference_variance = design_variance(
        lambda row: (row["value"] - left_mean) / left_count
        if row["domain"] == left["label"] else
        -(row["value"] - right_mean) / right_count
        if row["domain"] == right["label"] else 0)
    assert math.isclose(difference_mean, difference["mean"], abs_tol=1e-12, rel_tol=0)
    assert math.isclose(math.sqrt(difference_variance), difference["standardError"],
                        abs_tol=1e-10, rel_tol=0)

    out_table = json.loads(COMPLEX_MEANS_OUTTABLE_FIXTURE.read_text(encoding="utf-8"))
    assert out_table["status"] == "new-branch-browser-adaptation"
    assert out_table["fields"] == ["sex", "VARNAME", "COUNT", "MEAN", "StdErr",
                                   "LCL", "UCL", "MIN", "MAX"]
    assert len(out_table["records"]) == len(expected["rows"]) == 3
    for record, expected_row in zip(out_table["records"], expected["rows"]):
        assert record["sex"] == expected_row["label"]
        assert record["VARNAME"] == "age"
        assert record["COUNT"] == expected_row["count"]
        for output_name, result_name in [("MEAN", "mean"), ("StdErr", "standardError"),
                                         ("LCL", "lowerConfidenceLimit"),
                                         ("UCL", "upperConfidenceLimit"),
                                         ("MIN", "minimum"), ("MAX", "maximum")]:
            if expected_row[result_name] is None:
                assert record[output_name] is None
            else:
                assert math.isclose(record[output_name], expected_row[result_name],
                                    abs_tol=1e-10, rel_tol=0)


if __name__ == "__main__":
    verify_notebook()
    verify_foodborne_derivation()
    verify_foodborne_frequency()
    verify_foodborne_means()
    verify_foodborne_rate()
    verify_population_survey()
    verify_cohort()
    verify_unmatched()
    verify_chi_square_trend()
    verify_foodborne_tables()
    verify_foodborne_tables_adjusted()
    verify_foodborne_tables_weighted()
    verify_foodborne_complex_means()
    verify_stratified_operational_fixture()
    print("Validation Lab source passed: notebooks, foodborne derivations, and operational fixtures.")
