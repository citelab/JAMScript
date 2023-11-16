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

typedef struct _nvoid_refcount_t {
    unsigned refcount;
    nvoid_t* nv;
} nvoid_refcount_t;

nvoid_t* nvoid_new(uint32_t cap, uint8_t* data, uint32_t len);
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
#define NVOID_STATIC_PUSH(NVOID, VALUE)                                 \
    ({                                                                  \
        __auto_type __nv = (NVOID);                                     \
        if (__nv.len >= __nv.maxlen)                                    \
            nvoid_panic("Attempted to push to nvoid above maxlen %u\n", __nv.maxlen); \
        __nv.data[__nv.len++] = (VALUE);                                \
    })

#define NVOID_STATIC_POP(NVOID)                                         \
    ({                                                                  \
        __auto_type __nv = (NVOID);                                     \
        if (__nv.len <= 0)                                              \
            nvoid_panic("Attempted to pop from empty nvoid\n");         \
        __nv.data[--__nv.len];                                          \
    })


#define NVOID_STATIC_AT(NVOID, INDEX)                                   \
    (*({                                                                \
            __auto_type __nv = (NVOID);                                 \
            __auto_type __ind = (INDEX);                                \
            if (__ind >= __nv.len || __ind < 0)                         \
                nvoid_panic("Index out off bounds %u\n", (unsigned int)__ind); \
            &__nv.data[__ind];                                          \
        }))

#define NVOID_STATIC_LEN(NVOID)                 \
    ((size_t)(NVOID).len)

#define NVOID_STATIC_INSERT(NVOID, VALUE, INDEX)                        \
    ({                                                                  \
        __auto_type __nv = (NVOID);                                     \
        __auto_type __ind = (INDEX);                                    \
        if (__nv.len >= __nv.maxlen)                                    \
            nvoid_panic("Attempted to push to nvoid above maxlen %u\n", __nv.maxlen); \
        else if (__ind > __nv.len || __ind < 0)                         \
            nvoid_panic("Index out off bounds %u\n", (unsigned int)__ind); \
        memmove(&__nv.data[__ind + 1], &__nv.data[__ind], __nv.typesize * (__nv.len - __ind)); \
        __nv.data[__ind] = (VALUE);                                     \
    })

#define NVOID_STATIC_REMOVE(NVOID, INDEX)                               \
    ({                                                                  \
        __auto_type __nv = (NVOID);                                     \
        __auto_type __ind = (INDEX);                                    \
        if (__ind >= __nv.len || __ind < 0)                             \
            nvoid_panic("Index out off bounds %u\n", (unsigned int)__ind); \
        __auto_type __val = __nv.data[__ind];                           \
        memmove(&__nv.data[__ind], &__nv.data[__ind + 1], __nv.typesize * (__nv.len - __ind - 1)); \
        __val;                                                          \
    })

// dynamic macros
// the compiler needs to make sure that the NVOID is always an lval here
#define NVOID_DYNAMIC_PUSH(NVOID, VALUE)                            \
    ({                                                              \
        if ((NVOID)->len >= (NVOID)->maxlen)                        \
            (NVOID) = (typeof(NVOID))realloc((nvoid_t*)(NVOID));    \
        (NVOID)->data[(NVOID)->len++] = (VALUE);                    \
    })

#define NVOID_DYNAMIC_POP(NVOID)                                \
    ({                                                          \
        if ((NVOID)->len <= 0)                                  \
            nvoid_panic("Attempted to pop from empty nvoid\n"); \
        (NVOID)->data[--(NVOID)->len];                          \
    })


#define NVOID_DYNAMIC_AT(NVOID, INDEX)                                  \
    (*({                                                                \
            __auto_type __ind = (INDEX);                                \
            if (__ind >= (NVOID)->len || __ind < 0)                     \
                nvoid_panic("Index out off bounds %u\n", (unsigned int)__ind); \
            &(NVOID)->data[__ind];                                      \
        }))

#define NVOID_DYNAMIC_LEN(NVOID)                \
    ((size_t)(NVOID)->len)

#define NVOID_DYNAMIC_INSERT(NVOID, VALUE, INDEX)                       \
    ({                                                                  \
        __auto_type __ind = (INDEX);                                    \
        if (__ind > (NVOID)->len || __ind < 0)                          \
            nvoid_panic("Index out off bounds %u\n", (unsigned int)__ind); \
        else if ((NVOID)->len >= (NVOID)->maxlen)                       \
            (NVOID) = (typeof(NVOID))realloc((nvoid_t*)(NVOID));        \
        memmove(&(NVOID)->data[__ind + 1], &(NVOID)->data[__ind], (NVOID)->typesize * ((NVOID)->len - __ind)); \
        (NVOID)->data[__ind] = (VALUE);                                 \
    })

#define NVOID_DYNAMIC_REMOVE(NVOID, INDEX)                              \
    ({                                                                  \
        __auto_type NVOID = (NVOID);                                    \
        __auto_type __ind = (INDEX);                                    \
        if (__ind >= (NVOID)->len || __ind < 0)                         \
            nvoid_panic("Index out off bounds %u\n", (unsigned int)__ind); \
        __auto_type __val = (NVOID)->data[__ind];                       \
        memmove(&(NVOID)->data[__ind], &(NVOID)->data[__ind + 1], (NVOID)->typesize * ((NVOID)->len - __ind - 1)); \
        __val;                                                          \
    })

#endif
