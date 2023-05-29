#include "cnode.h"
#include <stddef.h>
#include <stdlib.h>
#include <multicast.h>
#include <esp_wifi.h>
#include <lwip/err.h>
#include <lwip/sys.h>
#include <string.h>
#include "command.h"
#include <receiver.h>

// Statically defined
cnode_t _global_cnode;

#define TEMP_PORT 1000



// System initialization is done here
cnode_t* cnode_init(int argc, char** argv)
{
    cnode_t* cnode = &_global_cnode;
    memset(cnode, 0, sizeof(cnode_t));

    cnode->system_manager = system_manager_init();

    // JAMScript Network Scan should happen here.

    cnode->tboard = tboard_create();

    cnode->initialized = true;

    cnode->node_id = NULL;

    // Must happen post-core-init
    receiver_init();

    return cnode;
}

// Many of the cnode start/stop/destryo commands aren't necessary to use on the esp32 as we have our
// own boot phase before the user program executes.

// @Unimplemented TODO
void cnode_destroy(cnode_t* cnode)
{
    assert(cnode->initialized);
    return;
    // free(cnode->node_id);
    // tboard_destroy(cnode->tboard);
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

cnode_t* get_device_cnode()
{
    assert(_global_cnode.initialized == true);
    return &_global_cnode;
}

bool get_device_cnode_initialized()
{
    return _global_cnode.initialized;
}