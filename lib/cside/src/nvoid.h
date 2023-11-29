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
#include <stdarg.h>

typedef struct _nvoid_t {
    uint32_t len; // Number of elements currently in array
    uint32_t maxlen; // Maximum number of elements
    uint32_t size; // Actual size, in bytes, of element buffer
    uint16_t typesize; // Size of each element in buffer
    uint8_t typefmt; // Character code for type eg. 'i'
    uint8_t static_alloc; // Whether nvoid was created on stack or not
    uint8_t data[8];
} __attribute__ ((__aligned__ (8), __packed__)) nvoid_t;

nvoid_t* nvoid_new(uint32_t maxlen, uint8_t* data, uint32_t len);
void nvoid_init(nvoid_t* dst, uint32_t maxlen, char typefmt, uint8_t* data, uint32_t len);
nvoid_t* nvoid_empty(uint32_t maxlen, char typefmt);
nvoid_t* nvoid_dup(nvoid_t* src);
nvoid_t* nvoid_cpy(nvoid_t* dst, nvoid_t* src);
nvoid_t* nvoid_cpy_str(nvoid_t* dst, char* str);
nvoid_t* nvoid_min(nvoid_t* src);
nvoid_t* nvoid_str(char* str);
char* str_nvoid(nvoid_t* src);
void nvoid_free(nvoid_t* nv);

// We need a panic so we can bounds check array operations at runtime
// Its return type is a void* so we can use it in macros without type warnings
void* nvoid_panic(const char* msg, ...);

// Macros for dealing with statically allocated nvoids in user generated code

#define NVOID_ALIGNED_SIZE(TYPE, SIZE)                                  \
    (sizeof(TYPE) * SIZE > 8 ? (sizeof(TYPE) * SIZE - 1 | 7) + 1 : 8)

#define NVOID_DEFINE_TYPE(STRUCT_NAME, TYPE, SIZE)                      \
    struct STRUCT_NAME {                                                \
        uint32_t len;                                                   \
        uint32_t maxlen;                                                \
        uint32_t size;                                                  \
        uint16_t typesize;                                              \
        uint8_t typefmt;                                                \
        uint8_t static_alloc;                                           \
        union {                                                         \
            TYPE data[SIZE];                                            \
            uint8_t pad[NVOID_ALIGNED_SIZE(TYPE, SIZE)];                \
        } __attribute__ ((__packed__));                                 \
    } __attribute__ ((__aligned__ (8), __packed__))

#define NVOID_STATIC_INIT(NVOID, STRUCT_NAME, TYPE, TYPEFMT, MAXLEN, LEN, ...) \
    struct STRUCT_NAME NVOID = {                                        \
        .len = LEN,                                                     \
        .maxlen = MAXLEN,                                               \
        .size = NVOID_ALIGNED_SIZE(TYPE, MAXLEN),                       \
        .typesize = (uint16_t)sizeof(TYPE),                             \
        .typefmt = (uint8_t)TYPEFMT,                                    \
        .static_alloc = 1,                                              \
        .data = __VA_ARGS__                                             \
    }

#define NVOID_STATIC_INIT_EMPTY(NVOID, STRUCT_NAME, TYPE, TYPEFMT, MAXLEN) \
    struct STRUCT_NAME NVOID = {                                        \
        .len = 0,                                                       \
        .maxlen = MAXLEN,                                               \
        .size = NVOID_ALIGNED_SIZE(TYPE, MAXLEN),                       \
        .typesize = (uint16_t)sizeof(TYPE),                             \
        .typefmt = (uint8_t)TYPEFMT,                                    \
        .static_alloc = 1                                               \
    }

// Doing these with macros because it ensures they are typed correctly
#define NVOID_STATIC_PUSH(NVOID, TYPE, VALUE)                           \
    ((void)(NVOID.len < NVOID.maxlen ? (NVOID.data[NVOID.len++] = VALUE) : *(TYPE*)nvoid_panic("Attempted to push to nvoid " #NVOID " above maxlen %u\n", NVOID.maxlen)))

#define NVOID_STATIC_POP(NVOID, TYPE)                                   \
    (NVOID.len > 0 ? NVOID.data[--NVOID.len] : *(TYPE*)nvoid_panic("Attempted to pop from empty nvoid " #NVOID "\n"))

#define NVOID_STATIC_AT(NVOID, TYPE, INDEX)                             \
    (*(INDEX < NVOID.len && INDEX > 0 ? &(NVOID.data[INDEX]) : (TYPE*)nvoid_panic("Index out off bounds " #NVOID "[%u]\n", (unsigned int)INDEX)))

#endif
