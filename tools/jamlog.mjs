#!/usr/bin/env zx
import { getAppFolder, getJamFolder } from "./fileDirectory.mjs";
import { getLogArgs } from "./parser.mjs";
const readline = require('readline');
import { Client } from 'ssh2';



function printlogArchived(path,tail){
    const appfolder = getAppFolder()
    if(tail) {
        const fileName = path.split("/").pop();

        if (fileName.includes("j")) {
            const string = (fs.readFileSync(`${path}`).toString().trim())
            const lines = string.split('\n');
            const lastNLines = lines.slice(-Number(tail));
            console.log(`---\nworker number J file \n---`)
            console.log(lastNLines.join('\n'))
            
        } else {
            return new Promise((resolve) =>{
                console.log(`\nLast ${tail} lines of C-NODES`);
                const myLineC = readline.createInterface({
                    input: fs.createReadStream(path),
                });
        
                const linesC = [];
                let header;
                let cNode = [];
                myLineC.on('line', (line) => {
                    if (line.includes('worker number')) {
                        if (cNode.length !== 0) {
                            // linesC.push("---")
                            linesC.push(header)
                            linesC.push("---")
                            linesC.push(cNode.join("\n"));

                        }
                        header = line

                       
                    }
             
                cNode.push(line);
                if (cNode.length > tail) {
                    cNode.shift();
                }
                    
                });
        
                myLineC.on('close', () => {

                    // linesC.push("---")
                    linesC.push(header)
                    linesC.push("---")
                    linesC.push(cNode.join("\n"));
                    
                       
                    console.log(linesC.join('\n'));
                    resolve()
                });
            })

        }
    
    }

    else{
        const data = fs.readFileSync(path, 'utf8');
        console.log(data);
    }
}


async function makeConnection(config){
    return await new Promise((resolve, reject) => {
        const client = new Client();
        client.on('ready', () => {
            resolve(client);
        });

        client.on('error', (error) => {
            reject(error);
        });

        client.connect(config);
    });
}

async function executeScript(client, command){
    return (await new Promise((resolve, reject) =>{
        client.exec(command, (err,stream) =>{
            if (err) console.log(error);
            stream.on("close", () => {
                resolve("closed")
            })
            stream.on("data" , (data) =>{
                console.log(data.toString())
            })
        })
    }))
}

