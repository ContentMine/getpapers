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
      var path = '/europepmc/webservices/rest/search/query=foo&resulttype=core&pageSize=1000&cursorMark=*'
      var eupmc = new EuPMC()
      sinon.spy(eupmc, 'pageQuery')
      sinon.spy(eupmc, 'handleSearchResults')
      eupmc.queryurl = host + path
      nock(host)
                .get(path)
                .replyWithFile(200, './responses/eupmc_lies.xml')
      eupmc.pageQuery()
      setTimeout(() => {
        expect(eupmc.pageQuery).to.have.been.calledOnce()
        done()
      })
    })
  })
})
