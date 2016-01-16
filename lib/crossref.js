var crossref_api = require('crossref')
, rest = require('restler')
, util = require('util')
, fs = require('fs')
, chalk = require('chalk')
, got = require('got')
, mkdirp = require('mkdirp')
, _ = require('lodash')
, ProgressBar = require('progress');

var CrossRef = function(opts) {

  this.opts = opts;

}

CrossRef.prototype.search = function(query) {

  var crossref = this;

  if (crossref.opts.pdf) {
    log.warn("Many of the fulltext PDF ")
  }

  if (crossref.opts.xml) {
    log.warn("Many of the fulltext XML results from CrossRef require special authentication to download");
    log.warn("You can view and optionally accept the various publisher")
    log.warn("text and data mining terms and conditions using the CrossRef")
    log.warn("'click-through' service at https://apps.crossref.org/clickthrough/researchers/")
    log.warn("Once you ")
  }


}
