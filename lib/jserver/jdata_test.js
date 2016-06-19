/**
 * Created by richboy on 19/06/16.
 */
var jlib = require('./jamlib'),
    async = require('asyncawait/async'),
    await = require('asyncawait/await'),
    readline = require('readline');

var http = require('http');
var cbor = require('cbor');
var qs = require('querystring');
var path = require('path');
var mime = require('mime');
var fs = require('fs');

var JManager = require('./jmanager');
var JLogger = require('./jlogger');

var test = new JLogger('test');

var host = "127.0.0.1";
var port = 3000;

var server;

var app = {
    init: function(){
        server = http.createServer(function(request, response){
            if (request.method == 'POST') {
                var body = '';

                request.on('data', function (data) {
                    body += data;

                    // Too much POST data, kill the connection!
                    // 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
                    if (body.length > 1e6)
                        request.connection.destroy();
                });

                request.on('end', function () {
                    //var post = qs.parse(body);
                    // use post['blah'], etc.
                    try{
                        var json = qs.parse(body);

                        switch (json.command) {
                            case 'add':
                            case 'log':
                                test.log(json.input, function(obj){
                                    app.sendResponse(obj, response);
                                });
                                break;
                            case 'series':
                                test.getSeries(function(obj){
                                    app.sendResponse(obj, response);
                                });
                                break;
                            case 'range':
                                test.getSeries(function(obj){
                                    app.sendResponse(obj, response);
                                }, json.fromMillis, json.toMillis);
                                break;
                            case 'delete':
                            case 'del':
                                test.deleteKey();
                                console.log("DELETE Sent");
                                break;
                            case 'publish':
                            case 'pub':
                                JManager.broadcastMessage(json.input, json.fromMillis);
                                console.log("BROADCAST sent!!!");
                                break;
                            default:
                                app.sendResponse({status: false, error: "Invalid Command"}, response);
                        }
                    }
                    catch(e){
                        console.log('ERROR', e);
                    }
                });
            }
            else{//emit html page
                var filePath = "./index.html";

                if( !(request.url == '/' || request.url == '/index.html') )
                    filePath = "./" + request.url;

                app.serveStatic(response, filePath);
            }
        });

        server.listen(port);

        console.log("Server running!!!");
    },
    serveStatic: function(response, absPath){
        fs.exists(absPath, function(exists){
            if( exists ){
                fs.readFile(absPath, function(err, data){
                    if( err ){
                        app.send404(response);
                        return;
                    }

                    response.writeHead(200, {'Content-Type': mime.lookup(path.basename(absPath)) + '; charset=utf-8'});
                    response.write(data);
                    response.end();
                });
            }
            else
                app.send404(response);
        });
    },
    sendResponse: function(json, resp){
        resp.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
        resp.write(JSON.stringify(json));
        resp.end();
    },
    send404: function(resp){
        resp.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
        resp.write(JSON.stringify({status: false, error: 'Cannot process command'}));
        resp.end();
    }
};

app.init();