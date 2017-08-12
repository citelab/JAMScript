#!/usr/bin/env node

/**
 * Created by Richboy on 10/08/17.
 */

'use strict';

var co = require('co');
var terminal = require('terminal-kit').terminal;
var program = require('commander');
var pkg = require('./package.json');
var parser = require('yargs-parser');
var figlet = require('figlet');

var hook;   //This is the Sub-Program executing on the shell
var types = ["flow", "jdata", "jdiscovery", "jview", "jamscript"];  //hook types

var code, cmd, rem = "";
var history = [];   //used for saving and lifting history. TODO: This could be saved to files and fetched on resumption
var quitters = ["quit", "exit", "bye"]; //quit commands

var shell = {
    init(){
        terminal.grabInput();

        program
            .version(pkg.version)
            .description("Choose the JAMScript shell scope to start")
            .arguments("<type>")
            .action(pType => {
                if( types.indexOf(pType) >= 0 ){
                    var opts = {terminal: terminal, args: process.argv.slice(), parser: parser, figlet: figlet};
                    switch(pType){
                        case "flow":
                            let FlowHook = require('./flow_hook.js');
                            hook = new FlowHook(opts);
                            break;
                        case "jdata":
                            let JDataHook = require('./jdata_hook.js');
                            hook = new JDataHook(opts);
                            break;
                        case "jview":
                            let JViewHook = require('./jview_hook.js');
                            hook = new JViewHook(opts);
                            break;
                    }
                }
                else
                    process.exit(1);

                hook.printBanner();

                shell.doAction();
            })
            .parse(process.argv);
    },
    setListeners(){
        terminal.on('key', function(key, matches, data){
            switch ( key ){
                case 'CTRL_C':
                    hook.disconnect();
                    console.log();
                    terminal.processExit(0);
                    break;
            }
        });
    },
    doAction(){
        co(function*(){
            Outer:
            do{
                code = "";
                cmd = "";

                do{
                    code += cmd;

                    terminal(hook.prompt + rem);
                    cmd = yield shell.getInput();
                    if( !cmd )
                        cmd = "";
                    if( cmd.indexOf(";") < 0 && hook.trigger != "\n" )
                        console.log();
                    if( cmd.trim() != "" )
                        history.push(cmd);

                    if( shell.isQuitCommand(cmd) ) {
                        shell.printByeMessage();
                        break Outer;
                    }

                    rem = "";
                }while( cmd.indexOf(hook.trigger) < 0 && hook.trigger != "\n" );

                if( hook.trigger != "\n" ) {
                    code += cmd.substring(0, cmd.indexOf(hook.trigger) + 1);
                    rem = cmd.substring(cmd.indexOf(hook.trigger) + 1, cmd.length).trim();
                }
                else{
                    console.log();
                    code = cmd;
                    rem = "";
                }

                hook.execute(code);
            }while(true);
        });
    },
    getInput(){
        return new Promise((resolve, reject) => {
            terminal.inputField(
                {
                    history: history,
                    tokenHook: hook.tokenizer,
                    autoCompleteHint: true,
                    autoComplete: hook.getAutoCompleteData()
                },
                (err, input) => {
                    if( err )
                        reject(err);
                    else {
                        resolve(input);
                    }
                }
            );
        });
    },
    printByeMessage(){
        //inform the hook
        hook.disconnect();

        console.log();
        terminal.brightBlack.italic("Bye from JAMScript...");
        console.log();
        terminal.processExit(0);
    },
    isQuitCommand(cmd){
        return quitters.indexOf(cmd) >= 0 || quitters.map(cmd => cmd + ";").indexOf(cmd) >= 0;
    }
};

shell.init();
shell.setListeners();