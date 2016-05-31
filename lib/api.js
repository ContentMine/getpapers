var eupmc = require('./eupmc.js')
var crossref = require('./crossref.js')
var arxiv = require('./arxiv.js')
var ieee = require('./ieee.js')

var chooseAPI = function (api) {
  if (api === 'eupmc') {
    return eupmc
  } else if (api === 'crossref') {
    return crossref
  } else if (api === 'ieee') {
    return ieee
  } else if (api === 'arxiv') {
    return arxiv
  }
  log.error('You asked for an unknown API :' + api)
  log.error('API must be one of: [eupmc, crossref, ieee, arxiv]')
}

module.exports = chooseAPI
