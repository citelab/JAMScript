#ifndef __JCOND_H__
#define __JCOND_H__

#include "duktape/duktape.h"
#include <stdlib.h>
#include "stdio.h"

// Here are the bit vector assignments for the conditional bit vector

#define JCOND_DEVICE_REQUESTED        0b00000000000000000000000000000001
#define JCOND_FOG_REQUESTED           0b00000000000000000000000000000010
#define JCOND_CLOUD_REQUESTED         0b00000000000000000000000000000100
#define JCOND_LEVEL_MASK              0b00000000000000000000000000000111

#define JCOND_SYNC_REQUESTED          0b00000000000000000000000000001000
#define JCOND_JDATA_COND              0b00000000000000000000000000010000


// In any case, we will read it into memory lazily when first needed ...

void jcond_init_duktape();
void jcond_eval_string(char *s);
int jcond_eval_bool(char *stmt);
int jcond_eval_int(char *stmt);
double jcond_eval_double(char *stmt);
void jcond_free_duktape(duk_context *ctx);


#endif
