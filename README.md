# getpapers
Get fulltexts or fulltext URLs of papers matching a search query using any of the following APIs:

 - EuropePMC
 - IEEE
 - ArXiv

getpapers can fetch article metadata, fulltexts (PDF or XML), and supplementary materials. It's designed for use in content mining, but you may find it useful for quickly acquiring large numbers of papers for reading, or for bibliometrics.

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
  --api <name>            API to search [eupmc, ieee] (default: eupmc)
  -x, --xml               Download fulltext XMLs if available
  -p, --pdf               Download fulltext PDFs if available
  -s, --supp              Download supplementary files if available
  -l, --loglevel <level>  amount of information to log (silent, verbose, info*, data, warn, error, or debug)
  -a, --all               search all papers, not just open access

```

By default, getpapers uses the EuropePMC API.

## Screenshot

![screenshot](https://raw.githubusercontent.com/ContentMine/getpapers/master/docs/screenshot.png)

## EuropePMC Query format

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

A selection of the most commonly useful search fields are explained below...

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

## IEEE query format

The IEEE query format is loosely documented at [IEEE Xplore Gateway](http://ieeexplore.ieee.org/gateway/). In general, anything that works in the website search will also work in `getpapers` with the `--api ieee` option enabled.

Note that IEEE does not provide fulltext XML, and their fulltext PDFs are not easily downloadable (though we're working on it). `getpapers` will output metadata for the search results, and will attempt to reconstruct the fulltext HTML URLs for any papers that have fulltext HTML.

If you want to actually download the fulltext HTML of papers, [you will need this hack-around script](https://gist.github.com/Blahah/95bf793b3c9ddba2d4b6). In the future we will incorporate fulltext download into getpapers.

## ArXiv query format

ArXiv has a nice, clearly defined format. Queries can target individual fields of the articles records, as follows:

<table>
<tbody valign="top">
  <tr>
    <td align="left">
    <strong>prefix</strong>
    </td>
    <td align="left">
    <strong>explanation</strong>
    </td>
  </tr>
  <tr>
    <td align="left">
    ti
    </td>
    <td align="left">
    Title
    </td>
  </tr>
  <tr>
    <td align="left">
    au
    </td>
    <td align="left">
    Author
    </td>
  </tr>
  <tr>
    <td align="left">
    abs
    </td>
    <td align="left">
    Abstract
    </td>
  </tr>
  <tr>
    <td align="left">
    co
    </td>
    <td align="left">
    Comment
    </td>
  </tr>
  <tr>
    <td align="left">
    jr
    </td>
    <td align="left">
    Journal Reference
    </td>
  </tr>
  <tr>
    <td align="left">
    cat
    </td>
    <td align="left">
    Subject Category
    </td>
  </tr>
  <tr>
    <td align="left">
    rn
    </td>
    <td align="left">
    Report Number
    </td>
  </tr>
  <tr>
    <td align="left">
    id
    </td>
    <td align="left">
    Id (use <tt>id_list</tt> instead)
    </td>
  </tr>
  <tr>
    <td align="left">
    all
    </td>
    <td align="left">
    All of the above
    </td>
  </tr>
</tbody>
</table>

These fields can be searched individually or combined with logical operators.

For example:

```
--query 'all:transcriptome'
--query 'au:"del maestro" AND ti:checkerboard'
```

## License

Copyright (c) 2014 Shuttleworth Foundation
Licensed under the MIT license
