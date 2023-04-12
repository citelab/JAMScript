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

// NOTE: Args could be a little more memory efficient; TODO: Delete
void tests()
{
    cnode_t* device_cnode = get_device_cnode();
    command_t* test_command = {0};

    test_command = command_new(CmdNames_REXEC, 0, "test_func", 12, "goodnode", "");
    process_message(device_cnode->tboard, test_command);
    command_free(test_command);
    
    test_command = command_new(CmdNames_REXEC, 0, "test_func2", 12, "goodnode", "i", 2012);

    process_message(device_cnode->tboard, test_command);
    command_free(test_command);
    multicast_test2();

    // Test 3
    test_command = command_new(CmdNames_REXEC, 0, "compyou", 12, "goodnode", "s", "Secret special message!");

    ipv4_address_t addr;
    addr.a1 = 10;
    addr.a2 = 0;
    addr.a3 = 0;
    addr.a4 = 10;

    multicast_t* multicast = multicast_create(addr, Multicast_RECVPORT+1, Multicast_SENDPORT+1, test_command->length);
    multicast_copy_send(multicast, test_command->buffer, test_command->length);


    printf("Finished running tests...\n");
    while (1)
    {
        // Feed watchdog.
        vTaskDelay(10);
    }
    
}

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
