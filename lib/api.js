var eupmc = require('./eupmc.js')

var chooseAPI = function(api) {
  if (api === 'eupmc') {
    return eupmc;
  }
  log.error('You asked for an unknown API :' + api);
  log.error('API must be one of: [eupmc]')
}

module.exports = chooseAPI;
