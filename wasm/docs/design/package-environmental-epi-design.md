# Environmental Epidemiology package design inputs

Status: exploratory design narrative. The bounded v0.1 demonstration implemented
on 2026-09-24 is narrower and is recorded in
[`../demo-runbook-environmental-epidemiology.md`](../demo-runbook-environmental-epidemiology.md)
and the
[`environmental-epidemiology`](../../demo/examples/environmental-epidemiology/README.md)
teaching-project folder. The capability package and teaching project are
separate imports. Provider access, exposure assignment, causal analysis, and
K09 advanced spatial statistics remain unimplemented and unapproved.

This document retains broader design inputs for later review. They are not a
statement of current product capability.

If we imagine an **Environmental Epidemiology package for Epi Info AI**, I would not make it simply “Epi Info + maps.” I would make the organizing concept:

> **Link people, place, time, and environmental exposure—then apply epidemiologic methods to quantify health effects.**

That would give Epi Info a genuinely distinct environmental-health capability.

## 1. The package's conceptual model

Environmental epidemiology adds another dimension to traditional Epi Info.

Classic Epi Info:

```text
PERSON
  │
  ├── exposure
  └── outcome
       │
       ▼
 epidemiologic analysis
```

Environmental epidemiology:

```text
             PERSON
               │
        ┌──────┼──────┐
        │      │      │
       PLACE   TIME   OUTCOME
        │      │
        └──┬───┘
           │
      ENVIRONMENT
           │
 ┌─────────┼─────────────┐
 ▼         ▼             ▼
air       water         climate
soil      chemicals     built environment
noise     radiation     occupational
           │
           ▼
     EXPOSURE ESTIMATE
           │
           ▼
    HEALTH-EFFECT ANALYSIS
```

That **exposure-estimation layer** is what would make the package different from ordinary statistical software.

---

# 2. I would call it something like Epi Info Environment

At the product level:

```text
Epi Info AI
│
├── Enter / Forms
├── Analyze
├── Visualize
├── Environmental Health
│     ├── Exposure
│     ├── Spatial Linkage
│     ├── Time Linkage
│     ├── Environmental Data
│     ├── Environmental Analysis
│     └── Maps
│
└── AI Assistant
```

But architecturally it should be a package:

```text
Epi Info Core
      │
      ├── epi.analysis
      ├── epi.statistics
      ├── epi.mapping
      │
      └── epi.environment
```

That prevents environmental-health requirements from bloating the core runtime.

---

# 3. The heart of it would be an Exposure Workbench

Imagine opening a case dataset:

```text
Asthma_ED_Visits.duckdb

PatientID
VisitDate
Latitude
Longitude
Age
Sex
Asthma
```

and then choosing:

### Add Environmental Exposure

```text
┌─────────────────────────────────────────┐
│ Add Exposure                            │
│                                         │
│ Exposure:  PM2.5                        │
│ Source:    EPA Air Quality System       │
│                                         │
│ Exposure period                         │
│ ○ Same day                              │
│ ● Previous 3 days                       │
│ ○ Previous 7 days                       │
│ ○ Custom                                │
│                                         │
│ Assignment                              │
│ ● Nearest monitor                       │
│ ○ Within 10 km                          │
│ ○ Spatial interpolation                 │
│ ○ Area average                          │
│                                         │
│             [Calculate Exposure]        │
└─────────────────────────────────────────┘
```

The resulting dataset might gain:

```text
PM25_DAY0
PM25_LAG1
PM25_LAG2
PM25_LAG3
PM25_3DAY_MEAN
PM25_MONITOR_DISTANCE
PM25_DATA_QUALITY
```

That is the kind of functionality that transforms GIS/data integration into an **epidemiologic exposure-assessment tool**.

---

# 4. Connect directly to authoritative environmental datasets

This is where browser-based Epi Info becomes particularly interesting.

CDC's Environmental Public Health Tracking Network already integrates environmental, health, and socioeconomic information and makes machine-readable data available through APIs. ([CDC][1])

EPA's AQS contains air-pollution observations from thousands of monitors and provides APIs and downloadable hourly/daily/annual data. ([US EPA][2])

NOAA/NCEI also exposes weather and climate observations programmatically through its Climate Data Online APIs. ([NCEI][3])

So imagine:

