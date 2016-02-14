var ometa = require('./deps/ometa'),
    JAMCParser = require('./lib/jamscript/grammars/jamc_parser.ojs'),
    JAMCTranslator = require('./lib/jamscript/grammars/jamc_translator.ojs'),
    fs = require('fs'),
    JSZip = require('jszip'),
    child_process = require('child_process'),
    crypto = require('crypto');

var args = process.argv.slice(2);
var jamlibPath = args[0];
var inputPath = args[1];
var tmpDir = "/tmp/jam-" + randomValueHex(20);
if(args.length < 2) {
  inputArgsError();
  process.exit(1);
}
if(args.length > 2) {
  var outputName = args[2];
} else {
  var outputName = "jamout";
}

if(process.platform == "darwin") {
  var cc = "gcc-5";
} else {
  var cc = "gcc";
}

var preprocessed = child_process.execSync(`${cc} -E -P -std=iso9899:199409 ${inputPath}`).toString();
try {
	var tree = JAMCParser.parse(preprocessed);
	var output = JAMCTranslator.translate(tree);
	fs.mkdirSync(tmpDir);
  fs.writeFileSync(`${tmpDir}/jamout.c`, output.C);
  child_process.execSync(`gcc -shared -o ${tmpDir}/libjamout.so -fPIC ${tmpDir}/jamout.c ${jamlibPath} -lpthread`);

  var zip = new JSZip();
  zip.file("MANIFEST.tml", createTOML());
  zip.file("jamout.js", output.JS);
  zip.file("libjamout.so", fs.readFileSync(`${tmpDir}/libjamout.so`));
	fs.writeFileSync(`${outputName}.jxe`, zip.generate({type:"nodebuffer"}));

  deleteFolderRecursive(tmpDir);
} catch(e) {
    console.log("ERROR:");
    console.log(e);
}

function createTOML() {
  var toml = "";
  toml += "# Description of the JXE structure\n";
  toml += "title = \"JAMScript Executable Description\"\n";

  toml += "# global identification and requirements are specified next\n";
  toml += "[jxe]\n";
  toml += "version = 1.0\n";
  toml += "checksum = \"XXXDFDFDFDFDF\"\n";
  toml += "requirements = \"none\"\n";

  toml += "# javascript portion is in one file for now\n";
  toml += "[jsfile]\n";
  toml += "# any or a particular version can be specified for nodeversion\n";
  toml += "nodeversion = 0\n";
  toml += "# list of modules that should be pre-loaded into Node\n";
  toml += "requires = []\n";
  toml += "# file name for the javascript code\n";
  toml += "file = \"jamout.js\"\n";

  toml += "# c portion could be in multiple files (in shared lib format)\n";
  toml += "[cfile]\n";
  toml += "portions = 1\n";
  toml += "# definition of a C portion\n";
  toml += "[cfile.1]\n";
  toml += "# architecture for which the shared library is genereated\n";
  toml += "arch = \"x86\"\n";
  toml += "# requirements of the shared library; these are tags that indicate the requirements\n";
  toml += "requires = []\n";
  toml += "# filename of the shared library\n";
  toml += "file = \"libjamout.so\"\n";
  return toml;
}

function inputArgsError() {
  console.log("No input file specified");
  console.log("Input format:");
  console.log("\tjamc [input file] [output name]");
}

function randomValueHex (len) {
    return crypto.randomBytes(Math.ceil(len/2))
        .toString('hex') // convert to hexadecimal format
        .slice(0,len);   // return required number of characters
}

function deleteFolderRecursive(path) {
  if( fs.existsSync(path) ) {
    fs.readdirSync(path).forEach(function(file,index){
      var curPath = path + "/" + file;
      if(fs.lstatSync(curPath).isDirectory()) { // recurse
        deleteFolderRecursive(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
};