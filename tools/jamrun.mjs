#!/usr/bin/env zx
import {jamrunParsArg , getCargs, getJargs, getRemoteArgs} from './parser.mjs'
import { fileURLToPath } from 'url';
import { cleanByPortNumber, pauseByPortNumber } from './cleanUp.mjs';
import { dirname, resolve } from 'path';
import {fileDirectorySetUp, isValidExecutable, fileDirectoryMqtt, getPaths, getappid, getFolder , cleanExecutables, getJamFolder, getFileNoext} from './fileDirectory.mjs'
const { spawn,spawnSync } = require('child_process');
import { Client } from 'ssh2';


let app, tmux, num, edge, data, local_registry, bg, NOVERBOSE, log, old, local, valgrind, long, lat, Type, tags, file, resume, port, remote, root;
const tmuxIds = [];
let removablePort

process.on('SIGINT', () => {
    if(removablePort){
        let toPause;
        try{
            toPause = fs.readFileSync(`${process.cwd()}/${removablePort}/paused`).toString().trim()
        }
        catch(error){
            toPause = "false"
        }
     
        if(toPause !== "false"){
            const fileNoext = getFileNoext(file);
            pauseByPortNumber(`${fileNoext}.jxe`,app,removablePort,NOVERBOSE)
            process.exit();

        }
        else{
            const fileNoext = getFileNoext(file);
            cleanByPortNumber(`${fileNoext}.jxe`,app,removablePort,NOVERBOSE); 
            process.exit();
        }
    }
    else{
        process.exit();
    }
});
process.on('SIGTERM', () =>  {
    if(removablePort){
        let toPause;
        try{
            toPause = fs.readFileSync(`${process.cwd()}/${removablePort}/paused`).toString().trim()
        }
        catch(error){
            toPause = "false"
        }
     
        if(toPause !== "false"){
            const fileNoext = getFileNoext(file);
            pauseByPortNumber(`${fileNoext}.jxe`,app,removablePort,NOVERBOSE)
            process.exit();

        }
        else{
            const fileNoext = getFileNoext(file);
            cleanByPortNumber(`${fileNoext}.jxe`,app,removablePort,NOVERBOSE); 
            process.exit();
        }
    }
    else{
        process.exit();
    }
    
        
});


const filePath = fileURLToPath(import.meta.url);
const IDIR = path.dirname(filePath);
const REDISFUNCS = fs.realpathSync(`${IDIR}/../deps/lua/jredlib.lua`);
const SHELLPID = process.pid;


const [MOSQUITTO, MOSQUITTO_PUB, TMUX] = await Promise.all(
    ["mosquitto","mosquitto_pub", "tmux"].map(
        async (entry)=> {
            try{
                const p = await $`which ${entry}`;
                return p.stdout.trim();
            }
            catch(error){
                switch(entry){
                    case "tmux":
                        throw new Error("tmux not installed. Quitting.")
                    case "mosquitto_pub":
                        throw new Error("mosquitto_pub (MQTT tools) not installed. Quitting.")
                    case "mosquitto":
                        throw new Error("mosquitto (MQTT broker) not installed. Quitting.")
                }
            }
        }
    )
)


