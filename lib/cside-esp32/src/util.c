#include "util.h"
#include <stdio.h>
#include "esp_heap_caps.h"
void mco_push(void*, void*, void*) {}
void* mco_running() {return 0;}

void dump_bufer_hex(uint8_t* buffer, uint32_t size)
{
    uint32_t* cast_buffer = (uint32_t*) buffer;
    
    printf("Dumping buffer (%ld bytes):\n", size);
    for(int row = 0; row < size/4; row++)
    {
        printf("%08lx\n", cast_buffer[row]);
    }

    for(int col = 0; col < size%4; col++)
    {
        printf("%1x", buffer[(size/4)*4+col]);
    }

    printf("\n");
}

void dump_heap_left()
{
    printf("Heap size left: %u\n\n", heap_caps_get_free_size(MALLOC_CAP_8BIT));
}