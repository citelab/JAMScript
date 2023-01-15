#!/usr/bin/env node

// Main Compiler Version 2.0
// January 2023

const fs = require("fs"),
    child_process = require("child_process"),
    crypto = require("crypto"),
    path = require("path"),
    callGraph = require("./lib/ohm/jamscript/callGraph"),
    jam = require("./lib/ohm/jamscript/jam"),
    os = require('os');
const JSZip = checkedRequire("jszip", "ERROR! jsZip not installed. Install jsZip first using 'npm install jszip'");

// global parameters 
let preprocessDecls;
let tmpDir = "/tmp/jam-" + randomValueHex(20);
let homeDir = os.homedir();

// Core of the compiler 
let args = processArgs();
validateArgs(args);
runMain(args);
// End of the core

function runMain(cargs) {
    let preprocessed;
    let lineNumber;

    try {
        fs.mkdirSync(tmpDir);
        try {
            var preprocessedOutput = preprocess(cargs.cPath, cargs);
            preprocessed = preprocessedOutput.program;
            lineNumber = preprocessedOutput.lineNumber;
        } catch (e) { 
            printAndExit("Exiting with preprocessor error");
        }
        
        if (cargs.preprocessOnly) 
            printAndExit(preprocessed);

        let results = jam.compile(preprocessed, fs.readFileSync(cargs.jsPath).toString(),
                                    lineNumber, cargs.yieldPoint);
        cargs.cSideEffectTable = results.C_SideEffectTable;
        cargs.jsSideEffectTable = results.JS_SideEffectTable;

        if (cargs.callGraphFlag) {
            fs.writeFileSync("callgraph.html", callGraph.createWebpage());
            fs.writeFileSync("callgraph.dot", callGraph.createDOT());
        }

        if (!cargs.noCompile) {
            let task = nativeCompile(results.C, cargs);
            task.then(function (value) {
                    results.manifest = createManifest(cargs.outPath, results.maxLevel);
                    createZip(
                        results.JS,
                        results.manifest,
                        results.jstart,
                        tmpDir,
                        cargs
                    );
                    if (!cargs.debug) {
                        for (var i = 0; i < value.length; i++) {
                            console.log(value[i]);
                        }
                        deleteFolderRecursive(tmpDir);
                    }
            }).catch(function (error) {
                console.log(error);
            });
        }
    } catch (e) {
        console.log("ERROR:");
        console.log(e);
    }
}