async function executeScript(client, command){

    return (await new Promise((resolve, reject) =>{
        client.exec(command, (err,stream) =>{
            if (err){
                reject(err);
            } 
            let result;
            stream.on("close", () => {
                resolve(result)
            })
            stream.on("data" , async (data) =>{
                if(data.includes("MY PORT IS:"))
                    {
                        console.log(data.toString())
                        result = data.toString().trim().split(":")[1]
                    }  
                if(data.includes("EXIT BG")){
                    resolve(result)
                }  
            })
        })
    }))
}
//tested.working
function show_usage(){
    const usageMessage = 
    `
    jamrun program.jxe
    Runs J and C node, one each, of a device with program.jxe
    under a app name X, use the --app=X option. It is mandatory to set the app name.
    
    jamrun program.jxe --fog
    Runs a fog node (only J node) with program.jxe. Similarly, the --cloud
    flag runs a cloud node.
    
    By default, jamrun uses a Redis server running at 127.0.0.1:(20000+porttaken) as the
    data store. To use a different Redis server use the --data option.
    
    jamrun program.jxe --data=127.0.0.1:7000
    Runs program.jxe and connects it to an already running Redis server at
    port 7000 of the local host. Redis server can run outside the
    local host (Redis needs to the configured to accept outside
    connections).
    
    To start more than one C node at a device use the following command.
    jamrun program.jxe --num=4.
    
    To provide a set of tags to the program, use the following command.
    jamrun program.jxe --tag="param1, param2"
    
    Use the --bg option to run a command in the background. the --bg is mandatory for the cases
    that program is running on a remote machine.
    
    Use the --old option to run the previous version in .jamruns folder.
    You can edit that version and rerun a custom version of a file.
    
    Use the --log option to turn on logging. This is useful for programs where
    the C side is crashing at the startup. The tmux console would not run when
    the program crash at startup. So the --log option allows us to see the
    program error messages.
    
    Use the --verb option to turn on verbose messaging.
    
    Use --valgrind to run the cside with valgrind for leak checking.
    
    Use --local to disable multicast discovery of the J node. The C node assumes that the J node in the local loopback.
    
    Use --resume to resume the paused program. Using resume will dissable [--old | --data | --num | --fog|--cloud|--device ] flags.
    the program can be resumed only if it was pased before.
    --resume tag have to be used with --port tag to specify exactly which program shoukd be resumed.
    
    to start the c nodes and j files on a remote machine the --remote is used. 
    the value assinge to --remote is IP addrress of the remote machine to make the connection.

    by default the location assigned to a program has random long and lat values. to set a specific
    location for the progam the --loc is used.
    value passsed to the loc contains long and lat with a ',' seperator between them.


    Usage: jamrun file.jxe
                    [--app=appl_name]
                    [--fog|--cloud|--device]
                    [--num=num_c_devs]
                    [--data=data-url]
                    [--tags=quoted_list_of_tags]
                    [--bg]
                    [--old]
                    [--log]
                    [--verb]
                    [--loc=long,lat]
                    [--edge=num_edge_connections]
                    [--valgrind]
                    [--local]
                    [--resume && port=<portNumber>]
                    [--remote=<IPAdress>]
                    
                    

    
    The jamrun command creates a run state in the $HOME/.jamruns folder.
    `;
    return usageMessage;
    
}

//teste.working.
async function startmqtt(port, cFile){
    const jamfolder = getJamFolder()
    try{ 
        await $`${MOSQUITTO_PUB} -p ${port} -t "test" -m "hello"`.quiet();

    }
    catch(error){
        
        if(!NOVERBOSE){
            console.log(`MQTT is not running at ${port}\nAttempting to start MQTT at ${port}`);
        }
        const command = MOSQUITTO;
        const args = ['-c', cFile];
        const options = {
            stdio: ['ignore', 'ignore', 'ignore'],
            detached: true,
        };
        const mqttProcesse =  spawn(command, args, options);
        console.log(mqttProcesse.pid)
        fs.writeFileSync(`${jamfolder}/mqttpid/${port}`,`${mqttProcesse.pid}` )
        mqttProcesse.unref();
            
        return;
    }
}

async function dojamout(iport, folder,jappid) {
    await dojamout_p1 (iport ,folder)
    await dojamout_p2 (iport ,folder, jappid)
    
}

//tested.working
async function dojamout_p1(pnum ,floc) {
    await startmqtt(pnum , `${floc}/${pnum}/mqtt.conf`, data)
    if(data){
        fs.writeFileSync(`${floc}/${pnum}/dataStore`, `${data}\n`);
    }
    fs.writeFileSync(`${floc}/${pnum}/class`, "process\n");
    fs.writeFileSync(`${floc}/${pnum}/paused`, "false\n");
    fs.writeFileSync(`${floc}/${pnum}/shellpid`,SHELLPID.toString()+"\n" );
    fs.writeFileSync(`${floc}/${pnum}/processId`, "new"+"\n");
    if(Type === "device"){
        fs.writeFileSync(`${floc}/${pnum}/numCnodes`, `${num}`); 
    }
    if(root){
        fs.writeFileSync(`${floc}/${pnum}/root`, root)
    }
}


