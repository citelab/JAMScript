jdata{
    int num as logger;
}

num.subscribe(function(key, entry , stream){
    console.log(entry.log, " from ", stream.key, " in ", JAMManager.getLevelCode());
});