```text
                   Epi Info Environment
                            │
       ┌────────────────────┼─────────────────────┐
       ▼                    ▼                     ▼
 CDC Tracking             EPA                  NOAA
    API                   AQS                  NCEI
       │                    │                     │
       └────────────────────┼─────────────────────┘
                            ▼
                     environmental
                         dataset
                            │
                            ▼
                      DuckDB-Wasm
```

Potential connectors could eventually include:

```text
CDC Environmental Tracking
EPA AQS / AirData
AirNow
NOAA weather/climate
state environmental agencies
local sensor networks
uploaded CSV/Parquet
NetCDF
GeoJSON
Shapefile
user sensor data
laboratory measurements
```

The package should not hard-code the United States, either.

Define a provider interface:

```typescript
interface EnvironmentalDataProvider {
    search(...): Promise<DataSet[]>;
    fetch(...): Promise<EnvironmentalData>;
}
```

Then other countries could add their own environmental datasets.

---

# 5. Space becomes a first-class epidemiologic variable

Environmental epidemiology is inherently spatial.

The browser stack you already have is surprisingly well positioned for this because **DuckDB-Wasm supports the spatial extension**, including geometry operations such as `ST_Within`, `ST_Distance`, `ST_DWithin`, intersections, and geodesic distance calculations. ([DuckDB][4])

That means operations like:

### Distance to source

```text
Residence
    │
    │ 3.2 km
    ▼
Industrial facility
```

### Buffer exposure

```text
             5 km buffer
        ┌──────────────────┐
        │                  │
        │       ● home     │
        │                  │
        │     ▲ facility   │
        └──────────────────┘
```

### Polygon assignment

```text
Patient coordinates
       │
       ▼
census tract / ZIP / county
       │
       ▼
area-level exposure
```

### Nearest monitor

```text
Patient
   ●
    \
     \ 4.7 km
      \
       ● PM2.5 monitor
```

could all execute locally.

CDC's Field Epidemiology Manual explicitly identifies spatial overlays, interpolation, spatial regression and cluster analysis as useful epidemiologic methods for evaluating geographic risk patterns. ([CDC][5])

---

# 6. Time should be just as important as space

This is where I would make the package particularly epidemiologic.

A GIS program can tell you:

> Patient lives 3 km from monitor #123.

Environmental epidemiology asks:

> What was that patient's exposure **during the biologically relevant time window**?

For example:

```text
Asthma ED visit
September 18
      │
      ▼

PM2.5
───────────────
Sep 18   42
Sep 17   38
Sep 16   33
Sep 15   18
Sep 14   12
```

Then automatically derive:

```text
lag0 = 42
lag1 = 38
lag2 = 33
lag3 = 18

mean_lag0_2 = 37.7
max_lag0_3  = 42
```

I'd make **exposure windows** a first-class AST concept:

```json
{
  "type": "EnvironmentalExposure",
  "pollutant": "PM2.5",
  "location": "Residence",
  "eventDate": "VisitDate",
  "window": {
    "startLag": 0,
    "endLag": 3
  },
  "aggregation": "mean"
}
```

Now you've codified environmental epidemiology, not merely written SQL.

---

# 7. Environmental-specific study designs

The analysis package should understand common designs explicitly.

### Cross-sectional

```text
Exposure at location
       ↓
current health outcome
```

### Cohort

```text
historical exposure
       ↓
follow-up
       ↓
disease occurrence
```

### Case-control

```text
Cases      Controls
   \         /
    exposure history
```

### Case-crossover

This one would be especially valuable for acute environmental exposures:

```text
              SAME PERSON

        control days       case day
        ────────────       ────────
PM2.5        12                48
heat         84°F              99°F
                              │
                              ▼
                         asthma event
```

The person effectively serves as their own control.

That is useful for:

```text
heat
air pollution
wildfire smoke
acute chemical releases
short-term exposure events
```

### Time-series studies

```text
Daily exposure
PM2.5 ────────────────

Daily health events
Asthma ───────────────

       ↓
temporal association
```

### Spatial/ecologic studies

```text
County exposure
      +
County disease rate
      +
Population covariates
```

These should appear as epidemiologic methods, not generic statistical menu items.

---

# 8. Add environmental-health statistical methods

An initial package could use the existing Epi Info analytic core and gradually add methods such as:

```text
2×2 analysis
logistic regression
linear regression
Poisson regression
negative-binomial regression

standardization
age-adjusted rates

correlation

spatial smoothing
spatial autocorrelation
cluster detection

exposure-response models

lagged exposure models
moving averages

case-crossover analysis
time-series analysis
```