async function dojamout_p2(iport, folder, jappid, group=null){
    if(!bg){
        await dojamout_p2_fg(iport, folder,jappid, group)
    }
    else
    {
        dojamout_p2_bg(iport, folder,jappid, group)
    }
}

//tested, working
async function dojamout_p2_fg(pnum, floc,jappid, group=null){
    let argObject = {
        "--app":jappid,
        "--port":pnum,
        "--group":group,
        "--data":data,
        "--tags":tags,
        "--edge":edge,
        "--long":long,
        "--lat":lat,
        "--localregistryhost":local_registry,
        "--type": Type
    }

    let jargs = getJargs(argObject)
    const command = 'node';
    const args = ['jstart.js', ...jargs];

    if(resume){
        console.log("############## RESUME ##############")
    }
    if(log){
        const options = {
            cwd: floc,
            stdio: ['pipe', 'pipe', 'pipe']
        };
        const stream = fs.createWriteStream(`${floc}/${pnum}/log.j`, { flags: 'a' });
        const child = spawn(command, args, options);
        child.stdout.on('data', (data) => {
            process.stdout.write(data);
            stream.write(data);
        });

        child.stderr.on('data', (data) => {
            process.stderr.write(data);
            stream.write(data);
        });

        child.on('exit', () => {
            process.kill(process.pid, 'SIGTERM');
        });

    }else{
        const options = {
            cwd: floc,
            stdio: 'inherit'
        };
        const child = spawn(command, args, options);
        child.on('exit', () => {
            console.log("sending sig term")
            process.kill(process.pid, 'SIGTERM');
        });
    }


}


function dojamout_p2_bg(pnum, floc, jappid, group=null){
    let argObject = {
        "--app":jappid,
        "--port":pnum,
        "--group":group,
        "--data":data,
        "--tags":tags,
        "--edge":edge,
        "--long":long,
        "--lat":lat,
        "--localregistryhost":local_registry,
        "--type": Type
    }
    let jargs = getJargs(argObject)

    const logFile = fs.openSync(`${floc}/${pnum}/log.j`, 'a');
    if(resume){
        fs.writeFileSync(`${floc}/${pnum}/log.j`,"############## RESUME ##############")
    }
 
    const command = 'node';
    const args = ['jstart.js', ...jargs];
    const options = {
      cwd: floc,
      stdio: ['ignore', logFile, logFile],
      detached: true,
    };

    const p =  spawn(command, args, options);
    p.unref();

    if(!NOVERBOSE){
        console.log("Started the J node in background")
    }
    //keep this log file
    console.log("EXIT BG")
    process.exit(0)
}

async function doaout(num,port,group,datap,myf,jappid){
    let counter=1
    if (fs.existsSync('a.out')) {
        await $`cd ${myf} && chmod +x a.out`
    }
    while(counter <= num){
        
        if(fs.existsSync('a.out')){

            const argObject = 
            {
                "-a": jappid.toString(),
                "-p": port,
                "-n": counter,
                "-g": group,
                "-t": tags,
                "-o": datap,
            }
            let cargs = getCargs(argObject)
            console.log("this is my cargs",cargs )
            await $`${TMUX} new-session -s ${tmux}-${counter} -c ${myf} -d`;
            if (!log){

                    if(valgrind)
                            await $`${TMUX} send-keys -t ${tmux}-${counter} ${valgrind} ./a.out ${cargs} C-m`;
                        
                    else
                            await $`${TMUX} send-keys -t ${tmux}-${counter} ./a.out ${cargs} C-m`;
                    
                }

            else{      
                   if(valgrind)
                        await $`${TMUX} send-keys -t ${tmux}-${counter} ${valgrind} ./a.out ${cargs} -f log C-m`;
                    else
                        //TMUX DOES NOT WORK FOR DOCKER CONTAINER(SCRIPT IS THE ISSUE)
                        await $`${TMUX} send-keys -t ${tmux}-${counter} "script -a -t 1 ${myf}/${port}/log.${counter} ./a.out" ${cargs} C-m`;  
                }
            }
            tmuxIds.push(`${tmux}-${counter}`)
            counter++;
    }
        if(!NOVERBOSE)
            console.log("Started a C node")
    }


