
#ifndef __JAM_H__
#define __JAM_H__

#include "../src/cnode.h"
#include "../src/utilities.h"
#include "../src/command.h"
#include "../src/calls.h"
#include "../src/constants.h"
#include "../src/tboard.h"

#include "minicoro.h"
#include "utarray.h"
#include "uthash.h"

#define milestone_log(X)
#define jsleep(X)               sleep_task_create(cnode->tboard, X)
#define define_condition(X, Y, Z)

#endif