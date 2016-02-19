#include <stdio.h>
#include <stdlib.h>
#include "files.h"


#define MEM_ALLOC_SIZE          32

int read_file_to_buffer(char *fname, char **gbuf, int *fsize)
{
    int maxsize, i = 0;
    char *buf = calloc(MEM_ALLOC_SIZE, sizeof(char));
    FILE *fp = fopen(fname, "r");
    maxsize = MEM_ALLOC_SIZE;
    if (fp == NULL) {
        printf("Unable to open file %s\n", fname);
        return -1;
    }

    while (!feof(fp)) {
        if (i >= maxsize) {
            buf = realloc(buf, (maxsize + MEM_ALLOC_SIZE) * sizeof(char));
            if (buf == NULL) {
                printf("Unable to reallocate memory\n");
                return -1;
            }
            maxsize += MEM_ALLOC_SIZE;
        }
        buf[i++] = fgetc(fp);
    }

    buf[i-1] = 0;
    *fsize = i - 1;
    *gbuf = buf;

    return 0;
}
