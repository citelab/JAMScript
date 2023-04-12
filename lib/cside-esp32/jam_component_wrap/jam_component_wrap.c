#include <stdio.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

extern int main(int argc, char** argv);
void jam_component_wrap_main(int argc, char** argv)
{
    main(argc, argv);

    vTaskDelete(0);
}