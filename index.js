#!/usr/bin/env node

var fs = require('fs'),
    JSZip = require('jszip'),
    child_process = require('child_process'),
    crypto = require('crypto'),
    path = require('path'),
    callGraph = require('./lib/ohm/jamscript/callGraph'),
    jam = require('./lib/ohm/jamscript/jam');

var preprocessDecls;

// Flags
var callGraphFlag = false,
    debug = false,
    noCompile = false,
    // parseOnly = false,
    preprocessOnly = false,
    // translateOnly = false,
    verbose = false;

// Process arguments

var args = process.argv.slice(2);
var tmpDir = "/tmp/jam-" + randomValueHex(20);
var cPath;
var jsPath;
var outPath;
var supFiles = [];

for (var i = 0; i < args.length; i++) {
    if (args[i].charAt(0) === "-") {
        if (args[i] === "-D" || args[i] === "-d") {             // Debug mode
            debug = true;
        } else if (args[i] === "-h" || args[i] === "--help") {  // Help
            printHelp();
            process.exit(0);
        } else if (args[i] === "-N") {                          // Don't compile
            noCompile = true;
        } else if (args[i] === "-o") {                          // Set output name
            outPath = args[i + 1];
            i = i + 1;
        } else if (args[i] === "-P") {                          // Preprocessor only
            preprocessOnly = true;
        } else if (args[i] === "-v") {                          // Print version
            console.log(require('./package.json').version);
            process.exit(0);
        } else if (args[i] === "-V") {                          // Verbose
            verbose = true;
        } else if (args[i] === "--analyze") {                   // Generate call graph files
            callGraphFlag = true;
        }
        // } else if(args[i] === "-T") {                        // Translator only
        //   translateOnly = true;
        // } else if(args[i] === "-A") {                        // Parser only
        //   parseOnly = true;
        // }
    } else {
        var inputPath = args[i];
        var extension = path.extname(inputPath);
        if (extension === '.js') {
            if (jsPath === undefined) {
                jsPath = inputPath;
                if (outPath === undefined) {
                    outPath = path.basename(inputPath, '.js');
                }
            } else {
                supFiles.push(inputPath);
            }
        } else if (extension === '.c') {
            cPath = inputPath;
        } else {
            if (path.extname(inputPath) !== '.jxe')
                supFiles.push(inputPath);
        }
    }
}

var inputError = false;
if (cPath === undefined) {
    console.error("Error: C input file not specified");
    inputError = true;
} else if (!fs.existsSync(cPath)) {
    console.error("File not found: " + cPath);
    inputError = true;
}
if (jsPath === undefined) {
    console.error("Error: JavaScript input file not specified");
    inputError = true;
} else if (!fs.existsSync(jsPath)) {
    console.error("File not found: " + jsPath);
    inputError = true;
}
if (inputError) {
    process.exit(1);
}

try {
    fs.mkdirSync(tmpDir);
    try {
        var preprocessedOutput = preprocess(cPath, verbose);
        var preprocessed = preprocessedOutput.program;
        var lineNumber = preprocessedOutput.lineNumber;
    } catch (e) {
        console.log("Exiting with preprocessor error");
        process.exit();
    }
    if (preprocessOnly) {
        printAndExit(preprocessed);
    }

    // if(parseOnly) {
    //   printAndExit(cTree + jsTree);
    // }

    var results = jam.compile(preprocessed, fs.readFileSync(jsPath).toString(), lineNumber);

    if (callGraphFlag) {
        fs.writeFileSync("callgraph.html", callGraph.createWebpage());
        fs.writeFileSync("callgraph.dot", callGraph.createDOT());
    }

    // if(translateOnly) {
    //   printAndExit(output);
    // }


    if (!noCompile) {
        var tasks = [
            flowCheck(results.annotated_JS, verbose),
            compile(results.C, verbose)
        ];



        // child_process.execSync(`gcc -Wno-incompatible-library-redeclaration -shared -o ${tmpDir}/libjamout.so -fPIC ${tmpDir}/jamout.c ${jamlibPath} -lpthread`);
        Promise.all(tasks).then(function(value) {
            results.manifest = createManifest(outPath, results.maxLevel);
            results.jstart = createJStart(results.hasJdata);
            // TODO here
            createZip(results.JS, results.manifest, results.jstart, tmpDir, outPath);
            if (!debug) {
                for (var i = 0; i < value.length; i++) {
                    console.log(value[i]);
                }
                deleteFolderRecursive(tmpDir);
            }
        }, function(error) {
            console.log(error);
        });

    }
} catch (e) {
    console.log("ERROR:");
    console.log(e);
}

function compile(code, verbose) {
    return new Promise(function(resolve, reject) {
        // Set platform options
        var options = "";
        if (process.platform === "darwin") {
            // Mac
            options = "-framework CoreFoundation";
        } else {
            // Linux
            options = "-lm -lbsd";
        }
        if (debug) {
            options += " -fno-omit-frame-pointer -fsanitize=address";
        }
        var includes = '#include "jam.h"\n';
        includes = '#include "command.h"\n' + includes;
        includes = '#include "jamdata.h"\n' + includes;
        includes = '#include "jamdevices.h"\n' + includes;
        includes = '#include <unistd.h>\n' + includes;


        fs.writeFileSync("jamout.c", includes + preprocessDecls.join("\n") + "\n" + code);
        fs.writeFileSync(`${tmpDir}/jamout.c`, includes + preprocessDecls.join("\n") + "\n" + code);
        try {
            var command = `clang -g ${tmpDir}/jamout.c -o ${tmpDir}/a.out -I/usr/local/include -I/usr/local/share/jam/lib/ ${options} -pthread -lcbor -lnanomsg /usr/local/lib/libjam.a -ltask -levent -lhiredis -lmujs -L/usr/local/lib -lpaho-mqtt3a`;
            console.log("Compiling C code...");
            if (verbose) {
                console.log(command);
            }
            // This prints any errors to stderr automatically, so no need to show the error again
            child_process.execSync(command, {
                stdio: [0, 1, 2]
            });
        } catch (e) {
            reject("Compilation failed");
        }
        resolve("Compilation finished");
    });
}

