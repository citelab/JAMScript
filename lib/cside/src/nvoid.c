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


// the nvoid_t structure has its own copy of the
// data. so the source "data" could be released by
// originating routine.
//
nvoid_t* nvoid_new(uint32_t cap, uint8_t* data, uint32_t len) {
    nvoid_t* nv = nvoid_empty(cap);
    nv->len = len;
    if (data != NULL)
        memcpy(&nv->data, data, len);
    return nv;
}

nvoid_t* nvoid_empty(uint32_t cap) {
    uint32_t aligned_cap = cap > 8 ? (cap - 1 | 7) + 1 : 8;
    nvoid_t* nv = (nvoid_t*)aligned_alloc(8, aligned_cap + 8);
    assert(nv != NULL);
    nv->cap = cap;
    nv->len = 0;
    return nv;
}

nvoid_t* nvoid_dup(nvoid_t* src) {
    return nvoid_new(src->cap, src->data, src->len);
}

void* panic(const char* msg, ...) {
    va_list args;
    va_start(args, msg);
    vfprintf(stderr, msg, args);
    va_end(args);
    exit(1);
}
