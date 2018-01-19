// import npm modules
var fs = require('fs');
var os = require('os');
var fsPath = require('fs-path');
var ncp = require('ncp').ncp;

// import generator modules from utils folder
const webpackGenerator = require('./utils/WebpackGenerator.js');
const pageGenerator = require('./utils/PageGenerator.js');
const nodeGenerator = require('./utils/NodeGenerator.js');

// get arguments
process.argv.forEach(function (val, index, array) {
    console.log(index + ': ' + val);
});

// read in json file first
fs.readFile(process.argv[2], 'utf8', function(err,data){

    // error detection
    if(err) {
        console.log('Filename has error')
        throw err;
    }

    // Step 1, read .json file and parse it
    config = JSON.parse(data)

    // Step 2, generate a wepack.config.js file inside of the application folder the user wants to write to
    webpackGenerator(config.path)

    // Step 3, generate pages based on user's page definition
    pageGenerator(config.pages, config.path)

    // Step 4, create index.html boilerplate for React application
    fsPath.writeFile(config.path+'/index.html', __StaticHTML__, function (err, data) {
        if (err) throw err;
    })

    // Step 5, Generate a node service file that will serve up Socket.io and React files
    // nodeGenerator.socketSetup(config.path, 1);
    nodeGenerator.expressSetup(config.path, config.port,config.maxMemorySize);

    // Step 6, Copy lib folder into the app project
    fsPath.mkdir(config.path+'/lib', function(err){
        console.log('ok');
        ncp('./lib', config.path+'/lib', function (err){
            if (err) throw err;
            console.log ('Copied Library into App Folder');
        })
    })
})

// boring biolerplate
const __StaticHTML__ = "<html>\
<head>\
<link href=\"https://fonts.googleapis.com/css?family=Slabo+27px\" rel=\"stylesheet\">\
    </head>\
    <body>\
    <div id=\"app\"></div>\
    <script src=\"/main.min.js\"></script>\
    </body>\
    </html>";

