#include <stdio.h>
#include <jam_component_wrap.h>
#include <esp_task_wdt.h>

#include <processor.h>
#include <command.h>
#include <cnode.h>
/*
Interesting Idea:
- Could disable os tick on one core use that as primary executor
- On second core, could handle networking and second executor tasks
- for those second executor tasks, Could instead assign to either core 1 or core 0 depending on CPU load.
*/

void tests()
{
    cnode_t* device_cnode = get_device_cnode();
    command_t test_command = {0};

    char* func_name = "test_func";
    test_command.cmd = CmdNames_REXEC;

    memcpy(test_command.fn_name, func_name, strlen(func_name));
    test_command.args = NULL;

    process_message(device_cnode->tboard, &test_command);




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

    jam_component_wrap_main(0, NULL);

    tests();

    assert(0 && "JAMScript program exited");
    while(1) {}
}
