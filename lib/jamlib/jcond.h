#ifndef __JCOND_H__
#define __JCOND_H__

#include <mujs.h>

// Here are the bit vector assignments for the conditional bit vector

#define JCOND_DEVICE_REQUESTED        0b00000000000000000000000000000001
#define JCOND_FOG_REQUESTED           0b00000000000000000000000000000010
#define JCOND_CLOUD_REQUESTED         0b00000000000000000000000000000100
#define JCOND_LEVEL_MASK              0b00000000000000000000000000000111

#define JCOND_SYNC_REQUESTED          0b00000000000000000000000000001000
#define JCOND_JDATA_COND              0b00000000000000000000000000010000


// In any case, we will read it into memory lazily when first needed ...
void print(js_State *J);

void jcond_init();
void jcond_eval_str(char *s);
char *jcond_eval_str_str(char *s);
int jcond_eval_bool(char *s);
int jcond_eval_int(char *s);
double jcond_eval_double(char *s);
void jcond_free();

#endif
