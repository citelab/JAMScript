#pragma once
#define FUNC_LEN_MAX 32
#define FUNC_MAX_REG 32
#include <stddef.h>
#include "platformsync.h"

void RegisterFunctionByName(void (*func)(void), const char *name, size_t stackSize, struct timespec dur);
#define jamcFunctionRegister(func) RegisterFunction(func, #func)

void ForkFunctionTableToThread();
void (*GetFunctionByName(const char *name, size_t namelen))(void);
size_t GetStackSizeByName(const char *name, size_t namelen);
struct timespec GetDurationByName(const char *name, size_t namelen);