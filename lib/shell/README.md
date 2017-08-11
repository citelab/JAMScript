JAMScript Shell Program
=======================

The JAMScript Shell allows multiple programs to be hooked and executed. The binary is currently named `jamshell` and would be the name installed to the system path 

Starting (without installing)
-----------------------------

Via testing is can be started with:

`node index.js <hook name>`

For example: `node index.js flow`

The Hook names currently defined are: "flow", "jdata", "jdiscovery", "jview", "jamscript". However, these can be modified or removed or more could be added.

Starting (after installing)
---------------------------

After installing, running the application from the terminal should be as easy as:

`jamshell <hook name>`

For example: `jamshell flow`

Adding/Modifying Hooks
----------------------

The `index.js` file in the root directory has a `types` variable which states the Hooks which are currently supported.
All Hooks extend the `Hook` class defined in `hook.js`. The hook class defined a `prompt` property which will be used as the shell prompt.
The default is `App>`. This can be modified in the extending class. Each hook can also define the character that triggers the command to be executed. By default the newline character (`\n`) is used. This can be modified by setting the `trigger` property in the constructor. For example:

```javascript
var Hook = require('./hook.js');

class MyHook extends Hook{
    constructor(opts){
        super(opts);
        this.trigger = ";"  //trigger command when the user presses semi-colon
    }
}
```

Adding Commands to Hooks
------------------------

When ever a command is triggered, the `execute` method of the active Hook receives the command. The Hook class defines defines utility methods for parsing commands. These could be used by subclasses. The same build object can used to show Usage help and also parsed to obtain required data from the terminal.
As example of the build object is shown below:

```javascript
class MyHook extends Hook{
    ...
    execute(code){
        // command: ds <name>
        // description: List the data streams in the data source specified in <name>
        // options:
        // -f, --from <index> The offset/index to start from
        // -t, --to <index> The index to end
        // -h, --help See usage help
        
        //If we have the above elements for our command, we can build it as:
        var build = {
            cmd: "ds <name>",
            desc: "List the data streams in the data source specified in <name>",
            opts: [
                {cmd: "-f, --from <index>", desc: "The offset/index to start from"},
                {cmd: "-t, --to <index>", desc: "The index to end"},
                {cmd: "-h, --help", desc: "See usage help"}
            ],
            code: code,
            number: ['from', 'to']
        };
    }             
    ...
}
```

In order to parse the build object, we call the method defined in the Hook class as:

```javascript
    var parsed = this.parse(build);
```

To generate the Help from that object we can do the following:

```javascript
    this.printHelp(build);
```

Ideally, we would want to first check if the user has specified the help flag by doing:

```javascript
    var parsed = this.parse(build);
    if( parsed.help ){
        this.printHelp(build);
        return;
    }
```

The required options for the build are:

1. cmd: The command pattern as is `<command>` or `<command> <arg1> <arg2>`.
   Now bear in mind that the names the command arguments are significant to retrieving the data stored in them. 
   As an example:
   
```javascript
    var build = {
        cmd: "listfiles <dir> <ext>",
        ...
    }
    
    //the above creates a command that requires a directory (<dir>) 
    //and file extension (<ext>). These are obtainable:
    
    var parsed = this.parse(build);
    if( parsed.dir != null && parsed.ext )
        doSomething(parsed.dir, parsed.ext);
    else if( parsed.dir != null )
        doSomethingElse(parsed.dir);
    else{
        this.printHelp(build);
        return;
    }
```

   The command arguments are deemed as required (meaning that they will always be set) and the order is preserved. They will be set to `null` if they were not provided by the user.

2. code: This is the full command string passed into the execute function


The following options are supported but are optional:

1. desc: The description of the Command. Used to generate the Usage Help.
2. opts: The array of possible options which can be specified by the user. Each option is an object that must have at least a `cmd` property. The desc is optional and is mainly used for generating the Usage Help. The `cmd` property can list several aliases as in:

```javascript
    var build = {
        ...
        opts: [
            {cmd: "-s, --size <number>", desc: "The maximum file size to show"},
            {cmd: "-t, --timestamp, --time <unix-time>"},
            {cmd: "--display-as-grid", desc: "Show files in Grid form"},
            {cmd: "-n, --no-empty", desc: "Ignore empty files"}
        ]
        ...
    }
```

Unlike the `build.cmd` property, the names in angle brackets (< and >) in the `build.opts.cmd` are not significant. They are just used as hints especially when generating the Usage Help.
**NOTE**: 
i. A property like `--display-as-grid` will be converted to camelCase as be accessed from the parsed object as `parsed.displayAsGrid`
ii. A property starting with `--no` as with `--no-empty` with evaluate to boolean as `{empty: false}` if specified.


3. number: An array of options and/or command arguments that should be treated as numbers.
4. boolean: An array of options and/or command arguments that should be treated as boolean.
5. string: An array of options and/or command arguments that should be treated as strings even if they appears as numbers.

   