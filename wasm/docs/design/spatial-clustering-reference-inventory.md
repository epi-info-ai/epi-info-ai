# Spatial and space-time clustering reference inventory

## Purpose

Epi Info AI will use multiple scientific Python projects as independent design,
fixture-generation, and differential-validation inputs. No package name becomes
an Epi Info AI command name, and the methods are not presented as equivalent.

The user-facing family remains **Cluster Detection**. Every operation must name
the question it answers, its null hypothesis or optimization objective, required
inputs, parameters, and whether its output is inferential or exploratory.

## Method families and reference inputs

| Epi Info AI family | Epidemiologic question | Scientific Python input | Intended role |
|---|---|---|---|
| Space-time permutation scan | Which bounded space-time windows contain more cases than expected from the observed spatial and temporal margins? | SciPy numerical/statistical primitives; independent reference implementation outside Python | First `EPIAI CLUSTER SPACE_TIME` candidate and independently reconstructed JupyterLite oracle |
| Space-time interaction | Are cases close in both space and time more often than expected? | PySAL `pointpats`: global/local Knox, Mantel, Jacquez, modified Knox | Complementary tests and differential evidence; not substitutes for ranked scan windows |
| Synthetic point processes | Can known null and clustered spatial patterns be generated reproducibly? | PySAL `pointpats.random`: Poisson and clustered Poisson/normal processes | Fixture generation and power/false-positive experiments; generated artifacts must remain deterministic and portable |
| Global spatial autocorrelation | Is the mapped attribute spatially autocorrelated across the study area? | PySAL `esda`: Moran's I, Geary's C, Getis-Ord G, join counts | Future inferential spatial-statistics commands with explicit spatial weights and permutation inference |
| Local hotspots/outliers | Where are local high/low concentrations or spatial outliers? | PySAL `esda`: local Moran/LISA, local Getis-Ord, local join counts | Future local inference with multiple-testing treatment; not called a space-time scan |
| Density-based point clusters | Which points form dense groups and which are noise under a distance/minimum-size rule? | scikit-learn DBSCAN, HDBSCAN, OPTICS; PySAL A-DBSCAN | Future exploratory cluster tools. No p-value or disease-risk interpretation unless a separate inferential design supplies one |
| Centroid/partition clustering | How can observations be partitioned to minimize within-cluster variation? | SciPy/scikit-learn k-means and related partition methods | Exploratory grouping; requires projected/scaled features and a declared cluster-count selection rule |
| Hierarchical clustering | What nested grouping is induced by a chosen distance and linkage rule? | SciPy hierarchy; scikit-learn agglomerative clustering | Exploratory dendrogram/partition reference with explicit metric, linkage, and cut rule |

## Governance rules

- Pin package versions and licenses in each validation environment and record
  them in generated evidence. Do not vendor or translate source merely because
  an API is open source.
- Use these packages primarily in independent Python/Jupyter validation. Browser
  production code must have its own typed contract and deterministic tests.
- Geographic distances require an explicit CRS/geodesic policy. Raw WGS 84
  longitude/latitude must not be passed to Euclidean algorithms as though units
  were meters.
- Space and time scaling must be declared. Combining latitude, longitude, and
  time into an arbitrary feature matrix is not a valid epidemiologic method.
- Randomized methods require an explicit seed, replication count, null model,
  and p-value convention.
- Local inferential statistics require a multiple-testing policy and disclosure
  of the spatial-weights construction.
- Unsupervised labels are descriptive. A cluster identifier alone is not proof
  of elevated risk or statistical significance.
- Compare outputs on synthetic null, known-cluster, boundary, duplicate-point,
  missing-data, and row-order metamorphic fixtures.

## Initial validation matrix

The first Space-Time Cluster Detection notebook will:

1. use SciPy/NumPy primitives to reconstruct spatial/time margins, expected
   counts, likelihood scores, and Monte Carlo summaries;
2. use `pointpats` synthetic point-process tools as a second fixture source when
   available in the validation environment;
3. report Knox/Mantel-style interaction evidence alongside—but visually and
   semantically separate from—the scan result;
4. run DBSCAN/HDBSCAN only as clearly labeled exploratory comparisons; and
5. persist package versions, seeds, parameters, input hashes, and discrepancies.

Package availability in Pyodide/JupyterLite must be proven by the build before a
notebook depends on it. When a package is unavailable, fixtures may be generated
in a pinned CI environment and consumed as checked, hashed static data, while
the core calculation remains independently reproducible in the browser lab.

## Primary documentation reviewed

- [SciPy clustering](https://docs.scipy.org/doc/scipy/reference/cluster.html)
- [scikit-learn clustering](https://scikit-learn.org/stable/modules/clustering.html)
- [PySAL exploratory spatial data analysis](https://pysal.org/esda/stable/user-guide/index.html)
- [PySAL point-pattern and space-time APIs](https://pysal.org/pointpats/api.html)
