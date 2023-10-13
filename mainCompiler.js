#!/usr/bin/env node

// Main Compiler Version 2.0
// January 2023

const   fs      = require("fs"),
        child_process = require("child_process"),
        crypto  = require("crypto"),
        path    = require("path"),
        // callGraph = require("./lib/ohm/jamscript/callGraph"),
        jam     = require("./lib/ohm/jamscript/jam"),
        os = require('os'),
        JSZip = require("jszip");

const USAGE = `
jamc [options] <inputs>

JAMScript compiler toolchain for creating JAMScript executable (.jxe) from
source files. It takes the C-side and J-side source files and any data files
(given as a directory) that have to be packaged with the executable.

Options:

    -h (--help)         shows the usage of the compiler (this information).
    -d (--debug)        sets the debug mode in which address sanitizer is linked to the C side
    -p (--preprocess)   launch the preprocessor only
    -o (--output)       sets the output filename
    -V (--version)      prints version information
    -v (--verbose)      turns on verbose mode
    -vv (--extrav)      turns on extra verbosity mode
    -a (--analyze)      analyzes the source and outputs call graph

Inputs:
    Exactly one C side file (with .c extension) and exactly one J side file (with .js extension).
    Optionally a directory with data files.

`

// global parameters
let preprocessDecls;
let tmpDir = "/tmp/jam-" + randomValueHex(20);
let homeDir = os.homedir();

// Core of the compiler
let args = processArgs();
validateArgs(args);
runMain(args);
// End of the core

function ansiiGreen(text) {
    return `\x1b[32m${text}\x1b[0m`;
}

function ansiiYellow(text) {
    return `\x1b[33m${text}\x1b[0m`;
}

function ansiiRed(text) {
    return `\x1b[31m${text}\x1b[0m`;
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
        preprocessOnly: false,
        verbosity: 0,
        callGraphFlag: false
    };

    for (var i = 0; i < args.length; i++) {
        if (args[i].charAt(0) === "-") {
            if (args[i] === "-d" || args[i] === "--debug") {
                conf.debug = true;
            } else if (args[i] === "-h" || args[i] === "--help") {
                console.log(USAGE);
                process.exit(0);
            } else if (args[i] === "-o" || args[i] === "--output") {
                conf.outPath = args[i + 1];
                i = i + 1;
            } else if (args[i] === "-p" || args[i] === "--preprocess") {
                conf.preprocessOnly = true;
            } else if (args[i] === "-V" || args[i] === "--version") {
                console.log(require("./package.json").version);
                process.exit(0);
            } else if (args[i] === "-v" || args[i] === "--verbose") {
                conf.verbosity = 1;
            } else if (args[i] === "-vv" || args[i] === "--extrav") {
                conf.verbosity = 2;
            } else if (args[i] === "-a" || args[i] === "--analyze") {
                // Generate call graph files
                conf.callGraphFlag = true;
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

function validateArgs(cargs) {
    let inputError = false;

    if (cargs.cPath === undefined) {
        console.log("\n");
        console.error(`${ansiiRed("Error:")} C-side input file missing`);
        inputError = true;
    } else if (!fs.existsSync(cargs.cPath)) {
        if (!inputError) console.log("\n");
        console.error(`${ansiiRed("File not found: ")}` + cargs.cPath);
        inputError = true;
    }
    if (cargs.jsPath === undefined) {
        if (!inputError) console.log("\n");
        console.error(`${ansiiRed("Error:")} J-side input file missing`);
        inputError = true;
    } else if (!fs.existsSync(cargs.jsPath)) {
        if (!inputError) console.log("\n");
        console.error(`${ansiiRed("File not found: ")}` + cargs.jsPath);
        inputError = true;
    }
    if (inputError) {
        console.log("\n");
        process.exit(1);
    }
}


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
                                  lineNumber, args.verbosity);

        cargs.cSideEffectTable = results.C_SideEffectTable;
        cargs.jsSideEffectTable = results.JS_SideEffectTable;

        // if (cargs.callGraphFlag) {
        //     fs.writeFileSync("callgraph.html", callGraph.createWebpage());
        //     fs.writeFileSync("callgraph.dot", callGraph.createDOT());
        // }

        if (!cargs.noCompile) {
            let task = nativeCompile(results.C, cargs);
            task.then(function (value) {
                    results.manifest = createManifest(cargs.outPath, results.hasJdata);
                    createZip(
                        results.JS,
                        results.C,
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
            options += " -fno-omit-frame-pointer -fsanitize=address -Wall";
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
            var command = `clang -g ${tmpDir}/jamout.c -o ${tmpDir}/a.out -I/usr/local/include -I${homeDir}/.jamruns/clib/include -I${homeDir}/.jamruns/clib/src ${options} -pthread -ltinycbor -lmosquitto -lhiredis -levent  ${homeDir}/.jamruns/clib/libjam.a  ${homeDir}/.jamruns/jamhome/deps/mujs2/build/release/libmujs.a -L/usr/local/lib`;

            let err = child_process.spawnSync('ld', ['-lwiringPi']).stderr;
            if(err == null || !err.includes("-lwiringPi"))
                command += " -lwiringPi";
            if (args.verbose) console.log("Compiling C code...");
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

    if (args.verbose) console.log("Preprocessing...");

    let contents = fs.readFileSync(file).toString();
    preprocessDecls = contents.match(/^[#;].*/gm);
    if (preprocessDecls === null) {
        preprocessDecls = [];
    }
    let originalProgram = contents;

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

function createZip(jsout, cout, mout, jstart, tmpDir, cargs) {
    let zip = new JSZip();
    zip.file("MANIFEST.txt", mout);
    zip.file("jamout.js", jsout);
    zip.file("jamout.c", cout); // TODO this should be removed eventually but is very useful for debugging
    zip.file("jstart.js", jstart);

    // Include debug symbols if they are there.
    // if(fs.existsSync(`${tmpDir}/a.out.dSYM`)) {
	//     fs.cpSync(`${tmpDir}/a.out.dSYM`, `${cargs.outPath}.dSYM`, {recursive: true});
	//     zip.file("a.out.dSYM", fs.readFileSync(`${tmpDir}/a.out.dSYM`))
    // }

    zip.file("a.out", fs.readFileSync(`${tmpDir}/a.out`));

    if (cargs.supFiles !== undefined && cargs.supFiles.length > 0)
        cargs.supFiles.forEach(function (e) {
            var st = fs.statSync(e);
            if (st.isDirectory()) {
                var dir = fs.readdirSync(e);
                process.chdir(e);
                dir.forEach(function (f) {
                    if (args.verbose) console.log("Copying file: ", e + "/" + f);
                    zip
                        .folder(path.basename(e))
                        .file(path.basename(f), fs.readFileSync(f));
                });
                process.chdir("..");
            } else {
                if (args.verbose) console.log("Copying file: ", e);
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

function createManifest(cargs, hasJ) {
    let mout;
    let ctime = new Date().getTime();

    mout = "VERSION = 2.0\n";
    mout += "DESCRIPTION = JAMScript executable file\n";
    mout += `NAME = ${cargs.outPath}\n`;
    mout += `CREATE-TIME = ${ctime}\n`;
    mout += `JDATA = ${hasJ}\n`;
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
