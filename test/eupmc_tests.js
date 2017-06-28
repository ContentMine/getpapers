var EuPMC = require('../lib/eupmc')
var chai = require('chai')
var sinon = require('sinon')
var nock = require('nock')
var sinonChai = require('sinon-chai')
chai.use(sinonChai)
var expect = chai.expect

describe('EuropePMC', () => {
  describe('Handling lies from EuPMC', () => {
    it('should stop searching if there is an unfilled page and we\'re expecting more results', (done) => {
      var host = 'http://www.ebi.ac.uk'
      var path = '/europepmc/webservices/rest/search/query=foo&resulttype=core&pageSize=1000'
      var eupmc = new EuPMC()
      sinon.spy(eupmc, 'pageQuery')
      sinon.spy(eupmc, 'handleSearchResults')
      eupmc.queryurl = host + path
      eupmc.nextCursorMark = '*'
      nock(host)
                .get(path + '&cursorMark=*')
                .replyWithFile(200, './test/responses/eupmc_lies.xml')
      nock(host)
                .persist()
                .get(path + '&cursorMark=AoIIP+g5rygzNjgxNDM1Mw==')
                .replyWithFile(200, './test/responses/eupmc_noresults.xml')
      eupmc.pageQuery()
      setTimeout(() => {
        expect(eupmc.pageQuery).to.have.been.calledOnce()
        done()
      }, 1500)
    })
  })
})
