#!/usr/bin/env node

/*******************************
 * JAMSCRIPT TESTING FRAMEWORK *
 *******************************/

const fs      = require('fs'),
      os      = require('os'),
      path    = require('path'),
      process = require('process'),
      assert  = require('assert'),
      child_process = require('child_process');

const TEST_RESULT_DIR_NAME = "toast-results";
const DEFAULT_TEST_DIR = "toaster"

const JAMRUNS_DIR = `${os.homedir()}/.jamruns`;

const TOASTER_JS_HOOKS = 
`\nfunction assert(cond){if(!cond){let _err = new Error(); console.log(\`@ToasterAssert#{\${_err.stack}}#\`);}}
function coverage(_id){console.log(\`@ToasterCoverage#{\${_id}}#\`);}\n`;

const TOASTER_C_HOOKS = 
`#undef assert
#define assert(cond, line) {if(!cond){printf("@ToasterAssert#{%d, %s}#", line, #cond);}}
#define coverage(_id){printf("@ToasterCoverage#{%d}#", _id);}\n`;

const TOASTER_ASSERT_KEYWORD = "@ToasterAssert";
const TOASTER_COVERAGE_KEYWORD = "@ToasterCoverage";

function Toaster(conf) {
  this.conf = conf;

  if(conf.testDirectory == undefined) {
    if(fs.existsSync(DEFAULT_TEST_DIR)) {
      console.log("Using default test directory " + DEFAULT_TEST_DIR);
      this.testDirectory = DEFAULT_TEST_DIR;
    } else {
      console.log("Must provide a test folder.");
      process.exit();
    }
  } else {
    this.testDirectory = conf.testDirectory;
  }

  this.testDirectoryName = path.basename(this.testDirectory);
  this.currentTest = 0;
}


Toaster.prototype.setupTestingEnvironment = function () {
  if (!fs.existsSync(TEST_RESULT_DIR_NAME)) {
    fs.mkdirSync(TEST_RESULT_DIR_NAME);
  }
  this.resultDirectory = `${TEST_RESULT_DIR_NAME}/${this.testDirectoryName}-${new Date().toISOString()}`
  fs.mkdirSync(this.resultDirectory);
}

Toaster.prototype._walkTestDir = function (folder) {
  let that = this;
  var tests = [];
  for(let file of fs.readdirSync(folder)) {
    let completePath = `${folder}/${file}`;

    if(fs.lstatSync(completePath).isDirectory()) {
      tests.push(...that._walkTestDir(completePath));
    }

    let extension = path.extname(file);
    if(extension === ".c") {
      let baseName = file.substring(0, file.length-2);
      if(fs.existsSync(`${folder}/${baseName}.js`)){
        let testName = `${folder}/${baseName}`.substring(this.testDirectory.length+1);
        tests.push({
          testName: testName,
          baseName: baseName,
          cFile: `${folder}/${baseName}.c`,
          jsFile: `${folder}/${baseName}.js`,
          testResultDirectory: `${that.resultDirectory}/${testName}`,
          logFile: `${that.resultDirectory}/${testName}/jlog.txt`
        });
      }
    }
  }
  return tests;
}


Toaster.prototype.scanTests = function () {
  this.tests = this._walkTestDir(this.testDirectory);
  console.log(`Found ${this.tests.length} tests.`);
}

const ASSERT_IDENTIFIER = "assert(";
const COVERAGE_IDENTIFIER = "coverage(";

function findClosingParen(text, start) {
  var end = -1;
  var lastIndex = start;
  var depth = 0;
  while(true) {
    let nextOpen = text.indexOf('(', lastIndex);
    let nextClose = text.indexOf(')', lastIndex);

    if(nextOpen == -1 && nextClose == -1) {
      console.log(`Error: was unable to find matching closing paren for \'${text}\'`);
    }

    if(nextOpen == -1 || nextClose < nextOpen) {
      depth--;
      assert(lastIndex != start);
      lastIndex = nextClose + 1;

      if(depth == 0) {
        end = nextClose;
        break;
      }
    }

    if(nextOpen != -1 && nextOpen < nextClose) {  
      depth++;
      lastIndex = nextOpen + 1;
    }
  }
  return end;
}

