#ifndef __CNODE_H__
#define __CNODE_H__

#include <stdbool.h>
#include "task.h"
#include "system_manager.h"
#include "multicast.h"
#include "util.h"

#define MAX_JNODES 8

typedef struct _jnode_record_t
{
    ipv4_address_t ip;
    port_t  port;
} jnode_record_t;

typedef struct _cnode_t 
{
    // contains args
    // server instance
    // core state
    tboard_t* tboard;
    system_manager_t* system_manager;

    char* node_id;

    multicast_t* discovery_multicast;

    jnode_record_t jnode_records[MAX_JNODES];

    bool initialized;
} cnode_t;

cnode_t*    cnode_init(int argc, char** argv);
void        cnode_destroy(cnode_t* cn);
bool        cnode_start(cnode_t* cn);
bool        cnode_stop(cnode_t* cn);

bool    get_device_cnode_initialized();
cnode_t* get_device_cnode();
void _cnode_scan_controllers(cnode_t* cn);

#endif