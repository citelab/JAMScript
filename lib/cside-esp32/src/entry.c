#include <stdio.h>
#include <jam_component_wrap.h>
#include <esp_task_wdt.h>
#include <multicast.h>
#include <processor.h>
#include <command.h>
#include <cnode.h>
#include <constants.h>
#include <stdlib.h>
#include <util.h>

void app_main(void)
{
    printf("ESP32 cside entry point.\n");

    TaskHandle_t handle;
    xTaskCreatePinnedToCore(jam_component_wrap_main, 
                            "Entry Task", 
                            STACK_SIZE*4, 
                            NULL, 
                            1,
                            &handle, 
                            1);

    printf("Should have started the task...\n");

    vTaskDelete(0);
}
