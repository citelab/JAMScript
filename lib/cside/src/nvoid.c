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
    nvoid_t* nv = nvoid_empty(size, 'b');
    nv->len = len;
    if (data != NULL)
        memcpy(nv->data, data, len);
    return nv;
}

nvoid_t* nvoid_empty(uint32_t maxlen, char typefmt) {
    uint16_t typesize;
    switch (typefmt) {
    case 'c':
    case 'b':
        typesize = 1;
        break;
    case 'i':
    case 'u':
    case 'f':
        typesize = 4;
        break;
    case 'l':
    case 'z':
    case 'd':
        typesize = 8;
    }
    uint32_t size = maxlen * typesize;
    uint32_t aligned_size = size >= 8 ? (size | 7) + 1 : 8;
    nvoid_t* nv = (nvoid_t*)aligned_alloc(8, aligned_size + 16);
    assert(nv != NULL);
    nv->len = 0;
    nv->maxlen = maxlen;
    nv->size = aligned_size;
    nv->typesize = typesize;
    nv->typefmt = typefmt;
    return nv;
}

nvoid_t* nvoid_dup(nvoid_t* src) {
    nvoid_t* nv = (nvoid_t*)aligned_alloc(8, src->size + 16);
    assert(nv != NULL);
    memcpy(nv, src, src->len * src->typesize + 16);
    return nv;
}

nvoid_t* nvoid_cpy(nvoid_t* dst, nvoid_t* src) {
    dst->len = src->len * src->typesize / dst->typesize;
    assert(dst->len <= dst->maxlen);
    return (nvoid_t*)memcpy(dst->data, src->data, dst->len * dst->typesize);
}

nvoid_t* nvoid_cpy_str(nvoid_t* dst, char* str) {
    dst->len = strlen(str);
    assert(dst->len <= dst->maxlen);
    assert(dst->typesize == 1);
    return (nvoid_t*)memcpy(dst->data, str, dst->len + 1);
}

nvoid_t* nvoid_min(nvoid_t* src) {
    uint32_t bytelen = src->len * src->typesize;
    uint32_t aligned_size =  bytelen >= 8 ? (bytelen | 7) + 1 : 8;
    nvoid_t* nv = (nvoid_t*)aligned_alloc(8, aligned_size + 16);
    assert(nv != NULL);
    nv->size = aligned_size;
    nv->len =  nv->maxlen = src->len;
    nv->typesize = src->typesize;
    nv->typefmt = src->typefmt;
    memcpy(nv->data, src->data, bytelen);
    return nv;
}

nvoid_t* nvoid_str(char* str) {
    uint32_t bytelen = strlen(str);
    uint32_t aligned_size = bytelen >= 8 ? (bytelen | 7) + 1 : 8;
    nvoid_t* nv = (nvoid_t*)aligned_alloc(8, aligned_size + 16);
    assert(nv != NULL);
    nv->size = aligned_size;
    nv->len = nv->maxlen = bytelen;
    nv->typesize = 1;
    nv->typefmt = 'c';
    memcpy(nv->data, str, bytelen);
    return nv;
}

char* str_nvoid(nvoid_t* src) {
    assert(src->typesize == 1);
    char* str = malloc(src->len + 1);
    memcpy(str, src->data, src->len);
    str[src->len] = '\0';
    return str;
}

void nvoid_free(nvoid_t* nv) {
    free(nv);
}

void* nvoid_panic(const char* msg, ...) {
    va_list args;
    va_start(args, msg);
    vfprintf(stderr, msg, args);
    va_end(args);
    exit(1);
}
