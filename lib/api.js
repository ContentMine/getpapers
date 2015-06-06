var eupmc = require('./eupmc.js')
  , arxiv = require('./arxiv.js')
  , ieee = require('./ieee.js');

var chooseAPI = function(api) {
  if (api === 'eupmc') {
    return eupmc;
  } else if (api === 'ieee') {
    return ieee;
  } else if (api === 'arxiv') {
    return arxiv;
  }
  log.error('You asked for an unknown API :' + api);
  log.error('API must be one of: [eupmc, ieee, arxiv]')
}

module.exports = chooseAPI;
