#include <udp.h>
#include <stdlib.h>
#include <esp_wifi.h>

#include "esp_system.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "esp_timer.h"
#include "esp_task_wdt.h"
#include "lwip/err.h"
#include "lwip/sockets.h"
#include "lwip/sys.h"
#include "lwip/netdb.h"
#include "lwip/dns.h"
#include "system_manager.h"
#include "endian.h"

udp_stack_context_t _global_stack_context;


// Not the safest thing...
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Waddress-of-packed-member"


frame_80211_t frame_80211_udp_config(mac_address_t destination_addr)
{
    frame_80211_t frame_80211 = {0};
    frame_80211.frame_type0 = 0x08;
    frame_80211.frame_type1 = 0x01;

    memcpy(frame_80211.address3, destination_addr,  sizeof(mac_address_t));
    memcpy(frame_80211.address2, _global_stack_context.device_mac,   sizeof(mac_address_t));
    memcpy(frame_80211.address1, _global_stack_context.access_point_mac,       sizeof(mac_address_t));
    return frame_80211;
}

frame_llc_t frame_llc_udp_config()
{
    frame_llc_t frame_llc = {0};

    frame_llc.DSAP = 0xaa;
    frame_llc.SSAP = 0xaa;
    frame_llc.control_field = 0x03;
    frame_llc.type = bswap16(0x0800); // flipped from endianness

    return frame_llc;
}

inline void _accumulate(uint32_t* acc, uint16_t sumee)
{
    *acc += sumee;
    
    if(*acc > 0xffff)
        *acc -= 0xffff;
}

// NOTE: Likely possible to speed this up
void frame_ip_calculate_checksum(frame_ip_t* frame)
{
    // header is 20 bytes
    frame->header_checksum = 0;

    // Should make sure this loop gets unrolled.
    uint16_t* cast_frame = (uint16_t*)frame;
    uint32_t acc = 0xffff;
    for(int i = 0; i < 10; i++)
    {
        _accumulate(&acc, bswap16(cast_frame[i]));
        //printf("Checksum status %4x sum state: %4x checksum state: %4x\n", (uint16_t) bswap16(cast_frame[i]), (uint16_t) acc, (uint16_t)~(acc));
    }

    frame->header_checksum = ~bswap16((uint16_t)acc);
}

frame_ip_t frame_ip_udp_config(ipv4_address_t destination_addr)
{
    frame_ip_t frame_ip = {0};

    frame_ip.version = 0x45;

    frame_ip.identification = bswap16(0x0004); // flipped from endianness
    frame_ip.time_to_live = 0xff;
    frame_ip.protocol = 0x11; // UDP
    frame_ip.header_checksum = 0x00;

    frame_ip.destination_address = destination_addr;    
    memcpy(&frame_ip.source_address, &system_manager()->ip_info.ip, sizeof(uint32_t));

    return frame_ip;
}
void frame_udp_calculate_checksum(frame_udp_t* udp_frame, frame_ip_t* ip_frame, uint32_t full_udp_size)
{
    // header is 20 bytes
    udp_frame->checksum = 0;

    uint16_t* cast_frame = 0;
    uint32_t acc = 0xffff;

    // Pseudoheader
    cast_frame = (uint16_t*)&ip_frame->source_address;
    for(int i = 0; i < 4; i++)
    {
        _accumulate(&acc, bswap16(cast_frame[i]));  
    }
    _accumulate(&acc, bswap16(udp_frame->length));
    _accumulate(&acc, ip_frame->protocol);
    
    cast_frame = (uint16_t*)udp_frame;
    for(int i = 0; i < full_udp_size/2; i++)
    {
        _accumulate(&acc, bswap16(cast_frame[i]));
        //printf("Checksum status %4x sum state: %4x checksum state: %4x\n", (uint16_t) bswap16(cast_frame[i]), (uint16_t) acc, (uint16_t)~(acc));
    }

    udp_frame->checksum = ~bswap16((uint16_t)acc);
}

