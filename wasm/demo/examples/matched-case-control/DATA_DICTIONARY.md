# Matched case-control teaching workbook data dictionary

This dictionary describes the 121 columns in
`case-control-database-example.xlsx`. It is a working aid for teaching and
validation, not a recovered copy of the original questionnaire.

## Evidence levels and coding cautions

- **Documented** means the Epi Info 7 Visual Dashboard guide states the
  variable's analytical role.
- **Observed** means the interpretation follows directly from the workbook's
  values, uniqueness, dates, or paired column structure.
- **Inferred** means the expanded label is a cautious reading of an abbreviated
  legacy field name. The original question wording has not been recovered.
- **Unknown** means the available materials do not support a reliable meaning.

Most exposure fields contain `1`, `0`, `9`, or a blank. Their exact value labels
were not included with the workbook. The data are consistent with `1` = yes,
`0` = no, and `9` = an unknown or indeterminate response, but that interpretation
remains **inferred** until an original form or codebook is recovered. A blank may
mean missing, not asked, or not applicable because of questionnaire skip logic;
those states must not be silently combined.

Many `...1` and `...2` pairs use the first field as an indicator and the second
as free text. This relationship is visible in the data, but the exact prompts
remain unknown. Normalized names used by Epi Info AI replace spaces with
underscores and use lowercase, for example `Matched pairs` becomes
`matched_pairs`.

## Identification, matching, demographics, and illness

| Source field | Working description | Format or observed coding | Evidence |
| --- | --- | --- | --- |
| `UID` | Unique record identifier | Text; 130 populated and 130 distinct | Observed |
| `CaCo` | Case/control status | Binary; 65 `1`, 65 `0`; guide identifies it as the case/control variable | Documented |
| `Matched pairs` | Matched-set identifier | Integer 1–65; every value occurs twice | Documented |
| `ClusterCode` | Legacy two-level cluster or grouping code | `1` or `2`; exact role not recovered | Unknown |
| `CDCCaseID` | CDC case identifier | Text; populated for 14 records | Inferred |
| `Age` | Age in years | Numeric; observed range 0–86 | Inferred |
| `Sex` | Sex code | `1`, `2`, or `9`; value labels not recovered | Inferred |
| `State` | Legacy numeric state code | 12 observed codes; lookup table not recovered | Inferred |
| `FirstSick` | Date first ill or symptom onset | Date; populated primarily for cases | Inferred |
| `FirstDiarrhea` | Date diarrhea began | Date | Inferred |

## Setting and general exposure questions

| Source field | Working description | Format or observed coding | Evidence |
| --- | --- | --- | --- |
| `Travel` | Travel exposure | Binary/unknown code | Inferred |
| `InstLiving` | Lived or stayed in an institution | Binary/unknown code | Inferred |
| `InstName` | Institution name | Free text | Inferred |
| `InstFood` | Ate food associated with an institution | Binary/unknown code | Inferred |
| `School` | School-related exposure | Binary/unknown code | Inferred |
| `Organic` | Organic-food exposure | Binary/unknown code | Inferred |
| `VegVeg` | Vegetarian or vegetable-related exposure | Binary/unknown code; exact question unknown | Unknown |
| `EatOut` | Ate food away from home | Binary/unknown code | Inferred |

## Chicken exposures

The Epi Info 7 guide explicitly identifies `AnyChkn` as the exposure used in
its matched-pair example. Meanings for the more detailed chicken fields are
inferred from their abbreviated names.

| Source field | Working description | Format or observed coding | Evidence |
| --- | --- | --- | --- |
| `AnyChkn` | Ate any chicken | Binary/unknown code; five blanks and three `9` values | Documented |
| `AnyFrshChkn` | Ate fresh chicken | Binary/unknown code | Inferred |
| `AnyFrznChkn1` | First legacy frozen-chicken question | Binary/unknown code | Inferred |
| `AnyFrznChkn2` | Second legacy frozen-chicken question | Binary/unknown code | Inferred |
| `AnyMicroChkn` | Ate microwaved chicken | Binary/unknown code | Inferred |
| `AnyMREChkn2` | Ate chicken in an MRE or similar prepared meal | Binary/unknown code; exact wording unknown | Inferred |
| `TouchRaw` | Touched raw chicken | Binary/unknown code | Inferred |
| `HouseRaw` | Raw chicken present or handled in the household | Binary/unknown code; exact wording unknown | Inferred |

## Apple or applesauce exposures

