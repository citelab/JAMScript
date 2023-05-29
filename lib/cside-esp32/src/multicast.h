#ifndef __MULTICAST_H__
#define __MULTICAST_H__
#include <sys/socket.h>
#include "udp.h"
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include "util.h"

// Using fixed sized multicast buffers for now
// Ideas: could do some crazy stuff with cached partially computed checksums?


/* ====================================================== */
/* ===================== IMPORTANT! ===================== */
/* ====================================================== */
// For now, there isn't any actual multicast implementation. This is somewhat like a unicast udp socket.
// The goal will be to add support of IGMP groups when necessary. The exposed interface should remain
// the same.. hopefully no refactoring.

typedef struct _multicast_t 
{
    uint32_t sent_packets;
    uint32_t packet_buffer_size;
    uint32_t occupied_packet_buffer_size;

    // Must be very careful about allignment here    
    bool ready_for_transmit;
    bool thread_safe;
    

    SemaphoreHandle_t buffer_access;

    udp_packet_t packet_template;
    
}__attribute__((packed))  multicast_t;


jam_error_t multicast_init(multicast_t* multicast, ipv4_address_t destination, port_t retport, port_t outgoing, uint32_t buffer_size);
multicast_t* multicast_create(ipv4_address_t destination, port_t retport, port_t outgoing, uint32_t buffer_size);

void multicast_make_threadsafe(multicast_t* multicast);

// copy send is thread safe
jam_error_t multicast_copy_send(multicast_t* multicast, void* buf, uint32_t buf_size);

// send is not thread safe
jam_error_t multicast_send(multicast_t* multicast, uint32_t buf_size);

// NOTE: Direct buffer modifications are not threadsafe!
void* multicast_get_packet_buffer(multicast_t* multicast, uint32_t* buffer_size);
void multicast_test();
void multicast_test2();

#endif