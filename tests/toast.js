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
`jtask function assert(cond){if(!cond){let _err = new Error(); console.log("\\n@ToasterAssert#{"+_err.stack+"}#");}}
jtask function coverage(_id){console.log("\\n@ToasterCoverage#{"+_id+"}#");}\n`;
const TOASTER_C_HOOKS = 
`#undef assert
#define assert(cond, line) {if(!cond){printf("\\n@ToasterAssert#{%d, %s}#\\n", line, #cond);}}
#define coverage(_id){printf("\\n@ToasterCoverage#{%d}#\\n", _id);}\n`;


// Just while the compiler is broken:

const TOASTER_JS_HOOK_ASSERT_L = "if(!(";
const TOASTER_JS_HOOK_ASSERT_R = `)){let _err = new Error(); console.log("@ToasterAssert#{"+_err.stack+"}#");}`;

const TOASTER_JS_HOOK_COVERAGE_L = `console.log("@ToasterCoverage#{`;
const TOASTER_JS_HOOK_COVERAGE_R = `}#");`


const TOASTER_ASSERT_KEYWORD = "@ToasterAssert";
const TOASTER_COVERAGE_KEYWORD = "@ToasterCoverage";

function ansiiPurple(text) {
    return `\x1b[35m${text}\x1b[0m`;
}

function ansiiGreen(text) {
  return `\x1b[32m${text}\x1b[0m`;
}

function ansiiYellow(text) {
  return `\x1b[33m${text}\x1b[0m`;
}

function ansiiRed(text) {
  return `\x1b[31m${text}\x1b[0m`;
}

const TestState = {
  COMPILING:  0,
  STARTING:   1,
  RUNNING:    2,
  PASSED:  3,
  FAILED:     4,
  COMPILE_FAILED: 5
};

function updateTestState(test) {
  if(test.state==TestState.COMPILING) {
    process.stdout.write(`\x1b[2K\r${ansiiYellow(test.testName)} ${ansiiYellow("Compiling")} `);
  } else if (test.state == TestState.STARTING) {
    let beginning = `${ansiiYellow(test.testName)} ${ansiiGreen("Compiled")}`;
    process.stdout.write(`\x1b[2K\r${beginning} Starting...`)
  } else if (test.state == TestState.RUNNING) {
    let beginning = `${ansiiYellow(test.testName)} ${ansiiGreen("Compiled")}`;
    let coverageStatus = "";
    if(test.coverageMarkers.length) {
      coverageStatus = `(${test.completedCoverageMarkers}/${test.coverageMarkers.length})`;
    }
    process.stdout.write(`\x1b[2K\r${beginning} ${ansiiYellow("Running")} ${coverageStatus}`)
  } else if (test.state == TestState.PASSED) {
    process.stdout.write(`\x1b[2K\r${ansiiGreen(test.testName + " Passed")}`)
  } else if (test.state ==TestState.COMPILE_FAILED) {
    process.stdout.write(`\x1b[2K\r${ansiiRed(test.testName + " Failed to Compile")}`);
  } else if (test.state == TestState.FAILED) {
    // Provide some context as to why
    let reason = "";
    if(test.completedCoverageMarkers != test.coverageMarkers.length) {
      reason += `${test.completedCoverageMarkers}/${test.coverageMarkers.length} Coverage Markers`
    }
    if(test.assertMessage) {
      if(reason!="") {
        reason += ", ";
      }
      reason += "Failed Assert";
    }
    
    if(reason == "") {
      reason = "!INTERNAL!";
      console.trace();
    }

    process.stdout.write(`\x1b[2K\r${ansiiRed(test.testName + " Failed")} (${reason})`)
  }
}

function setTestState(test, state) {
  test.state = state;
  updateTestState(test);
}

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
          logFile: `${that.resultDirectory}/${testName}/jlog.txt`,
          state: TestState.COMPILING,
          completedCoverageMarkers: 0,
          compilationDuration: 0,
          runDuration: 0,
          assertMessage: undefined
        });
      }
    }
  }
  return tests;
}


