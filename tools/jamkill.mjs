#!/usr/bin/env zx
import { getAppFolder, getJamFolder } from "./fileDirectory.mjs";
import {getKilltArgs} from "./parser.mjs"
import { cleanByPortNumber , pauseByPortNumber} from "./cleanUp.mjs";
import { Client } from 'ssh2';
import { transport } from "pino";
//can't specify what port ti jukk exactly
let currIP;
if (os.platform() === 'win32') {
    currIP = (await $`powershell (Get-NetIPAddress -AddressFamily IPv4).IPAddress`.catch(() => '')).toString().trim();
  } else if (os.platform() === 'darwin') {
    currIP = (await $`ipconfig getifaddr en0`.catch(() => '')).toString().trim();
  } else if (os.platform() === 'linux') {
    currIP =( await $`hostname -I`.catch(() => '')).toString().trim();
  }

export function getRunningDirs(){
    const jamFolder = getJamFolder()
    const appToPort = new Map()
    let activePorts
    try{
        activePorts = fs.readdirSync(`${jamFolder}/ports`)
    }
    catch(error){
        return appToPort
    }
    for(let port of activePorts){
        let apps;
        try{
            apps = fs.readFileSync(`${jamFolder}/ports/${port}`).toString().trim().split("\n");
        }
        catch(error){
            continue
        }
        for(let app of apps){
            if(appToPort.has(app)){
                const portList = appToPort.get(app);
                portList.push(port)
                appToPort.set(app,portList)
            }
            else{
                appToPort.set(app,[port])
            }
        }
    }
    return appToPort;
}

export function dirNameToAppName(dirName){
    const dir = dirName.split('_')
    if(dir.length > 2){
        return (dir.filter((_,index) => index !== 0)).join("_")
    }
    else{
        return dir[1];
    }
    
}
export function dirNameToProgramName(dirName){
    return (dirName.split('_'))[0]
    
}
function killDataByPortDir(portDir, root){
    const jamFolder = getJamFolder()
    const appFolder = getAppFolder()
    const infoList = portDir.split("/")

    if(infoList.length !== 2){
        throw new Error("Wrong Path input")
0   }
    const dirName = infoList[0]
    const portName = infoList[1]

    let dirsRunning;
    try{
        dirsRunning = fs.readFileSync(`${jamFolder}/ports/${portName}`).toString().trim().split("\n");
    }
    catch(error){
        return[]
    }

    if(!dirsRunning.includes(dirName)){
        return []
    }

    if(root){
        try{
            const rootIP = fs.readFileSync(`${appFolder}/${portDir}/root`).toString().trim();
            if(rootIP === root){
                const info = {
                    programName : dirNameToProgramName(dirName)+".jxe",
                    appName : dirNameToAppName(dirName),
                    portNumber : portName
                }
                return [info]
            }
            return [];
        }
        catch(error){
            return [];
        }
    }
    else{
        const info ={
            programName : dirNameToProgramName(dirName)+".jxe",
            appName : dirNameToAppName(dirName),
            portNumber : portName
        }
        return [info]
    }
}

function killDataByPortNum(portNum, root){
    const jamFolder = getJamFolder()
    const toClean=[];
    const appfolder = getAppFolder()
    let activePorts;
    let dirsRunning;
    try{
        activePorts = (fs.readdirSync(`${jamFolder}/ports`)).map((entry) => Number(entry))
        if(!activePorts.includes(Number(portNum))){
            return [];
        }
        dirsRunning = fs.readFileSync(`${jamFolder}/ports/${portNum}`).toString().trim().split("\n")
    }
    catch(error){
        return []
    }
    for(let dir of dirsRunning){
        if(root){
            try{
                const rootIP = fs.readFileSync(`${appfolder}/${dir}/${portNum}/root`).toString().trim();
                if(rootIP === root){
                    const info ={
                        programName : dirNameToProgramName(dir)+".jxe",
                        appName : dirNameToAppName(dir),
                        portNumber : portNum
                    }
                    toClean.push(info)
                }
            }
            catch(error){
                continue;
            }
        }
        else{
            const info ={
                programName : dirNameToProgramName(dir)+".jxe",
                appName : dirNameToAppName(dir),
                portNumber : portNum
            }
            toClean.push(info)
        }
    }
    return toClean;
}

