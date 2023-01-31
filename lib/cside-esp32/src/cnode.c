#include "cnode.h"
#include <stddef.h>
#include <stdlib.h>

#include <esp_wifi.h>
#include <lwip/err.h>
#include <lwip/sys.h>

// Statically defined
cnode_t _global_cnode;

// System initialization is done here
cnode_t* cnode_init(int argc, char** argv)
{
    cnode_t* cnode = &_global_cnode;
    memeset(cnode, 0, sizeof(cnode_t));

    cnode->system_manager = system_manager_init();

    _cnode_scan_controllers(cnode);

    cnode->tboard = tboard_create();

    cnode->initialized = true;
    return cnode;
}

void _cnode_scan_controllers(cnode_t* cn)
{
    (void) cn;
}

void cnode_destroy(cnode_t* cn)
{
    assert(cn->initialized);
    tboard_destroy(cn->tboard);
}

// @Unimplemented
bool cnode_start(cnode_t* cn)
{
    assert(cn->initialized);
    // Nothing for now

    return true;
}


// @Unimplemented
bool cnode_stop(cnode_t* cn)
{
    assert(cn->initialized);
    // Nothing for now

    return true;
}
