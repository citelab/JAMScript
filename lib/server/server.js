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
// This can facilitate dynamic function loading and unloading... 
// we could get rid of USER_DEF_FUNC??
//
function processmsg(message, socket) {

	var appname = "",
	    appid = 0,
	    reply = "";
	
	var cmd = message.name;
	switch (cmd) {
		case "PING":  // PING: seqnum - reply should have (seqnum + 1)
		var seqnum = message.args[0];
		reply = JSON.stringify({name:"PINGR", args:[(seqnum + 1)]}) + "\n";
		socket.write(reply);
		break;

		case "CHKREG":
		appname = message.args[0];
		appdb.isregistered(appname, function(appid) {
			console.log("Returned appid " + appid);
			reply = JSON.stringify({name:"APPSTAT", args:[appid]}) + "\n";
			console.log("------11----APPSTAT");
			socket.write(reply);
		});
		break;

		case "REGAPP":
		appname = message.args[0];
		appdb.register(appname, function(appid) {
			if (appid !== undefined) {
				// start the servlet... for appid..
				svlmgr.createservlet(appid, {}, function(servinfo) {
					if (servinfo !== undefined) {
						var dentry = {appname: appname, appid: appid, server: servinfo.server, port: servinfo.port, state: 1};
						appdb.finalizeregister(dentry);
						reply = JSON.stringify({name:"APPSTAT", args:[appid]}) + "\n";
						console.log("-----10-----APPSTAT");
						socket.write(reply);
					} else {
						reply = JSON.stringify({name:"APPSTAT", args:[0]}) + "\n";			
						console.log("-------8---APPSTAT");
						socket.write(reply);				
					}
				});
			} else {
				reply = JSON.stringify({name:"APPSTAT", args:[0]}) + "\n";	
				console.log("------9----APPSTAT");		
				socket.write(reply);						
			}
		});
		break;

		case "OPNAPP":
		appname = message.args[0];
		appdb.openapp(appname, function(sinfo) {
			if (sinfo !== undefined) {
				// start the servlet for rappid..
				svlmgr.recreateservlet(sinfo.appid, {server: sinfo.server, port: sinfo.port}, {}, function(servinfo) {
					if (servinfo !== undefined) {
						console.log("Finalizing open" + servinfo.server + servinfo.port);
						appdb.finalizeopen();
						reply = JSON.stringify({name:"APPSTAT", args:[sinfo.appid]}) + "\n";
									console.log("-------7---APPSTAT");
						socket.write(reply);
					} else {
						console.log("===================== 1");
						reply = JSON.stringify({name:"APPSTAT", args:[0]}) + "\n";	
									console.log("-------5---APPSTAT");		
						socket.write(reply);
					}
				});
			} else {
				console.log("===================== 2");
				reply = JSON.stringify({name:"APPSTAT", args:[0]}) + "\n";	
							console.log("--------6--APPSTAT");		
				socket.write(reply);						
			}
		});
		break;

		case "CLOSAPP":
		appid = message.args[0];
		appdb.closeapp(appid, function(rappid) {
			// destroy the servlet... for rappid..
			console.log("Destroy servlet..");
			svlmgr.destroyservlet(rappid, function(aid) {
				console.log("Inside the callback...");
				if (aid !== undefined) {
					console.log("======= Closing " + aid);
					appdb.finalizeclose(aid);
					console.log("Closing app.. return 0");
					reply = JSON.stringify({name:"APPSTAT", args:[0]}) + "\n";	
								console.log("---------1--APPSTAT");		
					socket.write(reply);
				} else {
					reply = JSON.stringify({name:"APPSTAT", args:[rappid]}) + "\n";		
								console.log("--------2---APPSTAT");	
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
					reply = JSON.stringify({name:"APPSTAT", args:[0]}) + "\n";	
								console.log("--------3--APPSTAT");		
					socket.write(reply);
				} else {
					reply = JSON.stringify({name:"APPSTAT", args:[rappid]}) + "\n";		
								console.log("--------4--APPSTAT");	
					socket.write(reply);
				}
			});
		});	
		break;

		case "GAPPINFO":
		appid = message.args[0];
		console.log("Appid = " + appid);
		appdb.getappinfo(appid, function(ainfo) {
			if (ainfo !== undefined) {
				console.log("Ainfo.... " + ainfo);
				reply = JSON.stringify({name: "APPINFO", args:[ainfo]}) + "\n";
			} else
				reply = JSON.stringify({name: "APPINFO", args:[null]}) + "\n";	
			console.log("Writing:  "+ reply);

			socket.write(reply);
		});
		break;

		default:
		console.log("Command = " + message["name"] + ".. received");
	}
}