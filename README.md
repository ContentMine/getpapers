# getpapers
Get fulltexts or fulltext URLs of papers matching a PubMed search query.

Uses the EuropePMC API.

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
