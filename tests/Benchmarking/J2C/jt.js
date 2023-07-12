function doCall() {
  remoteCall().catch((e)=>{});
  setImmediate(doCall);
}

setImmediate(doCall);
