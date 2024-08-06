#!/usr/bin/env zx
import { getAppFolder, getJamFolder } from "./fileDirectory.mjs";
import {getKilltArgs} from "./parser.mjs"
import { cleanByPortNumber , pauseByPortNumber} from "./cleanUp.mjs";
import { Client } from 'ssh2';
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
    const activePorts = fs.readdirSync(`${jamFolder}/ports`)
    for(let port of activePorts){
        const apps = fs.readFileSync(`${jamFolder}/ports/${port}`).toString().trim().split("\n");
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
    console.log("IF STATEMENT 1")
    if(infoList.length !== 2){
        throw new Error("Wrong Path input")
0   }
    const dirName = infoList[0]
    const portName = infoList[1]
    console.log("IF STATEMENT 2")

    if(!fs.existsSync(`${jamFolder}/ports/${portName}`)){
        return[]
    }
    console.log("IF STATEMENT 4")

    const dirsRunning = fs.readFileSync(`${jamFolder}/ports/${portName}`).toString().trim().split("\n")
    if(!dirsRunning.includes(dirName)){
        return []
    }
    console.log("PRE ROOT")
    if(root){
        console.log("root exists")
        console.log("portName", portName)
        if(fs.existsSync(`${jamFolder}/ports/${portName}`)){
            console.log("file exists")
            const rootIP = fs.readFileSync(`${appFolder}/${portDir}/root`).toString().trim();
            if(rootIP === root){
                console.log("root matches")
                const info = {
                    programName : dirNameToProgramName(dirName)+".jxe",
                    appName : dirNameToAppName(dirName),
                    portNumber : portName
                }
                console.log(info, "this is my info")
                return [info]
            }
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
    const activePorts = (fs.readdirSync(`${jamFolder}/ports`)).map((entry) => Number(entry))
    const appfolder = getAppFolder()
    if(!activePorts.includes(Number(portNum))){
        return [];
    }
    const dirsRunning = fs.readFileSync(`${jamFolder}/ports/${portNum}`).toString().trim().split("\n")
    for(let dir of dirsRunning){
        if(root){
            console.log("root exists from port num")
            if(fs.existsSync(`${appfolder}/${dir}/${portNum}/root`)){
                console.log("file exists")
                const rootIP = fs.readFileSync(`${appfolder}/${dir}/${portNum}/root`).toString().trim();
                if(rootIP === root){
                    console.log("PORT MATCHING")
                    const info ={
                        programName : dirNameToProgramName(dir)+".jxe",
                        appName : dirNameToAppName(dir),
                        portNumber : portNum
                    }
                    console.log(info, "TO KILL")
                    toClean.push(info)
                }
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
                    console.log("root EXISTS")
                    if(fs.existsSync(`${appfolder}/${dir}/${port}/root`)){
                    console.log("FILE EXISTS")
                        const rootIP = fs.readFileSync(`${appfolder}/${dir}/${port}/root`).toString().trim();
                        console.log(root, "root OLD")
                        console.log(rootIP, "root new")
                        if(rootIP === root){
                            const info ={
                                programName : dirNameToProgramName(dir)+".jxe",
                                appName : dirNameToAppName(dir),
                                portNumber : port
                            }
                            toClean.push(info)
                        }
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
    console.log("KILLING DATA BY NAME")
    const toClean=[];
    const activeDirs = getRunningDirs();
    const appfolder = getAppFolder()
    for(let dir of activeDirs.keys()){
        const currProgram = dirNameToProgramName(dir)
        if(currProgram === programName){
            for(let port of activeDirs.get(dir)){
                if(root){
                    console.log("ROOT EXISTS")
                    if(fs.existsSync(`${appfolder}/${dir}/${port}/root`)){
                        console.log("file exist")
                        const rootIP = fs.readFileSync(`${appfolder}/${dir}/${port}/root`).toString().trim();
                        console.log(rootIP)
                        console.log(root)
                        if(rootIP === root){
                            const info = {
                                programName : dirNameToProgramName(dir)+".jxe",
                                appName : dirNameToAppName(dir),
                                portNumber : port
                            }
                            console.log("this is the info", info)
                            toClean.push(info)
                        }
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
    console.log("KILLING BT NAME STARTED")
    const toClean=[];
    const activeDirs = getRunningDirs();
    const appfolder = getAppFolder()
    for(let dir of activeDirs.keys()){
        if(dir === dirName){
            for(let port of activeDirs.get(dir)){
                if(root){
                    console.log("ROOT IS HERE")
                    if(fs.existsSync(`${appfolder}/${dir}/${port}/root`)){
                        console.log("FILE IS HERE")
                        const rootIP = fs.readFileSync(`${appfolder}/${dir}/${port}/root`).toString().trim();
                        if(rootIP === root){
                            console.log("ID MATCHED")
                            const info ={
                                programName : dirNameToProgramName(dir)+".jxe",
                                appName : dirNameToAppName(dir),
                                portNumber : port
                            }
                            console.log("INFO")
                            toClean.push(info)
                        }
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
    console.log("ACTIVE DIRS", activeDirs)
    for(let dir of activeDirs.keys()){
        for(let port of activeDirs.get(dir)){
            if(root){
                console.log("root exists")
                if(fs.existsSync(`${appfolder}/${dir}/${port}/root`)){
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

            }
            else{
                console.log("root does not exists")
                const info ={
                    programName : dirNameToProgramName(dir)+".jxe",
                    appName : dirNameToAppName(dir),
                    portNumber : port
                }
                toClean.push(info)
            }
        }
    }
    console.log("TO CLEAN", toClean)
    return toClean
}
async function killJamRun(data){
    const appName = data.appName;
    const programName = data.programName
    const portNumber = data.portNumber
    const dirName = ((programName.split('.'))[0]) +"_"+ appName;
    const appfolder = getAppFolder()
    if(fs.existsSync(`${appfolder}/${dirName}/${portNumber}/shellpid`)){
        const pid = fs.readFileSync(`${appfolder}/${dirName}/${portNumber}/shellpid`).toString().trim();
        let exists;
        try {
            const cwd = process.cwd()
            const p = await $`ps -p ${pid} | grep jamrun | wc -l | tr -d '[:space:]'`
            exists = Number(p.stdout.toString().trim());
        } catch (error) {
            exists = 0 
     
        }

        if(exists){
            process.kill(pid);
        }
    }
}

async function killJFile(data){
    const appName = data.appName;
    const programName = data.programName
    const portNumber = data.portNumber
    const dirName = ((programName.split('.'))[0]) +"_"+ appName;
    const appfolder = getAppFolder()
    if(fs.existsSync(`${appfolder}/${dirName}/${portNumber}/processId`)){
        const pid = fs.readFileSync(`${appfolder}/${dirName}/${portNumber}/processId`).toString().trim();
        let exists;
        try {
            const p = await $`ps -p ${pid} | grep node | wc -l | tr -d '[:space:]'`
            exists = Number(p.stdout.toString().trim());
        } catch (error) {
            exists = 0 
        }
        if(exists){
            process.kill(pid);
            return;
        }
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
    console.log("KILLING PROCESS STARTING")
    console.log("this is my flag in jamkill", flag)
    let jamData;
    if(flag === "dir"){
        jamData = killDataByDirName(name, root)
    }
    else if(flag === "app"){
        jamData = killDataByAppName(name, root)
        console.log("data from name", jamData)
        
    }
    else if(flag === "program"){
        console.log("killing by program name")
        jamData = killDataByProgramName(name, root)
    }
    else if(flag === "port"){
        console.log("USING PORT TO CLEAN")
        jamData = killDataByPortNum(name, root)
    }
    else if(flag === "portDir"){
        console.log("GOT TO THE PORT DIR")
        jamData = killDataByPortDir(name, root)
    }
    else{
        console.log("CLEANING DATA FOR ALL")
        jamData = killDataForAll(root)
    }

    console.log(jamData)
    if(jamData.length === 0 ){
        if(flag === "all"){
            console.log("no running app on local")
        }
        else{
            console.log("no such running app on local")
        }
        
    }
    console.log(pause)
    if(pause){
        console.log("Pausing from jam kill")
        for(let data of jamData){
            console.log(data)
            let appfolder = getAppFolder()
            const appName = data.appName;
            const programName = data.programName
            const portNumber = data.portNumber
            if(
                (!fs.existsSync(`${appfolder}/${programName.split(".")[0]}_${appName}/${portNumber}/machType`)) 
            ){
                console.log("CAN'T PAUSE",`${appfolder}/${programName.split(".")[0]}_${appName}/${portNumber}. TRY LATER` )
            }
            if(fs.readFileSync(`${appfolder}/${programName.split(".")[0]}_${appName}/${portNumber}/processId`).toString().trim() === "new"){
                console.log("CAN'T PAUSE",`${appfolder}/${programName.split(".")[0]}_${appName}/${portNumber}. TRY LATER` )
            }
            pauseByPortNumber(programName,appName,portNumber)
            await pauseProcess(data);
        }
    }
    else{
        console.log("KILL,KILL")
        for(let data of jamData){
            console.log("I GET HERE")
            console.log(data)
            const appName = data.appName;
            const programName = data.programName
            const portNumber = data.portNumber
            await killProcess(data);
            cleanByPortNumber(programName,appName,portNumber)
        }
        
    }
    console.log("KILLING IS OVER, IT IS OVER INDEEDE")
    console.log("KILLING IS OVER")

}

async function jamKillBruteForce(){
    console.log("KILL RESER BRUTE FORCEAS")
    await $`pkill node`.nothrow().quiet();
    console.log("KILL RESER BRUTE FORCEAS")

    await $`pkill mosquitto`.nothrow().quiet();
    console.log("KILL RESER BRUTE FORCEAS")

    await $`pkill tmux`.nothrow().quiet();
    console.log("GOT HERE")
    await $`ps aux | grep redis-server | grep -v grep | awk '{print $2}' | xargs kill`.nothrow().quiet();
    console.log("GOT HERE")
    const jamfolder = getJamFolder();
    //should I remove the apps as well or that is not required
    if(fs.existsSync(`${jamfolder}/ports`))
        fs.rmSync(`${jamfolder}/ports`, { recursive: true, force: true })
    if(fs.existsSync(`${jamfolder}/apps`))
        fs.rmSync(`${jamfolder}/apps`, { recursive: true, force: true })
    if(fs.existsSync(`${jamfolder}/mqttpid`))
        fs.rmSync(`${jamfolder}/mqttpid`, { recursive: true, force: true })
            
}
async function executeScript(client, command){
    console.log("GOT HERE")
    // console.log(client)
    // console.log(command)
    return (await new Promise((resolve, reject) =>{
        client.exec(command, (err,stream) =>{
            console.log("got here")
            if (err) throw err;
            let result = ''
            stream.on("close", () => {
                resolve(result)
            })
            stream.on("data" , (data) =>{
                console.log(data.toString())
                if(data.includes("KILLING IS OVER"))
                    {
                        console.log(data.toString())
                        resolve(data.toString())
                    }

            })
        })
    }))
}

async function main(){
  console.log("gothere")
  let args;

  try{
    args = getKilltArgs(process.argv)
   
  }
  catch(error){
    console.log(error)
    if(error.type === "ShowUsage"){
        console.log(
    /**
     {name : "help", alias : "h", type: Boolean, defaultValue : false },
    {name : 'all', type: Boolean , defaultValue: false },
    {name : 'reset', type: Boolean , defaultValue: false },
    {name : 'app', type: Boolean , defaultValue: false },
    {name : 'program', type: Boolean , defaultValue: false },
    {name : 'dir', type: Boolean , defaultValue: false },
    {name : 'port', type: Boolean , defaultValue: false },
    {name: "portDir", type: Boolean, defaultValue: false },
    {name: "pause", type: Boolean, defaultValue: false },
    {name : 'name', alias : "n" , type: String , defaultValue: undefined },
     */
    `
    Kill running instances of the application.

    Usage: jamkill [--all|app_id|--help]

    jamkill
    kill the program started last among the currently running ones

    jamkill --help
    displays this help messages

    jamkill --all
    kills all running instances

    [--name && (--app=<appName> || --program=<jt2>(without ext)|| --dir=<jt2_shahin> || --port=<portNum> || --portDir<jt2_shahin/1883>)] 
    the --name is used to set the name and the other flags are used to mention what the name associates to

    [--pause] is used to pause the running program 

    [--reset] is the hard reset. it closes all the running nodes, mosquito,tmux,reddis and remove all the directories including ports and apps

    [--remote] is a flag to kill programs on remote machines as well if the program root is current machine

    `
        )
    }
    process.exit(1);
  }
  const jamfolder = getJamFolder();
  const appfolder = getAppFolder();
  if(fs.existsSync(`${jamfolder}/remote`) && args.remote && !args.root){
    console.log("GOT HERE !")
    const remotes = fs.readdirSync(`${jamfolder}/remote`)
    console.log(remotes)
    console.log("GOT HERE 2")
    console.log(args.pause, "IF IT IS PAUSED")

    for(let remote of remotes){
        console.log(host)
        console.log(port)
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
        console.log(toExecute)

        const command=`${pathExport} && ${changeDir} && ${toExecute}`
        await executeScript(client, command);
    }
  }
  if(args.flag === "reset"){
    if(args.root){
        throw new Error("DOES NOT HAVE THE PERMISSION TO RESET A REMOTE MACHINE")
    }
    console.log("kill reset")
    await jamKillBruteForce()
  }
  else if( !fs.existsSync(jamfolder) ){
    throw new Error('.jamruns folder missing. JAMScript tools not setup?')
  }
  else if( !fs.existsSync(appfolder) ){
    throw new Error('.jamruns/apps folder missing. JAMScript tools not setup?')
  }
  else{
    console.log("PRE KILL")
    console.log("flag", args.flag)
    console.log("name", args.name)
    console.log("root", args.root)
    await jamKill(args.flag , args.name, args.pause, args.root);
  }


  process.exit(0);
  
}


(async() => {
    console.log("SCRIPT STARTS")
    await main()

})()