| Source field | Working description | Format or observed coding | Evidence |
| --- | --- | --- | --- |
| `Apple` | Apple or applesauce exposure | Binary/unknown code; exact food wording unknown | Inferred |
| `AppleMott` | Mott's brand indicator | Binary | Inferred |
| `AppleMussel` | Musselman's brand indicator | Binary | Inferred |
| `AppleStore1` | Store-brand indicator | Binary | Observed |
| `AppleStore2` | Store-brand name | Free text | Observed |
| `AppleBrandOther1` | Other-brand indicator | Binary | Observed |
| `AppleBrandOther2` | Other-brand description | Free text | Observed |
| `AppleUnk` | Brand unknown | Binary/unknown code | Inferred |
| `AppleReg` | Regular variety or flavor | Binary | Inferred |
| `AppleGranny` | Granny Smith variety | Binary | Inferred |
| `AppleNatural` | Natural variety or flavor | Binary | Inferred |
| `AppleStraw` | Strawberry flavor | Binary | Inferred |
| `AppleBerry` | Berry flavor | Binary | Inferred |
| `AppleBanana` | Banana flavor | Binary | Inferred |
| `ApplePear` | Pear flavor | Binary | Inferred |
| `AppleStrawBan` | Strawberry-banana flavor | Binary | Inferred |
| `AppleManPea` | Legacy apple flavor category | Binary; expansion not recovered | Unknown |
| `AppleFlavOther1` | Other-flavor indicator | Binary | Observed |
| `AppleFlavOther2` | Other-flavor description | Free text | Observed |

## Peanut exposures

| Source field | Working description | Format or observed coding | Evidence |
| --- | --- | --- | --- |
| `Pnut` | Ate peanuts | Binary/unknown code | Inferred |
| `PnutShell` | Peanuts in the shell | Binary | Inferred |
| `PnutNoShell` | Shelled peanuts | Binary | Inferred |
| `PnutUnkShell` | Shell status unknown | Binary | Inferred |
| `PnutWhole` | Whole peanuts | Binary | Inferred |
| `PnutCrush` | Crushed peanuts | Binary/unknown code | Inferred |
| `PnutUnk` | Peanut type unknown | Binary | Inferred |
| `PnutPlanter` | Planters brand | Binary | Inferred |
| `PnutStore1` | Store-brand indicator | Binary | Observed |
| `PnutStore2` | Store-brand name | Free text | Observed |
| `PnutBrandOther1` | Other-brand indicator | Binary | Observed |
| `PnutBrandOther2` | Other-brand description | Free text | Observed |
| `PnutBrandUnk` | Brand unknown | Binary | Inferred |
| `PnutHoney` | Honey-roasted or honey-flavored peanuts | Binary | Inferred |
| `PnutSalt` | Salted peanuts | Binary | Inferred |
| `PnutUnSalt` | Unsalted peanuts | Binary | Inferred |
| `PnutBBQ` | Barbecue-flavored peanuts | Binary | Inferred |
| `PnutFlavOther1` | Other-flavor indicator | Binary | Observed |
| `PnutFlavOther2` | Other-flavor description | Free text | Observed |

## Peanut butter exposures

| Source field | Working description | Format or observed coding | Evidence |
| --- | --- | --- | --- |
| `PB` | Ate peanut butter | Binary/unknown code; two blanks and three `9` values | Inferred |
| `PBJif` | Jif brand | Binary | Inferred |
| `PBSkippy` | Skippy brand | Binary | Inferred |
| `PBSmuck` | Smucker's brand | Binary | Inferred |
| `PBReese` | Reese's brand | Binary | Inferred |
| `PBPeterPan` | Peter Pan brand | Binary | Inferred |
| `PBBrandOther1` | Other-brand indicator | Binary | Observed |
| `PBBrandOther2` | Other-brand description | Free text | Observed |
| `PBBrandUnk` | Brand unknown | Binary | Inferred |
| `PBCream` | Creamy peanut butter | Binary | Inferred |
| `PBCrunch` | Crunchy peanut butter | Binary | Inferred |
| `PBKindOther1` | Other-kind indicator | Binary | Observed |
| `PBKindOther2` | Other-kind description | Free text | Observed |
| `PBKindUnk` | Peanut-butter kind unknown | Binary | Inferred |
| `PBJar` | Peanut butter eaten from or supplied in a jar | Binary/unknown code; exact wording unknown | Inferred |
| `PBBake` | Peanut butter in baked food | Binary/unknown code | Inferred |
| `PBPrePackOther1` | Other prepackaged peanut-butter food indicator | Binary/unknown code | Observed |
| `PBPrePackOther2` | Other prepackaged peanut-butter food description | Free text | Observed |

## Potato chip exposures

