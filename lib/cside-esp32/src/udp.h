#ifndef __UDP_H__
#define __UDP_H__

#include <stdbool.h>
#include <stdint.h>
#include "util.h"

typedef uint8_t mac_address_t[6];
typedef uint8_t org_code_t[3];
typedef uint16_t port_t;

typedef struct _udp_stack_context_t
{
    mac_address_t device_mac;
    mac_address_t access_point_mac;
    bool initialized;
} udp_stack_context_t;

typedef struct _ipv4_address_t
{
    uint8_t a1;
    uint8_t a2;
    uint8_t a3;
    uint8_t a4;
} __attribute__((packed)) ipv4_address_t ;

// This is just one possible configuration of an 80211 frame;

typedef struct _frame_80211_t
{
    uint8_t frame_type0;
    uint8_t frame_type1;
    uint16_t duration;
    mac_address_t address1;
    mac_address_t address2;
    mac_address_t address3;
    uint16_t sequence_control;
} __attribute__((packed)) frame_80211_t;

frame_80211_t frame_80211_udp_config(mac_address_t destination);

typedef struct _frame_llc_t
{
    uint8_t DSAP;
    uint8_t SSAP;
    uint8_t control_field;
    org_code_t org_code;
    uint16_t type;
} __attribute__((packed)) frame_llc_t;

frame_llc_t frame_llc_udp_config();

typedef struct _frame_ip_t
{
    uint8_t     version; // version + header
    uint8_t     diff_services_field;
    uint16_t    total_length;
    uint16_t    identification;
    uint16_t    flags_and_fragment_offset;
    uint8_t     time_to_live;
    uint8_t     protocol;
    uint16_t    header_checksum;
    ipv4_address_t source_address;
    ipv4_address_t destination_address;
} __attribute__((packed)) frame_ip_t;

frame_ip_t frame_ip_udp_config(ipv4_address_t destination_addr);

typedef struct _frame_udp_t
{
    port_t source_port;
    port_t destination_port;
    uint16_t length;
    uint16_t checksum;
} __attribute__((packed)) frame_udp_t;

typedef struct _udp_packet_t
{
    frame_80211_t   frame_80211;
    frame_llc_t     frame_llc;
    frame_ip_t      frame_ip;
    frame_udp_t     frame_udp;

} udp_packet_t;

void udp_init_stack();

uint32_t udp_packet_size(uint32_t buffer_size);

jam_error_t udp_packet_init(udp_packet_t* packet,
                              ipv4_address_t destination, 
                              port_t source_port, 
                              port_t destination_port, 
                              void* buffer, 
                              uint32_t buffer_size,
                              uint32_t* packet_size);

jam_error_t udp_packet_init_headers(udp_packet_t* packet,
                              ipv4_address_t destination, 
                              port_t source_port, 
                              port_t destination_port);

// Assumes buffer size is rounded up to factor of two
jam_error_t udp_packet_package(udp_packet_t* packet, uint32_t buffer_size);

#endif