void udp_init_stack()
{
    udp_stack_context_t* stack_context = &_global_stack_context;
    esp_wifi_get_mac(WIFI_IF_STA, stack_context->device_mac);
    
    wifi_config_t config;
    esp_wifi_get_config(WIFI_IF_STA, &config);

    memcpy(stack_context->access_point_mac, config.sta.bssid, sizeof(mac_address_t));

    stack_context->initialized = true;
}

uint32_t udp_packet_size(uint32_t buffer_size)
{
    uint32_t raw_size = sizeof(udp_packet_t)+buffer_size;
    uint32_t padded_size = raw_size + (raw_size % 2);

    return padded_size;
}

jam_error_t udp_packet_init_headers(udp_packet_t* packet,
                              ipv4_address_t destination, 
                              port_t source_port, 
                              port_t destination_port)
{
    assert((intptr_t)packet % 2 == 0);
    packet->frame_80211     = frame_80211_udp_config(_global_stack_context.access_point_mac); 
    packet->frame_llc       = frame_llc_udp_config();
    packet->frame_ip        = frame_ip_udp_config(destination);
    
    packet->frame_udp = (frame_udp_t) { 0 };
    packet->frame_udp.source_port       = bswap16(source_port);
    packet->frame_udp.destination_port  = bswap16(destination_port);

    return JAM_OK;
}

jam_error_t udp_packet_init(udp_packet_t* packet,
                              ipv4_address_t destination, 
                              port_t source_port, 
                              port_t destination_port, 
                              void* buffer, 
                              uint32_t buffer_size,
                              uint32_t* packet_size)
{
    assert((uint32_t)packet % 2 == 0);
    uint32_t padded_size = udp_packet_size(buffer_size);

    packet->frame_80211     = frame_80211_udp_config(_global_stack_context.access_point_mac);
    packet->frame_llc       = frame_llc_udp_config();
    packet->frame_ip        = frame_ip_udp_config(destination);
    
    packet->frame_udp = (frame_udp_t) { 0 };
    packet->frame_udp.source_port       = bswap16(source_port);
    packet->frame_udp.destination_port  = bswap16(destination_port);
    packet->frame_udp.length = bswap16(sizeof(frame_udp_t) + buffer_size);
    packet->frame_ip.total_length = bswap16(sizeof(frame_ip_t) + sizeof(frame_udp_t) + buffer_size);

    frame_ip_calculate_checksum(&packet->frame_ip);

    memcpy(((uint8_t*)packet) + sizeof(udp_packet_t), buffer, buffer_size);

    // The +1 is for rounding up the size to the correct number of hextets
    frame_udp_calculate_checksum(&packet->frame_udp, &packet->frame_ip, sizeof(frame_udp_t) +buffer_size + 1); 
    if(packet_size!=NULL)
    {
        *packet_size = padded_size;
    }

    return JAM_OK;
}

jam_error_t udp_packet_package(udp_packet_t* packet, uint32_t raw_buffer_size)
{
    uint32_t buffer_size = raw_buffer_size + (raw_buffer_size%2);

    // This very confusing condition is here to zero any frame data not in the payload that will be in the
    // udp frame after payload is rounded to hextets.
    if(raw_buffer_size%2 == 1)
    {
        // very confusing looking line...
        *((uint8_t*)(&packet->frame_udp) + sizeof(frame_udp_t) + buffer_size - 1) = 0;
    }

    packet->frame_udp.length = bswap16(sizeof(frame_udp_t) + raw_buffer_size);
    packet->frame_ip.total_length = bswap16(sizeof(frame_ip_t) + sizeof(frame_udp_t) + buffer_size);

    frame_ip_calculate_checksum(&packet->frame_ip);
    frame_udp_calculate_checksum(&packet->frame_udp, &packet->frame_ip, sizeof(frame_udp_t) + buffer_size + 1);
    //frame_udp_calculate_checksum(&packet->frame_udp, &packet->frame_ip, buffer_size);
    return JAM_OK;
}

#pragma GCC diagnostic pop