async function main(){
    let arg;
    try{
        arg = getLogArgs(process.argv)
    }
    catch(error){
        if(error.type = "ShowUsage"){
            console.log(
                /**
                 *     {name : "help", alias : "h", type: Boolean, defaultValue : false },
                        {name : "program", type: String, defaultValue : undefined },
                        {name : "app", type: String, defaultValue : undefined },
                        {name: "port", type:String, defaultValue: undefined},
                        {name : "j", alias: "j", type: Boolean, defaultValue : false },
                        {name : "c", alias: "c", type: Boolean, defaultValue : false },
                        {name : "tail", alias: "t", type: Number, defaultValue : undefined },

                 */
                `
        Usage: jamlist [--app=appl_name]
    
        [--help] is used to show usage
        [--program && --app && --port] all used togeather to indicate what log we want to get 
        [--c] is a flag used to only show the c file
        [--j] is a flagused to only show the j file
        [--tail=<num>] shows the last n lines of the log
        [--all] shows all the logs
                `
                
            )
        process.exit(1);
        }
    }
    const flag = arg.flag;
    const port =Number(arg.file.split("/")[ arg.file.split("/").length-1]);
    const logFiles =arg.file.split("/")[0]+"/log";
    const tail = arg.tail
    const appFolder = getAppFolder()
    const jamfolder = getJamFolder()
    const path = `${appFolder}/${logFiles}/${port}`
    if(arg.remote){
        if(!fs.existsSync(`${jamfolder}/remote/${arg.remote}`)){
            console.log("there is no such remote machine available for this host")
        }

        const config = {
            host: arg.remote,
            username: '',
        };
        const client = await makeConnection(config);
        const pathExport ="export PATH=$PATH:/home/admin/JAMScript/node_modules/.bin"
        const changeDir= "cd JAMScript/tools"
        let args = '';
        //return {file : file , flag : flag, tail : options.tail, remote: options.remote}
        for(let myArg of Object.keys(arg)){
            if(myArg === "file"){
                const file = arg[myArg];
                const port = file.split("/")[1];
                const app = (file.split("/")[0]).split("_")[1];
                const program = (file.split("/")[0]).split("_")[0];
                args = args + `--app=${app} --program=${program} --port=${port} `
            }
            if(myArg === "flag"){
                if(arg.flag === "all"){
                    args = args +  `--j --c `
                }
                else{
                    args = args + `--${arg.flag} `
                }
                
            }
            if(myArg === "tail"){
                args = args + `--tail=${arg.tail} `
            }
        }
        const finalArg = args.trim()
        console.log(args) 
        const command = `${pathExport} && ${changeDir} && zx jamlog.mjs ${finalArg}`
        console.log(command)
        await makeConnection(config)
        await executeScript(client, command)
        process.exit(0)


    }

    if(fs.existsSync(`${appFolder}/${arg.file}`)){
        if(flag === "all"){
            if(!fs.existsSync(`${appFolder}/${arg.file}/log.j`)){
                console.log("we do not have the log file for j files")
            }
            const string = (fs.readFileSync(`${appFolder}/${arg.file}/log.j`).toString().trim())
            if(tail){
                const lines = string.split('\n');
                const lastNLines = lines.slice(-Number(tail));
                console.log(`---\nworker number J file \n---`)
                console.log(lastNLines.join('\n'))
            }
            else{
       

                console.log(`---\nworker number J file \n---`)
                console.log(string)
            }

            const cFiles = fs.readdirSync(`${appFolder}/${arg.file}`).filter((entry) => (entry.includes("log") && !entry.includes(".j")));
            if(cFiles.length === 0 ){
                console.log("we do not have the log files for c files")
            }
            else{
                for(let cFile of cFiles ){
                    const string = fs.readFileSync(`${appFolder}/${arg.file}/${cFile}`).toString().trim()
                    if(tail){
                        const lines = string.split('\n');
                        const lastNLines = lines.slice(-Number(tail));
                        console.log(`---\nworker number ${cFile.split(".")[1]} \n---`)

                        console.log(lastNLines.join('\n'))
                    }
                    else{

                        console.log(`---\nworker number ${cFile.split(".")[1]} \n---`)
                        console.log(string)
                    }
                }
            }

        }
        else if(flag === "j"){
            
            if(!fs.existsSync(`${appFolder}/${arg.file}/log.j`)){
                console.log("we do not have the log file for j files")
            }
            const string = (fs.readFileSync(`${appFolder}/${arg.file}/log.j`).toString().trim())
            if(tail){
                const lines = string.split('\n');
                const lastNLines = lines.slice(-Number(tail));
                console.log(`---\nworker number J file \n---`)
                console.log(lastNLines.join('\n'))
            }
            else{
       

                console.log(`---\nworker number J file \n---`)
                console.log(string)
            }
            
        }
        else{
            const cFiles = fs.readdirSync(`${appFolder}/${arg.file}`).filter((entry) => (entry.includes("log") && !entry.includes(".j")));
            if(cFiles.length === 0 ){
                console.log("we do not have the log files for c files")
            }
            else{
                for(let cFile of cFiles ){
                    const string = fs.readFileSync(`${appFolder}/${arg.file}/${cFile}`).toString().trim()
                    if(tail){
                        const lines = string.split('\n');
                        const lastNLines = lines.slice(-Number(tail));
                        console.log(`---\nworker number ${cFile.split(".")[1]} \n---`)

                        console.log(lastNLines.join('\n'))
                    }
                    else{

                        console.log(`---\nworker number ${cFile.split(".")[1]} \n---`)
                        console.log(string)
                    }
                }
            }

        }
    }
    else{    
        if(port){
            if(!fs.existsSync(path)){
                console.log(`THERE IS NO LOG ON ${port} for ${logFiles.split("/")[0]}`)
            }

            if(flag === "all"){
                if(!fs.existsSync(`${path}/log.j`)){
                    console.log(`There is no log for C files on port ${port} for ${logFiles.split("/")[0]}`)
                }
                else{
                    
                    await printlogArchived(`${path}/log.j`,tail)
                    
                }
                if(!fs.existsSync(`${path}/log.c`)){
                    console.log(`There is no log for C files on port ${port} for ${logFiles.split("/")[0]}`)
                }
                else{
                    await printlogArchived(`${path}/log.c`,tail)
                }
            }   
            else if(flag === "j"){
                if(!fs.existsSync(`${path}/log.j`)){
                    console.log(`There is no log for C files on port ${port} for ${logFiles.split("/")[0]}`)
                }
                else{
                    await printlogArchived(`${path}/log.j`,tail)
                }
            }
            else if(flag === "c"){
                if(!fs.existsSync(`${path}/log.c`)){
                    console.log(`There is no log for C files on port ${port} for ${logFiles.split("/")[0]}`)
                }
                else{
                    await printlogArchived(`${path}/log.c`,tail)
                }
            }
        }
    }

 
}


(async () =>{
    await main()

})()