Later, more specialized environmental methods could include:

```text
distributed lag models

generalized additive models

spline exposure-response curves

mixture analysis

multiple-pollutant models

measurement-error sensitivity analysis
```

I wouldn't put all of those in version 1.

The first package should emphasize **field-useful methods**.

---

# 9. Heat epidemiology would make an excellent first vertical

Imagine:

## Heat & Health

```text
Patient/event data
        +
NOAA weather
        +
location
        ↓
daily temperature exposure
        ↓
heat index
        ↓
lagged exposure
        ↓
health outcomes
```

A user could ask:

> Compare emergency department visits on extreme-heat days with normal-temperature days.

Epi Info AI might construct:

```text
ENV EXPOSURE Temperature
    LOCATION Residence
    DATE VisitDate
    SOURCE NOAA

DEFINE ExtremeHeat =
    Temperature >= 95

TABLES ExtremeHeat EDVisit
```

Or:

> Is the effect stronger among people over 65?

which becomes:

```text
TABLES ExtremeHeat EDVisit
    STRATAVAR=Age65Plus
```

This is exactly where the old Epi Info model and the new AI model meet nicely.

---

# 10. Air pollution would be another natural vertical

EPA AQS provides monitor-based ambient air pollution data programmatically. ([US EPA][2])

The package could support:

```text
PM2.5
PM10
O3
NO2
SO2
CO
```

with workflows like:

```text
Cases
  │
  ├── coordinates
  └── event date
         │
         ▼
Environmental Exposure Engine
         │
         ├── nearest monitor
         ├── distance threshold
         ├── temporal matching
         └── lag computation
                 │
                 ▼
              PM2.5
                 │
                 ▼
             analysis
```

And preserve provenance:

```text
ExposureSource = "EPA AQS"
StationID      = ...
DistanceKm     = 4.83
MeasurementDate = ...
Method         = "nearest_monitor"
```

This matters enormously for reproducibility.

---

# 11. Chemical exposure / biomonitoring

CDC Tracking already provides biomonitoring data intended to help characterize exposure to environmental chemicals, identify sensitive populations, and evaluate exposure reduction. ([CDC][1])

An Epi Info package could support biological measurements:

```text
blood lead
urinary arsenic
PFAS
mercury
cadmium
pesticide metabolites
```

with concepts such as:

```text
LOD
LOQ
below-detection handling
creatinine correction
lipid adjustment
sample date
specimen type
laboratory method
```

This suggests a specialized type:

```text
EnvironmentalMeasurement
```

rather than treating every value as a plain numeric field.

For example:

```json
{
  "analyte": "Lead",
  "value": 3.2,
  "unit": "ug/dL",
  "lod": 0.1,
  "specimen": "blood"
}
```

That type information could prevent a lot of analytical mistakes.

---

# 12. Exposure provenance should be built into the data model

This might be one of the most important innovations.

For every derived exposure:

```text
PM25_3DAY_MEAN = 37.7
```

Epi Info should know:

```text
Where did 37.7 come from?
```

So maintain:

```text
Exposure value
       │
       ├── source dataset
       ├── provider
       ├── version
       ├── retrieval date
       ├── spatial method
       ├── temporal method
       ├── units
       ├── transformations
       └── quality flags
```

Conceptually:

```json
{
  "variable": "PM25_3DAY_MEAN",
  "source": "EPA AQS",
  "method": {
    "spatial": "nearest-monitor",
    "maxDistanceKm": 25,
    "temporal": "lag-0-2-mean"
  },
  "units": "ug/m3"
}
```

That creates **reproducible exposure assessment**.

---

# 13. AI becomes especially useful here

Environmental-health analysis often requires assembling many steps.

A user could say:

> Investigate whether asthma ED visits were associated with PM2.5 during the three days before the visit.

Epi Info AI could break that down:

```text
1. Identify outcome
   Asthma ED visit

2. Identify location
   patient residence

3. Identify event date
   VisitDate

4. Retrieve exposure
   EPA PM2.5

5. Perform spatial linkage
   nearest monitor within 25 km

6. Perform temporal linkage
   event day through lag 3

7. Calculate exposure
   four-day mean

8. Analyze
   regression / case-crossover

9. Visualize
   exposure-response
```

But again:

```text
AI
 ↓
AST
 ↓
validation
 ↓
deterministic Epi Info execution
```

The AI shouldn't invent calculations.

---

# 14. The assistant could teach environmental epidemiology while doing it

