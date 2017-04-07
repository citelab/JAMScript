stream = require 'stream'
util = require 'util'

# NoFilter stream.  Can be used to sink or source data to and from other
# node streams.  Implemented as the "identity" Transform stream (hence the
# name), but allows for inspecting data that is in-flight.
#
# @example source
#   var n = new NoFilter('Zm9v', 'base64');
#   n.pipe(process.stdout);
#
# @example sink
#   var n = new Nofilter();
#   # NOTE: 'finish' fires when the input is done writing
#   n.on('finish', function() { console.log(n.toString('base64')); });
#   process.stdin.pipe(n);
#
# @event read(Buffer|String|Object) fired whenever anything is read from the
#   stream.
#
# @method #writeUInt8(value)
#   Write an 8-bit unsigned integer to the stream.  Adds 1 byte.
#   @param value [Number]
# @method #writeUInt16LE(value)
#   Write a little-endian 16-bit unsigned integer to the stream.  Adds
#   2 bytes.
#   @param value [Number]
# @method #writeUInt16BE(value)
#   Write a big-endian 16-bit unsigned integer to the stream.  Adds
#   2 bytes.
#   @param value [Number]
# @method #writeUInt32LE(value)
#   Write a little-endian 32-bit unsigned integer to the stream.  Adds
#   4 bytes.
#   @param value [Number]
# @method #writeUInt32BE(value)
#   Write a big-endian 32-bit unsigned integer to the stream.  Adds
#   4 bytes.
#   @param value [Number]
# @method #writeInt8(value)
#   Write an 8-bit signed integer to the stream.  Adds
#   1 byte.
#   @param value [Number]
# @method #writeInt16LE(value)
#   Write a little-endian 16-bit signed integer to the stream.  Adds
#   2 bytes.
#   @param value [Number]
# @method #writeInt16BE(value)
#   Write a big-endian 16-bit signed integer to the stream.  Adds
#   2 bytes.
#   @param value [Number]
# @method #writeInt32LE(value)
#   Write a little-endian 32-bit signed integer to the stream.  Adds
#   4 bytes.
#   @param value [Number]
# @method #writeInt32BE(value)
#   Write a big-endian 32-bit signed integer to the stream.  Adds
#   4 bytes.
#   @param value [Number]
# @method #writeFloatLE(value)
#   Write a little-endian 32-bit float to the stream.  Adds
#   4 bytes.
#   @param value [Number]
# @method #writeFloatBE(value)
#   Write a big-endian 32-bit float to the stream.  Adds
#   4 bytes.
#   @param value [Number]
# @method #writeDoubleLE(value)
#   Write a little-endian 64-bit double precision number to the stream.  Adds
#   8 bytes.
#   @param value [Number]
# @method #writeDoubleBE(value)
#   Write a big-endian 64-bit double precision number to the stream.  Adds
#   8 bytes.
#   @param value [Number]
# @method #readUInt8()
#   Read an unsigned 8-bit integer from the stream.  Consumes
#   1 byte.
#   @return [Number]
# @method #readUInt16LE()
#   Read a little-endian unsigned 16-bit integer from the stream.  Consumes
#   2 bytes.
#   @return [Number]
# @method #readUInt16BE()
#   Read a big-endian unsigned 16-bit integer from the stream.  Consumes
#   2 bytes.
#   @return [Number]
# @method #readUInt32LE()
#   Read a little-endian unsigned 32-bit integer from the stream.  Consumes
#   4 bytes.
#   @return [Number]
# @method #readUInt32BE()
#   Read a -bigendian unsigned 32-bit integer from the stream.  Consumes
#   4 bytes.
#   @return [Number]
# @method #readInt8()
#   Read a signed 8-bit integer from the stream.  Consumes
#   1 byte.
#   @return [Number]
# @method #readInt16LE()
#   Read a little-endian signed 16-bit integer from the stream.  Consumes
#   2 bytes.
#   @return [Number]
# @method #readInt16BE()
#   Read a big-endian signed 16-bit integer from the stream.  Consumes
#   2 bytes.
#   @return [Number]
# @method #readInt32LE()
#   Read a little-endian signed 32-bit integer from the stream.  Consumes
#   4 bytes.
#   @return [Number]
# @method #readInt32BE()
#   Read a big-endian signed 32-bit integer from the stream.  Consumes
#   4 bytes.
#   @return [Number]
# @method #readFloatLE()
#   Read a little-endian floating point number from the stream.  Consumes
#   4 bytes.
#   @return [Number]
# @method #readFloatBE()
#   Read a big-endian floating point number from the stream.  Consumes
#   4 bytes.
#   @return [Number]
# @method #readDoubleLE()
#   Read a little-endian double-precision number from the stream.  Consumes
#   8 bytes.
#   @return [Number]
# @method #readDoubleBE()
#   Read a big-endian double-precision number from the stream.  Consumes
#   8 bytes.
#   @return [Number]
module.exports = class NoFilter extends stream.Transform
  # Create a NoFilter.  Allow passing in source data (input, inputEncoding)
  # at creation time.  Source data can also be passed in the options object.
  #
  # @param input [String, Buffer] Optional source data
  # @param inputEncoding [String] Optional encoding name for input, ignored
  #   if input is not a String
  # @param options [Object] Other options
  # @option options [String, Buffer] Input source data
  # @option options [String] inputEncoding Encoding name for input, ignored
  #   if input is not a String
  # @option options [Number] highWaterMark The maximum number of bytes to store
  #   in the internal buffer before ceasing to read from the underlying
  #   resource. Default=16kb, or 16 for objectMode streams.
  # @option options [String] encoding  If specified, then buffers will be
  #   decoded to strings using the specified encoding. Default=null
  # @option options [Boolean] objectMode Whether this stream should behave as a
  #   stream of objects. Meaning that stream.read(n) returns a single value
  #   instead of a Buffer of size n. Default=false
  # @option options [Boolean] decodeStrings Whether or not to decode strings
  #   into Buffers before passing them to _write(). Default=true
  # @option options [Boolean] watchPipe Whether to watch for 'pipe' events,
  #   setting this stream's objectMode based on the objectMode of the input
  #   stream. Default=true
  constructor: (input, inputEncoding, options = {}) ->
    inp = undefined
    inpE = undefined
    switch typeof(input)
      when 'object'
        if Buffer.isBuffer(input)
          inp = input
          if inputEncoding? and (typeof(inputEncoding) == 'object')
            options = inputEncoding
        else
          options = input
      when 'string'
        inp = input
        if inputEncoding? and (typeof(inputEncoding) == 'object')
          options = inputEncoding
        else
          inpE = inputEncoding

    if !options?
      options = {}
    inp ?= options.input
    inpE ?= options.inputEncoding
    delete options.input
    delete options.inputEncoding
    watchPipe = options.watchPipe ? true
    delete options.watchPipe
    super(options)

    if watchPipe
      @on 'pipe', (readable) =>
        om = readable._readableState.objectMode
        if (@length > 0) and (om != @_readableState.objectMode)
          throw new Error 'Do not switch objectMode in the middle of the stream'

        @_readableState.objectMode = om
        @_writableState.objectMode = om

    if inp?
      @end inp, inpE

  # Is the given object a {NoFilter}?
  # @param obj [Object] The object to test.
  # @return [Boolean]
  @isNoFilter: (obj) ->
    obj instanceof @

  # The same as nf1.compare(nf2). Useful for sorting an Array of NoFilters:
  # @example compare
  #  var arr = [new NoFilter('1234'), new NoFilter('0123')];
  #  arr.sort(Buffer.compare);
  # @param nf1 [NoFilter] The first object to compare
  # @param nf2 [NoFilter] The second object to compare
  # @return [Number] -1, 0, 1 for less, equal, greater
  @compare: (nf1, nf2) ->
    if !(nf1 instanceof @)
      throw new TypeError 'Arguments must be NoFilters'
    if nf1 == nf2
      0
    else
      nf1.compare nf2

  # Returns a buffer which is the result of concatenating all the NoFilters in
  # the list together. If the list has no items, or if the totalLength is 0,
  # then it returns a zero-length buffer.
  #
  # If length is not provided, it is read from the buffers in the list. However,
  # this adds an additional loop to the function, so it is faster to provide the
  # length explicitly.
  #
  # @param list [Array of NoFilter] Inputs.  Must not be in object mode.
  # @param length [Number] Optional.
  # @return [Buffer] The concatenated values
  @concat: (list, length) ->
    if !Array.isArray list
      throw new TypeError 'list argument must be an Array of NoFilters'
    if (list.length == 0) or (length == 0)
      return new Buffer 0
    if !length?
      length = list.reduce (tot, nf) ->
        if !(nf instanceof NoFilter)
          throw new TypeError 'list argument must be an Array of NoFilters'
        tot + nf.length
      , 0
    bufs = list.map (nf) ->
      if !(nf instanceof NoFilter)
        throw new TypeError 'list argument must be an Array of NoFilters'
      if nf._readableState.objectMode
        # TODO: if any of them are in object mode, then return an array?
        throw new Error 'NoFilter may not be in object mode for concat'
      nf.slice()
    Buffer.concat bufs, length

  # @nodoc
  _transform: (chunk, encoding, callback) ->
    if !@_readableState.objectMode and !Buffer.isBuffer(chunk)
      chunk = new Buffer chunk, encoding
    @push chunk
    callback()

  # @nodoc
  _bufArray: () ->
    bufs = @_readableState.buffer
    # HACK: replace with something else one day.  This is what I get for
    # relying on internals.
    if !Array.isArray(bufs)
      b = bufs.head
      bufs = []
      while b?
        bufs.push b.data
        b = b.next
    bufs

  # The read() method pulls some data out of the internal buffer and returns it.
  # If there is no data available, then it will return null.
  #
  # If you pass in a size argument, then it will return that many bytes. If size
  # bytes are not available, then it will return null, unless we've ended, in
  # which case it will return the data remaining in the buffer.
  #
  # If you do not specify a size argument, then it will return all the data in
  # the internal buffer.
  #
  # This version also fires the 'read' event upon a successful read.
  #
  # @param size [Number] Optional. Number of bytes to read.
  # @return [String, Buffer, null]
  read: (size) ->
    buf = super size
    if buf?
      @emit 'read', buf
    buf

  # Return a promise fulfilled with the full contents, after the 'finish'
  # event fires.  Errors on the stream cause the promise to be rejected.
  promise: (cb) ->
    done = false
    new Promise (resolve, reject) =>
      @on 'finish', =>
        data = @read()
        if cb? and !done
          done = true
          cb null, data
        resolve data
      @on 'error', (er) ->
        if cb? and !done
          done = true
          cb er
        reject er

  # Returns a number indicating whether this comes before or after or is the
  # same as the other NoFilter in sort order.
  #
  # @param other [NoFilter] The other object to compare
  # @return [Number] -1, 0, 1 for less, equal, greater
  compare: (other) ->
    if !(other instanceof NoFilter)
      throw new TypeError 'Arguments must be NoFilters'
    if @_readableState.objectMode or other._readableState.objectMode
      throw new Error 'Must not be in object mode to compare'
    if @ == other
      0
    else
      @slice().compare other.slice()

  # Do these NoFilter's contain the same bytes?  Doesn't work if either is
  # in object mode.
  # @param other [NoFilter]
  # @return [Boolean] Equal?
  equals: (other) ->
    @compare(other) == 0

  # Read bytes or objects without consuming them.  Useful for diagnostics.
  # Note: as a side-effect, concatenates multiple writes together into what
  # looks like a single write, so that this concat doesn't have to happen
  # multiple times when you're futzing with the same NoFilter.
  #
  # @param start [Number] Optional, Default: 0
  # @param end [Number], Optional, Default: NoFilter.length
  # @return [Buffer,Array] if in object mode, an array of objects.  Otherwize,
  #   concatenated array of contents.
  slice: (start, end) ->
    if @_readableState.objectMode
      @_bufArray().slice start, end
    else
      bufs = @_bufArray()
      switch bufs.length
        when 0 then new Buffer(0)
        when 1 then bufs[0].slice(start, end)
        else
          b = Buffer.concat bufs
          # TODO: store the concatented bufs back
          # @_readableState.buffer = [b]
          b.slice start, end

  # Get a byte by offset.  I didn't want to get into metaprogramming
  # to give you the `NoFilter[0]` syntax.
  # @param index [Number] The byte to retrieve
  # @return [Number] 0-255
  get: (index) ->
    @slice()[index]

  # Return an object compatible with Buffer's toJSON implementation, so
  # that round-tripping will produce a Buffer.
  # @return [Object]
  #
  # @example output for 'foo'
  #   { type: 'Buffer', data: [ 102, 111, 111 ] }
  toJSON: ->
    b = @slice()
    if Buffer.isBuffer(b)
      b.toJSON()
    else
      b

  # Decodes and returns a string from buffer data encoded using the specified
  # character set encoding. If encoding is undefined or null, then encoding
  # defaults to 'utf8'. The start and end parameters default to 0 and
  # NoFilter.length when undefined.
  #
  # @param encoding [String] Optional, Default: 'utf8'
  # @param start [Number] Optional, Default: 0
  # @param end [Number] Optional, Default: NoFilter.length
  # @return [String]
  toString: (encoding, start, end) ->
    @slice().toString(encoding, start, end)

  # @nodoc
  inspect: (depth, options) ->
    bufs = @_bufArray()
    hex = bufs.map (b) ->
      if Buffer.isBuffer(b)
        if options?.stylize
          options.stylize b.toString('hex'), 'string'
        else
          b.toString('hex')
      else
        util.inspect(b, options)
    .join ', '
    "#{@constructor.name} [#{hex}]"

  # @nodoc
  _read_gen = (meth, len) ->
    (val) ->
      b = @read len
      if !Buffer.isBuffer(b)
        return null
      b[meth].call b, 0, true

  # @nodoc
  _write_gen = (meth, len) ->
    (val) ->
      b = new Buffer len
      b[meth].call b, val, 0, true
      @push b

  # unsigned
  writeUInt8:    _write_gen 'writeUInt8',    1
  writeUInt16LE: _write_gen 'writeUInt16LE', 2
  writeUInt16BE: _write_gen 'writeUInt16BE', 2
  writeUInt32LE: _write_gen 'writeUInt32LE', 4
  writeUInt32BE: _write_gen 'writeUInt32BE', 4

  # signed
  writeInt8:     _write_gen 'writeInt8',     1
  writeInt16LE:  _write_gen 'writeInt16LE',  2
  writeInt16BE:  _write_gen 'writeInt16BE',  2
  writeInt32LE:  _write_gen 'writeInt32LE',  4
  writeInt32BE:  _write_gen 'writeInt32BE',  4

  # float
  writeFloatLE:  _write_gen 'writeFloatLE',  4
  writeFloatBE:  _write_gen 'writeFloatBE',  4
  writeDoubleLE: _write_gen 'writeDoubleLE', 8
  writeDoubleBE: _write_gen 'writeDoubleBE', 8

  # unsigned
  readUInt8:    _read_gen 'readUInt8',    1
  readUInt16LE: _read_gen 'readUInt16LE', 2
  readUInt16BE: _read_gen 'readUInt16BE', 2
  readUInt32LE: _read_gen 'readUInt32LE', 4
  readUInt32BE: _read_gen 'readUInt32BE', 4

  # signed
  readInt8:     _read_gen 'readInt8',     1
  readInt16LE:  _read_gen 'readInt16LE',  2
  readInt16BE:  _read_gen 'readInt16BE',  2
  readInt32LE:  _read_gen 'readInt32LE',  4
  readInt32BE:  _read_gen 'readInt32BE',  4

  # float
  readFloatLE:  _read_gen 'readFloatLE',  4
  readFloatBE:  _read_gen 'readFloatBE',  4
  readDoubleLE: _read_gen 'readDoubleLE', 8
  readDoubleBE: _read_gen 'readDoubleBE', 8

  # @nodoc
  get = (props) ->
    NoFilter::__defineGetter__(name, getter) for name, getter of props

  # @property [Number] The number of bytes currently available to read
  get length: -> @_readableState.length
