#include <stdio.h>
#include <jam_component_wrap.h>

/*
Interesting Idea:
- Could disable os tick on one core use that as primary executor
- On second core, could handle networking and second executor tasks

*/

void app_main(void)
{
    printf("ESP32 cside entry point.\n");

    jam_component_wrap_main(0, NULL);

    assert(0 && "JAMScript program exited");
    while(1) {}
}
