#include <stdlib.h>
#include <string.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdint.h>
#include <cbor.h>

#include "command.h"
#include "cborutils.h"
#include "free_list.h"

typedef struct encoded_obj{
	cbor_mutable_data data;
	size_t size;
}encoded_obj;

char* jamdata_encode(char *fmt, ...);