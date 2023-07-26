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

#ifndef __NVOID_H__
#define __NVOID_H__

#include <stdint.h>
#include <stdio.h>

typedef struct _nvoid_t {
    uint32_t cap;
    uint32_t len;
    uint8_t data[8];
} __attribute__ ((__aligned__ (8), __packed__)) nvoid_t;

nvoid_t* nvoid_new(uint32_t cap, uint8_t* data, uint32_t len);
nvoid_t* nvoid_empty(uint32_t cap);
nvoid_t* nvoid_dup(nvoid_t* src);

#define nvoid_free(n)  do {                     \
        free(n);                                \
    } while (0)

void* panic(const char* msg, ...);

#define NVOID_DEFINE_TYPE(NAME, TYPE, CAP) typedef struct {             \
        uint32_t cap;                                                   \
        uint32_t len;                                                   \
        union {                                                         \
            TYPE data[CAP];                                             \
            uint8_t pad[sizeof(TYPE) * CAP > 8 ? (sizeof(TYPE) * CAP - 1 | 7) + 1 : 8]; \
        } __attribute__ ((__packed__));                                 \
    } __attribute__ ((__aligned__ (8), __packed__)) NAME

#define NVOID_STATIC_PUSH(NVOID, TYPE, VALUE) ((void)(NVOID.len < NVOID.cap ? (NVOID.data[NVOID.len++] = VALUE) : *(TYPE*)panic("Attempted to push to nvoid " #NVOID " above capacity %u", NVOID.cap)))

#define NVOID_STATIC_POP(NVOID, TYPE) (NVOID.len > 0 ? NVOID.data[--NVOID.len] : *(TYPE*)panic("Attempted to pop from empty nvoid " #NVOID))

#define NVOID_STATIC_AT(NVOID, TYPE, INDEX) (*(INDEX < NVOID.len && INDEX > 0 ? &(NVOID.data[INDEX]) : (TYPE*)panic("Index out off bounds " #NVOID "[%u]", (unsigned int)INDEX)))

#endif
