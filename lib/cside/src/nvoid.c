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

#include <string.h>
#include <stdlib.h>
#include <assert.h>
#include <stdio.h>

// the nvoid_t structure has its own copy of the
// data. so the source "data" could be released by
// originating routine.
nvoid_t* nvoid_new(uint32_t size, uint8_t* data, uint32_t len) {
    assert(len <= size);
    nvoid_t* nv = nvoid_empty(size);
    nv->len = len;
    if (data != NULL)
        memcpy(nv->data, data, len);
    return nv;
}

nvoid_t* nvoid_empty(uint32_t size) {
    uint32_t aligned_size = size > 8 ? (size - 1 | 7) + 1 : 8;
    nvoid_t* nv = (nvoid_t*)aligned_alloc(8, aligned_size + 16);
    assert(nv != NULL);
    nv->len = 0;
    nv->maxlen = size;
    nv->size = aligned_size;
    nv->typesize = 1;
    return nv;
}

nvoid_t* nvoid_dup(nvoid_t* src) {
    nvoid_t* nv = (nvoid_t*)aligned_alloc(8, src->size + 16);
    assert(nv != NULL);
    nv->len = src->len;
    nv->maxlen = src->maxlen;
    nv->size = src->size;
    nv->typesize = src->typesize;
    memcpy(nv->data, src->data, src->len);
    return nv;
}

nvoid_t* nvoid_min(nvoid_t* src) {
    nvoid_t* nv = (nvoid_t*)malloc(src->len + 16);
    assert(nv != NULL);
    nv->len = nv->size = nv->maxlen = src->len;
    nv->typesize = 1;
    memcpy(nv->data, src->data, src->len);
    return nv;
}

nvoid_t* nvoid_str(char* str) {
    uint32_t strlen = strlen(str);
    nvoid_t* nv = (nvoid_t*)malloc(strlen + 16);
    assert(nv != NULL);
    nv->len = nv->size = nv->maxlen = strlen;
    nv->typesize = 1;
    memcpy(nv->data, src->data, strlen);
    return nv;
}

void* nvoid_panic(const char* msg, ...) {
    va_list args;
    va_start(args, msg);
    vfprintf(stderr, msg, args);
    va_end(args);
    exit(1);
}