This connects directly with your **codified epidemiology knowledge** argument.

Suppose someone asks:

> Find people living within five miles of the factory.

The AI might respond operationally:

```text
BUFFER source by 5 miles
SPATIAL JOIN residences
```

but also recognize:

> Proximity is being used as an exposure surrogate; it does not establish individual dose.

That is domain knowledge.

Or if someone requests:

> Compare county asthma rates with county PM2.5.

Epi Info could flag:

> This is an ecological analysis. Association at the county level should not automatically be interpreted as an individual-level association.

That's precisely where **Epi Info AI could encode good epidemiologic practice rather than merely expose functions**.

---

# 15. Maps would be investigative, not decorative

Environmental maps should answer questions.

Examples:

### Exposure map

```text
PM2.5 concentration
high ██████
     ████
     ██
low  █
```

### Case overlay

```text
PM2.5 surface

      ● cases
 ●       ●
        ●
```

### Distance analysis

```text
Facility ▲

  1 km ─────
  3 km ─────────
  5 km ─────────────

Cases ● ● ●
```

### Space-time animation

```text
Day 1 → Day 2 → Day 3 → Day 4

Smoke plume
      +
ED visits
```

The map should be linked directly to the analytical dataset:

```text
select on map
      ↓
filter records
      ↓
analyze selection
```

---

# 16. Environmental investigation templates

I'd ship ready-made investigation packages.

For example:

```text
Environmental Epi Templates
───────────────────────────

Air pollution & asthma

Heat-related illness

Lead exposure investigation

Drinking-water contamination

Chemical release

Wildfire smoke

Occupational exposure

Vector/environment interaction

Radiation exposure

Community environmental concern

Cancer cluster preliminary assessment
```

Each template could provide:

```text
data-entry form
+
recommended variables
+
exposure workflow
+
analysis program
+
report template
```

This is very Epi Info-like.

---

# 17. The technical architecture fits what you're already building

I would imagine:

```text
                    Epi Info AI
                         │
                         ▼
                      AST
                         │
          ┌──────────────┼───────────────┐
          ▼              ▼               ▼
       Core Epi        ENV AST         AI AST
                         │
                         ▼
              Environmental Engine
                         │
        ┌────────────────┼─────────────────┐
        ▼                ▼                 ▼
     Spatial          Temporal          Exposure
     Engine            Engine            Engine
        │                │                 │
        └────────────────┼─────────────────┘
                         ▼
                    DuckDB-Wasm
                         │
                    Spatial ext.
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
    Local files       Web APIs          OPFS
    Parquet/CSV    CDC/EPA/NOAA        workspace
```

DuckDB-Wasm already supports its spatial extension in the browser, which makes this significantly less hypothetical than it might initially sound. ([DuckDB][4])

---

# 18. I would create new Epi Info environmental language constructs

Instead of making users write SQL like:

```sql
SELECT ...
FROM cases c
JOIN monitors m
ON ST_DWithin_Spheroid(...)
```

give them epidemiologic vocabulary.

For example:

```text
EXPOSURE PM25
    SOURCE EPA_AQS
    LOCATION Residence
    DATE VisitDate
    METHOD NEAREST
    MAXDISTANCE 25 KM
    WINDOW 0 TO 3 DAYS
    AGGREGATE MEAN
    INTO PM25_4DAY
END-EXPOSURE
```

Then:

```text
REGRESS AsthmaVisit =
    PM25_4DAY +
    Age +
    Sex +
    Temperature
```

Or a simple version:

```text
ENVLINK PM25
    LOCATION=Residence
    DATE=VisitDate
    LAG=0:3
```

The AST could represent all of this cleanly.

---

# 19. A compelling end-to-end example

Imagine an epidemiologist receives:

```text
asthma_visits.csv
```

containing:

```text
PatientID
Date
Latitude
Longitude
Age
Sex
```

They ask:

> Were these asthma visits associated with wildfire smoke?

Epi Info AI:

```text
                        User
                          │
          "Were visits associated
            with wildfire smoke?"
                          │
                          ▼
                    Epi Info AI
                          │
                          ▼
                Environmental AST
                          │
       ┌──────────────────┼───────────────────┐
       ▼                  ▼                   ▼
   get smoke            get PM2.5        get weather
    exposure              data               data
       │                  │                   │
       └──────────────────┼───────────────────┘
                          ▼
                 spatial-temporal
                     linkage
                          │
                          ▼
                     DuckDB
                          │
                          ▼
                   analysis dataset
                          │
                 ┌────────┴────────┐
                 ▼                 ▼
             statistics           map
                 │
                 ▼
             interpretation
```

