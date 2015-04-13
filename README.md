# getpapers
Get fulltexts or fulltext URLs of papers matching a search query

Currently uses the EuropePMC API.

## Installation

```bash
$ npm install --global getpapers
```

## Usage

```bash
$ getpapers --query 'c4 photosynthesis'
Number of hits: 2005
First 25 hits:
0. Sage RF, Stata M. (2015). Photosynthetic diversity meets biodiversity: the C4 plant example. http://dx.doi.org/10.1016/j.jplph.2014.07.024
1. Christin PA, Arakaki M, Osborne CP, Edwards EJ. (2015). Genetic enablers underlying the clustered evolutionary origins of c4 photosynthesis in angiosperms. http://dx.doi.org/10.1093/molbev/msu410
2. Offermann S, Friso G, Doroshenk KA, Sun Q, Sharpe RM, Okita TW, Wimmer D, Edwards GE, van Wijk KJ. (2015). Developmental and subcellular organization of single-cell C4 photosynthesis in Bienertia sinuspersici determined by large scale proteomics and cDNA assembly from 454 DNA sequencing. http://dx.doi.org/10.1021/pr5011907
...
```
