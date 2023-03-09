#ifndef __MULTICAST_H__
#define __MULTICAST_H__
#include <sys/socket.h>
#include "udp.h"
// Using fixed sized multicast buffers for now
// Ideas: could do some crazy stuff with cached partially computed checksums?

typedef struct _multicast_t 
{
    uint32_t sent_packets;
    uint32_t packet_buffer_size;
    uint32_t occupied_packet_buffer_size;
    
    bool ready_for_transmit;

    char PADDING_BC_ALIGNMENT_ISNT_WORKING;
    udp_packet_t packet_template;
    
}__attribute__((aligned (2)))  multicast_t;


jam_error_t multicast_init(multicast_t* multicast, ipv4_address_t destination, port_t outgoing, port_t incoming, uint32_t buffer_size);
multicast_t* multicast_create(ipv4_address_t destination, port_t outgoing, port_t incoming, uint32_t buffer_size);

jam_error_t multicast_copy_send(multicast_t* multicast, void* buf, uint32_t buf_size);
jam_error_t multicast_send(multicast_t* multicast);
void* multicast_get_packet_buffer(multicast_t* multicast, uint32_t* buffer_size);
void multicast_test();

#endif