And then outputs:

```text
Exposure definition
───────────────────
Wildfire smoke / PM2.5 exposure during
the 3 days preceding each ED visit.

Data quality
────────────
92% of records linked to an air monitor
within 20 km.

Analysis
────────
...

Limitations
───────────
Monitor-derived PM2.5 represents ambient
rather than individual exposure.
```

That last section matters as much as the p-value.

---

# 20. I would make uncertainty visible

Environmental epidemiology is full of uncertainty:

```text
Where was the person actually located?

How far was the monitor?

Was exposure indoor or outdoor?

Were measurements missing?

Was the pollutant modeled or measured?

What was the relevant exposure window?
```

So every environmental variable could carry a quality indicator:

```text
PM25 = 32.4 µg/m³

Exposure confidence
████████░░  High

Monitor distance: 2.4 km
Observed data: 100%
Temporal coverage: 100%
```

For another record:

```text
Exposure confidence
████░░░░░░  Low

Monitor distance: 47 km
2 of 4 days imputed
```

That would be genuinely useful.

---

# 21. Privacy becomes particularly important

Addresses and exact locations can be highly sensitive.

I'd therefore separate:

```text
Raw location
     │
     ▼
local spatial processing
     │
     ▼
derived geography/exposure
     │
     ▼
analysis
```

For example:

```text
123 Main Street
      │
      X  not sent to AI
      │
      ▼
local geocode / coordinates
      │
      ▼
PM25 exposure = 18.2
      │
      ▼
AI can see 18.2 if permitted
```

External geocoding should be clearly identified as an external-data transfer.

---

# 22. What I would build first

I wouldn't attempt the whole environmental field immediately.

### Environmental Package 1.0

I'd choose four capabilities:

| Capability                       | Why                        |
| -------------------------------- | -------------------------- |
| **Spatial linkage**              | foundational               |
| **Temporal exposure windows**    | uniquely environmental-epi |
| **EPA/NOAA/CDC data connectors** | immediately useful         |
| **Exposure provenance**          | scientific reproducibility |

Then three demonstration scenarios:

```text
1. PM2.5 + asthma

2. Extreme heat + ED visits

3. Facility proximity + health outcome
```

And only a few new AST primitives:

```text
ENVIMPORT
SPATIALJOIN
DISTANCE
BUFFER
EXPOSURE
LAG
```

Everything else can use existing Epi Info analysis.

---

# Where I think this could become distinctive

Generic AI can answer:

> “What is the health effect of PM2.5?”

GIS software can answer:

> “Which homes are within 5 km of this facility?”

Statistical software can answer:

> “What is the coefficient from this regression?”

An **Epi Info Environmental Epidemiology package** could answer the applied question:

> **“Given these people, these health events, these locations, and these environmental measurements, construct a defensible exposure estimate, analyze its relationship to disease, show me where the uncertainty lies, and preserve exactly how the analysis was performed.”**

That is much closer to the actual practice of environmental epidemiology.

And it fits the philosophy you've been developing around Epi Info AI: **codify the epidemiologic method, not merely the software function.** The Environmental package would encode *how an environmental epidemiologist thinks about person + place + time + exposure + outcome*, while WASM, DuckDB and AI are simply the machinery underneath it.

[1]: https://www.cdc.gov/environmental-health-tracking/php/data-research/biomonitoring.html?utm_source=chatgpt.com "Biomonitoring: Population Exposures | Tracking Program | CDC"
[2]: https://www.epa.gov/aqs/obtaining-aqs-data?utm_source=chatgpt.com "Obtaining AQS Data | US EPA"
[3]: https://www.ncdc.noaa.gov/cdo-web/webservices/v2?utm_source=chatgpt.com "Web Services API (version 2) Documentation | Climate Data Online (CDO) | National Climatic Data Center (NCDC)"
[4]: https://duckdb.org/docs/current/clients/wasm/extensions?utm_source=chatgpt.com "Load Extensions – DuckDB"
[5]: https://www.cdc.gov/field-epi-manual/php/chapters/gis-data.html?utm_source=chatgpt.com "Geographic Information System Data | Field Epi Manual | CDC"

# About C3S