function killDataByAppName(appName, root){
    const toClean=[];
    const activeDirs = getRunningDirs();
    const appfolder = getAppFolder()
    for(let dir of activeDirs.keys()){
        const currApp = dirNameToAppName(dir)
        if(currApp === appName){
            for(let port of activeDirs.get(dir)){
                if(root){
                    try{
                        const rootIP = fs.readFileSync(`${appfolder}/${dir}/${port}/root`).toString().trim();
                        if(rootIP === root){
                            const info ={
                                programName : dirNameToProgramName(dir)+".jxe",
                                appName : dirNameToAppName(dir),
                                portNumber : port
                            }
                            toClean.push(info)
                        }
                    }
                    catch(error){
                        continue;
                    }
                }
                else{
                    const info ={
                        programName : dirNameToProgramName(dir)+".jxe",
                        appName : dirNameToAppName(dir),
                        portNumber : port
                    }
                    toClean.push(info)
                }
            }
        }
    }
    return toClean
}

function killDataByProgramName(programName, root){

    const toClean=[];
    const activeDirs = getRunningDirs();
    const appfolder = getAppFolder()
    for(let dir of activeDirs.keys()){
        const currProgram = dirNameToProgramName(dir)
        if(currProgram === programName){
            for(let port of activeDirs.get(dir)){
                if(root){
                    try{
                        const rootIP = fs.readFileSync(`${appfolder}/${dir}/${port}/root`).toString().trim();
                        if(rootIP === root){
                            const info = {
                                programName : dirNameToProgramName(dir)+".jxe",
                                appName : dirNameToAppName(dir),
                                portNumber : port
                            }
                            toClean.push(info)
                        }
                    }
                    catch(error){
                        continue;
                    }
                }
                else{
                    const info ={
                        programName : dirNameToProgramName(dir)+".jxe",
                        appName : dirNameToAppName(dir),
                        portNumber : port
                    }
                    toClean.push(info)
                }
            }
        }
    }
    return toClean
}


function killDataByDirName(dirName, root){

    const toClean=[];
    const activeDirs = getRunningDirs();
    const appfolder = getAppFolder()
    for(let dir of activeDirs.keys()){
        if(dir === dirName){
            for(let port of activeDirs.get(dir)){
                if(root){
                    try{
                        const rootIP = fs.readFileSync(`${appfolder}/${dir}/${port}/root`).toString().trim();
                        if(rootIP === root){

                            const info ={
                                programName : dirNameToProgramName(dir)+".jxe",
                                appName : dirNameToAppName(dir),
                                portNumber : port
                            }
                            toClean.push(info)
                        }
                    }
                    catch(error){
                        continue;
                    }
                }
                else{
                    const info ={
                        programName : dirNameToProgramName(dir)+".jxe",
                        appName : dirNameToAppName(dir),
                        portNumber : port
                    }
                    toClean.push(info)
                }
            }
        }
    }
    return toClean
}

function killDataForAll(root){
    const toClean=[];
    const activeDirs = getRunningDirs();
    const appfolder = getAppFolder()

    for(let dir of activeDirs.keys()){
        for(let port of activeDirs.get(dir)){
            if(root){
                try{
                    const rootIP = fs.readFileSync(`${appfolder}/${dir}/${port}/root`).toString().trim();
                    if(rootIP === root){
                        const info ={
                            programName : dirNameToProgramName(dir)+".jxe",
                            appName : dirNameToAppName(dir),
                            portNumber : port
                        }
                        toClean.push(info)
                    }
                }
                catch(error){
                    continue;
                }
            }
            else{

                const info ={
                    programName : dirNameToProgramName(dir)+".jxe",
                    appName : dirNameToAppName(dir),
                    portNumber : port
                }
                toClean.push(info)
            }
        }
    }

    return toClean
}
async function killJamRun(data){
    const appName = data.appName;
    const programName = data.programName
    const portNumber = data.portNumber
    const dirName = ((programName.split('.'))[0]) +"_"+ appName;
    const appfolder = getAppFolder()
    try{
        const pid = fs.readFileSync(`${appfolder}/${dirName}/${portNumber}/shellpid`).toString().trim();
        const p = await $`ps -p ${pid} | grep jamrun | wc -l | tr -d '[:space:]'`
        const exists = Number(p.stdout.toString().trim());
        if(exists){
            process.kill(pid);
            return
        }
    }
    catch(error){
        return 
    }
}

