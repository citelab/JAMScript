#include "task.h"

#include "constants.h"
#include "tboard.h"
#include "util.h"

// @Unimplemented
long int mysnowflake_id()
{
    static int counter = 0;
    counter            = (counter + 1) % 10000;
    long int x;
    struct timespec ts;
    // clock_gettime(CLOCK_MONOTONIC, &ts);
    // x = ts.tv_sec * 1000000000 +  ts.tv_nsec;

    // TODO: use time-dependent function here

    x = 1000;

    return x / 100 + counter;
}

void _debug_print_command_cbor(command_t* command)
{
    dump_bufer_hex(command->buffer, command->length);
}

// @Unimplemented
arg_t* task_get_args() { return calloc(1, sizeof(arg_t)); }

// @Unimplemented
arg_t* remote_task_start_sync(tboard_t* tboard, char* symbol, int32_t level,
                              char* arg_sig, arg_t* args, uint32_t size)
{
    printf("Task Start Remote Sync - called '%s'\n", symbol);

    command_t* command = command_new_using_arg(CmdNames_REXEC, 0, symbol,
                                               mysnowflake_id(),
                                               "temp_device_id", arg_sig, args);

    _debug_print_command_cbor(command);

    assert(0 && "Unimplemented");

    return calloc(1, sizeof(arg_t));
}

// @Unimplemented
arg_t* remote_task_start_async(tboard_t* tboard, char* symbol, int32_t level,
                               char* arg_sig, arg_t* args, uint32_t size)
{
    printf("Task Start Remote Async - called '%s'\n", symbol);

    command_t* command = command_new_using_arg(CmdNames_REXEC, 0, symbol,
                                               mysnowflake_id(),
                                               "temp_device_id", arg_sig, args);
	

    _debug_print_command_cbor(command);

    assert(0 && "Unimplemented");

    return calloc(1, sizeof(arg_t));
}