Yes—if you mean the **Copernicus C3S Atlas** (Copernicus Climate Change Service Interactive Climate Atlas), I think it could become one of the most valuable data sources for an Epi Info Environmental Epidemiology package.

In some respects, it is more strategically interesting than individual EPA/NOAA connectors because it gives Epi Info a **global climate-exposure layer plus historical and future climate projections**.

The C3S Atlas is backed by a downloadable gridded dataset combining observations, reanalysis—including ERA5 and ERA5-Land—and CMIP5/CMIP6/CORDEX climate projections. The current dataset provides **35 climate variables and indices**, is global for many products, and covers roughly 1940–present for observation/reanalysis products and up to 2100 for projections, depending on the source. ([Climate Data Store][1])

## This changes the environmental package

My earlier model was mostly:

```text
PERSON
  +
PLACE
  +
TIME
  +
measured environmental exposure
  ↓
health analysis
```

C3S lets us extend it to:

```text
                    EPI INFO ENVIRONMENT

                         PERSON
                           │
                  ┌────────┼────────┐
                  ▼        ▼        ▼
                PLACE     TIME    OUTCOME
                  │        │
                  └────┬───┘
                       ▼
                 CLIMATE EXPOSURE
                       │
        ┌──────────────┼───────────────┐
        ▼              ▼               ▼
    Historical       Current        Projected
        │              │               │
      ERA5          Reanalysis       CMIP6
    ERA5-Land                        CORDEX
        │                              │
        ▼                              ▼
 health-effect                  climate-health
   analysis                        scenarios
```

That last branch is particularly interesting.

Epi Info could move from:

> “Was heat associated with these deaths?”

to:

> “How would the population exposed to hazardous heat change under different future climate scenarios?”

That's a substantial expansion of what Epi Info could support.

### Health-relevant C3S Atlas variables

The Atlas already has many variables that translate naturally into environmental epidemiology, including monthly temperature, maximum/minimum temperature, extreme hot days over 35°C, very extreme hot days over 40°C, tropical nights, frost days, precipitation, heavy precipitation, drought indices, soil moisture, wind, humidity-related variables and solar radiation. ([Climate Data Store][1])

You could organize them in Epi Info as:

| Environmental-health domain | C3S variables                                      |
| --------------------------- | -------------------------------------------------- |
| **Heat**                    | Tmax, Tmin, extreme hot days, tropical nights      |
| **Cold**                    | Tmin, frost days, heating degree-days              |
| **Flooding**                | heavy precipitation, 1-day/5-day max precipitation |
| **Drought**                 | SPI, SPEI, consecutive dry days                    |
| **Vector ecology**          | temperature, precipitation, humidity               |
| **Wildfire conditions**     | heat, drought, wind, soil moisture                 |
| **UV/solar**                | surface solar radiation                            |
| **Water/environment**       | precipitation, runoff, evapotranspiration          |
| **Agricultural health**     | drought, soil moisture, temperature                |

And C3S separately maintains **ERA5-HEAT**, including the Universal Thermal Climate Index (UTCI), specifically useful for human thermal stress. Copernicus uses UTCI categories from no thermal stress through moderate, strong, very strong, and extreme heat stress. ([Copernicus Climate Change Service][2])

That would be excellent for an Epi Info **Heat & Health** module.

## One important distinction: C3S Atlas versus ERA5

I would use both, but for different purposes.

The Atlas dataset is primarily **monthly/annual**. That's excellent for:

```text
long-term climate exposure
climatology
historical trends
regional comparisons
chronic exposure
climate projections
climate vulnerability
```

But consider an epidemiologist investigating:

> Did yesterday's extreme heat contribute to today's ED visits?

Monthly Atlas data are too coarse.

For that you would want:

```text
ERA5
ERA5-Land
ERA5-HEAT
```

at daily/hourly resolutions.

So I'd design:

```text
             Copernicus Provider

                    │
         ┌──────────┴──────────┐
         ▼                     ▼
     C3S Atlas                ERA5
         │                     │
     climate-scale          event-scale
     monthly/yearly         hourly/daily
         │                     │
         ▼                     ▼
 projections/trends       acute exposures
```

The Atlas becomes the **climate context and projection engine**, while ERA5 handles detailed retrospective exposure assignment.

---

# Imagine this in Epi Info

An epidemiologist has:

```text
heat_deaths.csv

DeathID
Date
Latitude
Longitude
Age
Sex
Cause
```

They choose:

### Add Climate Exposure

