// import npm modules
var fs = require('fs');
var os = require('os');
var fs = require('fs');
var ncp = require('ncp').ncp;

// import generator modules from utils folder
const webpackGenerator = require('./utils/WebpackGenerator.js');
const pageGenerator = require('./utils/PageGenerator.js');
const nodeGenerator = require('./utils/NodeGenerator.js');

var path = "app";

// read in json file first
fs.readFile(process.argv[2], 'utf8', function(err,data){

    // error detection
    if(err) {
        console.log('Filename has error')
        throw err;
    }

    // Create app folder
    // Increment folder number until finding an unused number
    // const origPath = path;
    // let counter = 1;
    // let itemSet = new Set(fs.readdirSync('.'));
    // while(itemSet.has(path)) {
    //     path = origPath + counter;
    //     counter++;
    // }
    // fs.mkdir(path, function(err) {
    //     if(err) throw err;
    // });

    fs.readdir('.', function(err, items) {
        if(err) throw err;
        const origPath = path;
        let itemSet = new Set(items);
        let counter = 1;
        while(itemSet.has(path)) {
            path = origPath + counter;
            counter++;
        }
        fs.mkdir(path, function(err) {
            if(err) throw err;
             // Step 1, read .json file and parse it
            config = JSON.parse(data);
            
            // Step 2, generate a wepack.config.js file inside of the application folder the user wants to write to
            webpackGenerator(path);

            // Step 3, generate pages based on user's page definition
            pageGenerator(config.pages, path);

            // Step 4, create index.html boilerplate for React application
            fs.writeFile(path+'/index.html', __StaticHTML__, (err) => {
                if (err) throw err;
            });

            // Step 5, Generate a node service file that will serve up Socket.io and React files
            // nodeGenerator.socketSetup(path, 1);
            nodeGenerator.expressSetup(path, config.port, config.maxMemorySize);

            // Step 6, Copy lib folder into the app project
            fs.mkdir(path+'/lib', function(err){
                ncp(process.env.JAMHOME +'/lib/jview/lib', path+'/lib', function (err){
                    if (err) throw err;
                    console.log ('Copied Library into App Folder');
                })
            })
        });
    });
    

   
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
