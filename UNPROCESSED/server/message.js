var events = require('events'),
	util = require('util');

module.exports = function(stream) {
	return new Message(stream);
};


function Message(stream) {
	events.EventEmitter.call(this);
	var self = this, buffer = '';
	stream.on('data', function(data) {
		buffer += data;
		console.log("Buffer " + buffer);
		// We use '\n' (newline) as the message delimiter...
		var boundary = buffer.indexOf('\n');
		while (boundary !== -1) {
			var input = buffer.substr(0, boundary);
			buffer = buffer.substr(boundary + 1);
			self.emit('message', JSON.parse(input));
			boundary = buffer.indexOf('\n');
		}
	});
};

util.inherits(Message, events.EventEmitter);