async function killJFile(data){
    const appName = data.appName;
    const programName = data.programName
    const portNumber = data.portNumber
    const dirName = ((programName.split('.'))[0]) +"_"+ appName;
    const appfolder = getAppFolder()
    try{
        const pid = fs.readFileSync(`${appfolder}/${dirName}/${portNumber}/processId`).toString().trim();
        const p = await $`ps -p ${pid} | grep node | wc -l | tr -d '[:space:]'`
        const exists = Number(p.stdout.toString().trim());
        if(exists){
            process.kill(pid);
            return;
        }
    }
    catch(error){
        return
    }
}

async function killProcess(data){
    await killJamRun(data);
    await killJFile(data);
}

async function pauseProcess(data){
    await killJamRun(data);
    await killJFile(data);
}

async function jamKill(flag, name, pause, root)
{   


    let jamData;
    if(flag === "dir"){
        jamData = killDataByDirName(name, root)
    }
    else if(flag === "app"){
        jamData = killDataByAppName(name, root)

        
    }
    else if(flag === "program"){

        jamData = killDataByProgramName(name, root)
    }
    else if(flag === "port"){

        jamData = killDataByPortNum(name, root)
    }
    else if(flag === "portDir"){

        jamData = killDataByPortDir(name, root)
    }
    else{

        jamData = killDataForAll(root)
    }


    if(jamData.length === 0 ){
        if(flag === "all"){
            console.log("no running app on local")
        }
        else{
            console.log("no such running app on local")
        }
        
    }

    if(pause){
        for(let data of jamData){
            let appfolder = getAppFolder()
            const appName = data.appName;
            const programName = data.programName
            const portNumber = data.portNumber
            try{
                fs.existsSync(`${appfolder}/${programName.split(".")[0]}_${appName}/${portNumber}/machType`)
                if(fs.readFileSync(`${appfolder}/${programName.split(".")[0]}_${appName}/${portNumber}/processId`).toString().trim() === "new"){
                    console.log("CAN'T PAUSE",`${appfolder}/${programName.split(".")[0]}_${appName}/${portNumber}. TRY LATER` )
                }
            }
            catch(error){
                console.log("CAN'T PAUSE",`${appfolder}/${programName.split(".")[0]}_${appName}/${portNumber}. TRY LATER` )
            }
            pauseByPortNumber(programName,appName,portNumber)
            await pauseProcess(data);
        }
    }
    else{
        for(let data of jamData){
            const appName = data.appName;
            const programName = data.programName
            const portNumber = data.portNumber
            await killProcess(data);
            cleanByPortNumber(programName,appName,portNumber)
        }
    }
    //keep this LOG
    console.log("KILLING IS OVER")

}

async function jamKillBruteForce(){

    await $`pkill node`.nothrow().quiet();
    await $`pkill mosquitto`.nothrow().quiet();
    await $`pkill tmux`.nothrow().quiet();
    await $`ps aux | grep redis-server | grep -v grep | awk '{print $2}' | xargs kill`.nothrow().quiet();
    const jamfolder = getJamFolder();
    if(fs.existsSync(`${jamfolder}/ports`))
        fs.rmSync(`${jamfolder}/ports`, { recursive: true, force: true })
    if(fs.existsSync(`${jamfolder}/apps`))
        fs.rmSync(`${jamfolder}/apps`, { recursive: true, force: true })
    if(fs.existsSync(`${jamfolder}/mqttpid`))
        fs.rmSync(`${jamfolder}/mqttpid`, { recursive: true, force: true })
            
}
async function executeScript(client, command){
    return (await new Promise((resolve, reject) =>{
        client.exec(command, (err,stream) =>{

            if (err) throw err;
            let result = ''
            stream.on("close", () => {
                resolve(result)
            })
            stream.on("data" , (data) =>{

                if(data.includes("KILLING IS OVER"))
                    {
                        resolve(data.toString())
                    }

            })
        })
    }))
}

