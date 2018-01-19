
# Utils used in the bash scripts

die() {
    printf '%s\n' "$1" >&2
    exit 1
}


# We use the global variable 'result' to pass parameter values back
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
        result=$value
        ((value++))
    else
        value=1
        result=1
    fi
    echo $value > $counter
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

# save value location
# with overwrite
save() {
    local value=$1
    local location=$2

    echo $value > $location
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

exit_missingfile() {
    local file=$1
    local emsg=$2

    if [ ! -e $file ]; then
        echo $emsg
        exit 0
    fi
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
