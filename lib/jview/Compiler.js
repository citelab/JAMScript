var fs = require('fs');
var os = require('os');
var fsPath = require('fs-path');
var ncp = require('ncp').ncp;

const webpackGenerator = require('./utils/WebpackGenerator.js');
const pageGenerator = require('./utils/PageGenerator.js');
const nodeGenerator = require('./utils/NodeGenerator.js');

process.argv.forEach(function (val, index, array) {
    console.log(index + ': ' + val);
});

fs.readFile(process.argv[2], 'utf8', function(err,data){
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
    fsPath.writeFile(config.path+'/index.html', static_HTML, function (err, data) {
        if (err) throw err;
    })
    // Step 5, Generate a node service file that will serve up Socket.io and React files
    // nodeGenerator.socketSetup(config.path, 1);
    nodeGenerator.expressSetup(config.path, config.port);
    // Step 6, Copy lib folder into the app project
    fsPath.mkdir(config.path+'/lib', function(err){
        console.log('ok');
        ncp('./lib', config.path+'/lib', function (err){
            if (err) throw err;
            console.log ('Copied Library into App Folder');
        })
    })
    // Step 7, Generate a package.json file based on user's definition
    fs.readFile('./utils/Default.json', 'utf8', function (err, data) {
        var outputPackage = JSON.parse(data); //loads in default package
        if (config.package.name) outputPackage.name = config.package.name
        if (config.package.version) outputPackage.version = config.package.version
        if (config.package.description) outputPackage.description = config.package.description
        if (config.package.author) outputPackage.author = config.package.author
        fsPath.writeFile(config.path+'/package.json', JSON.stringify(outputPackage, null, 2), function (err) {
            if (err) throw err;
        });
    });
})

const static_HTML = "<html>\
<head>\
<link href=\"https://fonts.googleapis.com/css?family=Slabo+27px\" rel=\"stylesheet\">\
    </head>\
    <body>\
    <div id=\"app\"></div>\
    <script src=\"/main.min.js\"></script>\
    </body>\
    </html>";