async function main(){

  let args;

  try{
    args = getKilltArgs(process.argv)
   
  }
  catch(error){
  

        console.log(

    `
    Kill running instances of the application.
    Usage: 
    
    jamkill --reset [--remote]
    To kill all the programs and remove the ports, mqttpid and apps directory which would be equivelant to a hard reset
    --reset flag should be used. have in mind uninsg the --reset flag will dissable all the other flags and do a hard reset. 
    the only flag which can be used with --reset is --remote which runs the kill --reset on the local machine and all the remote
    machines.

    jamkill --help
    displays this help messages.

    jamkill --all [--remote] [--pause]
    to kill all the programs running --all flag should be used. It differ from --reset since it just removes the running programs
    and does no file directory cleanup. The only other flag which can be used next to --all is --remote and --pause. use --remote  to include all the remote
    machines in the killing process. use --pause to pause all the programs instead of completly killing them.
    

    jamkill --app --name==<appName> [--remote] [--pause]
    to kill program with a specific appName. use --app flag as an indicator of the killing criteria(which is app name), followed by --name=<appName>
    to specify what program should be kiiled.[--remote] and [--pause] are optional flags to include remote machines or pause instead of complete termination.
    ex) jamkill --app --name=testingApp --remote --pause
    
    jamkill --program --name==<programName> [--remote] [--pause]
    to kill program with a specific programName. use --program flag as an indicator of the killing criteria(which is program name), followed by --name=<programName>
    to specify what program should be kiiled.[--remote] and [--pause] are optional flags to include remote machines or pause instead of complete termination.
    ex)jamkill --program --name=jt2 [--remote] [--pause]

    jamkill --port --name==<portNum> [--remote] [--pause]
    to kill program with on a specific portNumber, use --port flag as an indicator of the killing criteria(which is portNumbrt), followed by --name=<portNumber>
    to specify what program on which port should be killed. [--remote] and [--pause] are optional flags to include remote machines or pause instead of complete termination.
    ex) jamkill --app --name=1883 --remote --pause
    
    jamkill --dir --name==<appDirName> [--remote] [--pause]
    Directory name is refered to the directory associated to a program under the apps folder. dirName is a combination of the --program and --name flag. 
    If a program with specific appName and programName should be killed --dir flag should be used followed by the --name=<direcotryName>.
    [--remote] and [--pause] are optional flags to include remote machines or pause instead of complete termination.
    ex)jamkill --dir --name=jt2_testingApp --remote --pause

    jamkill --portDir --name==<appPortDirName> [--remote] [--pause]
    portDir refers to the directory in the folder for a specific program which contains the info of that program running on an specific port. 
    portdir is a combination of --app, --program and --ports which always targetes a signle running program.
    [--remote] and [--pause] are optional flags to include remote machines or pause instead of complete termination.
    ex)jamkill --portDir --name==jt2_shahin/1883 [--remote] [--pause]

    NOTE: only one of --app && --program && --dir && --portDir && --port can be used.
    `
        )
    throw error
  }
  const jamfolder = getJamFolder();
  const appfolder = getAppFolder();
  if(fs.existsSync(`${jamfolder}/remote`) && args.remote && !args.root){
    const remotes = fs.readdirSync(`${jamfolder}/remote`)
    for(let remote of remotes){

        const config = {
            host: remote,
            username: '',
          };          
        let client = await new Promise((resolve, reject) => {
            const client = new Client();

            client.on('ready', () => {
                resolve(client);
            });

            client.on('error', (error) => {
                reject(error);
            });

            client.connect(config);
        });
        const pathExport ="export PATH=$PATH:/home/admin/JAMScript/node_modules/.bin"
        const changeDir= "cd JAMScript/tools"
        let toExecute;

        if(args.flag == "reset"){
                toExecute = `zx jamkill.mjs --reset --root=${currIP}`
        }
       
        else if(args.flag == "all"){
            if(!args.pause)
                toExecute = `zx jamkill.mjs --${args.flag} --root=${currIP}`
            else
                toExecute = `zx jamkill.mjs --${args.flag} --pause --root=${currIP}`
        }
        else{
            if(!args.pause)
                toExecute = `zx jamkill.mjs --${args.flag} --name=${args.name} --root=${currIP}`
            else
                toExecute = `zx jamkill.mjs --${args.flag} --name=${args.name} --pause --root=${currIP}`
        }


        const command=`${pathExport} && ${changeDir} && ${toExecute}`
        await executeScript(client, command);
    }
  }
  if(args.flag === "reset"){
    if(args.root){
        throw new Error("DOES NOT HAVE THE PERMISSION TO RESET A REMOTE MACHINE")
    }

    await jamKillBruteForce()
  }
  else if( !fs.existsSync(jamfolder) ){
    throw new Error('.jamruns folder missing. JAMScript tools not setup?')
  }
  else if( !fs.existsSync(appfolder) ){
    throw new Error('.jamruns/apps folder missing. JAMScript tools not setup?')
  }
  else{
    await jamKill(args.flag , args.name, args.pause, args.root);
  }


  process.exit(0);
  
}


(async() => {

    await main()

})()
