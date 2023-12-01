#ifndef __JAM_H__
#define __JAM_H__

#include <stdint.h>

#include "../src/cnode.h"
#include "../src/utilities.h"
#include "../src/command.h"
#include "../src/calls.h"
#include "../src/constants.h"
#include "../src/tboard.h"
#include "../src/jcond.h"
#include "../src/dpanel.h"
#include "../src/nvoid.h"

#include "minicoro.h"
#include "utarray.h"
#include "uthash.h"

#define __jname__jsys__sleep(X)                 sleep_task_create(cnode->tboard, X)
#define __jname__jsys__yield()                  task_yield()
#define __jname__jsys__id                       get_id(cnode)
#define __jname__jsys__serial                   get_serial(cnode)
#define __jname__jsys__dontyield()            ((void)0)

#endif
