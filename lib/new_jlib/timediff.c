#include "timediff.h"

#include <limits.h>
#include <stdarg.h>
#include <stdio.h>
#include <time.h>
#define INT_SUBTRACT_RANGE_OVERFLOW(a, b, min, max) \
  ((b) < 0 ? (max) + (b) < (a) : (a) < (min) + (b))
#define EXPR_SIGNED(e) (_GL_INT_NEGATE_CONVERT(e, 1) < 0)
#define _GL_INT_CONVERT(e, v) ((1 ? 0 : (e)) + (v))
#define _GL_INT_NEGATE_CONVERT(e, v) ((1 ? 0 : (e)) - (v))
#define _GL_INT_MINIMUM(e) \
  (EXPR_SIGNED(e) ? ~_GL_SIGNED_INT_MAXIMUM(e) : _GL_INT_CONVERT(e, 0))
#define _GL_INT_MAXIMUM(e) \
  (EXPR_SIGNED(e) ? _GL_SIGNED_INT_MAXIMUM(e) : _GL_INT_NEGATE_CONVERT(e, 1))
#define _GL_SIGNED_INT_MAXIMUM(e) \
  (((_GL_INT_CONVERT(e, 1) << (TYPE_WIDTH(+(e)) - 2)) - 1) * 2 + 1)
#define _GL_SUBTRACT_OVERFLOW(a, b, min, max)              \
  ((min) < 0 ? INT_SUBTRACT_RANGE_OVERFLOW(a, b, min, max) \
   : (a) < 0 ? 1                                           \
   : (b) < 0 ? (a) - (b) <= (a)                            \
             : (a) < (b))
#define _GL_BINARY_OP_OVERFLOW(a, b, op_result_overflow)           \
  op_result_overflow(a, b, _GL_INT_MINIMUM(_GL_INT_CONVERT(a, b)), \
                     _GL_INT_MAXIMUM(_GL_INT_CONVERT(a, b)))
#define _GL_SUBTRACT_OVERFLOW(a, b, min, max)              \
  ((min) < 0 ? INT_SUBTRACT_RANGE_OVERFLOW(a, b, min, max) \
   : (a) < 0 ? 1                                           \
   : (b) < 0 ? (a) - (b) <= (a)                            \
             : (a) < (b))
#define INT_SUBTRACT_OVERFLOW(a, b) \
  _GL_BINARY_OP_OVERFLOW(a, b, _GL_SUBTRACT_OVERFLOW)
#define _GL_INT_NEGATE_CONVERT(e, v) ((1 ? 0 : (e)) - (v))
#define TYPE_SIGNED(t) (!((t)0 < (t)-1))
#define TYPE_WIDTH(t) (sizeof(t) * CHAR_BIT)
#define TYPE_MINIMUM(t) ((t)~TYPE_MAXIMUM(t))
#define TYPE_MAXIMUM(t) \
  ((t)(!TYPE_SIGNED(t) ? (t)-1 : ((((t)1 << (TYPE_WIDTH(t) - 2)) - 1) * 2 + 1)))

void PrintTimeWith(struct timespec tr, const char* format, ...) {
  printf("[%ld secs, %ld nanosecs]: ", tr.tv_sec, tr.tv_nsec);
  va_list args;
  va_start(args, format);
  vprintf(format, args);
  va_end(args);
}

struct timespec timespec_sub(struct timespec a, struct timespec b) {
  struct timespec r;
  time_t rs = a.tv_sec;
  time_t bs = b.tv_sec;
  int ns = a.tv_nsec - b.tv_nsec;
  int rns = ns;

  if (ns < 0) {
    rns = ns + 1000000000;
    if (rs == TYPE_MINIMUM(time_t)) {
      if (bs <= 0) goto low_overflow;
      bs--;
    } else
      rs--;
  }

  if (INT_SUBTRACT_OVERFLOW(rs, bs)) {
    if (rs < 0) {
    low_overflow:
      rs = TYPE_MINIMUM(time_t);
      rns = 0;
    } else {
      rs = TYPE_MAXIMUM(time_t);
      rns = 999999999;
    }
  } else
    rs -= bs;

  r.tv_sec = rs;
  r.tv_nsec = rns;
  return r;
}
