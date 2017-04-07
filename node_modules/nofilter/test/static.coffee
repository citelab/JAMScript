NoFilter = require '../'
expect = require('chai').expect
util = require 'util'

describe 'Static methods', ->
  it 'can be compared', ->
    nf1 = new NoFilter '1'
    nf2 = new NoFilter '2'
    expect(NoFilter.compare(nf1, nf1)).equal 0
    expect(NoFilter.compare(nf1, new NoFilter '1')).equal 0
    expect(NoFilter.compare(nf1, nf2)).equal -1
    expect(NoFilter.compare(nf2, nf1)).equal 1
    expect ->
      NoFilter.compare null, null
    .to.throw TypeError
    expect ->
      NoFilter.compare nf1, null
    .to.throw TypeError

  it 'can be concatenated', ->
    nf1 = new NoFilter '1'
    nf2 = new NoFilter '2'
    nf3 = new NoFilter
      objectMode: true
    expect(NoFilter.concat [nf1, nf2]).eql new Buffer('12')
    expect(NoFilter.concat []).eql new Buffer(0)
    expect(NoFilter.concat [nf1, nf2], 0).eql new Buffer(0)
    expect(NoFilter.concat [nf1, nf2], 1).eql new Buffer('1')

    expect ->
      NoFilter.concat 'foo'
    .to.throw TypeError
    expect ->
      NoFilter.concat [0]
    .to.throw TypeError
    expect ->
      NoFilter.concat [0], 1
    .to.throw TypeError
    expect ->
      NoFilter.concat [nf1, nf2, nf3], 1
    .to.throw Error
