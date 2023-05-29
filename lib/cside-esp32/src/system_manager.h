#ifndef __SYSTEM_MANAGER_H__
#define __SYSTEM_MANAGER_H__
#include <stdbool.h>
#include "util.h"

#include <esp_event.h>
#include <esp_netif_types.h>

typedef struct _system_manager_t
{
    char* device_id;
    int   serial_num;
    int   default_mqtt_port;

    volatile bool wifi_connection;

    esp_netif_ip_info_t ip_info;

    uint16_t _connection_attempts;
    esp_event_handler_instance_t wifi_any_event_handle;
    esp_event_handler_instance_t got_ip_event_handle;

} system_manager_t;

system_manager_t* system_manager_init();

system_manager_t* system_manager();

void _system_manager_board_init(system_manager_t* system_manager);
void _system_manager_net_init(system_manager_t* system_manager);    
void _system_manager_rtc_sync_ntp(system_manager_t* system_manager);

#endif