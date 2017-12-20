/**
 * Created by Richboy on 10/08/17.
 */

'use strict';

var Hook = require('./hook.js');

class JDataHook extends Hook{
    constructor(opts){
        super(opts);

        this.prompt = "jdata> ";
    }

    execute(code){
        code = code.trim();
        var parts = code.split(" ");
        var tokens;

        if( parts.length == 0 ){    //if no command was entered
            return;
        }

        switch(parts[0]){
            case "ds":
                // command: ds <name>
                // description: List the data streams in the data source specified in <name>
                // options:
                // -f, --from <index> The offset/index to start from
                // -t, --to <index> The index to end
                // -h, --help See usage help
                //tokens = this.parser(code, {alias: {'from': ['f'], 'to': ['t'], 'help': ['h']}, number: ['from', 'to']});

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

                tokens = this.parse(build);

                if( tokens.help ) { //if help was called
                    this.printHelp(build);
                    return;
                }

                let from = tokens.from ? tokens.from : 0;
                let to = tokens.to ? tokens.to : Number.MAX_VALUE;
                let dataSource = tokens.name;

                //TODO implements getting the datasources from Redis or...
                console.log("list the data streams for %s", dataSource);
                break;
        }
    }
}

module.exports = JDataHook;