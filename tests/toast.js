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
  COMPILE_FAILED: 5,
};

const FailDetails = {
  TEST_FAILED: 0,
  LAUNCH_FAILED: 1,
  RUNTIME_FAILED: 2,
  CRASH_FAILED: 3,
}

const NODETYPE_DEVICE = "device";
const NODETYPE_FOG = "fog";

Toaster.prototype.updateTestState = function (test) {
  let completeStr = `${this.currentTest}`;
  let totalStr = `${this.tests.length}`;

  // Magic characters clear line
  let prefix = `\x1b[2K\r(${completeStr}/${totalStr}) `;
  let padding = totalStr.length - completeStr.length;
  prefix += " ".repeat(padding);
  if(test.state==TestState.COMPILING) {
    process.stdout.write(`${prefix}${ansiiYellow(test.testName)} ${ansiiYellow("Compiling")} `);
  } else if (test.state == TestState.STARTING) {
    let beginning = `${ansiiYellow(test.testName)} ${ansiiGreen("Compiled")}`;
    process.stdout.write(`${prefix}${beginning} Starting...`)
  } else if (test.state == TestState.RUNNING) {
    let beginning = `${ansiiYellow(test.testName)} ${ansiiGreen("Compiled")}`;
    let coverageStatus = "";
    if(test.coverageMarkers.length) {
      coverageStatus = `(${test.completedCoverageMarkers}/${test.coverageMarkers.length})`;
    }
    process.stdout.write(`${prefix}${beginning} ${ansiiYellow("Running")} ${coverageStatus}`)
  } else if (test.state == TestState.PASSED) {
    process.stdout.write(`${prefix}${ansiiGreen(test.testName + " Passed")}`)
  } else if (test.state == TestState.FAILED) {
    if(test.compilerWarnings != "") {
      process.stdout.write(`${prefix}${test.compilerWarnings}`);
    }

    if (test.failDetails == FailDetails.TEST_FAILED || 
        test.failDetails == FailDetails.RUNTIME_FAILED || 
        test.failDetails == FailDetails.CRASH_FAILED)  {
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
      if(test.failDetails == FailDetails.RUNTIME_FAILED) {
        if(reason!="") {
          reason += ", ";
        }
        reason += "JAMScript Runtime Error";
      } else if (test.failDetails == FailDetails.CRASH_FAILED) {
        if(reason!="") {
          reason += ", ";
        }
        reason += "Test Crashed";
      }

      if(reason == "") {
        reason = "!INTERNAL!";
        console.trace();
      }

      process.stdout.write(`${prefix}${ansiiRed(test.testName + " Failed")} (${reason}) `)
    } else if (test.failDetails == FailDetails.COMPILE_FAILED) {
      process.stdout.write(`${prefix}${ansiiRed(test.testName + " Failed to compile")}`);
    } else if (test.failDetails == FailDetails.LAUNCH_FAILED) {
      process.stdout.write(`${prefix}${ansiiRed(test.testName + " Failed to start test")}`); 
    } else {
      console.error("Mistakes were made while programming this.");
      console.trace();
    }
  }
}

Toaster.prototype.setTestState = function(test, state) {
  test.state = state;
  this.updateTestState(test);
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
  this.testProcesses = new Set();

  let that = this;
  process.on("SIGINT", ()=>that.exitHook());
  //process.on("exit", ()=>that.exitHook());
}


Toaster.prototype.exitHook = function() {
  let endTime = Date.now();
  this.finalReport(endTime-this.startTime);
  process.exit();
}


Toaster.prototype.setupTestingEnvironment = function () {
  if (!fs.existsSync(TEST_RESULT_DIR_NAME)) {
    fs.mkdirSync(TEST_RESULT_DIR_NAME);
  }
  this.resultDirectory = `${TEST_RESULT_DIR_NAME}/${this.testDirectoryName}-${new Date().toISOString()}`
  fs.mkdirSync(this.resultDirectory);
}

Toaster.prototype.walkTestDir = function (folder) {
  let that = this;
  var tests = [];
  for(let file of fs.readdirSync(folder)) {
    let completePath = `${folder}/${file}`;

    if(fs.lstatSync(completePath).isDirectory()) {
      tests.push(...that.walkTestDir(completePath));
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
          compilerWarnings: "",
          runDuration: 0,
          assertMessage: undefined,
          failDetails: undefined, 
          networkConfig: {
            devices: 1,
            fogs: 0
        }});
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
    this.tests = this.walkTestDir(this.testDirectory);
  }
  console.log(`Found ${this.tests.length} tests.`);
}

const ASSERT_IDENTIFIER = "assert(";
const COVERAGE_IDENTIFIER = "coverage(";

//TODO: refactor be more clearer about what this does
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

const FOGS_KEYWORD = "fogs:";
const DEVICES_KEYWORD = "devices:";

