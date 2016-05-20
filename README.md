# getpapers [![NPM version](https://img.shields.io/npm/v/getpapers.svg)][npm] [![license MIT](https://img.shields.io/github/license/contentmine/getpapers.svg)][license] [![Downloads](http://img.shields.io/npm/dm/getpapers.svg)][downloads]

[npm]: https://www.npmjs.com/package/getpapers
[license]: https://github.com/ContentMine/getpapers/blob/master/LICENSE
[downloads]: https://nodei.co/npm/getpapers
Get metadata, fulltexts or fulltext URLs of papers matching a search query using any of the following APIs:

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
  --api <name>            API to search [arxiv, eupmc, ieee] (default: eupmc)
  -x, --xml               Download fulltext XMLs if available
  -p, --pdf               Download fulltext PDFs if available
  -s, --supp              Download supplementary files if available
  -l, --loglevel <level>  amount of information to log (silent, verbose, info*, data, warn, error, or debug)
  -a, --all               search all papers, not just open access

```

By default, getpapers uses the EuropePMC API.

## Screenshot

![screenshot](https://raw.githubusercontent.com/ContentMine/getpapers/master/docs/screenshot.png)

## Query formats

Each API has its own query format. Usage guides are provided on our wiki:

- [EuropePMC query format](https://github.com/ContentMine/getpapers/wiki/europepmc-query-format)
- [IEEE query format](https://github.com/ContentMine/getpapers/wiki/ieee-query-format)
- [ArXiv query format](https://github.com/ContentMine/getpapers/wiki/arxiv-query-format)

## License

Copyright (c) 2014 Shuttleworth Foundation
Licensed under the MIT license