async function portavailable(folder,port) {
    let porttaken;
    const jamFolder = getJamFolder()
    if(fs.existsSync(`${folder}/${port}`)){
        porttaken=1
    }
    else{
        porttaken=0;
    }

    if(porttaken === 0){
        if(!fs.existsSync(`${jamFolder}/ports/${port}`)){
            const p = await $`netstat -lan -p tcp -f inet | grep ${port} | wc -l`.nothrow().quiet()
            porttaken = Number(p.stdout.trim()) === 0 ? 0 : 1;

        }
        else{
            const runningApps = fs.readFileSync(`${jamFolder}/ports/${port}`).toString().trim().split();
            const fileNoExt = getFileNoext(file)
            if(runningApps.includes(`${fileNoExt}_${app}`)){
                porttaken = 1;
            }
            else{
                porttaken = 0;
            }
        }
    }
    return porttaken;
}

function setuptmux(path, appfolder) {
    fs.writeFileSync(`${path}/tmuxid`,tmux.toString()+"\n");
    fs.writeFileSync(`${appfolder}/tmuxid`,tmux.toString()+"\n");

}


async function startredis(port) {
    try{
        const p = $`redis-server --port ${port}`.stdio('ignore', 'ignore', 'inherit').nothrow().quiet();
        console.log(p)
    }
    catch(error){
        console.log(error)
    }
}

async function waitforredis(port){
    while (true) {
        try{
            const p = await $`redis-cli -p ${port} -c PING`.quiet()
            if (p.stdout.trim() === "PONG") {
                break;
            }
        }
        catch(error){
            console.log(error)
        }
        if (!NOVERBOSE) {
          console.log("Trying to find Redis server...");
        }
        await sleep(1000)
      }
      
      if (!NOVERBOSE) {
        console.log(`Redis running at port: ${port}`);
      }
     
}


async function setupredis(port) {

    await $`cat ${REDISFUNCS} | redis-cli -p ${port} -x FUNCTION LOAD REPLACE > /dev/null`
    await $`echo "set protected-mode no" | redis-cli -p ${port} > /dev/null`
    await $`echo 'config set save "" protected-mode no' | redis-cli -p ${port} > /dev/null`
    //IMPORTANT: flushing redis
    //USE FLUSH DB TO ONLY FLUSH THE CURRENT DB FOR THE APP
    //DB NUMBER
    //FOR NOW KEEP AS IT IS
    if(!resume){
        await $`redis-cli -p ${port} FLUSHALL`;
    }

}

async function resolvedata(Name) {
    const [host, port] = Name.split(':');

    await startredis(Number(port));
    await waitforredis(port);
    await setupredis(port);
    data = Name.split(/\s+/).join('');


}

async function unpack(file,folder){
    if(!old){
        if(!fs.existsSync("./MANIFEST.txt")){
            try{
                await $`cd ${folder} && unzip -o ${file}`.quiet()
            }
            catch(error){
                throw new Error(`Problem reading file: ${file}\n${error}`)
            } 
                       
        }
        else{
            let forceRedo = false;
            try{
                isValidExecutable()
            }
            catch(error){
                forceRedo = true;
            }
            if(!forceRedo){
                const p1  = await $`cd ${folder} && zipgrep CREATE ${file} | awk 'NR==1{split($0,a, " "); print a[3]}'`;
                const p2 = await $`cd ${folder} && grep CREATE MANIFEST.txt | awk '{split($0,a, " "); print a[3]}'`;
                const ntime = Number(p1.stdout.toString().trim());
                const ontime = Number(p2.stdout.toString().trim());
                if(ntime > ontime){
                    try{
                        console.log("outdated, unzippping again")
                        await $`cd ${folder} && unzip -oq ${file}`.quiet()
                    }
                    catch(error){

                        throw new Error(`Problem reading file: ${file}\n${error}`)

                    } 
                }
            }
            else{
                if(!NOVERBOSE)
                    console.log("The corrupted unziped files. files will be unziped again based on the existing MANIFEST.txt")
                await cleanExecutables()
                await $`cd ${folder} && unzip -oq ${file}`.quiet()
            }
        }
    }
    else{
        if(!NOVERBOSE){
            console.log("WARNING: Unziped files might be outdated")
        }
        isValidExecutable()
    }
}

