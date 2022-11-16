
# Utils used in the bash scripts

die() {
    printf '%s\n' "$1" >&2
    exit 1
}


# We use the global variable 'result' to pass parameter values back
#

#
# Call like the following
# inc_counter counter_name
# the counter_name is a file location
#
inc_counter() {
    local counter=$1
    local value

    if [ -e $counter ]; then
        value=`cat $counter`
        ((value++))
        result=$value
    else
        value=1
        result=1
    fi
    echo $value > $counter
}

inc_counter_sync() {
    local counter=$1
    local value

    if [ -e $counter ]; then
        value=`cat $counter`
        ((value++))
        result=$value
    else
        value=1
        result=1
    fi
    echo $value > $counter
    sync
}


# set_counter 10 $jamfolder/global/count
set_counter() {
    local value=$1
    local counter=$2

    if [ ! -e $counter ]; then
        echo $value > $counter
    fi
}

set_counter_sync() {
    local value=$1
    local counter=$2

    if [ ! -e $counter ]; then
        echo $value > $counter
    fi
    sync
}



# dec_counter counter_name
#
dec_counter() {
    local counter=$1

    if [ ! -e $counter ]; then
        die "Trying to decrement a non-existent counter $counter"
    fi

    local value=`cat $counter`
    if [ ! -z $value ]; then
        ((value--))
        echo $value > $counter
    fi
    result=$value
}

dec_counter_sync() {
    local counter=$1

    if [ ! -e $counter ]; then
        die "Trying to decrement a non-existent counter $counter"
    fi

    local value=`cat $counter`
    if [ ! -z $value ]; then
        ((value--))
        echo $value > $counter
    fi
    result=$value
    sync
}

# save_no_overwrite value location
#
save_no_overwrite() {
    local value=$1
    local location=$2

    if [ ! -e $location ]; then
        echo $value > $location
    else
        local x=`cat $location`
        if [ -z $x ]; then
            echo $value > $location
        fi
    fi
}


save_no_overwrite_sync() {
    local value=$1
    local location=$2

    if [ ! -e $location ]; then
        echo $value > $location
    else
        local x=`cat $location`
        if [ -z $x ]; then
            echo $value > $location
        fi
    fi
    sync
}


# save value location
# with overwrite
save() {
    local value=$1
    local location=$2

    echo $value > $location
}


save_sync() {
    local value=$1
    local location=$2

    echo $value > $location
    sync
}


create_missingdir() {
    local dirn=$1

    if [ ! -e $dirn ]; then
        mkdir $dirn
    fi
}

exit_missingdir() {
    local dirn=$1
    local emsg=$2
    if [ ! -d $dirn ]; then
        echo $emsg
        exit 0
    fi
}

wait_missingdir() {
    local rootdir=$1
    local watchdir=$2

    if [ ! -d $watchdir ]; then
        while :; do
            inotifywait -e create -t 1 $rootdir
            if [ -d $watchdir ]; then break; fi
        done
    fi
}


exit_missingfile() {
    local file=$1
    local emsg=$2

    if [ ! -e $file ]; then
        echo $emsg
        exit 0
    fi
}

create_conffile() {
    local file=$1
    local contents=$2

    echo "#" | cat > $1
    echo "allow_anonymous true" | cat >> $1
    echo "#" | cat >> $1
    echo "listener  ${2}" | cat >> $1
}

check_prog() {
    local prog=$1
    local msg=$2

    local present=`which $prog`
    if [ -z $present ]; then
        echo $msg
        exit 0
    fi
}

# Check the Program
# If the program is not there.. check the alt.
# Print error and exit if the alt is missing as well
#
check_set_check_prog() {
    prog=$1
    local msg=$2
    altprog=$3

    local present=`which $prog`
    if [ -z $present ]; then
        prog=$altprog
        local present=`which $prog`
        if [ -z $present ]; then
            echo $msg
            exit 0
        fi
    fi
}

buildjargs() {
    local str=
    for x in $@; do
        str+=" "
        local xtail="${x##*=}"
        local xhead="${x%=*}"

        if [ ! -z $xtail ]; then
            str+=$x
        fi
    done

    str+=" --$type"

    results=$str
}

buildcargs() {
    local str=
    for x in $@; do
        str+=" "
        local xtail="${x##*=}"
        local xhead="${x%=*}"

        if [ ! -z $xtail ]; then
            str+="$xhead $xtail"
        fi
    done

    results=$str
}
