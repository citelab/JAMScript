// Generates the index.js where the Node service hosts static assets and socket.io
var fsPath = require('fs-path');
var fs = require('fs');
var storeGenerator = require('./StoreGenerator.js');

module.exports = {
    expressSetup:function (path, port) {
        fsPath.writeFile(path+'/index.js', '// Root File for Node Service ', function (err, data) {
            if(err) throw err;
            console.log('Index.js Written');
            // Create a write stream, and add in/extend with the writeLine() method
            var ws = fs.createWriteStream(path+'/index.js', {flags: 'a'})
            ws.writeLine = (str)=> {
                ws.write('\n');
                ws.write(str);
            };
            ws.writeLine(ImportDependencies);
            ws.writeLine(WebpackSetup);
            ws.writeLine(AppSetup(port));
            ws.writeLine(SocketIOSetup);

        });
    },
    socketSetup: function (path,socketId) {
    fsPath.writeFile(path+'/index.js', '// Root File for Node Service ', function (err, data) {
        if(err) throw err;
        console.log('Index.js Written');
        // Create a write stream, and add in/extend with the writeLine() method
        var ws = fs.createWriteStream(path+'/index.js', {flags: 'a'})
        ws.writeLine = (str)=> {
            ws.write('\n');
            ws.write(str);
        };
        ws.writeLine(SocketIOSetup);
    });
    }
}




// Static boilerplates
const ImportDependencies = "const express = require('express');\
const http = require('http');\
const bodyParser = require('body-parser');\
const socketIo = require('socket.io');\
const webpack = require('webpack');\
const webpackDevMiddleware = require('webpack-dev-middleware');\
const webpackConfig = require('./webpack.config.js');\
const app = express();\
const server = http.createServer(app);\
const io = socketIo(server);"
const WebpackSetup = "webpackConfig.plugins.push(new webpack.HotModuleReplacementPlugin());\
app.use(express.static(__dirname+'/'));\
app.use(webpackDevMiddleware(webpack(webpackConfig)));\
app.use(bodyParser.urlencoded({extended:false}));\
app.use(require('webpack-hot-middleware')(webpack(webpackConfig)));"
const AppSetup = (port) => {
    return "server.listen("+port+");\
    app.get('*', (req, res) => {\
    console.log('Orignal Path: ' + req.url);\
    res.sendFile(__dirname+'/index.html');\
    });\
    console.log('Server Has Been Hosted On Port : "+port+"');";
};

const SocketIOSetup = "io.on('connection', socket => {\
console.log('connected');\
socket.on('message', body =>{\
    socket.broadcast.emit('message', {\
        body,\
        from: socket.id.slice(8)\
    });\
});\
socket.on('newDataPoint', body =>{\
    console.log('new data point received: '+body.x+','+body.y);\
    socket.broadcast.emit('newDataPoint', {\
        body,\
        from: socket.id.slice(8)\
    });\
});\
socket.on('disconnect', function() {\
    console.log('disconnect');\
});\
});"