| Source field | Working description | Format or observed coding | Evidence |
| --- | --- | --- | --- |
| `Chips` | Ate potato chips or similar chips | Binary/unknown code; exact scope unknown | Inferred |
| `ChipsBakedLays` | Baked Lay's brand/type | Binary | Inferred |
| `ChipsOrigLays` | Original Lay's brand/type | Binary | Inferred |
| `ChipsPringle` | Pringles brand | Binary/unknown code | Inferred |
| `ChipsKettle` | Kettle brand/type | Binary | Inferred |
| `ChipsWise` | Wise brand | Binary | Inferred |
| `ChipsVicki` | Miss Vickie's brand | Binary | Inferred |
| `ChipsBrandOther1` | Other-brand indicator | Binary | Observed |
| `ChipsBrandOther2` | Other-brand description | Free text | Observed |
| `ChipsBrandUnk` | Brand unknown | Binary | Inferred |
| `ChipsPlain` | Plain flavor | Binary/unknown code | Inferred |
| `ChipsBBQ` | Barbecue flavor | Binary | Inferred |
| `ChipsSourOnion` | Sour cream and onion flavor | Binary | Inferred |
| `ChipsSaltVin` | Salt and vinegar flavor | Binary | Inferred |
| `ChipsCheddar` | Cheddar flavor | Binary | Inferred |
| `ChipsFlavOther1` | Other-flavor indicator | Binary | Observed |
| `ChipsFlavOther2` | Other-flavor description | Free text | Observed |
| `ChipsFlavUnk` | Flavor unknown | Binary | Inferred |

## Pizza exposures

| Source field | Working description | Format or observed coding | Evidence |
| --- | --- | --- | --- |
| `Pizza` | Ate pizza | Binary/unknown code | Inferred |
| `PizzaPepp` | Pepperoni topping | Binary | Inferred |
| `PizzaSaus` | Sausage topping | Binary | Inferred |
| `PizzaGreenPep` | Green-pepper topping | Binary | Inferred |
| `PizzaOnion` | Onion topping | Binary | Inferred |
| `PizzaMushrm` | Mushroom topping | Binary | Inferred |
| `PizzaTopOther1` | Other-topping indicator | Binary | Observed |
| `PizzaTopOther2` | Other-topping description | Free text | Observed |
| `PizzaTopUnk` | Topping unknown | Binary | Inferred |
| `PizzaDiGio` | DiGiorno brand | Binary/unknown code | Inferred |
| `PizzaTotino` | Totino's brand | Binary | Inferred |
| `PizzaStouff` | Stouffer's brand | Binary | Inferred |
| `PizzaTony` | Tony's brand | Binary | Inferred |
| `PizzaFresch` | Freschetta brand | Binary | Inferred |
| `PizzaCali` | California Pizza Kitchen brand | Binary | Inferred |
| `PizzaRedBar` | Red Baron brand | Binary | Inferred |
| `PizzaTomb` | Tombstone brand | Binary/unknown code | Inferred |
| `PizzaBrandOther1` | Other-brand indicator | Binary/unknown code | Observed |
| `PizzaBrandOther2` | Other-brand description | Free text | Observed |
| `PizzaBrandUnk` | Brand unknown | Binary | Inferred |

## Import artifact

| Source field | Working description | Format or observed coding | Evidence |
| --- | --- | --- | --- |
| `Column1` | Empty trailing spreadsheet column | Blank in all 130 records; exclude from analysis | Observed |

## Variables used in the command tour

| Analytical role | Source field | Epi Info AI name | Why it is reviewed |
| --- | --- | --- | --- |
| Record identifier | `UID` | `uid` | Confirms that individual rows are unique; it is not the matched-set key |
| Outcome | `CaCo` | `caco` | Confirms the case/control balance and assigns one case and one control per valid pair |
| Matched-set key | `Matched pairs` | `matched_pairs` | Confirms that each pair identifier occurs exactly twice |
| Descriptive variable | `Age` | `age` | Gives demographic context and can reveal implausible or missing ages |
| Exposure | `AnyChkn` | `anychkn` | Reproduces the guide's chicken-exposure analysis and reveals missing/non-binary values before matching |

## Provenance and remaining work

The documented roles and matched-pair example come from the archived
[Epi Info 7 User Guide](https://archive.cdc.gov/www_cdc_gov/epiinfo/pdfs/userguide/EI7Full.pdf).
The working interpretations were checked against the headers and observed values
in the supplied workbook. Recovering the original questionnaire, Epi Info form,
or a contemporary codebook would allow the inferred definitions and value labels
to be replaced with authoritative wording.
