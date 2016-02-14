var c    = require('./lib/c'),
    fs   = require('fs'),
    path = require('path');


function puterror(emsg) {
    console.error("ERROR! " + emsg);
    process.exit(1);
}


function putwarning(emsg) {
    console.error("WARN! " + emsg);
}


function assure(file, extension) {
    if(fs.existsSync(file))
        return file;

    if(fs.existsSync(file + extension))
        return file + extension;

    puterror("File does not exist: " + file);
}


function maketarget(p, ext) {
    if (ext === undefined)
        puterror("Extension must be specified..");

        console.log(path.dirname(p));
        console.log(path.basename(p));

    return path.join(path.dirname(p), [path.basename(p, path.extname(p)), ext].join(''));
}


var cmd = {

    /**
     * There is quite a bit redundancy here in the functions for the different commands.
     * It is ok for now. We need to change them as the compiler evolves..
     */

    /**
     * Parse the JAMScript input to AST
     */
    parse: function(source, target) {
        var code   = fs.readFileSync(assure(source, ".jm"), 'utf8'),
        result = c.parse(code);

        if (target === undefined) {
            target = maketarget(source, ".ast");
            putwarning("Using default target .. " + target);
        }

        console.log("Writing parse result (AST) to " + target);
        fs.writeFileSync(target, result, 'utf8');
    },

    /**
     * Translate AST to C and JS
     */
    translate: function(source, target) {
        var code   = fs.readFileSync(assure(source, ".jm"), 'utf8'),
        result = c.translate(code);

        if (target === undefined) {
            target = maketarget(source, ".c");
            putwarning("Using default target .. " + target);
        }

        console.log("Translating the AST to " + target);
        fs.writeFileSync(target, result, 'utf8');
    },

    /**
     * Compile JAMScript to C and JS (combination of the parse and translate)
     */
    compile: function(source, target) {
        var code   = fs.readFileSync(assure(source, ".jm"), 'utf8'),
        result = c.compile(code);

        if (target === undefined) {
            target = maketarget(source, ".c");
            putwarning("Using default target .. " + target);
        }

        console.log("Compiling the source to " + target);
        fs.writeFileSync(target, result, 'utf8');
    },

    /**
     * Compile JAMScript to C
     */
    jm2c: function(source, target) {
        var code   = fs.readFileSync(assure(source, ".jm"), 'utf8'),
        result = c.compile(code);

        if (target === undefined) {
            target = maketarget(source, ".c");
            putwarning("Using default target .. " + target);
        }

        console.log("Compiling the source to " + target);
        fs.writeFileSync(target, result, 'utf8');
    },

    /**
     * Compile JAMScript to JS
     */
    jm2js: function(source, target) {
        var code   = fs.readFileSync(assure(source, ".jm"), 'utf8'),
        result = c.compile(code);

        if (target === undefined) {
            target = maketarget(source, ".js");
            putwarning("Using default target .. " + target);
        }

        console.log("Compiling the source to " + target);
        fs.writeFileSync(target, result, 'utf8');
    }
}

var commands = "  compile SOURCE [TARGET]\n  run SOURCE\n  watch SOURCE TARGET"

if(process.argv[2] === undefined)
    puterror("Specify action to execute as first parameter:\n" + commands);
if (process.argv[3] === undefined)
    puterror("Source must be specified.");

var action = cmd[process.argv[2]];
if(typeof action !== 'function')
    puterror("Not a valid action, try:\n" + commands);

// Execute Action
action.apply(this, process.argv.slice(3));
node /usr/local/share/jam/jamc.js /usr/local/share/jam/lib/jamlib/jamlib.a "$@" 