async function getjdata(folder) {
    const p = await $`cd ${folder} && grep JDATA MANIFEST.txt | awk '{split($0,a, " "); print a[3]}'`.nothrow().quiet()
    return p.stdout.trim()
}

async function runNoneDevice(iport){
    const [jamfolder,appfolder,folder] = getPaths(file,app)
    fileDirectoryMqtt(folder,iport,jamfolder,app)
    const jappid = getappid(jamfolder, `${folder}/${iport}`,app,appfolder)
    await dojamout(iport, folder, jappid)
}

async function runDevice(iport,dport,group){
    const [jamfolder,appfolder,folder] = getPaths(file,app)
    fileDirectoryMqtt(folder,iport,jamfolder,app)
    const jappid = getappid(jamfolder, `${folder}/${iport}` ,app,appfolder)
    await dojamout_p1(iport,folder)
    setuptmux(`${folder}/${iport}`, appfolder)
    await doaout(num,iport, group, dport,folder,jappid)
    await dojamout_p2(iport, folder,jappid,group )
}


async function main(){
    let iport;
    let dport;
    let group;
    try{    
        ({
            app,
            tmux,
            num,
            edge,
            data,
            local_registry,
            bg,
            NOVERBOSE,
            resume,
            log,
            old,
            local,
            valgrind,
            long,
            lat,
            Type,
            tags,
            port,
            file,
            remote,
            root,
        } = jamrunParsArg(process.argv))
    }
   
   
    catch(error){
            show_usage()
            throw(error)
    }
    let folder;
    let ifile;
    let jdata;
    let client;
    if(remote){
        const config = {
            host: remote,
            username: '',
          };    
        if(resume){
            const jamfolder = getJamFolder()
            const fileNoext = getFileNoext(file);
            if(!fs.existsSync(`${jamfolder}/remote`)){
                console.log(`this machine is not the root for any running app`);
                process.exit(0);
            }
            if(!fs.existsSync(`${jamfolder}/remote/${config.host}/${port}`)){
                console.log(`this machine is not the root for any running app on ${config.host}`);
                process.exit(0);
            }
            const remoteApps = fs.readFileSync(`${jamfolder}/remote/${config.host}/${port}`).toString().trim().split("\n")
            if(!remoteApps.includes(`${fileNoext}_${app}`)){
                console.log(`this machine is not the root for any running ${fileNoext}_${app}`);
                process.exit(0)
            }
        }
        client = await new Promise((resolve, reject) => {
            const client = new Client();

            client.on('ready', () => {
                resolve(client);
            });

            client.on('error', (error) => {
                reject(error);
            });

            client.connect(config);
        });
        const remoteArgs = getRemoteArgs(jamrunParsArg(process.argv))
        // const pathExport ="export PATH=$PATH:/home/admin/JAMScript/node_modules/.bin"
        const changeDir= "cd JAMScript/tools"
        let currIP ;
        if (os.platform() === 'win32') {
          currIP = (await $`powershell (Get-NetIPAddress -AddressFamily IPv4).IPAddress`.catch(() => '')).toString().trim();
        } else if (os.platform() === 'darwin') {
          currIP = (await $`ipconfig getifaddr en0`.catch(() => '')).toString().trim();
        } else if (os.platform() === 'linux') {
          currIP = (await $`hostname -I`.catch(() => '')).toString().trim();
        }
        const myPort = await executeScript(client, `${changeDir} && zx jamrun.mjs ${remoteArgs} --root=${currIP}`)

        if(!resume){
            const jamfolder = getJamFolder()
            const fileNoext = getFileNoext(file);
            if(!fs.existsSync(`${jamfolder}/remote`)){
                fs.mkdirSync(`${jamfolder}/remote`);
            }
            if(!fs.existsSync(`${jamfolder}/remote/${config.host}`)){
                fs.mkdirSync(`${jamfolder}/remote/${config.host}`);

            }
            if(fs.existsSync(`${jamfolder}/remote/${config.host}/${myPort}`)){
                const remoteApps = fs.readFileSync(`${jamfolder}/remote/${config.host}/${myPort}`).toString().trim().split("\n")
                if(!remoteApps.includes(`${fileNoext}_${app}`)){
                    console.log("NOT INCLUDEDE APPEND")
                    fs.appendFileSync(`${jamfolder}/remote/${config.host}/${myPort}`,`${fileNoext}_${app}\n`);
                }
            }
            else{
                console.log("FILE DONT EXISTS")
                fs.writeFileSync(`${jamfolder}/remote/${config.host}/${myPort}`,`${fileNoext}_${app}\n`)
            }   
        }
        process.exit(0)

    }


    if(resume){
        const fileNoExt = getFileNoext(file)
        if(!port)
            throw new Error("can't resume the app without port number")
       
        folder = getFolder(file,app);
        if(!fs.existsSync(folder)){
            throw new Error("NO PAUSED INSTANCE OF", `${fileNoExt}_${app}` )

        }
        if(!fs.existsSync(`${folder}/${port}`) || !fs.existsSync(`${folder}/${port}/paused`)){
            throw new Error("NO PAUSED INSTANCE OF", `${fileNoExt}_${app} on port: ${port}` )
        }
        else{
            const isPaused = (fs.readFileSync(`${folder}/${port}/paused`).toString().trim()) === "false" ? false : true;
            if(!isPaused){
                throw new Error("NO PAUSED INSTANCE OF", `${fileNoExt}_${app} on port: ${port}` )
            }

        }
        if(num, data, Type){
            console.log("WARNING: IN CASE OF RESUMING, WILL NOT USE ANY OF NUM, DATA, TYPE ARGUMENTS.")
        }
        try{
            Type = fs.readFileSync(`${folder}/${port}/machType`).toString().trim();
        }
        catch(error){
            throw new Error('type missing, corrupted program, it should be killed')
        }
        process.chdir(folder);
        isValidExecutable();
        jdata = await getjdata(folder);
    }
    else{
        if(port){
            console.log("Warning. If it's not to resume the port argument will not be used")
        }

        fileDirectorySetUp(file,app)
        folder = getFolder(file,app)
        ifile = path.resolve(file);
        process.chdir(folder);
        await unpack(ifile, folder)
        isValidExecutable()
        jdata = await getjdata(folder);
    }

    let isDevice;
    switch(Type){
        case "cloud":
            if(resume){
                iport = port;
                removablePort = port;
                isDevice = false;
            }
            else{
                iport=9883
                isDevice = false;

                while(true){
                    const porttaken = Number(await portavailable(folder ,iport))
                    if(porttaken !== 1){
                        break;
                    }
                    iport++;
                }
                removablePort = iport;
            }
            break;
            
        case "fog":
            if(resume){
                iport = port;
                removablePort = port;
                isDevice = false;
            }
            else{
                iport=5883
                isDevice = false
                while(true){

                    const porttaken = Number(await portavailable(folder ,iport))
                    if(porttaken !== 1){
                        break;
                    }
                    iport++;
                }
                removablePort = iport;
            }

            break;

        case "device":
            if(resume){
                iport = port;
                removablePort = port;
                isDevice = true;
            }
            else{
                iport=1883;
                isDevice = true;
                while(true){
                    const porttaken = Number(await portavailable(folder ,iport))
                    if(porttaken !== 1){
                        break;
                    }
                    iport++;
                }
                removablePort = iport;
            }
            if(!local){
                group= iport-1882
            }
            else
                group = 0; 
    }


    if(jdata.toLowerCase() === "true"){
        dport=iport + 20000;
        await resolvedata(`127.0.0.1:${dport}`)

    }
    
    if(!fs.existsSync(`${folder}/${iport}`,{ recursive: true })){
        fs.mkdirSync(`${folder}/${iport}`)
    }
    console.log(`MY PORT IS:${removablePort}`)
    if(isDevice)
        await runDevice(iport,dport,group)
        
    else
        await runNoneDevice(iport)
    }

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename);
const jamcleanPath = resolve(__dirname, 'jamclean.mjs');
await $`zx ${jamcleanPath}`
await main()