Toaster.prototype.scanForToasterConfig = function(test, line, lineIter) {
  const keywords = [FOGS_KEYWORD, DEVICES_KEYWORD];
  if(line.includes("@ToasterConfig")) {
    let lineResult;
    while(!(lineResult = lineIter.next()).done) {
      line = lineResult.value.toLowerCase();

      let keywordFound = false;
      for(let keyword of keywords) {
        if(line.includes(keyword)) {
          keywordFound = true;
          let start = line.indexOf(keyword) + keyword.length;
          let value = line.substring(start).trim();

          if(keyword == FOGS_KEYWORD) {
            test.networkConfig.fogs = parseInt(value);
            //TODO; check if this is correct!
          } else if (keyword == DEVICES_KEYWORD) {
            test.networkConfig.fogs = parseInt(value);
          }
        }
      }

      if(!keywordFound) {
        return;
      }
    }
  }
}

Toaster.prototype.compileTest = function(test, testResultDirectory) {
  const buildEnv = `${JAMRUNS_DIR}/_toaster_build_env`;
  if(!fs.existsSync(buildEnv)) {
    fs.mkdirSync(buildEnv);
  }
  
  this.updateTestState(test);

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

  let lines = cFileContents.split(/\r?\n/);
  let lineIter = lines[Symbol.iterator]();

  var lineResult;
  while(!(lineResult = lineIter.next()).done) {
    let line = lineResult.value;

    lineCount++;
    let regularLine = true;

    this.scanForToasterConfig(test, line, lineIter);

    if(line.toLowerCase().includes("error")) {
      test.compilerWarnings +=`WARNING: Printing 'Error' to standard out will mark the test as failed! (${lineCount})\n`;
      test.compilerWarnings += `--> ${line}\n`;
    }

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

  lines = jsFileContents.split(/\r?\n/);
  lineIter = lines[Symbol.iterator]();
  while(!(lineResult = lineIter.next()).done) {
    let line = lineResult.value;

    lineCount++;
    let regularLine = true;

    this.scanForToasterConfig(test, line, lineIter);

    if(line.toLowerCase().includes("error")) {
      test.compilerWarnings +=`WARNING: Printing 'Error' to standard out will mark the test as failed! (${lineCount})\n`;
      test.compilerWarnings += `--> ${line}\n`;
    }

    // TODO: remove this when compiler bug is fixed
    if(line.includes(ASSERT_IDENTIFIER)) {
      regularLine = false;
      let start = line.indexOf(ASSERT_IDENTIFIER);
      let end = findClosingParen(line, start);

      let condition = line.substring(start + ASSERT_IDENTIFIER.length, end);
      if(condition=="") {
        console.log(`\nAssert is missing condition! \\/ (${lineCount})\n--> ${line}`);
      }
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

    this.setTestState(test,TestState.STARTING);

    /*console.log("Success");  
    test.output.write(proc.stdout);
    test.output.write("Stderr Follows: \n");
    test.output.write(proc.stderr);*/
    
    return true;
  } catch(err) {

    test.failDetails = FailDetails.COMPILE_FAILED;
    this.setTestState(test,TestState.FAILED);
    /*console.log("Failed!");*/
    
    test.output.write(proc.stdout);
    test.output.write("Stderr Follows: \n");
    test.output.write(proc.stderr);
    test.output.close();
    //console.log(` Full log can be found at ${test.logFile}`);

    return false;
  }

}

// Built in kill not working.
function killGroup(pgid) {
  try {
    child_process.execSync(`kill -- -${pgid}`, {stdio:'ignore'}); 
  } catch (err) {
    console.log("Failed to terminate test process.");
  }
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

Toaster.prototype.processOutput = function (test, data) {
  if(typeof data != 'string') {
    return;
  }
  for(let line of data.split('\n')) {
    if(test.state == TestState.STARTING) {
      this.setTestState(test, TestState.RUNNING);
    } else if (test.state == TestState.PASSED ||
              test.state == TestState.FAILED) {
      return false;
    }

    test.output.write(line + "\n");

    // Try to pick up any spurrious errors we may have missed otherwise.
    if(line.includes("error") || line.includes("Error")) {
      // NOTE: this is super hacky edge case handling for an already hacky
      // way of detecting errors!
      if(line.includes("error: 0")) {
        continue;
      }
      test.failDetails = FailDetails.RUNTIME_FAILED;
      this.setTestState(test, TestState.FAILED);
      return true;
    }

    if(line.includes('@')) {
      let keywordIndex = -1;

      if((keywordIndex = line.indexOf(TOASTER_ASSERT_KEYWORD)) != -1) {
        test.assertMessage = extractOutputKeywordData(line);
        test.failDetails = FailDetails.TEST_FAILED;
        this.setTestState(test, TestState.FAILED);
        return true
      } else if ((keywordIndex = line.indexOf(TOASTER_COVERAGE_KEYWORD)) != -1) {
        let coverageId = extractOutputKeywordData(line);
        for(let marker of test.coverageMarkers) {
          if(marker.id == coverageId &&
            marker.covered == false) {
            test.completedCoverageMarkers++;
            marker.covered = true;
            this.updateTestState(test);
          }
        }
      }
      // Test is complete
      if(test.completedCoverageMarkers == test.coverageMarkers.length) {
        this.setTestState(test,TestState.PASSED);
        return true;
      }
    }

  }
  return false;
}

Toaster.prototype.cleanupResidualTests = function() {
  for(let pid of this.testProcesses) {
    killGroup(pid);
  }
  this.testProcesses.clear();
}

Toaster.prototype.executeTest = async function(test, machType) {
  let command = `jamrun`
  let args =  [
    `${test.testResultDirectory}/test.jxe`,
    `--app=${this.testDirectoryName}`,
    //"--log",
    "--disable-stdout-redirect",
    "--temp_broker"];

  if(machType==NODETYPE_FOG) {
    args.push("--fog");
  }

  let that = this;

  function cleanup() {
    clearTimeout(timeout);
    const testEndTime = Date.now();
    test.runDuration = testEndTime-testStartTime;
    try {
      if(test.failDetails != FailDetails.CRASH_FAILED) {
        killGroup(testProcess.pid); // Not entirely sure why this works...
      }
      that.testProcesses.delete(testProcess.pid);
      //that.killWorkerTmuxSessions(test);
    }catch(e){console.log(e)}
  }

  const testStartTime = Date.now();

  // We should log compiler output in the event of a compiler error.
  let testProcess = child_process.spawn(command, args, {shell: true, detached: true});
  this.testProcesses.add(testProcess.pid);

  let timeout = setTimeout(()=>{
    if(test.state == TestState.STARTING) {
      test.failDetails = FailDetails.LAUNCH_FAILED;
      that.setTestState(test, TestState.FAILED);
    }
    if(test.state == TestState.RUNNING) {
      if(test.coverageMarkers.length) {
        test.failDetails = FailDetails.TEST_FAILED;
        that.setTestState(test, TestState.FAILED);
      } else {
        that.setTestState(test, TestState.PASSED);
      }
      cleanup();
    }
  }, 10*1000);

  testProcess.stdout.setEncoding('utf-8');

  testProcess.stdout.on('data', (data) => {
    if(that.processOutput(test, data)) {
      cleanup();
    }
  });

  testProcess.stderr.on('data', (data) => {
    if(test.state == TestState.RUNNING) {
      if(that.processOutput(test, data)) {
        cleanup();
      }
      test.output.write(`STDERR: ${data}`);
    }
  });

  await new Promise((resolve, reject) => {
    testProcess.on('close', (exit) => {

      if(test.state == TestState.RUNNING) {
        // Crash
        test.failDetails = FailDetails.CRASH_FAILED;
        that.setTestState(test, TestState.FAILED);
      } else if(test.state == TestState.STARTING) {
        test.failDetails = FailDetails.LAUNCH_FAILED
        that.setTestState(test, TestState.FAILED);
      }

      let report = that.generateReport(test);
      test.output.write(`\n\n\n${report}`);
      test.output.close();
      resolve();
    });
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

Toaster.prototype.testAll = async function () {
  this.startTime = Date.now();

  for(let test of this.tests) {
    this.currentTest++;

    await this.runTest(test);
  }

  let endTime = Date.now();
  this.finalReport(endTime-this.startTime);
}

Toaster.prototype.runTest = async function (test) {
  process.stdout.write('\n');

  fs.mkdirSync(test.testResultDirectory, {recursive: true});

  test.output = fs.createWriteStream(`${test.testResultDirectory}/jlog.txt`);

  // The directory could be included in the test object, that would make more sense
  if(!this.compileTest(test)) {
    return;
  }


  // Resume as soon as one of these exits.
  await new Promise( (resolve, reject) => {
    for(let _ = 0; _ < test.networkConfig.devices; _++){
      this.executeTest(test, NODETYPE_DEVICE).then(()=>{resolve()});
    }
  
    for(let _ = 0; _ < test.networkConfig.fogs; _++){
      this.executeTest(test, NODETYPE_FOG).then(()=>{resolve()});
    }
  });
  this.cleanupResidualTests();
  
}

Toaster.prototype.finalReport = function(duration) {
  const total = this.tests.length;
  let passed = 0;

  let allTestsFinished = true;

  for(let test of this.tests) {
    if(test.state == TestState.PASSED) {
      passed++;
    }
    if(test.state == undefined) {
      allTestsFinished = false;
    }
  }

  let exitText = `\n\n${testsAllFinished ? "All Tests Finished" : "Not All Tests Finished"} (${passed}/${total}) in ${duration/1000}s`;

  if(passed == total) {
    exitText = ansiiGreen(exitText);
  } else if (!passed) { 
    // oopsies...
    exitText = ansiiRed(exitText);
  }

  console.log(exitText);

  console.log(`Complete Logs: ${this.resultDirectory}`);

  if(passed != total) {
    console.log("Logs of Failed Tests:");
    for(let test of this.tests) {
      if(test.state == TestState.FAILED) {
        console.log(`${test.testName}    --    ${test.logFile}`);
      }
    }
  }
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
        process.exit();
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
toaster.testAll();
