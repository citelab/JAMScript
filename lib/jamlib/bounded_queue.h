/*
 * based on the following:
 * SPSC Bounded Queue
 * Based on public domain C++ version by mstump[1]. Released under
 * the same license terms.
 *
 * [1]
 * https://github.com/mstump/queues/blob/master/include/spsc-bounded-queue.hpp
 */

#pragma once

#include <stdbool.h>
#include <stddef.h>

#define ALWAYS_INLINE inline __attribute__((always_inline))

static ALWAYS_INLINE size_t nextpow2(size_t number)
{
#if defined(HAVE_BUILTIN_CLZLL)
    static const int size_bits = (int)sizeof(number) * CHAR_BIT;

    if (sizeof(size_t) == sizeof(unsigned int)) {
        return (size_t)1 << (size_bits - __builtin_clz((unsigned int)number));
    } else if (sizeof(size_t) == sizeof(unsigned long)) {
        return (size_t)1 << (size_bits - __builtin_clzl((unsigned long)number));
    } else if (sizeof(size_t) == sizeof(unsigned long long)) {
        return (size_t)1 << (size_bits - __builtin_clzll((unsigned long long)number));
    } else {
        (void)size_bits;
    }
#endif

    number--;
    number |= number >> 1;
    number |= number >> 2;
    number |= number >> 4;
    number |= number >> 8;
    number |= number >> 16;

    return number + 1;
}

typedef struct bounded_queue_t {
    size_t size;
    size_t mask;
    int *buffer;
    char cache_line_pad0[64 - sizeof(size_t) + sizeof(size_t) + sizeof(void *)];

    size_t head;
    char cache_line_pad1[64 - sizeof(size_t)];

    size_t tail;
    char cache_line_pad2[64 - sizeof(size_t)];
} bounded_queue_t;

int bounded_queue_init(bounded_queue_t *q, size_t size);
void bounded_queue_free(bounded_queue_t *q);
bool bounded_queue_push(bounded_queue_t *q, int input);
bool bounded_queue_pop(bounded_queue_t *q, int *output);
