

killrouterpumba() {
    if [ -z $1]
        local pid=`ps axw | grep pumba | grep router | awk '{split($0,a, " "); print a[1]}'`
    else
        local pid=`ps axw | grep pumba | grep router | grep $1 | awk '{split($0,a, " "); print a[1]}'`
    fi
    if [ ! -z $pid ]; then
        kill $pid
    fi
}

startrouterpumba() {

    local routercmd=`cat $jamfolder/pumba/outfog_cmd`
    $routercmd $@ &
}

restartrouterpumba() {

    killrouterpumba $@
    startrouterpumba $@
}


killfogpumba() {

    if [ -z $1]
        local pid=`ps axw | grep pumba | grep fog | awk '{split($0,a, " "); print a[1]}'`
    else
        local pid=`ps axw | grep pumba | grep fog | grep $1 | awk '{split($0,a, " "); print a[1]}'`
    fi

    if [ ! -z $pid ]; then
        kill $pid
    fi
}

startfogpumba() {

    local fogcmd=`cat $jamfolder/pumba/infog_cmd`
    $fogcmd $@ &
}

restartfogpumba() {

    killfogpumba $@
    startfogpumba $@
}


killcloudpumba() {

    if [ -z $1]
        local pid=`ps axw | grep pumba | grep cloud | awk '{split($0,a, " "); print a[1]}'`
    else
        local pid=`ps axw | grep pumba | grep cloud | grep $1 | awk '{split($0,a, " "); print a[1]}'`
    fi

    if [ ! -z $pid ]; then
        kill $pid
    fi
}

startcloudpumba() {

    local cloudcmd=`cat $jamfolder/pumba/cloud_cmd`
    $cloudcmd $@ &
}

restartcloudpumba() {

    killcloudpumba $@
    startcloudpumba $@
}
