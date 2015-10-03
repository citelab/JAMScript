module.exports = {
	hello: function (self, sock) {
	console.log("Hello, World!");
	sock.write("Hello");
	}
};