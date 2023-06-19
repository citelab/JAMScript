#!/usr/bin/env node

/*******************************
 * JAMSCRIPT TESTING FRAMEWORK *
 *******************************/
const fs      = require('fs'),
      path    = require('path'),
      process = require('process'),
      child_process = require('child_process');

const TEST_RESULT_DIR_NAME = "toast-results";
const DEFAULT_TEST_DIR = "Ver_2_Tests"


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
    let completePath = `${folder}/${file}`

    if(fs.lstatSync(completePath).isDirectory()) {
      tests.push(...that._walkTestDir(completePath));
    }

    let extension = path.extname(file);
    if(extension === ".c") {
      let basename = file.substring(0, file.length-2);
      if(fs.existsSync(`${folder}/${basename}.js`)){
        let testName = `${folder}/${basename}`.substring(this.testDirectory.length+1);
        tests.push({
          testName: testName,
          cFile: `${folder}/${basename}.c`,
          jsFile: `${folder}/${basename}.js`,
          testResultDirectory: `${that.resultDirectory}/${testName}`
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


Toaster.prototype.compileTest = function(test, testResultDirectory) {
  let command = `jamc -d ${test.cFile} ${test.jsFile} -o ${test.testResultDirectory}/test`;

  // We should log compiler output in the event of a compiler error.
  child_process.execSync(command, {stdio: [0,1,2]});
}

// Built in kill not working.
function killGroup(pgid) {
  child_process.execSync(`kill -- -${pgid}`);
}

Toaster.prototype.executeTest = function(test, testResultDirectory) {
  let command = `jamrun`
  let args =  [
    `${test.testResultDirectory}/test.jxe`,
    "--app=qwe",
    //"--log",
    "--temp_broker"];

    // Loop through process ID files
    // 

  // We should log compiler output in the event of a compiler error.
  let testProcess = child_process.spawn(command, args, {shell: true, detached: true});
  let timeout = setTimeout(()=>{
    console.log("Trying to kill thing");
    killGroup(testProcess.pid); // This works fo now but is likely not portable
  }, 4000);

  testProcess.stdout.on('data', (data) => {
    console.log(`${data}`);
  });

  testProcess.stderr.on('data', (data) => {
    //clearTimeout(timeout);
    console.error(`stderr: ${data}`);
    //testProcess.kill();
  });

  testProcess.on('close', (exit) => {
    console.log("Test Finished....");
    this.runNextTest();
  });
}

// For now running sequentially
Toaster.prototype.runTest = function () {
  let test = this.tests[this.currentTest];
  console.log(`Running ${test.testName}`);
  fs.mkdirSync(test.testResultDirectory, {recursive: true});

  // The directory could be included in the test object, that would make more sense
  this.compileTest(test);
  this.executeTest(test);
}

Toaster.prototype.runNextTest = function() {
  this.currentTest++;
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