Toaster.prototype.scanTests = function () {
  // TODO: refactor
  if(fs.existsSync(this.testDirectory+".js")) {
    let basename = path.basename(this.testDirectory);
    this.tests = [];
    this.tests.push({
      testName: basename,
      baseName: basename,
      cFile: `${this.testDirectory}.c`,
      jsFile: `${this.testDirectory}.js`,
      testResultDirectory: basename,
      logFile: `${basename}/jlog.txt`,
      state: TestState.COMPILING,
      completedCoverageMarkers: 0,
      compilationDuration: 0,
      runDuration: 0,
      assertMessage: undefined
    });
  } else {
    this.tests = this._walkTestDir(this.testDirectory);
  }
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
  
  updateTestState(test);

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
        line: lineCount,
        covered: false
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
    let regularLine = true;

    // TODO: remove this when compiler bug is fixed
    if(line.includes(ASSERT_IDENTIFIER)) {
      regularLine = false;
      let start = line.indexOf(ASSERT_IDENTIFIER);
      let end = findClosingParen(line, start);

      let condition = line.substring(start + ASSERT_IDENTIFIER.length, end);

      fs.writeSync(jsTestOutput, line.substring(0, start));
      fs.writeSync(jsTestOutput, TOASTER_JS_HOOK_ASSERT_L);
      fs.writeSync(jsTestOutput, condition);
      fs.writeSync(jsTestOutput, TOASTER_JS_HOOK_ASSERT_R);
      fs.writeSync(jsTestOutput, line.substring(end+2)+"\n");
    }

    if(line.includes(COVERAGE_IDENTIFIER)) {
      regularLine = false;
      let start = line.indexOf(COVERAGE_IDENTIFIER);
      let end = findClosingParen(line, start);

      let currentCoverageID = coverageUID++;

      fs.writeSync(jsTestOutput, line.substring(0, start));
      fs.writeSync(jsTestOutput, TOASTER_JS_HOOK_COVERAGE_L);
      fs.writeSync(jsTestOutput, `${currentCoverageID}`);
      fs.writeSync(jsTestOutput, TOASTER_JS_HOOK_COVERAGE_R);
      fs.writeSync(jsTestOutput, line.substring(end+2)+"\n");

      coverageMarkers.push({
        id: currentCoverageID,
        line: lineCount,
        covered: false
      });
    }
    if(regularLine) {
      fs.writeSync(jsTestOutput, line+"\n");
    }
  }

  fs.closeSync(jsTestOutput);
  fs.closeSync(cTestOutput);

  test.coverageMarkers = coverageMarkers;

  const compilationStart = Date.now();

  // Forward preprocessed files into JamC

  let command = 'jamc';
  let args = [
    '-d', 
    cTestPath, 
    jsTestPath,
    '-o', 
    `${test.testResultDirectory}/test`];

  // We should log compiler output in the event of a compiler error.
  
  //process.stdout.write("Compiling... ");
  var proc = undefined;
  try{
    proc = child_process.spawnSync(command,args, {encoding: 'utf-8'});//, {stdio: [0,test.output,test.output]});
    if(proc.stderr.includes("error") != 0 ||
      !fs.existsSync(`${test.testResultDirectory}/test.jxe`)
    ) {
      throw new Error();
    }

    const compilationEnd = Date.now();
    test.compilationDuration = compilationEnd-compilationStart;

    setTestState(test,TestState.STARTING);

    /*console.log("Success");  
    test.output.write(proc.stdout);
    test.output.write("Stderr Follows: \n");
    test.output.write(proc.stderr);*/
    
    return true;
  } catch(err) {

    setTestState(test,TestState.COMPILE_FAILED);
    console.log("Failed!");
    test.output.write(proc.stdout);
    test.output.write("Stderr Follows: \n");
    test.output.write(proc.stderr);
    console.log(`Full log can be found at ${test.logFile}`);

    return false;
  }

}

// Built in kill not working.
function killGroup(pgid) {
  child_process.execSync(`kill -- -${pgid}`, {stdio:'ignore'});
}
// Built in kill not working.
function kill(pid) {
  child_process.execSync(`kill -- ${pid}`, {stdio:'ignore'});
}

  // Loop through process ID files (use this)
Toaster.prototype.killWorkerTmuxSessions = function(test) {

  const searchDir = `${os.homedir()}/.jamruns/apps/test_${this.testDirectory}`;

  for(let file of fs.readdirSync(searchDir)) {
    let completePath = `${searchDir}/${file}`;
    if(fs.lstatSync(completePath).isDirectory()) {
      let tmuxid = fs.readFileSync(`${completePath}/tmuxid`, 'utf-8');
      child_process.execSync(`tmux kill-session -t ${tmuxid}`);
    }
  }

}

//TODO: refactor with better name
function extractOutputKeywordData(text){
  let start = text.indexOf("#{")+2;
  let end = text.indexOf("}#");
  return text.substring(start, end);
}

