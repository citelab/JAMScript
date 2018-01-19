

checkdocker() {

    local dockeravail=`which docker`
    if [ -z $dockeravail ]; then
        die "Docker not installed in this machine. Exiting!"
    fi
}