```text
┌──────────────────────────────────────────────┐
│ Copernicus Climate Exposure                  │
│                                              │
│ Variable                                     │
│ [ Extreme Heat ▼ ]                           │
│                                              │
│ Dataset                                      │
│ ● ERA5-HEAT                                  │
│ ○ ERA5-Land                                  │
│ ○ C3S Climate Atlas                          │
│                                              │
│ Metric                                       │
│ [ UTCI ▼ ]                                   │
│                                              │
│ Exposure window                              │
│ Day 0 through Day -3                         │
│                                              │
│ [ Add Exposure ]                             │
└──────────────────────────────────────────────┘
```

Epi Info does:

```text
case coordinates
       +
case date
       │
       ▼
Copernicus grid
       │
       ▼
extract UTCI
       │
       ▼
calculate lag 0–3
       │
       ▼
append exposure variables
```

producing:

```text
UTCI_LAG0
UTCI_LAG1
UTCI_LAG2
UTCI_LAG3
UTCI_MAX_4DAY
HEAT_STRESS_CATEGORY
```

And then:

```text
TABLES HeatStress Death
```

or a more appropriate regression/case-crossover analysis.

---

# But the Atlas creates something entirely new: future epidemiology

Suppose a health department has historical heat mortality.

You could analyze:

```text
1990–2025
observed/reanalysis
       │
       ▼
exposure-response relationship
```

Then use C3S projections:

```text
CMIP6

SSP1-2.6
SSP2-4.5
SSP3-7.0
SSP5-8.5
```

The C3S Atlas provides those SSP scenarios among its projections. ([Climate Data Store][1])

Now Epi Info could support:

```text
              Historical health data
                       │
                       ▼
              exposure-response model
                       │
                       ▼
                 C3S projections
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
       2030s         2050s        2080s
          │            │            │
          ▼            ▼            ▼
     projected health burden
```

For example:

> How many additional days of extreme heat could Fulton County experience by 2050 under SSP2-4.5?

Or more epidemiologically:

> Given the observed heat-mortality relationship, estimate how the heat-attributable burden could change under specified climate scenarios.

You'd want careful uncertainty language around this, of course, because it becomes **scenario-based projection**, not prediction.

---

# I would create a `CLIMATE` AST family

Because you already have the Epi Info AST, I would encode these concepts rather than make users manipulate NetCDF.

Something like:

```text
CLIMATE EXPOSURE Heat
    SOURCE COPERNICUS
    DATASET ERA5_HEAT
    VARIABLE UTCI
    LOCATION Residence
    DATE EventDate
    WINDOW 0 TO 3 DAYS
    AGGREGATE MAX
    INTO HeatExposure
END-CLIMATE
```

AST:

```json
{
  "type": "ClimateExposure",
  "provider": "Copernicus",
  "dataset": "ERA5_HEAT",
  "variable": "UTCI",
  "location": "Residence",
  "date": "EventDate",
  "window": {
    "startLag": 0,
    "endLag": 3
  },
  "aggregation": "max",
  "output": "HeatExposure"
}
```

Now natural language becomes easy:

> Add maximum heat stress during the three days before each visit.

```text
AI
 ↓
ClimateExposure AST
 ↓
validator
 ↓
Copernicus provider
 ↓
exposure variables
```

Again, the AI isn't doing climate science. It is selecting a deterministic, documented analysis operation.

---

# We could have another AST for climate scenarios

Perhaps:

```text
CLIMATE PROJECT
    VARIABLE ExtremeHotDays
    REGION County
    BASELINE 1991-2020
    PERIOD 2041-2060
    SCENARIO SSP2-4.5
END-CLIMATE
```

Internally:

```json
{
  "type": "ClimateProjection",
  "variable": "ExtremeHotDays",
  "baseline": [1991, 2020],
  "projectionPeriod": [2041, 2060],
  "scenario": "SSP2-4.5"
}
```

That is **codified climate epidemiology** in exactly the same sense we've been discussing for traditional Epi Info.

---

# The data engineering is also favorable

The underlying C3S Atlas dataset is standardized as:

```text
NetCDF4
CF metadata
regular lat/lon grids
```

and currently exposes STAC metadata as well. ([Climate Data Store][1])

That lends itself well to a provider architecture:

```text
Epi Info
    │
    ▼
CopernicusProvider
    │
    ├── catalogue / STAC
    ├── CDS retrieval
    └── local cache
           │
           ▼
       NetCDF
           │
           ▼
    preprocessing
           │
           ▼
       Parquet
           │
           ▼
     DuckDB-Wasm
```

