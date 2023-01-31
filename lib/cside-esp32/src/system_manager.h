#ifndef __CORE_H__
#define __CORE_H__
#include <stdbool.h>

typedef struct _system_manager_t
{
    char* device_id;
    int   serial_num;
    int   default_mqtt_port;

    bool initialized;

} system_manager_t;

system_manager_t* system_manager_init();

void _system_manager_board_init(system_manager_t* system_manager);
void _system_manager_rtc_sync_ntp(system_manager_t* system_manager);
#endif