#pragma once
#include "task.h"
#include "command.h"
#include "util.h"

void process_message(tboard_t* tboard, command_t* cmd);

void processor_init();