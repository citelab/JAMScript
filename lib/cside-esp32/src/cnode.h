#ifndef __CNODE_H__
#define __CNODE_H__

#include <stdbool.h>
#include "task.h"
#include "system_manager.h"

typedef struct _cnode_t 
{
    // contains args
    // server instance
    // core state
    tboard_t* tboard;
    system_manager_t* system_manager;

    bool initialized;
} cnode_t;


cnode_t*    cnode_init(int argc, char** argv);
void        cnode_destroy(cnode_t* cn);
bool        cnode_start(cnode_t* cn);
bool        cnode_stop(cnode_t* cn);

void _cnode_scan_controllers(cnode_t* cn);

#endif