Toaster.prototype.compileTest = function(test, testResultDirectory) {
  const buildEnv = `${JAMRUNS_DIR}/_toaster_build_env`;
  if(!fs.existsSync(buildEnv)) {
    fs.mkdirSync(buildEnv);
  }
  
  let cTestPath = `${buildEnv}/${test.baseName}.c`;
  let jsTestPath = `${buildEnv}/${test.baseName}.js`;

  let cFileContents = fs.readFileSync(test.cFile, 'utf-8');
  let cTestOutput = fs.openSync(cTestPath, 'w');

  let jsFileContents = fs.readFileSync(test.jsFile, 'utf-8');
  let jsTestOutput = fs.openSync(jsTestPath, 'w');

  let coverageMarkers = [];
  var coverageUID = 0;
  var lineCount = 0;

  // Process c-side
  fs.writeSync(cTestOutput, TOASTER_C_HOOKS);
  for(let line of cFileContents.split(/\r?\n/)) {
    lineCount++;
    console.log(line);
    let regularLine = true;
    if(line.includes(ASSERT_IDENTIFIER)) {
      regularLine = false;
      let start = line.indexOf(ASSERT_IDENTIFIER);
      let end = findClosingParen(line, start);
      fs.writeSync(cTestOutput, line.substring(0, end));
      fs.writeSync(cTestOutput, `,${lineCount}`);
      fs.writeSync(cTestOutput, line.substring(end) + "\n");
    }
    if(line.includes(COVERAGE_IDENTIFIER)) {
      regularLine = false;
      let start = line.indexOf(COVERAGE_IDENTIFIER);
      let end = findClosingParen(line, start);

      let currentCoverageID = coverageUID++;

      fs.writeSync(cTestOutput, line.substring(0, end));
      fs.writeSync(cTestOutput, `${currentCoverageID}`);
      fs.writeSync(cTestOutput, line.substring(end)+"\n");

      coverageMarkers.push({
        id: currentCoverageID,
        line: lineCount
      });
    }
    if(regularLine) {
      fs.writeSync(cTestOutput, line+"\n");
    }
  }

  // Process c-side
  lineCount = 0;
  //fs.writeSync(jsTestOutput, TOASTER_JS_HOOKS);
  for(let line of jsFileContents.split(/\r?\n/)) {
    lineCount++;
    console.log(line);
    let regularLine = true;

    if(line.includes(COVERAGE_IDENTIFIER)) {
      regularLine = false;
      let start = line.indexOf(COVERAGE_IDENTIFIER);
      let end = findClosingParen(line, start);

      let currentCoverageID = coverageUID++;

      fs.writeSync(jsTestOutput, line.substring(0, end));
      fs.writeSync(jsTestOutput, `${currentCoverageID}`);
      fs.writeSync(jsTestOutput, line.substring(end)+"\n");

      coverageMarkers.push({
        id: currentCoverageID,
        line: lineCount
      });
    }
    if(regularLine) {
      fs.writeSync(jsTestOutput, line+"\n");
    }
  }

  fs.closeSync(jsTestOutput);
  fs.closeSync(cTestOutput);


  test.coverageMarkers = coverageMarkers;

  //fs.cpSync(test.cFile, );
  //fs.cpSync(test.jsFile, `${buildEnv}/${test.baseName}.js`);

  let command = 'jamc';
  let args = [
    '-d', 
    cTestPath, 
    jsTestPath,
    '-o', 
    `${test.testResultDirectory}/test`];

  // We should log compiler output in the event of a compiler error.
  
  process.stdout.write("Compiling... ");
  var proc = undefined;
  try{
    proc = child_process.spawnSync(command,args, {encoding: 'utf-8'});//, {stdio: [0,test.output,test.output]});
    if(proc.stderr.includes("error") != 0) {
      throw new Error();
    }

    console.log("Success");  
    test.output.write(proc.stdout);
    test.output.write("Stderr Follows: \n");
    test.output.write(proc.stderr);

    return true;
  } catch(err) {
    console.log("Failed!\n");
    test.output.write(proc.stdout);
    test.output.write("Stderr Follows: \n");
    test.output.write(proc.stderr);
    
    console.log(`Full log can be found at ${test.logFile}`);
    console.log("Stderr Messages: ");
    console.log(proc.stderr);
    return false;
  }

}

