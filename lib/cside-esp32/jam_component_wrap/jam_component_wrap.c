#include <stdio.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

extern int main(int argc, char** argv);
void jam_component_wrap_main(void*)
{
    int argc = 0;
    char** argv = NULL;
    
    main(argc, argv);

    vTaskDelete(0);
}