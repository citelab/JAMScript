#ifndef __JCOND_H__
#define __JCOND_H__

#include <mujs.h>
#include <stdbool.h>
#include <uthash.h>

typedef struct {
    const char *cond_name;
    const char *cond;
    UT_hash_handle hh;
} condition_t;


// In any case, we will read it into memory lazily when first needed ...
void print(js_State *J);

void jcond_init();
void jcond_eval_str(const char *s);
char *jcond_eval_str_str(const char *s);
int jcond_eval_bool(const char *s);
int jcond_eval_int(const char *s);
double jcond_eval_double(const char *s);
void jcond_free();
bool jcond_evaluate(const char *cnd);
void jcond_define(const char *label, const char *cstr);

#endif
