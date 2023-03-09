#ifndef __UTIL_H__
#define __UTIL_H__
#include <stdint.h>

#define JAM_OK 1
#define JAM_FAIL -1
#define JAM_MEMORY_ERR -2
typedef uint32_t jam_error_t;

#define ERR_PROP(x) {jam_error_t __temperr = x; if(__temperr!=JAM_OK) return __temperr;}


void dump_bufer_hex(uint8_t* buffer, uint32_t size);

#endif