I probably would **not repeatedly query raw NetCDF directly for interactive Epi Info work**.

I'd convert relevant subsets to something more browser-friendly:

```text
NetCDF
   ↓
subset
   ↓
Arrow / Parquet
   ↓
DuckDB-Wasm
```

Then Epi Info could cache something like:

```text
Georgia_PM25...
Georgia_ERA5_temperature_2020_2026.parquet
```

locally.

---

## There is one integration wrinkle

The CDS API currently requires a registered account/API token, and individual datasets can require acceptance of their terms before programmatic download. The conventional client is Python; ECMWF also exposes newer REST/catalogue APIs, though it currently characterizes the advanced client as incubating. ([Climate Data Store][3])

So I would not initially have the browser blindly make massive CDS download requests.

I'd design:

```text
                Epi Info Browser
                       │
                       ▼
             Climate Data Service
                       │
            ┌──────────┴──────────┐
            ▼                     ▼
      cached common data       CDS jobs
            │                     │
            ▼                     ▼
         Parquet               NetCDF
```

Importantly, the service doesn't need patient data.

It gets:

```text
variable
bounding box
date range
resolution
```

not:

```text
patient ID
address
health outcome
```

All person-level linkage can still occur locally inside Epi Info.

---

# Copernicus also already thinks in health terms

This isn't us forcing a generic climate system into epidemiology.

C3S has operated a **European Health Service** focused specifically on climate-health indicators involving heat/cold stress, vector-borne diseases, and allergenic pollen. ([Copernicus Climate Change Service][4])

And its newer **Thermal Trace** application uses more than 80 years of heat/cold-stress information with explicit emphasis on heat-health monitoring. ([Copernicus Climate Change Service][5])

So I would add another set of Epi Info environmental verticals:

```text
Epi Info Environment
│
├── Air Quality
│
├── Heat & Health
│      └── Copernicus ERA5-HEAT
│
├── Climate & Health
│      └── Copernicus C3S Atlas
│
├── Extreme Weather
│
├── Vector Climate Suitability
│
├── Drought & Health
│
└── Climate Projection
```

### This could become global Epi Info infrastructure

EPA and NOAA are superb sources, but primarily U.S.-oriented.

Copernicus gives you:

```text
                     WORLD

 Africa ───────────────┐
 Asia ─────────────────┤
 Europe ───────────────┤
 Americas ─────────────┼──► C3S / ERA5
 Pacific ──────────────┤
 Middle East ──────────┘
```

That matters enormously for an application whose historical user community has been global.

So my revised environmental architecture would make **Copernicus a first-class provider**, alongside CDC/EPA/NOAA:

```text
                 EPI INFO ENVIRONMENT

                         AST
                          │
                 Exposure Engine
                          │
       ┌──────────────────┼──────────────────┐
       ▼                  ▼                  ▼
   Copernicus            EPA                CDC
       │
 ┌─────┼──────────┐
 ▼     ▼          ▼
C3S   ERA5    ERA5-HEAT
Atlas
 │      │          │
 ▼      ▼          ▼
future daily/     human
climate hourly    thermal
       weather    stress
```

For me, **C3S Atlas would be the climate-change and long-horizon exposure component; ERA5/ERA5-Land/ERA5-HEAT would be the acute and historical exposure components**.

That combination could give an Epi Info environmental package capabilities that the old product never had—and, importantly, capabilities that remain accessible globally rather than being tied only to U.S. environmental datasets.

[1]: https://cds.climate.copernicus.eu/datasets/multi-origin-c3s-atlas?tab=overview&utm_source=chatgpt.com "Gridded dataset underpinning the Copernicus Interactive Climate Atlas"
[2]: https://climate.copernicus.eu/about-data-and-methods?utm_source=chatgpt.com "About the data and methods | Copernicus"
[3]: https://cds.climate.copernicus.eu/how-to-api?utm_source=chatgpt.com "CDSAPI setup - Climate Data Store"
[4]: https://climate.copernicus.eu/european-health-service?utm_source=chatgpt.com "European health service | Copernicus"
[5]: https://climate.copernicus.eu/copernicus-introducing-thermal-trace-gateway-wealth-heat-and-cold-stress-data?utm_source=chatgpt.com "Copernicus: Introducing Thermal Trace, a gateway to a wealth of heat and cold stress data | Copernicus"