// Built in kill not working.
function killGroup(pgid) {
  child_process.execSync(`kill -- -${pgid}`);
}
// Built in kill not working.
function kill(pid) {
  child_process.execSync(`kill -- ${pid}`);
}

  // Loop through process ID files (use this)
Toaster.prototype.getWorkerPids = function(test) {
  const searchDir = `${os.homedir()}/.jamruns/apps/test_${this.testDirectory}`;

  let pids = [];

  for(let file of fs.readdirSync(searchDir)) {
    let completePath = `${searchDir}/${file}`;
    if(fs.lstatSync(completePath).isDirectory()) {
      let pid = fs.readFileSync(`${completePath}/processId`, 'utf-8');
      console.log("'"+pid+"'");
      let _why_does_this_work = (parseInt(pid)-1).toString();
      pids.push(_why_does_this_work);
    }
  }

  return pids;
}

Toaster.prototype.executeTest = function(test, testResultDirectory) {
  let command = `jamrun`
  let args =  [
    `${test.testResultDirectory}/test.jxe`,
    `--app=${this.testDirectoryName}`,
    "--log",
    "--temp_broker"];

  var processComplete = false;
  
  let that = this;
  // This works for now but is likely not portable
  function cleanup() {
    killGroup(testProcess.pid); 
    kill(that.getWorkerPids(test).join(' '));
    fs.rmSync(`${os.homedir()}/.jamruns/apps/test_${that.testDirectory}`, {recursive: true, force: true});
  }

  // We should log compiler output in the event of a compiler error.
  let testProcess = child_process.spawn(command, args, {shell: true, detached: true});
  let timeout = setTimeout(()=>{
    console.log("Test Timeout Reached");
    processComplete = true;
    cleanup();
  }, 10*1000);

  testProcess.stdout.on('data', (data) => {
    test.output.write(data);
    if(data.includes('@')) {
      let keywordIndex = -1;

      if((keywordIndex = data.indexOf(TOASTER_ASSERT_KEYWORD)) != -1) {
        // Assert went off!!!
        console.log("Test Failed an assert!");
        console.log(data);
      } else if ((keywordIndex = data.indexOf(TOASTER_COVERAGE_KEYWORD)) != -1) {
        console.log("Coverage Marker Reached!!");
        console.log(data);
      }
    }
    //console.log(`${data}`);
  });

  testProcess.stderr.on('data', (data) => {
    if(!processComplete) {
      test.output.write(`STDERR: ${data}`);
      console.error(`stderr: ${data}`);
      //clearTimeout(timeout);
      //cleanup();
    }
  });

  testProcess.on('close', (exit) => {
    console.log("Test Finished....");
    test.output.close();
    this.runNextTest();
  });
}

// For now running sequentially
Toaster.prototype.runTest = function () {
  let test = this.tests[this.currentTest];
  console.log(`Running ${test.testName}`);
  fs.mkdirSync(test.testResultDirectory, {recursive: true});

  test.output = fs.createWriteStream(`${test.testResultDirectory}/jlog.txt`);

  // The directory could be included in the test object, that would make more sense
  if(!this.compileTest(test)) {
    return; //for now
  }
  this.executeTest(test);
}

Toaster.prototype.runNextTest = function() {
  this.currentTest++;
  if(this.currentTest == this.tests.length) {
    console.log("Completed All Tests...");
    process.exit();
  }

  this.runTest();
}

function processArgs() {
  let args = process.argv.slice(2);
  let conf = {
    testDirectory: undefined
  };

  for (var i = 0; i < args.length; i++) {
    if (args[i].charAt(0) === "-") {
      if (args[i] === "-g" || args[i] === "--grape") {
        console.log("GRAPES!");
      } 
    } else {
      let inputPath = args[i];
      if(conf.testDirectory != undefined) {
        console.log("Can only provide one test folder!");
        process.exit(0xBADBAD);
      }

      if(fs.existsSync(inputPath)) {
        conf.testDirectory = inputPath;
      } else {
        console.log(`Folder '${inputPath}' Doesn't Exist.`);
      }
    }
  }

  return conf;
}

function firstTimeSetup() {
  try{
    console.log("Created jamtest group.");
  } catch(err) {
    console.log("Already have jamtest group.");
  }
  
}

firstTimeSetup();

let toaster = new Toaster(processArgs());
toaster.setupTestingEnvironment();
toaster.scanTests();
toaster.runTest();