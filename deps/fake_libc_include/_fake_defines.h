#ifndef _FAKE_DEFINES_H
#define _FAKE_DEFINES_H

#define	NULL	0
#define	BUFSIZ		1024
#define	FOPEN_MAX	20
#define	FILENAME_MAX	1024

#ifndef SEEK_SET
#define	SEEK_SET	0	/* set file offset to offset */
#endif
#ifndef SEEK_CUR
#define	SEEK_CUR	1	/* set file offset to current plus offset */
#endif
#ifndef SEEK_END
#define	SEEK_END	2	/* set file offset to EOF plus offset */
#endif

#define __LITTLE_ENDIAN 1234
#define LITTLE_ENDIAN __LITTLE_ENDIAN
#define __BIG_ENDIAN 4321
#define BIG_ENDIAN __BIG_ENDIAN
#define __BYTE_ORDER __LITTLE_ENDIAN
#define BYTE_ORDER __BYTE_ORDER

#define EXIT_FAILURE 1
#define EXIT_SUCCESS 0


#define RAND_MAX 32767

/* limits.h */

#define CHAR_BIT 8
#define SCHAR_MIN -128
#define SCHAR_MAX 127
#define UCHAR_MAX 255
#define CHAR_MIN -128
#define CHAR_MAX 127
#define MB_LEN_MAX 6
#define SHRT_MIN -32768
#define SHRT_MAX 32767
#define USHRT_MAX 65535
#define INT_MIN -32768
#define INT_MAX 32767
#define UINT_MAX 4294967295U
#define LONG_MIN -2147483648
#define LONG_MAX 2147483647
#define ULONG_MAX 4294967295
#define LLONG_MIN -9223372036854775808
#define LLONG_MAX 9223372036854775807
#define ULLONG_MAX 18446744073709551615



/* C99 stdbool.h defines */
#define __bool_true_false_are_defined 1
#define false 0
#define true 1

/* va_arg macros and type*/
typedef int va_list;
#define va_start(_ap, _type) __builtin_va_start((_ap))
#define va_arg(_ap, _type) __builtin_va_arg((_ap))
#define va_end(_list)

#endif
