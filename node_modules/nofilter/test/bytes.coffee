NoFilter = require '../'
expect = require('chai').expect
util = require 'util'

describe 'When not in object mode', ->
  it 'can be created with no params', ->
    n = new NoFilter
    expect(n).is.not.null
    expect(n).to.be.an.instanceof(NoFilter)
    expect(NoFilter.isNoFilter n).true
    expect(n.length).to.equal(0)

  it 'can be created with a string', ->
    n = new NoFilter 'foo'
    expect(n.length).eql(3)

  it 'can be created with a string and encoding', ->
    n = new NoFilter 'Zm9v', 'base64'
    expect(n.length).eql(3)
    expect(n.toString()).eql('foo')

  it 'can be created with a buffer and options', ->
    n = new NoFilter new Buffer('010203', 'hex')
    expect(n.toString('hex')).eql('010203')

    n = new NoFilter new Buffer('010203', 'hex'),
      objectMode: false
    expect(n.length).eql(3)
    expect(n.toString('hex')).eql('010203')

  it 'can be created with options', ->
    n = new NoFilter
      input: 'Zm9v'
      inputEncoding: 'base64'
    expect(n.length).eql(3)
    expect(n.toString()).eql('foo')

    n = new NoFilter 'Zm9v',
      inputEncoding: 'base64'
    expect(n.length).eql(3)
    expect(n.toString()).eql('foo')

    n = new NoFilter 'Zm9v', 'base64',
      objectMode: false
    expect(n.length).eql(3)
    expect(n.toString()).eql('foo')

  it 'can be passed null', ->
    n = new NoFilter null
    expect(n.length).eql(0)

  it 'does delayed decodes', ->
    n = new NoFilter
      decodeStrings: false
      defaultEncoding: 'hex'
    n.end '010203'
    expect(n.slice(0, 2)).eql(new Buffer([1,2]))

  it 'looks like a buffer with toJSON', ->
    n = new NoFilter '010203', 'hex'
    b = new Buffer '010203', 'hex'
    expect(n.toJSON()).eql b.toJSON()

  it 'looks like a buffer with toString', ->
    n = new NoFilter '010203', 'hex'
    b = new Buffer '010203', 'hex'
    expect(n.toString()).eql b.toString()
    expect(n.toString('hex')).eql b.toString('hex')

  it 'does integer read/writes', ->
    n = new NoFilter
    n.writeUInt8 255
    expect(n.toString('hex')).equals 'ff'
    expect(n.readUInt8()).equals 255
    n.writeInt32BE 0x01020304
    expect(n.toString('hex')).equals '01020304'

  it 'supports inspect', ->
    n = new NoFilter
    n.write '01', 'hex'
    n.write new Buffer([2])
    expect(util.inspect(n)).equals 'NoFilter [01, 02]'
    expect(n.inspect()).equals 'NoFilter [01, 02]'

  it 'supports compare', ->
    nf1 = new NoFilter '1'
    nf2 = new NoFilter '2'
    nf3 = new NoFilter
      objectMode: true
    expect(nf1.compare(nf2)).equal -1
    expect(nf1.compare(nf1)).equal 0
    expect(nf1.equals nf2).equal false
    expect ->
      nf1.compare nf3
    .to.throw Error
    expect ->
      nf3.compare nf1
    .to.throw Error

  it 'slices', ->
    nf1 = new NoFilter
    expect(nf1.slice()).eql new Buffer(0)
    nf1.write '1'
    nf1.write '2'
    nf1.write '3'
    expect(nf1.slice()).eql new Buffer('123')
    expect(nf1.get(0)).equal '1'.charCodeAt(0)

  it 'emits a read event', (cb) ->
    nf = new NoFilter '010203', 'hex'
    nf.on 'read', (buf) ->
      expect(buf).eql new Buffer([1,2])
      cb()

    expect(nf.read 2).eql new Buffer([1,2])
