#include "cnode.h"
#include <stddef.h>
#include <stdlib.h>
#include <multicast.h>
#include <esp_wifi.h>
#include <lwip/err.h>
#include <lwip/sys.h>
#include "command.h"

// Statically defined
cnode_t _global_cnode;



// System initialization is done here
cnode_t* cnode_init(int argc, char** argv)
{
    cnode_t* cnode = &_global_cnode;
    memset(cnode, 0, sizeof(cnode_t));

    cnode->system_manager = system_manager_init();

    _cnode_scan_controllers(cnode);

    cnode->tboard = tboard_create();

    cnode->initialized = true;
    return cnode;
}

void _cnode_scan_controllers(cnode_t* cnode)
{
    const uint32_t buffer_size = 32;

    if(cnode->discovery_multicast==NULL)
    {
        ipv4_address_t igmp_group = {0};
        uint16_t incoming_port = 0, outgoing_port = 0;

        cnode->discovery_multicast = multicast_create(igmp_group, outgoing_port, incoming_port, buffer_size);
    }


    // This is not in spec!!!
    command_t *smsg = command_new(CmdNames_WHERE_IS_CTRL, 0, "", 0, "", "si", "127.0.0.1", port);
    assert(buffer_size >= smsg->length);
    
    void* internal_buf = multicast_get_packet_buffer(cnode->discovery_multicast, NULL);
    memcpy(internal_buf, smsg->buffer, smsg->length);

    multicast_send(cnode->discovery_multicast);

    //TODO: handle received
    jnode_record_t new_record;
    for(int i = 0; i < MAX_JNODES; i++)
    {
        if(cnode->jnode_records[i]==0)
            cnode->jnode_records[i] = new_record;
    }
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

cnode_t* get_device_cnode()
{
    assert(_global_cnode.initialized == true);
    return &_global_cnode;
}