function nativeCompile(code, cargs) {
    return new Promise(function (resolve, reject) {
        // Set platform options
        let options = "";
        if (process.platform === "darwin") {
            // Mac
            options = "-framework CoreFoundation";
        } else {
            // Linux
            options = "-lm";
        }
        if (cargs.debug) {
            options += " -fno-omit-frame-pointer -fsanitize=address";
        }

        const includes = [
                'jam'
            ]
            .map((lib) => `#include <${lib}.h>`)
            .join("\n") + "\n";

        fs.writeFileSync(
            `${tmpDir}/jamout.c`,
            includes + preprocessDecls.join("\n") + "\n" + code
        );

        try {
            var command = `clang -g ${tmpDir}/jamout.c -o ${tmpDir}/a.out -I/usr/local/include -I${homeDir}/.jamruns/clib/include -I${homeDir}/.jamruns/clib/src ${options} -pthread -ltinycbor -lmosquitto -lmujs ${homeDir}/.jamruns/clib/libjam.a -L/usr/local/lib`;
            console.log("Compiling C code...");
            if (cargs.verbose) {
                console.log(command);
            }
            // This prints any errors to stderr automatically, so no need to show the error again
            child_process.execSync(command, {
                stdio: [0, 1, 2],
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

function preprocess(file, cargs) {
    console.log("Preprocessing...");

    let contents = fs.readFileSync(file).toString();
    preprocessDecls = contents.match(/^[#;].*/gm);
    if (preprocessDecls === null) {
        preprocessDecls = [];
    }
    let includes = '#include "jam.h"\n';
    let originalProgram = contents;
    contents = includes + "int main();\n" + contents;

    fs.writeFileSync(`${tmpDir}/pre.c`, contents);
    let command = `clang -E -P -I/usr/local/include -I${homeDir}/.jamruns/jamhome/deps/fake_libc_include -I${homeDir}/.jamruns/clib/include ${tmpDir}/pre.c`;

    if (cargs.verbose) 
        console.log(command);

    let preprocessedProg = child_process.execSync(command).toString();
    if (cargs.debug)
        fs.writeFileSync(`${tmpDir}/pre2.c`, preprocessedProg);
    let index = preprocessedProg.indexOf("int main();\n");
    let tmp = preprocessedProg.substring(0, index);
    let lineNumber = tmp.split("\n").length;
    return {
        program: preprocessedProg,
        lineNumber: lineNumber,
    };
}

function createZip(jsout, mout, jstart, tmpDir, cargs) {
    let zip = new JSZip();
    zip.file("MANIFEST.txt", mout);
    zip.file("jamout.js", jsout);
    zip.file("jstart.js", jstart);

    zip.file("a.out", fs.readFileSync(`${tmpDir}/a.out`));
    zip.file("dummysched.js", fs.readFileSync(__dirname + '/lib/jside/dummysched.js'));

    if (cargs.supFiles !== undefined && cargs.supFiles.length > 0)
        cargs.supFiles.forEach(function (e) {
            var st = fs.statSync(e);
            if (st.isDirectory()) {
                var dir = fs.readdirSync(e);
                process.chdir(e);
                dir.forEach(function (f) {
                    console.log("Copying file: ", e + "/" + f);
                    zip
                        .folder(path.basename(e))
                        .file(path.basename(f), fs.readFileSync(f));
                });
                process.chdir("..");
            } else {
                console.log("Copying file: ", e);
                zip.file(path.basename(e), fs.readFileSync(e));
            }
        });
    zip
        .generateNodeStream({
            type: "nodebuffer",
            streamFiles: true,
        })
        .pipe(fs.createWriteStream(`${cargs.outPath}.jxe`));
}

function createManifest(cargs, level) {
    let mout;
    let ctime = new Date().getTime();

    mout = "VERSION = 1.0\n";
    mout += "DESCRIPTION = JAMScript executable file\n";
    mout += `NAME = ${cargs.outPath}\n`;
    mout += `CREATE-TIME = ${ctime}\n`;
    mout += `MAX-HEIGHT = ${level}\n`;
    mout += `C-SIDE-EFFECT = ${JSON.stringify(cargs.cSideEffectTable)}\n`;
    mout += `JS-SIDE-EFFECT = ${JSON.stringify(cargs.jsSideEffectTable)}\n`;
    return mout;
}

function randomValueHex(len) {
    return crypto
        .randomBytes(Math.ceil(len / 2))
        .toString("hex") // convert to hexadecimal format
        .slice(0, len); // return required number of characters
}

function deleteFolderRecursive(path) {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function (file) {
            let curPath = path + "/" + file;
            if (fs.lstatSync(curPath).isDirectory()) {
                // recurse
                deleteFolderRecursive(curPath);
            } else {
                // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
}


function validateArgs(cargs) {
    let inputError = false;

    if (cargs.cPath === undefined) {
        console.error("Error: C input file not specified");
        inputError = true;
    } else if (!fs.existsSync(cargs.cPath)) {
        console.error("File not found: " + cargs.cPath);
        inputError = true;
    }
    if (cargs.jsPath === undefined) {
        console.error("Error: JavaScript input file not specified");
        inputError = true;
    } else if (!fs.existsSync(cargs.jsPath)) {
        console.error("File not found: " + cargs.jsPath);
        inputError = true;
    }
    if (inputError) {
        process.exit(1);
    }
}

function printHelp() {
    console.log("\n");
    console.log("JAMScript Transpiler Version 2.0");
    console.log("USAGE: jamc [options] <inputs>");
    console.log("\nOptions:");
    console.log("\t-d\t --debug \t Debug mode");
    console.log("\t-h\t --help \t Display available options");
    console.log("\t-n\t --nocompile \t Skip compilation");
    console.log("\t-o\t --output \t Set output file name (.jxe)");
    console.log("\t-p\t --preprocess \t Preprocessor only");
    console.log("\t-v\t --version \t Print version information");
    console.log("\t-V\t --verbose \t Turn on verbose mode");
    console.log("\t-a\t --analyze \t Analyze the source and output call graph");
    console.log("\n");
}

// Process command arguments and return a structure
function processArgs() {
    let args = process.argv.slice(2);
    let conf = {
        cPath: undefined,
        jsPath: undefined,
        outPath: undefined,
        supFiles: [],
        debug: false,
        noCompile: false,
        preprocessOnly: false,
        verbose: false,
        callGraphFlag: false,
        yieldPoint: false,
        cSideEffectTable: "None",
        jsSideEffectTable: "None"
    };

    for (var i = 0; i < args.length; i++) {
        if (args[i].charAt(0) === "-") {
            if (args[i] === "-d" || args[i] === "--debug") {
                conf.debug = true;
            } else if (args[i] === "-h" || args[i] === "--help") {
                printHelp();
                process.exit(0);
            } else if (args[i] === "-n" || args[i] === "--nocompile") {
                conf.noCompile = true;
            } else if (args[i] === "-o" || args[i] === "--output") {
                // Set output name
                conf.outPath = args[i + 1];
                i = i + 1;
            } else if (args[i] === "-p" || args[i] === "--preprocess") {
                // Preprocessor only
                conf.preprocessOnly = true;
            } else if (args[i] === "-v" || args[i] === "--version") {
                // Print version
                console.log(require("./package.json").version);
                process.exit(0);
            } else if (args[i] === "-V" || args[i] === "--verbose") {
                // Verbose
                conf.verbose = true;
            } else if (args[i] === "-a" || args[i] === "--analyze") {
                // Generate call graph files
                conf.callGraphFlag = true;
            } else if (args[i] === "-y" || args[i] === "yield") {
                conf.yieldPoint = true;
            }
        } else {
            let inputPath = args[i];
            let extension = path.extname(inputPath);
            if (extension === ".js") {
                if (conf.jsPath === undefined) {
                    conf.jsPath = inputPath;
                    if (conf.outPath === undefined) {
                        conf.outPath = path.basename(inputPath, ".js");
                    }
                } else {
                    conf.supFiles.push(inputPath);
                }
            } else if (extension === ".c") {
                conf.cPath = inputPath;
            } else {
                if (path.extname(inputPath) !== ".jxe") conf.supFiles.push(inputPath);
            }
        }
    }

    return conf;
}

function checkedRequire(lib, msg) {
    try {
        return require(lib);
    } catch(e) {
        console.log(msg);
        process.exit(1);
    }
}