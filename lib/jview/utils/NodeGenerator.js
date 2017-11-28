// Generates the index.js where the Node service hosts static assets and socket.io

// Import npm dependencies and StoreGenerator
var fsPath = require('fs-path');
var fs = require('fs');
var storeGenerator = require('./StoreGenerator.js');

module.exports = {
    // 1. Write code to set up express server
    expressSetup:function (path, port, maxMemorySize) {
        fsPath.writeFile(path+'/index.js', '// Root File for Node Service ', function (err, data) {
            if(err) throw err;
            console.log('Index.js Written');

            // Create a write stream, and add in/extend with the writeLine() method
            var ws = fs.createWriteStream(path+'/index.js', {flags: 'a'})
            ws.writeLine = (str)=> {
                ws.write('\n');
                ws.write(str);
            };
            ws.writeLine(__ImportDependencies__);
            ws.writeLine(__WebpackSetup__);
            ws.writeLine(__AppSetup(port));
            if(!maxMemorySize) {
                ws.writeLine(__SocketIOSetup__);
            } else {
                ws.writeLine(__SocketIOSetupWithMaxSize(maxMemorySize));
            }
        });
    },

    // 1. Write code to set up socket.io server
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
        ws.writeLine(__SocketIOSetup__);
    });
    }
}


// Static and boring boilerplates

// write code to import npm dependencies
const __ImportDependencies__ = "const express = require('express');\
const http = require('http');\
const bodyParser = require('body-parser');\
const socketIo = require('socket.io');\
const webpack = require('webpack');\
const webpackDevMiddleware = require('webpack-dev-middleware');\
const webpackConfig = require('./webpack.config.js');\
const app = express();\
const server = http.createServer(app);\
const io = socketIo(server);"

// write code to set up webpack and HMR
const __WebpackSetup__ = "webpackConfig.plugins.push(new webpack.HotModuleReplacementPlugin());\
app.use(express.static(__dirname+'/'));\
app.use(webpackDevMiddleware(webpack(webpackConfig)));\
app.use(bodyParser.urlencoded({extended:false}));\
app.use(require('webpack-hot-middleware')(webpack(webpackConfig)));"

// write code to set up Express server at a defined port
const __AppSetup = (port) => {
    return "server.listen("+port+");\
    app.get('*', (req, res) => {\
    console.log('Orignal Path: ' + req.url);\
    res.sendFile(__dirname+'/index.html');\
    });\
    console.log('Server Has Been Hosted On Port : "+port+"');";
};

// write code to set up socket.io services on the same port
const __SocketIOSetup__ = "io.on('connection', socket => {\
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
    socket.on('emitValue', body => {\
        console.log(body);\
        if (body.id === '1') {\
            let randomIdx = Math.floor((Math.random() * 3) + 0);\
            let states = ['state_1', 'state_2', 'state_3'];\
            let randomState = states[randomIdx];\
            socket.emit('changeValue', {\
                id: '4',\
                name: 'currentState',\
                value: randomState\
            })\
        }\
        if (body.id === '2') {\
            socket.emit('changeValue', {\
                id: '3',\
                name: 'disabledState3',\
                value: true\
            })\
        } else if (body.id === '5') {\
            setTimeout(() => {\
            socket.emit('terminalResponse', {\
                id: '5',\
                value: 'Command not recognized'\
            })\
            }, 500)\
        }\
    });\
});"

// write code to set up socket.io services with the node service as the main memory store
const __SocketIOSetupWithMaxSize = (maxMemorySize) => {return "\
    var array = [];\
    const maxMemorySize = "+maxMemorySize+";\
io.on('connection', socket => {\
console.log('connected');\
socket.on('message', body => {\
    socket.broadcast.emit('message', {\
        body,\
        from: socket.id.slice(8)\
    });\
});\
socket.on('newDataPoint', body => {\
    console.log('new data point received: ' + body.x + ',' + body.y);\
    array.push([body.x,body.y]);\
    var arrayToBoardCast = array;\
    if(array.length>maxMemorySize){\
        arrayToBoardCast = array.slice(-maxMemorySize);\
    }\
    console.log(arrayToBoardCast);\
    socket.broadcast.emit('setArray',{\
        array:arrayToBoardCast,\
        body\
    })\
});\
socket.on('disconnect', function() {\
    console.log('disconnect');\
    });\
});"}