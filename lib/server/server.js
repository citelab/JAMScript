var net = require('net'),
	events = require('events'),
	util = require('util'),
	getmessage = require('./message.js'),
	appdb = require('./appdb.js'),
	svlmanager = require('./svlmanager.js');


// Port number for the main server to listen..
var PORT = 2500;
var SERVER = "localhost";
var svlmgr = svlmanager.init(SERVER);

var args = process.argv.slice(2);
var path = args[0];

var server = net.createServer(function(c) {
	var message = getmessage(c);
	message.on('message', function(msg) {
		processmsg(msg, c);
	});
}).listen(PORT, SERVER);

server.on('error', function (e) {
	if (e.code == 'EADDRINUSE') {
		console.log('Address in use, retrying...');
		setTimeout(function () {
			server.close();
			server.listen(PORT, SERVER);
		}, 1000);
	}
});


// This is a function that is called synchronously?.. bad??
// However, nothing time consuming is happening inside here..
//
// Switch statement can be replaced with a hash table - tag,function pair.
//
function processmsg(message, socket) {

	var appname = "",
	    appid = 0,
	    reply = "";

	var cmd = message.name;
	switch (cmd) {
		case "PING":  // PING: seqnum - reply should have (seqnum + 1)
		var seqnum = message.args[0];
		reply = JSON.stringify({name:"PINGR", tag: "", args:[(seqnum + 1)], cback: ""}) + "\n";
		socket.write(reply);
		break;

		case "CHKREG":
		appname = message.args[0];
		appdb.isregistered(appname, function(appid) {
			reply = JSON.stringify({name:"APPSTAT", tag: "", args:[appid], cback: ""}) + "\n";
			socket.write(reply);
		});
		break;

		case "REGAPP":
		appname = message.args[0];
		console.log(appname);
		var jam = require(path + appname);

		appdb.register(appname, function(appid) {
			if (appid !== undefined) {
				// start the servlet... for appid..
				svlmgr.createservlet(appid, jam.getAllFunctions(), function(servinfo) {
					if (servinfo !== undefined) {
						var dentry = {appname: appname, appid: appid, server: servinfo.server, port: servinfo.port, state: 1};
						appdb.finalizeregister(dentry);
						reply = JSON.stringify({name:"APPSTAT", tag: "", args:[appid], cback: ""}) + "\n";
						socket.write(reply);
					} else {
						reply = JSON.stringify({name:"APPSTAT", tag: "", args:[0], cback: ""}) + "\n";
						socket.write(reply);
					}
				});
			} else {
				reply = JSON.stringify({name:"APPSTAT", tag: "", args:[0], cback: ""}) + "\n";
				socket.write(reply);
			}
		});
		break;

		case "OPNAPP":
		appname = message.args[0];
		console.log(appname);
		var jam = require(path + appname);
		
		appdb.openapp(appname, function(sinfo) {
			if (sinfo !== undefined) {
				// start the servlet for rappid..
				svlmgr.recreateservlet(sinfo.appid, {server: sinfo.server, port: sinfo.port}, jam.getAllFunctions(), function(servinfo) {
					if (servinfo !== undefined) {

						appdb.finalizeopen();
						reply = JSON.stringify({name:"APPSTAT", tag: "", args:[sinfo.appid], cback: ""}) + "\n";
						socket.write(reply);
					} else {
						reply = JSON.stringify({name:"APPSTAT", tag: "", args:[0], cback: ""}) + "\n";
						socket.write(reply);
					}
				});
			} else {
				reply = JSON.stringify({name:"APPSTAT", tag: "", args:[0], cback: ""}) + "\n";
				socket.write(reply);
			}
		});
		break;

		case "CLOSAPP":
		appid = message.args[0];
		appdb.closeapp(appid, function(rappid) {
			// destroy the servlet... for rappid..
			svlmgr.destroyservlet(rappid, function(aid) {
				if (aid !== undefined) {
					appdb.finalizeclose(aid);
					reply = JSON.stringify({name:"APPSTAT", tag: "", args:[rappid], cback: ""}) + "\n";
					socket.write(reply);
				} else {
					reply = JSON.stringify({name:"APPSTAT", tag: "", args:[0], cback: ""}) + "\n";
					socket.write(reply);
				}
			});
		});
		break;

		case "REMAPP":
		appid = message.args[0];
		appdb.removeapp(appid, function(rappid) {
			// destroy the servlet... for appid.. this runs only if the app is still running..
			svlmgr.destroyservlet(appid, function(aid) {
				if (aid !== undefined) {
					reply = JSON.stringify({name:"APPSTAT", tag: "", args:[rappid], cback: ""}) + "\n";
					socket.write(reply);
				} else {
					reply = JSON.stringify({name:"APPSTAT", tag: "", args:[0], cback: ""}) + "\n";
					socket.write(reply);
				}
			});
		});
		break;

		case "GAPPINFO":
		appid = message.args[0];
		appdb.getappinfo(appid, function(ainfo) {
			if (ainfo !== undefined) {
				reply = JSON.stringify({name: "APPINFO", tag: "", args:[ainfo], cback: ""}) + "\n";
			} else
				reply = JSON.stringify({name: "APPINFO", tag: "", args:[null], cback: ""}) + "\n";

			socket.write(reply);
		});
		break;

		default:
			console.log("Command = " + message["name"] + ".. received");
	}
}