function processStdout(test, data) {
  for(let line of data.split('\n')) {
    if(test.state == TestState.STARTING) {
      setTestState(test, TestState.RUNNING);
    } else if (test.state == TestState.PASSED ||
              test.state == TestState.FAILED) {
      return false;
    }

    test.output.write(line + "\n");

    // Try to pick up any spurrious errors we may have missed otherwise.
    if(line.includes("error") || line.includes("Error")) {
      setTestState(test, TestState.FAILED);
      return true;
    }

    if(line.includes('@')) {
      let keywordIndex = -1;

      if((keywordIndex = line.indexOf(TOASTER_ASSERT_KEYWORD)) != -1) {
        test.assertMessage = extractOutputKeywordData(line);
        setTestState(test, TestState.FAILED);
        return true
      } else if ((keywordIndex = line.indexOf(TOASTER_COVERAGE_KEYWORD)) != -1) {
        let coverageId = extractOutputKeywordData(line);
        for(let marker of test.coverageMarkers) {
          if(marker.id == coverageId &&
            marker.covered == false) {
            test.completedCoverageMarkers++;
            marker.covered = true;
            updateTestState(test);
          }
        }
      }
      // Test is complete
      if(test.completedCoverageMarkers == test.coverageMarkers.length) {
        setTestState(test,TestState.PASSED);
        return true;
      }
    }

  }
  return false;
}

Toaster.prototype.executeTest = function(test, testResultDirectory) {
  let command = `jamrun`
  let args =  [
    `${test.testResultDirectory}/test.jxe`,
    `--app=${this.testDirectoryName}`,
    //"--log",
    "--disable-stdout-redirect",
    "--temp_broker"];

  var processComplete = false; //TODO: replace with test.state
  
  let that = this;
  // This works for now but is likely not portable
  function cleanup() {
    clearTimeout(timeout);
    const testEndTime = Date.now();
    test.runDuration = testEndTime-testStartTime;
    try {
      killGroup(testProcess.pid); // Not entirely sure why this works...
      //that.killWorkerTmuxSessions(test);
    }catch(e){console.log(e)}
  }

  const testStartTime = Date.now();

  // We should log compiler output in the event of a compiler error.
  let testProcess = child_process.spawn(command, args, {shell: true, detached: true});
  let timeout = setTimeout(()=>{
    if(test.state == TestState.RUNNING) {
      if(test.coverageMarkers.length) {
        setTestState(test, TestState.FAILED);
      } else {
        setTestState(test, TestState.PASSED);
      }
      cleanup();
    }
  }, 10*1000);

  testProcess.stdout.setEncoding('utf-8');

  testProcess.stdout.on('data', (data) => {
    if(processStdout(test, data)) {
      cleanup();
    }
  });

  testProcess.stderr.on('data', (data) => {
    if(test.state==TestState.RUNNING) {
      test.output.write(`STDERR: ${data}`);
      //console.error(`stderr: ${data}`);
    }
  });

  testProcess.on('close', (exit) => {
    if(test.state === TestState.RUNNING) {
      setTestState(test, TestState.FAILED);
    }
    let report = this.generateReport(test);
    test.output.write(`\n\n\n${report}`);
    test.output.close();
    this.runNextTest();
  });
}

Toaster.prototype.generateReport = function(test) {
  var reportMessage = "";
  if(test.state == TestState.PASSED) {
    reportMessage = `Test: ${test.testName} Completed Succesfully\n`+
      `Time to Compile: ${test.compilationDuration/1000.0}s\n` +
      `Time to Run Test: ${test.runDuration/1000.0}s\n`;
  } else if (test.state == TestState.FAILED) {
    reportMessage = `Test: ${test.testName} Failed\n`+
      `Time to Compile: ${test.compilationDuration/1000.0}s\n` +
      `Time to Run Test: ${test.runDuration/1000.0}s\n` + 
      `Reached ${test.completedCoverageMarkers} coverage markers out of ${test.coverageMarkers.length}\n`;
      if(test.completedCoverageMarkers != test.coverageMarkers.length) {
        for(let marker of test.coverageMarkers) {
          if(!marker.covered) {
            reportMessage += `  Missed coverage marker on line ${marker.line}\n`
          }
        }
      }
  }

  return reportMessage;
}

// For now running sequentially
Toaster.prototype.runTest = function () {
  let test = this.tests[this.currentTest];

  //Just a newline..
  process.stdout.write('\n');

  fs.mkdirSync(test.testResultDirectory, {recursive: true});

  test.output = fs.createWriteStream(`${test.testResultDirectory}/jlog.txt`);

  // The directory could be included in the test object, that would make more sense
  if(!this.compileTest(test)) {
    this.runNextTest(); // should not be recursive but for now...
  }
  this.executeTest(test);
}

Toaster.prototype.runNextTest = function() {
  this.currentTest++;
  if(this.currentTest == this.tests.length) {
    console.log(ansiiGreen("\n\nCompleted All Tests"));
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
      } else if (fs.existsSync(inputPath + ".js")){
        conf.testDirectory = inputPath;
      } else {
        console.log(`Folder/Test '${inputPath}' Doesn't Exist.`);
      }
    }
  }

  return conf;
}

let toaster = new Toaster(processArgs());
toaster.setupTestingEnvironment();
toaster.scanTests();
toaster.runTest();