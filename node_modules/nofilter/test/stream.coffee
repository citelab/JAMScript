NoFilter = require '../'
expect = require('chai').expect

describe 'When streaming', ->
  it 'listens for pipe events', ->
    nf1 = new NoFilter
      objectMode: true
    nf2 = new NoFilter
      objectMode: false

    nf1.pipe nf2
    expect(nf2._readableState.objectMode).true

  it 'does not have to listen for pipe events', ->
    nf1 = new NoFilter
      objectMode: true
    nf2 = new NoFilter
      objectMode: false
      watchPipe: false

    nf1.pipe nf2
    expect(nf2._readableState.objectMode).false

  it 'does not allow piping after writing', ->
    nf1 = new NoFilter
      objectMode: true
    nf2 = new NoFilter
      objectMode: false
    nf2.write '123'
    expect ->
      nf1.pipe nf2
    .to.throw Error

  it 'can generate a promise', ->
    nf = new NoFilter
    p = nf.promise()
    .then (val) ->
      expect(val).eql new Buffer('123')
    nf.end '123'
    p

  it 'can generate a rejected promise', ->
    nf = new NoFilter
    p = nf.promise()
    .catch (er) ->
      expect(er).instanceof Error

    nf.end
      a: 1
    p

  it 'can generate a promise and a callback', ->
    nf = new NoFilter
    p = nf.promise (er, val) ->
      expect(val).eql new Buffer('123')
    nf.end '123'
    p

  it 'can generate a rejected promise and a callback', ->
    nf = new NoFilter
    p = nf.promise (er, val) ->
      expect(er).instanceof TypeError
      expect(val).is.undefined

    nf.end
      a: 1
    p.catch (er) ->
      expect(er).instanceof TypeError
