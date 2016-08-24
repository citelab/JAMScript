/*
The MIT License (MIT)
Copyright (c) 2016 Muthucumaru Maheswaran

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:
The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

#include "nvoid.h"

#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <assert.h>


// the nvoid_t structure has its own copy of the
// data. so the source "data" could be released by
// originating routine.
//
nvoid_t *nvoid_new(void *data, int len)
{    
    nvoid_t *nv = (nvoid_t *)calloc(1, sizeof(nvoid_t));
    assert(nv != NULL);
    void *dc = (void *)malloc(len);
    assert(dc != NULL);

    memcpy(dc, data, len);
    nv->data = dc;
    nv->len = len;

    return nv;
}


void nvoid_free(nvoid_t *n)
{
    free(n->data);
    free(n);
}


// Old structure is reused..
// Don't deallocate the old nvoid structure.. doing so will
// result in a segmentation fault!
//
nvoid_t *nvoid_append(nvoid_t *n, void *data, int len)
{
    void *nd = (void *)malloc(len + n->len);
    assert(nd != NULL);

    memcpy(nd, n->data, n->len);
    memcpy(nd + n->len, data, len);

    free(n->data);
    n->data = nd;
    n->len = len + n->len;

    return n;
}


// Creates a new nvoid object that has a concatenation of both
// objects
//
nvoid_t *nvoid_concat(nvoid_t *f, nvoid_t *s)
{
    nvoid_t *n = (nvoid_t *)calloc(1, sizeof(nvoid_t));
    assert(n != NULL);

    void *nd = (void *)malloc(f->len + s->len);
    memcpy(nd, f->data, f->len);
    memcpy(nd + f->len, s->data, s->len);

    n->data = nd;
    n->len = f->len + s->len;

    return n;
}

void nvoid_print(nvoid_t *n)
{
#define PRINT_WIDTH                             80
#define GROUP_WIDTH                             4

    int i;
    printf("\n");
    for (i = 0; i < n->len; i++)
    {
        if (i % PRINT_WIDTH == 0)
            printf("\n");
        if (i % GROUP_WIDTH == 0)
            printf(" ");

        printf("%x", *(int8_t *)&n->data[i]);
    }
    printf("\n");
}


void nvoid_print_ascii(nvoid_t *n)
{
    int i;
    printf("\n");
    for (i = 0; i < n->len; i++)
    {
        if (i % PRINT_WIDTH == 0)
            printf("\n");
        if (i % GROUP_WIDTH == 0)
            printf(" ");

        printf("%c", *(int8_t *)&n->data[i]);
    }
    printf("\n");
}