function printAndExit(output) {
    console.log(output);
    process.exit();
}

function preprocess(file, verbose) {
    console.log("Preprocessing...");

    var contents = fs.readFileSync(file).toString();
    preprocessDecls = contents.match(/^[#;].*/gm);
    if (preprocessDecls === null) {
        preprocessDecls = [];
    }
    var includes = '#include "jam.h"\n';

    var originalProgram = contents

    contents = includes + "int main();\n" + contents;

    fs.writeFileSync(`${tmpDir}/pre.c`, contents);
    var command = `clang -E -P -I/usr/local/include -I/usr/local/share/jam/deps/fake_libc_include -I/usr/local/share/jam/lib ${tmpDir}/pre.c`;
    if (verbose) {
        console.log(command);
    }
    
    var preprocessedProg = child_process.execSync(command).toString();
    var index = preprocessedProg.indexOf("int main();\n");
    var tmp = preprocessedProg.substring(0, index);
    var lineNumber = tmp.split('\n').length;
    return {
        program: preprocessedProg,
        lineNumber: lineNumber
    };
}

function flowCheck(input, verbose) {
    return new Promise(function(resolve, reject) {
        // Returns empty buffer if flow installed
        var hasFlow = child_process.execSync("flow version >/dev/null 2>&1 || { echo 'not installed';}");

        if (hasFlow.length === 0) {
            fs.writeFileSync(`${tmpDir}/.flowconfig`, "");
            fs.writeFileSync(`${tmpDir}/annotated.js`, input);
            var command = `flow ${tmpDir}/annotated.js --color always`;
            console.log("Running Flow type check...");
            if (verbose) {
                console.log(command);
            }
            child_process.exec(command, (error, stdout) => {
                if (error !== null) {
                    reject("JavaScript Type Checking Error:\n" + stdout.substring(stdout.indexOf("\n") + 1));
                } else {
                    resolve("No Flow JavaScript errors found");
                }
            });
            // const child = child_process.exec('flow check-contents --color always', (error, stdout, stderr) => {
            //     if (error !== null) {
            //       console.log("JavaScript Type Checking Error:");
            //       console.log(stdout.substring(stdout.indexOf("\n") + 1));
            //     }
            // });
            // child.stdin.write(input);
            // child.stdin.end();
        } else {
            resolve("Flow not installed, skipping JavaScript typechecking");
        }
    });
}

function createZip(jsout, mout, jstart, tmpDir, outputName) {
    var zip = new JSZip();
    zip.file("MANIFEST.txt", mout);
    zip.file("jamout.js", jsout);
    zip.file("jstart.js", jstart);

    zip.file("a.out", fs.readFileSync(`${tmpDir}/a.out`));

    if (supFiles.length > 0)
        supFiles.forEach(function(e) {
            var st = fs.statSync(e);
            if (st.isDirectory()) {
                var dir = fs.readdirSync(e);
                process.chdir(e);
                dir.forEach(function(f) {
                    console.log("Copying file: ", e + "/" + f);
                    zip.folder(path.basename(e)).file(path.basename(f), fs.readFileSync(f));
                });
                process.chdir("..");
            } else {
                console.log("Copying file: ", e);
                zip.file(path.basename(e), fs.readFileSync(e));
            }
        });
    zip.generateNodeStream({
        type: 'nodebuffer',
        streamFiles: true
    }).pipe(fs.createWriteStream(`${outputName}.jxe`));
}

function createManifest(outName, level) {
    var mout;
    var ctime = new Date().getTime();

    mout = 'VERSION = 1.0\n';
    mout += 'DESCRIPTION = JAMScript executable file\n';
    mout += `NAME = ${outName}\n`;
    mout += `CREATE-TIME = ${ctime}\n`;
    mout += `MAX-HEIGHT = ${level}\n`;

    return mout;
}

// This is to create launcher start script - jstart.js
//
function createJStart(hasj) {
    var mout;

    if (hasj)
        mout = "var jserver = require('jamserver')(true);\n";
    else
        mout = "var jserver = require('jamserver')(false);\n";

    mout += "const {Flow, ParallelFlow, PFlow} = require('flows.js')();\n";
    mout += "var jamlib = jserver.jamlib;\n";
    mout += "jamlib.run(function() {});\n";
    mout += "\n\n";

    return mout;

}


function randomValueHex(len) {
    return crypto.randomBytes(Math.ceil(len / 2))
        .toString('hex') // convert to hexadecimal format
        .slice(0, len); // return required number of characters
}

function deleteFolderRecursive(path) {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function(file) {
            var curPath = path + "/" + file;
            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
}

function printHelp() {
    console.log("USAGE: jamc [options] <inputs> <output name>");
    console.log("\nOptions:");
    console.log("\t-A \t\t\t Parser only");
    console.log("\t-D \t\t\t Debug mode");
    console.log("\t-h \t\t\t Display available options");
    console.log("\t-N \t\t\t Skip compilation");
    console.log("\t-o \t\t\t Set jxe output name");
    console.log("\t-P \t\t\t Preprocessor only");
    console.log("\t-V \t\t\t Verbose mode");
    console.log("\t-T \t\t\t Translator only");
    process.exit();
}
