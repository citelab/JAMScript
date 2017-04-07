NoFilter = require '../'
expect = require('chai').expect
util = require 'util'

describe 'When in object mode', ->
  it 'can be created', ->
    n = new NoFilter
      objectMode: true
    expect(n._readableState.objectMode).to.be.true
    expect(n._writableState.objectMode).to.be.true

  it 'allows object writes', ->
    n = new NoFilter
      objectMode: true
    n.write
      a: 1
    expect(n.slice()).eql [
      a: 1
    ]
    n.write
      b: 2
    expect(n.slice()).eql [
      a: 1
    ,
      b: 2
    ]
    expect(n.slice(0,1)).eql [
      a: 1
    ]

  it 'is transparent for toJSON', ->
    n = new NoFilter
      objectMode: true
    n.write
      a: 1
    expect(n.toJSON()).eql [
      a: 1
    ]

  it 'does not fail reading integers', ->
    n = new NoFilter
      objectMode: true
    n.write
      a: 1
    expect(n.readUInt8()).equals null

  it 'supports inspect', ->
    n = new NoFilter
      objectMode: true
    n.write 1
    n.write
      a: 1
    expect(util.inspect(n)).equals 'NoFilter [1, { a: 1 }]'
