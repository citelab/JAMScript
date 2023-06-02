#!/usr/bin/env node

var fs = require('fs'),
	path = require('path'),
	child_process = require('child_process'),
	crypto = require('crypto'),
	jam = require('./lib/ohm/jamscript/jam');

var args = process.argv.slice(2);
var tmpDir = "/tmp/jam-" + randomValueHex(20);
var jsPath;
var cPath;

var preprocessDecls;


for (var i = 0; i < args.length; i++) {
	var inputPath = args[i];
    var extension = path.extname(inputPath);
    if (extension === '.js') {
        jsPath = inputPath;
    } else if (extension === '.c') {
        cPath = inputPath;
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
        var preprocessedOutput = preprocess(cPath, false);
        var preprocessed = preprocessedOutput.program;
        var lineNumber = preprocessedOutput.lineNumber;
    } catch (e) {
    	console.log(e);
        console.log("Exiting with preprocessor error");
        process.exit();
    }


	var results = jam.compile(preprocessed, fs.readFileSync(jsPath).toString(), lineNumber);

	var tasks = [
            compile(results.C, false)
        ];

	Promise.all(tasks).then(
		function(value) {
			deleteFolderRecursive(tmpDir);
            console.log(value);
		},
		function(error) {
			console.log(error);
		}
	);

} catch(e) {
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