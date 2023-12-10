
var result = 0;

async function getloop() {
    let x;
    while(true) {
      await (remoteCall().catch((e)=>{}));
//      for(var i = 0; i < 10000; i++) {
//	result += i
//      }
    }
}

await getloop();

thing();

console.log(result2);

