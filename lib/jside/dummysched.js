
const {
    workerData, BroadcastChannel
} = require('worker_threads');
const globals = require('utils/constants').globals;

initSched(workerData.port);

function initSched(parent)
{
    const schchannel = new BroadcastChannel(globals.ChannelName.APP_LIBRARY);
    parent.postMessage({cmd: "READY"});
    schchannel.onmessage = (ev)=> {
        schchannel.close();
    }
}
