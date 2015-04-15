# getpapers
Get fulltexts or fulltext URLs of papers matching a search query using the EuropePMC API.

getpapers is designed for use in content mining, but you may find it useful for quickly acquiring large numbers of papers for reading.

## Installation

```bash
$ npm install --global getpapers
```

## Usage

Use `getpapers --help` to see the command-line help:

```

Usage: getpapers [options]

Options:

  -h, --help              output usage information
  -V, --version           output the version number
  -q, --query <query>     Search query (required)
  -o, --outdir <path>     Output directory (required - will be created if not found)
  -l, --loglevel <level>  amount of information to log (silent, verbose, info*, data, warn, error, or debug)

```

## Screenshot

![screenshot](https://raw.githubusercontent.com/ContentMine/getpapers/master/docs/screenshot.png)

## Query format

Queries are processed by EuropePMC. In their simplest form, they can be free text, like this:

```
--query 'brain tumour rnaseq'
```

But they can also be much more detailed, using the EuropePMC webservice's query language (see Appendix 1 of [the EuropePMC reference PDF](http://europepmc.org/docs/EBI_Europe_PMC_Web_Service_Reference.pdf)).

For example we can restrict our search to only papers that mention 'transcriptome assembly' in the methods:

```
--query 'METHODS:"transcriptome assembly"'
```

Or to only papers with a CC-BY license:

```
--query 'LICENSE:"cc by" OR LICENSE:"cc-by"'
```

Note that in this case, we combine two restrictions using the logical `OR` keyword. We can also use `AND`, and can group operations using brackets:

```
--query '(LICENSE:"cc by" OR LICENSE:"cc-by") AND METHODS:"transcriptome assembly"'
```

### Restrict search by bibliographic metadata

| Field     | Description                                                                                       | Example                                                                                            |
|-----------|---------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| `PMCID:`    | Search for a publication by its PubMed Central ID, where applicable (i.e. available as full text) | `PMCID:PMC1287967`                                                                                   |
| `TITLE:`    | Search for a term or terms in publication titles                                                  | `TITLE:aspirin, TITLE:”protein knowledgebase”`                                                       |
| `ABSTRACT:` | Search for a term or terms in publication abstracts                                               | `ABSTRACT:malaria`, `ABSTRACT:”chicken pox”`                                                           |
| `AUTH:`     | Search for a surname and (optionally) initial(s) in publication author lists                      | `AUTH:einstein`, `AUTH:”Smith AB”`                                                                     |
| `JOURNAL:`  | Journal title – searchable either in full or abbreviated form                                     | `JOURNAL:”biology letters”`, `JOURNAL:”biol lett”`                                                     |
| `LICENSE:`  | Search for content according to the assigned Creative Commons license (where provided).           | `LICENSE:"cc by" OR LICENSE:"cc-by"`, `LICENSE:cc` |

### Restrict by article metadata

| Field         | Description                                      | Example                                               |
|---------------|--------------------------------------------------|-------------------------------------------------------|
| `DISEASE:`      | Search for mined diseases                        | `DISEASE:dysthymias`                                    |
| `GENE_PROTEIN:` | Search for records that have GENE_PROTEINS mined | `GENE_PROTEIN:gng11`                                    |
| `GOTERM:`       | Search for records that have GOTERM mined        | `GOTERM:apoptosis`                                      |
| `CHEM:`         | Limit your search by MeSH substance              | `CHEM:propantheline`, `CHEM:”protein kinases”`            |
| `ORGANISM:`     | Search for mined organisms                       | `ORGANISM:terebratulide`                                |
| `PUB_TYPE:`     | Limit your search by publication type            | `PUB_TYPE:review`, `PUB_TYPE:”retraction of publication”` |

### Section-level search

| Field      | Description                                                          | Example                        |
|------------|----------------------------------------------------------------------|--------------------------------|
| `INTRO:`   | Find articles with a phrase in the Introduction & Background section | `INTRO:“protein interactions”` |
| `METHODS:` | Find articles with a phrase in the Materials & Methods section       |  `METHODS:“yeast two-hybrid”`  |
| `RESULTS:` | Find articles with a phrase in the Results section                   | `RESULTS:"in vivo"`            |
| `DISCUSS:` | Find articles with a phrase in the Discussion seciton                | `DISCUSS:cardivascular`        |
