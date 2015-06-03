var eupmc = require('./eupmc.js')
  , ieee = require('./ieee.js');

var chooseAPI = function(api) {
  if (api === 'eupmc') {
    return eupmc;
  } else if (api === 'ieee') {
    return ieee;
  }
  log.error('You asked for an unknown API :' + api);
  log.error('API must be one of: [eupmc, ieee]')
}

module.exports = chooseAPI;
