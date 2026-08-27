"""Build-time checks for the data-only Validation Lab contract."""

from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path

import nbformat


REPOSITORY = Path(__file__).resolve().parents[2]
NOTEBOOKS = [
    REPOSITORY / "wasm/validation-lab/content/validate-table2x2.ipynb",
    REPOSITORY / "wasm/validation-lab/content/validate-stratified2x2.ipynb",
]
FIXTURE = REPOSITORY / "wasm/tests/fixtures/algorithm-validation/foodborne-outbreak-v1-table2x2.json"
STRATIFIED_OPERATIONAL_FIXTURE = REPOSITORY / "wasm/tests/fixtures/algorithm-validation/stratified-operational-v0.8.json"


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

    stratified = nbformat.read(NOTEBOOKS[1], as_version=4)
    source = "\n".join(cell.source for cell in stratified.cells)
    assert "stratified-operational-v0.8.json" in source
    assert "1,024-strata" in source


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


if __name__ == "__main__":
    verify_notebook()
    verify_foodborne_derivation()
    verify_stratified_operational_fixture()
    print("Validation Lab source passed: notebook schemas/syntax, foodborne derivation, and V0.8 operational fixture.")
