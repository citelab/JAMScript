
#ifndef __JAM_H__
#define __JAM_H__

#include "../cnode.h"
#include "../utilities.h"
#include "../command.h"
#include "../calls.h"
#include "../constants.h"
#include "../tboard.h"
#include "../jcond.h"
#include "../dpanel.h"

#include "minicoro.h"
#include "utarray.h"
#include "uthash.h"

#define milestone_log(X)
#define jsleep(X)               sleep_task_create(cnode->tboard, X)

#endif
