

killrouterpumba() {

    if [ -z $1 ]; then
        local pid=`ps axw | grep pumba | grep router | awk '{split($0,a, " "); print a[1]}'`
    else
        local pid=`ps axw | grep pumba | grep router | grep $1 | awk '{split($0,a, " "); print a[1]}'`
    fi

    for p in $pid; do
        kill $p
    done
}

startrouterpumba() {

    if [ $pumbastatus == "on" ]; then
        local routercmd=`cat $jamfolder/pumba/outfog_cmd`
        $routercmd $@ &
    fi 
}

restartrouterpumba() {

    killrouterpumba $@
    startrouterpumba $@
}


killfogpumba() {

    if [ -z $1 ]; then
        local pid=`ps axw | grep pumba | grep fog | awk '{split($0,a, " "); print a[1]}'`
    else
        local pid=`ps axw | grep pumba | grep fog | grep $1 | awk '{split($0,a, " "); print a[1]}'`
    fi

    for p in $pid; do
        kill $p
    done
}

startfogpumba() {

    if [ $pumbastatus == "on" ]; then
        local fogcmd=`cat $jamfolder/pumba/infog_cmd`
        $fogcmd $@ &
    fi
}

restartfogpumba() {

    killfogpumba $@
    startfogpumba $@
}


killcloudpumba() {

    if [ -z $1 ]; then
        local pid=`ps axw | grep pumba | grep cloud | awk '{split($0,a, " "); print a[1]}'`
    else
        local pid=`ps axw | grep pumba | grep cloud | grep $1 | awk '{split($0,a, " "); print a[1]}'`
    fi

    if [ ! -z $pid ]; then
        kill $pid
    fi
}

startcloudpumba() {

    if [ $pumbastatus == "on" ]; then
        local cloudcmd=`cat $jamfolder/pumba/cloud_cmd`
        $cloudcmd $@ &
    fi
}

restartcloudpumba() {

    killcloudpumba $@
    startcloudpumba $@
}
