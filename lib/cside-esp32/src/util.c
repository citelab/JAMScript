#include "util.h"
#include <stdio.h>

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