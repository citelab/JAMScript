var nano = require('nanomsg'),
    cbor = require('cbor');

	var sock = nano.socket('rep');
    var url = "tcp://127.0.0.1:5555";
	console.log("Bind URL " + url);
	sock.bind(url);

	sock.on('data', function(buf) {
		console.log("In new service.. Buffer size " + Buffer.byteLength(buf));
		cbor.decodeFirst(buf, function(error, msg) {
			console.log(msg);
			if (msg["cmd"] == "PING") {
				msg["cmd"] = "PONG";
				var encode = cbor.encode(msg);
				sock.send(encode);

			}

		});
	});
